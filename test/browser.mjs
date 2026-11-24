import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdir} from 'node:fs/promises';
import {setTimeout as wait} from 'node:timers/promises';
import {chromium} from 'playwright-core';
import {createGameServer} from '../server/index.js';
import {dist,terminal,tasks} from '../shared/deck.js';

let offset=0;
const {server,close}=createGameServer({now:()=>Date.now()+offset,serve:true});
server.listen(0,'127.0.0.1');
await once(server,'listening');
const address='http://127.0.0.1:'+server.address().port;
const path=process.env.FAYEZ_SCREENSHOTS||'test-results/screenshots';
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
  async function drive(p,x,y){
    const keys=new Set();
    try {
      await until(()=>{
        if(!p.s)return false;
        const q=p.s.self;
        if(dist(q,{x,y})<19)return true;
        const want=new Set();
        if(Math.abs(x-q.x)>13)want.add(x>q.x?'d':'a');
        if(Math.abs(y-q.y)>13)want.add(y>q.y?'s':'w');
        for(const k of keys)if(!want.has(k)){void p.page.keyboard.up(k);keys.delete(k);}
        for(const k of want)if(!keys.has(k)){void p.page.keyboard.down(k);keys.add(k);}
        return false;
      },'Move '+p.name+' to '+x+', '+y,9000);
    }finally{await Promise.all([...keys].map(k=>p.page.keyboard.up(k)));}
    await wait(85);
  }
  const advance=async ms=>{offset+=ms;await wait(145);};
  const players=await Promise.all(['Ari','Jun','Mina','Sol'].map(player));
  const [host,...guests]=players;
  assert.equal(await host.page.getByRole('button').count(),2);
  await shot(host,'01-menu');
  await get(host,'CREATE ROOM').click();
  await host.page.getByLabel('Nickname').fill(host.name);
  await get(host,'Create room').click();
  await until(()=>host.s?.code,'Create private room');
  for(const guest of guests){
    await get(guest,'JOIN ROOM').click();
    await guest.page.getByLabel('Nickname').fill(guest.name);
    await guest.page.getByLabel('Room code').fill(host.s.code);
    await get(guest,'Join room').click();
    await until(()=>guest.s?.code===host.s.code,'Join '+guest.name);
  }
  await until(()=>players.every(p=>p.s.roster.length===4),'Four crew on board');
  const old=host.s.self.x;
  await drive(host,terminal.x,terminal.y);
  assert.notEqual(host.s.self.x,old);
  await until(()=>guests.every(p=>p.s.positions.some(q=>q.id===host.s.self.id&&Math.abs(q.x-host.s.self.x)<6)),'Movement reached remote browsers');
  await shot(host,'02-shuttle');
  await host.page.keyboard.press('e');
  await host.page.getByRole('dialog',{name:'Suit locker'}).waitFor();
  await get(host,'mint').click();
  await host.page.getByLabel('Equipment').selectOption('2');
  await until(()=>guests.every(p=>p.s.roster.some(q=>q.name==='Ari'&&q.color==='mint'&&q.hat===2)),'Suit selection synchronized');
  await shot(host,'03-suit-locker');
  await host.page.keyboard.press('Escape');
  await get(host,'Settings').click();
  await host.page.getByLabel('Discussion (s)').fill('5');
  await host.page.getByLabel('Voting (s)').fill('10');
  await host.page.getByLabel('Common tasks').fill('2');
  await host.page.getByLabel('Strike cooldown (s)').fill('10');
  await host.page.getByLabel('Walk speed').fill('215');
  const phantom=host.page.locator('details').filter({hasText:'Phantom'});
  await phantom.locator('summary').click();
  await phantom.getByLabel('Enabled').check();
  await phantom.getByLabel('Chance (%)').fill('100');
  await shot(host,'04-role-settings');
  await get(host,'Save settings').click();
  await get(host,'Start flight').click();
  await until(()=>players.every(p=>p.s.phase==='reveal'),'Round starts on four browsers');
  const infiltrator=players.find(p=>p.s.self.role==='phantom'), crew=players.filter(p=>p!==infiltrator);
  assert.ok(infiltrator&&crew.length===3);
  assert.ok(crew.every(p=>p.s.roster.every(q=>!('role' in q)&&!('team' in q))));
  await shot(infiltrator,'05-role-reveal');
  await advance(4000);
  await get(infiltrator,'Ability').click();
  await get(infiltrator,'Cloak').click();
  await until(()=>infiltrator.s.self.effect==='phantom','Phantom cloaks');
  await until(()=>crew.every(p=>p.s.positions.every(q=>q.id!==infiltrator.s.self.id)),'Phantom absent from crew snapshots');
  await shot(infiltrator,'06-phantom-ability');
  await infiltrator.page.keyboard.press('Escape');
  const operator=crew[0];
  await shot(operator,'07a-cafeteria-gameplay');
  await get(operator,'Map').click();
  await shot(operator,'07-meridian-map');
  await operator.page.keyboard.press('Escape');
  const wire=tasks.find(t=>t.id==='wire').stops[0];
  await drive(operator,940,335);await drive(operator,940,570);await drive(operator,wire.x,wire.y);
  await operator.page.keyboard.press('e');
  await operator.page.getByRole('dialog',{name:'Patch the cable harness'}).waitFor();
  for(const c of ['coral','teal','gold','iris']){
    const lead=operator.page.locator('[data-key=left][data-value='+c+']');
    const socket=operator.page.locator('[data-key=right][data-value='+c+']');
    if(c==='coral'){
      await lead.dragTo(socket);
    }else{
      await lead.click();
      await socket.click();
    }
    await until(()=>operator.s.progress.done===1||operator.s.puzzle?.matched?.includes(c),'Cable pair '+c);
    if(c==='teal')await shot(operator,'08-cable-task');
  }
  await until(()=>operator.s.progress.done===1,'Task progress increased');
  const badge=tasks.find(t=>t.id==='card').stops[0];
  await drive(operator,940,570);await drive(operator,940,335);await drive(operator,660,335);await drive(operator,badge.x,badge.y);
  await operator.page.keyboard.press('e');
  await operator.page.getByRole('dialog',{name:'Read the access badge'}).waitFor();
  await shot(operator,'09-badge-task');
  const badgeButton=operator.page.getByRole('button',{name:'Swipe access badge'});
  const bounds=await badgeButton.boundingBox(), box=await operator.page.locator('.reader').boundingBox();
  await operator.page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
  await operator.page.mouse.down();
  await wait(350);
  await operator.page.mouse.move(box.x+box.width-15,bounds.y+bounds.height/2,{steps:5});
  await operator.page.mouse.up();
  await until(()=>operator.s.progress.done===2,'Badge credited by server');
  await advance(16000);
  await get(infiltrator,'Sabotage').click();
  await shot(infiltrator,'10a-sabotage-map');
  await get(infiltrator,'LIGHTS').click();
  await until(()=>crew.every(p=>p.s.sabotage?.kind==='lights'),'Lights disruption reaches crew');
  await drive(operator,660,335);await drive(operator,940,335);await drive(operator,940,607);
  await operator.page.keyboard.press('e');
  await operator.page.getByRole('dialog',{name:'Lights recovery'}).waitFor();
  await shot(operator,'10-sabotage-repair');
  const switches=operator.s.sabotage.pattern.flatMap((on,i)=>on?[]:[i]);
  for(const i of switches)await operator.page.locator('[data-switch="'+i+'"]').click();
  await until(()=>!operator.s.sabotage,'Repair restores lights');
  const [,victim,reporter]=crew;
  for(const p of [infiltrator,victim,reporter])await drive(p,940,335);
  // Keep the reporter and the intended target within strike/report range but apart.
  await drive(reporter,1024,335);
  await infiltrator.page.keyboard.press('q');
  await until(()=>!victim.s.self.alive,'Victim becomes ghost');
  await drive(reporter,victim.s.self.x,victim.s.self.y);
  await until(()=>reporter.s.bodies.some(b=>b.id===victim.s.self.id&&dist(b,reporter.s.self)<60),'Incident is within report range');
  await reporter.page.keyboard.press('r');
  await until(()=>players.every(p=>p.s.phase==='meeting'),'Incident opens meeting');
  await reporter.page.getByLabel('Chat message').fill('I found a suit in the cafeteria.');
  await get(reporter,'Send').click();
  await operator.page.getByText('I found a suit in the cafeteria.').waitFor();
  await shot(reporter,'11-meeting');
  await advance(5300);
  await get(reporter,'Skip vote').waitFor();
  await shot(reporter,'12-ballot');
  for(const p of [reporter,operator]){
    const row=p.page.locator('.ballot-row').filter({hasText:infiltrator.name});
    await row.getByRole('button',{name:'Vote',exact:true}).click();
  }
  await get(infiltrator,'Skip vote').click();
  await until(()=>players.every(p=>p.s.phase==='verdict'),'Ballot ejection on all browsers');
  await shot(reporter,'13-vote-result');
  await advance(4900);
  await until(()=>players.every(p=>p.s.outcome?.team==='crew'),'Crew wins');
  await shot(host,'14-victory');
  await get(host,'Return to shuttle').click();
  await until(()=>players.every(p=>p.s.phase==='lobby'),'Private room returns to shuttle');
  guests[0].s=null;
  await guests[0].page.reload();
  await until(()=>guests[0].s?.roster.some(q=>q.name===guests[0].name&&q.online),'Guest resumes after reload');
  await get(host,'Start flight').click();
  await until(()=>players.every(p=>p.s.round===2&&p.s.phase==='reveal'),'Second round starts in same room');
  assert.deepEqual(runtimeErrors,[]);
  console.log('Four isolated Chromium contexts passed the two-round multiplayer journey.');
} finally {
  await browser?.close();
  await close();
}
