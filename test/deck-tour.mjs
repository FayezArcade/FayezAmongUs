import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdir} from 'node:fs/promises';
import {setTimeout as wait} from 'node:timers/promises';
import {chromium} from 'playwright-core';
import {deck,doors,dist,walkable} from '../shared/deck.js';
import {createGameServer} from '../server/index.js';
import {deckWaypoints} from './deck-route.mjs';

const before=process.argv.includes('--before');
const directory=process.env.FAYEZ_SCREENSHOTS||'test-results/deck-tour';
await mkdir(directory,{recursive:true});
let offset=0, browser, state;
const {server,close}=createGameServer({now:()=>Date.now()+offset,serve:true});
server.listen(0,'127.0.0.1');
await once(server,'listening');
try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
  const page=await browser.newPage({viewport:{width:1365,height:835},reducedMotion:'reduce'});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('websocket',ws=>ws.on('framereceived',({payload})=>{
    if(typeof payload==='string'&&payload.startsWith('42')){
      const [type,value]=JSON.parse(payload.slice(2));if(type==='state')state=value;
    }
  }));
  const button=name=>page.getByRole('button',{name,exact:true}).first();
  async function until(predicate,message){
    const deadline=Date.now()+7500;
    while(Date.now()<deadline){if(state&&predicate(state))return;await wait(32);}
    assert.fail(message+' near '+JSON.stringify(state?.self&&{x:state.self.x,y:state.self.y}));
  }
  const shot=name=>page.screenshot({path:directory+'/'+name+'.png'});
  async function walk(point){
    for(const target of deckWaypoints(state.self,point)){
      for(const [axis,negative,positive] of [['x','a','d'],['y','w','s']]){
        const delta=target[axis]-state.self[axis];
        if(Math.abs(delta)<7)continue;
        const key=delta<0?negative:positive;
        const reached=s=>delta<0?s.self[axis]<=target[axis]+5:s.self[axis]>=target[axis]-5;
        await page.keyboard.down(key);
        try{await until(reached,'Walk to '+target.x+', '+target.y);}
        finally{await page.keyboard.up(key);}
        await until(s=>!s.positions.find(p=>p.id===s.self.id)?.moving,'Stop');
      }
    }
    assert.ok(dist(state.self,point)<20,'Reached target '+JSON.stringify(point));
    assert.ok(walkable(state.self.x,state.self.y,false),'Player occupies walkable floor');
  }

  await page.goto('http://127.0.0.1:'+server.address().port);
  await button('CREATE ROOM').click();
  await page.getByLabel('Nickname').fill('Nova');
  await button('Create room').click();
  await button('Settings').click();
  await page.getByLabel('Walk speed').fill('240');
  await button('Save settings').click();
  await button('START').click();
  await until(s=>s.phase==='countdown','Launch');
  offset+=3130;await until(s=>s.phase==='reveal','Reveal');
  offset+=3500;await until(s=>s.phase==='play'&&s.solo,'Board ship');
  const overview=async()=>{
    await button('Test controls').click();
    await button('Deck overview').click();
    await shot('physical');
    await page.keyboard.press('Escape');
    await button('Map').click();
    await shot('blue');
    await page.keyboard.press('Escape');
  };
  await overview();
  if(!before){
    const viewpoints=[['cafe',0,8],['weapons',-20,51],['oxygen',-16,57],['nav',-35,49],['shields',-14,57],
      ['comms',-17,50],['storage',0,0],['admin',-46,52],['electrical',34,65],['lower',34,53],
      ['reactor',32,56],['security',-39,49],['upper',50,50],['med',-16,42]];
    for(const [id,dx,dy] of viewpoints){
      const room=deck[id];
      if(id==='electrical'){
        const entry=doors.find(d=>d.room===id);
        await walk({x:entry.x,y:entry.y+37});await shot('narrow-hall');
      }
      await walk({x:room.x+dx,y:room.y+dy});
      await page.locator('#current-room').filter({hasText:room.name}).waitFor({timeout:3000});
      await shot(id);
      console.log('Walked into '+room.name);
      if(id==='cafe'){
        const door=doors.find(d=>d.label==='Cafeteria · east hall');
        const hall={x:door.x+58,y:door.y};
        await walk(hall);await shot('open-shutter');
        await button('Test controls').click();
        await button('Sabotage').click();
        await page.getByLabel('Bulkhead').selectOption(String(door.id));
        await button('Seal bulkhead').click();
        await until(s=>s.doors.includes(door.id),'Shutter seals');
        await shot('closed-shutter');
        offset+=9800;await until(s=>!s.doors.includes(door.id),'Shutter opens');
      }
    }
  }
  assert.deepEqual(errors,[]);
}finally{
  await browser?.close();
  await close();
}
