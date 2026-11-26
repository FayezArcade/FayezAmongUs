import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdir} from 'node:fs/promises';
import {setTimeout as wait} from 'node:timers/promises';
import {chromium} from 'playwright-core';
import {createGameServer} from '../server/index.js';
import {deck,dist} from '../shared/deck.js';

import {deckWaypoints} from './deck-route.mjs';

let offset=0;
const {server,close}=createGameServer({now:()=>Date.now()+offset,serve:true});
server.listen(0,'127.0.0.1');
await once(server,'listening');
const address='http://127.0.0.1:'+server.address().port;
const path=process.env.FAYEZ_SCREENSHOTS||'test-results/neutrals';
await mkdir(path,{recursive:true});
let browser;
const runtimeErrors=[];
try {
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
  const player=async(name)=>{
    const context=await browser.newContext({viewport:{width:1365,height:835},deviceScaleFactor:1});
    const page=await context.newPage(), result={page,name,s:null};
    page.on('pageerror',e=>runtimeErrors.push(name+': '+e.message));
    page.on('websocket',ws=>ws.on('framereceived',({payload})=>{
      if(typeof payload!=='string'||!payload.startsWith('42'))return;
      const [type,s]=JSON.parse(payload.slice(2));if(type==='state')result.s=s;
    }));
    await page.goto(address);
    return result;
  };
  const shot=async(p,name)=>p.page.screenshot({path:path+'/'+name+'.png',animations:'allow',timeout:10000});
  const get=(p,text)=>p.page.getByRole('button',{name:text,exact:true}).first();
  async function until(fn,label,limit=10000){
    const end=Date.now()+limit;
    while(Date.now()<end){const v=fn();if(v)return v;await wait(40);}
    assert.fail(label);
  }
  async function navigate(p,point){
    for(const q of deckWaypoints(p.s.self,point))await drive(p,q.x,q.y);
  }
  async function drive(p,x,y){
    const keys=new Set();
    try {
      await until(()=>{
        if(!p.s)return false;
        const q=p.s.self;
        if(dist(q,{x,y})<10)return true;
        const want=new Set();
        if(Math.abs(x-q.x)>6)want.add(x>q.x?'d':'a');
        if(Math.abs(y-q.y)>6)want.add(y>q.y?'s':'w');
        for(const k of keys)if(!want.has(k)){void p.page.keyboard.up(k);keys.delete(k);}
        for(const k of want)if(!keys.has(k)){void p.page.keyboard.down(k);keys.add(k);}
        return false;
      },'Move '+p.name+' to '+x+', '+y,9000);
    }finally{await Promise.all([...keys].map(k=>p.page.keyboard.up(k)));}
    await wait(85);
  }
  const advance=async ms=>{offset+=ms;await wait(145);};
  const players=await Promise.all(['Ari','Jun','Mina','Sol','Noor'].map(player));
  const [host,...guests]=players;
  await get(host,'CREATE ROOM').click();
  await host.page.getByLabel('Nickname').fill(host.name);
  await get(host,'Create room').click();
  await until(()=>host.s?.code,'Create private room');
  await Promise.all(guests.map(async guest=>{
    await get(guest,'JOIN ROOM').click();
    await guest.page.getByLabel('Nickname').fill(guest.name);
    await guest.page.getByLabel('Room code').fill(host.s.code);
    await get(guest,'Join room').click();
  }));
  await until(()=>players.every(p=>p.s?.roster.length===5),'Five connected browsers');
  const select=(label,value)=>host.page.getByLabel(label,{exact:true}).selectOption(String(value));
  const role=async(name,enabled)=>{
    const card=host.page.locator('details').filter({hasText:name});
    if(!await card.getAttribute('open'))await card.locator('summary').click();
    await card.getByLabel('Enabled',{exact:true}).setChecked(enabled);
    if(enabled)await card.getByLabel('Spawn Chance',{exact:true}).selectOption('100');
  };
  const start=async round=>{
    await get(host,'Save Settings').click();
    await host.page.getByRole('dialog',{name:'Game Settings'}).waitFor({state:'hidden'});
    await get(host,'START').click();
    await until(()=>players.every(p=>p.s.phase==='countdown'),'Synchronized start');
    await advance(3150);
    await until(()=>players.every(p=>p.s.round===round&&p.s.phase==='reveal'),'Private roles appear');
  };
  const vote=async candidate=>{
    await until(()=>players.every(p=>p.s.phase==='meeting'),'Meeting starts');
    await advance(1930);
    for(const p of players.filter(p=>p.s.self.alive)){
      if(!candidate)await get(p,'Skip Vote').click();
      else await p.page.locator('.ballot-row').filter({hasText:candidate.name}).getByRole('button',{name:'Vote',exact:true}).click();
      await get(p,'Confirm vote').click();
    }
    await until(()=>players.every(p=>p.s.phase==='verdict'),'All verdicts match');
    await advance(4950);
  };
  const result=async (winner,heading,file)=>{
    await until(()=>players.every(p=>p.s.outcome?.winner?.id===winner.s.self.id),'Every browser receives the same winner');
    for(const p of players)await p.page.getByRole('heading',{name:heading,exact:true}).waitFor();
    await shot(winner,file);
    await get(host,'Play Again').click();
    await until(()=>players.every(p=>p.s.phase==='lobby'),'Return to the same lobby');
  };
  await get(host,'Settings').click();
  await select('Kill Cooldown',10);
  await shot(host,'general-settings');
  await get(host,'Meetings').click();
  await select('Discussion Time',0);
  await select('Emergency Cooldown',0);
  await get(host,'Crewmates').click();
  await shot(host,'crewmate-settings');
  await get(host,'Impostors').click();
  await shot(host,'impostor-settings');
  await get(host,'Neutrals').click();
  await role('Jester',true);
  await shot(host,'neutral-settings');
  await start(1);
  const jester=players.find(p=>p.s.self.role==='jester');
  await jester.page.getByRole('heading',{name:'Jester',exact:true}).waitFor();
  await shot(jester,'jester-intro');
  assert.ok(players.every(p=>p.s.roster.every(q=>!('role' in q))));
  await advance(3600);
  await navigate(host,deck.cafe);
  await host.page.locator('.space-action').filter({hasText:'Emergency Meeting'}).click();
  await vote(jester);
  await result(jester,'Jester Wins','jester-victory');

  await get(host,'Settings').click();
  await get(host,'Neutrals').click();
  await role('Jester',false);
  await role('Vulture',true);
  await select('Required Collections',1);
  await shot(host,'vulture-settings');
  await start(2);
  const vulture=players.find(p=>p.s.self.role==='vulture'),impostor=players.find(p=>p.s.self.team==='impostor');
  const [victim,reporter]=players.filter(p=>p.s.self.team==='crew');
  await shot(vulture,'vulture-intro');
  await shot(impostor,'impostor-intro');
  await advance(13900);
  await Promise.all([impostor,victim].map(p=>navigate(p,deck.cafe)));
  await Promise.all([navigate(reporter,{x:deck.cafe.x+84,y:deck.cafe.y}),navigate(vulture,{x:deck.cafe.x-89,y:deck.cafe.y})]);
  await impostor.page.keyboard.press('q');
  await until(()=>!victim.s.self.alive,'Impostor downs the intended target');
  await navigate(reporter,victim.s.self);
  await reporter.page.locator('.space-action').filter({hasText:'Report'}).click();
  await vote(null);
  await until(()=>vulture.s.tactical.remains?.length===1,'Only Vulture sees the reported site');
  assert.ok(players.filter(p=>p!==vulture).every(p=>p.s.tactical.remains===undefined));
  await navigate(vulture,deck.cafe);
  const collect=vulture.page.locator('.space-action').filter({hasText:'Collect remains'});
  await collect.waitFor();
  await shot(vulture,'vulture-objective');
  await collect.click();
  await result(vulture,'Vulture Wins','vulture-victory');

  await get(host,'Settings').click();
  await get(host,'Reset to Recommended').click();
  await start(3);
  assert.ok(players.every(p=>p.s.self.team!=='neutral'&&!p.s.self.role));
  const crewmate=players.find(p=>p.s.self.team==='crew');
  await shot(crewmate,'crewmate-intro');
  await advance(3600);
  await crewmate.page.getByRole('button',{name:'Map',exact:true}).waitFor();
  await shot(crewmate,'final-hud');
  assert.deepEqual(runtimeErrors,[]);
  console.log('Five Chromium contexts verified Jester, Vulture, and a reset to a standard match.');
}finally{await browser?.close();await close();}
