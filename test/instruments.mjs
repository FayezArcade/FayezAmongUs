import assert from 'node:assert/strict';
import {readFile, mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright-core';
import {tasks} from '../shared/deck.js';
import {puzzle,publicPuzzle,stepPuzzle} from '../server/puzzles.js';

// Exercise each instrument's real browser controls against its server validator.
const directory=process.env.FAYEZ_SCREENSHOTS||'test-results/instruments';
await mkdir(directory,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
try{
  const page=await browser.newPage({viewport:{width:900,height:710}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('http://instruments.local/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/'){
      await route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8">
        <link rel="stylesheet" href="/client/style.css"><link rel="stylesheet" href="/client/flight.css">
        <div id="overlay"><div class="scrim"><section class="panel instrument"><h2></h2><div id="instrument"></div></section></div></div>
        <script type="module">
          import {taskPanel} from '/client/tasks.js';
          let panel, now;
          window.openInstrument=({title,state,time})=>{
            document.querySelector('h2').textContent=title;
            const holder=document.createElement('div');
            holder.id='instrument';
            document.querySelector('#instrument').replaceWith(holder);
            now=time;
            panel=taskPanel(holder,state,()=>now,window.step);
          };
          window.advanceInstrument=({state,time})=>{now=time;panel.update(state,now);};
        </script>`});
      return;
    }
    const contentType=path.endsWith('.css')?'text/css':'text/javascript';
    await route.fulfill({contentType,body:await readFile(new URL('..'+path,import.meta.url))});
  });
  let active,now,done;
  await page.exposeFunction('step',action=>{
    const reply=stepPuzzle(active,action,now);
    done||=reply.done===true;
    return {ok:true,...reply,puzzle:publicPuzzle(active,now)};
  });
  await page.goto('http://instruments.local/');
  await page.waitForFunction(()=>Boolean(window.openInstrument));
  const button=(action,value)=>page.locator(`[data-key="${action}"]${value===undefined?'':`[data-value="${value}"]`}`);
  const press=(action,value)=>button(action,value).click();
  const advance=async time=>{
    now=time;
    await page.evaluate(data=>window.advanceInstrument(data),{time,state:publicPuzzle(active,time)});
  };
  const setAxis=async (selector,value)=>{
    const axis=page.locator(selector);
    await axis.fill(String(value));
  };
  const representatives=new Map(tasks.map(t=>[t.instrument,t]));
  for(const task of representatives.values()){
    const stages=['data','route','fuel'].includes(task.instrument)?[0,1]:[0];
    for(const stage of stages){
      const id=task.instrument;
      now=10000;done=false;active=puzzle(task.id,stage,now,id);
      await page.evaluate(data=>window.openInstrument(data),{
        title:task.label,state:publicPuzzle(active,now),time:now
      });
      await page.locator('.hardware').screenshot({path:join(directory,id+'-'+stage+'.png')});
      if(id==='wire'){
        for(const color of active.left){await press('left',color);await press('right',color);}
      }else if(id==='card'){
        const badge=page.locator('#badge');
        await badge.press('Enter');await advance(now+600);await badge.press('Enter');
      }else if(id==='sequence'){
        for(const value of active.sequence)await press('key',value);
      }else if(id==='reactor'){
        for(let level=1;level<=5;level++){
          assert.equal(await page.locator('.relay-display .live').count(),1);
          await advance(active.reveal);
          for(const value of active.sequence.slice(0,level))await press('key',value);
        }
      }else if(id==='chart'){
        for(let i=0;i<active.waypoints.length;i++)await press('waypoint',i);
      }else if(id==='sample'){
        await press('beginSample');await advance(active.ready);
        await press('sample',active.odd);
      }else if(id==='target'){
        for(let frame=0;frame<3;frame++){
          await advance(active.start+active.period*frame);
          await press('target',(active.lane+2*frame)%5);
        }
      }else if(id==='route'&&stage===1){
        await press('accept');
      }else if(id==='nav'||id==='route'||id==='align'){
        await setAxis('#axis',active.target);
        if(id==='nav')await setAxis('#axis-y',active.targetY);
        await press('axes');
      }else if(id==='shield'){
        for(const [i,on] of active.active.entries())if(!on)await press('toggle',i);
      }else if(id==='calibrate'){
        for(let turn=1;turn<=3;turn++){
          await advance(active.start+Math.round(.48*active.period)-active.offset+active.period*turn);
          await press('capture');
        }
      }else if(id==='clean'||id==='filter'){
        for(const i of active.debris)await press('clear',i);
      }else if(id==='data'){
        await press('begin');
        await advance(now+2800);
      }else{
        const handle=page.locator('#hold-control');
        await handle.press('Enter');await advance(now+1500);await handle.press('Enter');
      }
      assert.ok(done,`${id} stage ${stage} completes through its browser controls`);
    }
  }
  assert.deepEqual(errors,[]);
  console.log(`Checked all ${representatives.size} instrument families in Chromium, with both treatments for data, power and fuel.`);
}finally{
  await browser.close();
}
