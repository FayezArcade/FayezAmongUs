import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdir} from 'node:fs/promises';
import {setTimeout as wait} from 'node:timers/promises';
import {chromium} from 'playwright-core';
import {createGameServer} from '../server/index.js';
import {deck,deckBounds,contains,dist,terminal,tasks,repairs,doors,playerRadius} from '../shared/deck.js';

import {deckWaypoints} from './deck-route.mjs';

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
  const stationMarker=(p,station)=>p.page.locator('.blue-map canvas').evaluate((canvas,point)=>{
    const ctx=canvas.getContext('2d'),x=Math.round(point.x*canvas.width/point.worldWidth),y=Math.round(point.y*canvas.height/point.worldHeight);
    const pixels=ctx.getImageData(x-5,y-5,11,11).data;
    for(let i=0;i<pixels.length;i+=4)if(pixels[i]===243&&pixels[i+1]===207&&pixels[i+2]===98)return true;
    return false;
  },{...station,worldWidth:deckBounds.width,worldHeight:deckBounds.height});
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
  const players=await Promise.all(['Ari','Jun','Mina','Sol'].map(player));
  const [host,...guests]=players;
  assert.equal(await host.page.getByRole('button').count(),2);
  await shot(host,'01-menu');
  await get(host,'CREATE ROOM').click();
  await host.page.getByLabel('Nickname').fill(host.name);
  await get(host,'Create room').click();
  await until(()=>host.s?.code,'Create private room');
  await host.page.context().grantPermissions(['clipboard-read','clipboard-write']);
  await get(host,'COPY CODE').click();
  assert.equal(await host.page.evaluate(()=>navigator.clipboard.readText()),host.s.code);
  await host.page.getByRole('button',{name:'ROOM CODE '+host.s.code}).click();
  await host.page.getByRole('status').filter({hasText:'Room code copied.'}).waitFor();
  await shot(host,'15-private-code');
  for(const guest of guests){
    await get(guest,'JOIN ROOM').click();
    await guest.page.getByLabel('Nickname').fill(guest.name);
    await guest.page.getByLabel('Room code').fill(host.s.code);
    await get(guest,'Join room').click();
    await until(()=>guest.s?.code===host.s.code,'Join '+guest.name);
    if(guest===guests[0]){
      await until(()=>host.s.roster.length===2,'Two browsers share the dropship');
      assert.equal(await get(host,'START').isEnabled(),false);
    }
  }
  await until(()=>players.every(p=>p.s.roster.length===4),'Four crew on board');
  await host.page.keyboard.down('w');
  await until(()=>host.s.positions.some(p=>p.id===host.s.self.id&&p.moving),'Moving inside the dropship');
  await shot(host,'16-walking');
  await host.page.keyboard.up('w');
  const old=host.s.self.y;
  await drive(host,terminal.x,terminal.y);
  assert.notEqual(host.s.self.y,old);
  await until(()=>guests.every(p=>p.s.positions.some(q=>q.id===host.s.self.id&&dist(q,host.s.self)<7)),'Movement reached remote browsers');
  await shot(host,'02-shuttle');
  assert.equal(await host.page.getByLabel('Chat message').count(),0);
  await host.page.keyboard.press('Space');
  await host.page.getByRole('dialog',{name:'Suit locker'}).waitFor();
  assert.deepEqual(await host.page.locator('.suit-palette button').allTextContents(),[
    'Red','Blue','Green','Pink','Orange','Yellow','Black','White','Purple','Brown','Cyan','Lime','Maroon','Rose','Banana','Gray','Tan','Coral'
  ]);
  assert.equal(await get(host,'Blue').isEnabled(),false);
  await get(host,'Cyan').click();
  await host.page.getByLabel('Equipment').selectOption('2');
  await until(()=>guests.every(p=>p.s.roster.some(q=>q.name==='Ari'&&q.color==='sky'&&q.hat===2)),'Suit selection synchronized');
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
  await get(host,'START').click();
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
  await advance(13500);
  await navigate(operator,deck.cafe);
  await operator.page.keyboard.press('Space');
  await until(()=>players.every(p=>p.s.phase==='meeting'&&p.s.meeting.kind==='emergency'),'Server starts the same emergency for all four clients');
  assert.equal(new Set(players.map(p=>p.s.meeting.start)).size,1);
  for(const p of players)await p.page.getByRole('heading',{name:'Emergency meeting',exact:true}).waitFor({timeout:3000});
  await wait(730);
  await shot(operator,'23-emergency-intro');
  await advance(1950);
  await operator.page.getByText(/^DISCUSSION:/).waitFor();
  assert.equal(await operator.page.getByRole('img',{name:'Body reporter',exact:true}).count(),0);
  assert.equal(await get(operator,'Skip Vote').count(),0);
  await advance(5200);
  for(const p of players){
    await get(p,'Skip Vote').click();
    await get(p,'Confirm vote').click();
  }
  await until(()=>players.every(p=>p.s.phase==='verdict'&&p.s.meeting.result.counts.skip===4),'All emergency ballots skipped');
  await advance(5000);
  await until(()=>players.every(p=>p.s.phase==='play'),'All four return after emergency');

  await shot(operator,'07a-cafeteria-gameplay');
  await operator.page.keyboard.down('w');
  await until(()=>operator.s.positions.some(q=>q.id===operator.s.self.id&&q.moving&&q.direction==='up'),'North-facing walk pose');
  await shot(operator,'22-characters-walking');
  await operator.page.keyboard.up('w');

  assert.equal(await operator.page.getByLabel('Chat message').count(),0);
  const map=await get(operator,'Map').boundingBox();
  assert.ok(map.x>1300&&map.y<32);
  await get(operator,'Map').click();
  await shot(operator,'07-meridian-map');
  await get(operator,'Map').click();
  await operator.page.getByRole('dialog',{name:'Meridian deck plan'}).waitFor({state:'hidden'});
  await operator.page.keyboard.press('m');
  await operator.page.getByRole('dialog',{name:'Meridian deck plan'}).waitFor();
  await operator.page.keyboard.press('m');
  const wire=tasks.find(t=>t.instrument==='wire'&&operator.s.self.assignments.some(a=>a.id===t.id));
  await navigate(operator,wire.stops[0]);
  await operator.page.locator('.space-action').filter({hasText:'Fix Wiring'}).waitFor();
  await shot(operator,'31-space-prompt');
  await operator.page.keyboard.press('Space');
  await operator.page.getByRole('dialog',{name:'Fix Wiring'}).waitFor();
  for(const c of ['coral','teal','gold','iris']){
    const lead=operator.page.locator('[data-key=left][data-value='+c+']');
    const socket=operator.page.locator('[data-key=right][data-value='+c+']');
    if(c==='coral'){
      await lead.dragTo(socket);
    }else{
      await lead.click();
      await socket.click();
    }
    await until(()=>operator.s.self.assignments.some(a=>a.id===wire.id&&a.stage===1)||operator.s.puzzle?.matched?.includes(c),'Cable pair '+c);
    if(c==='teal')await shot(operator,'08-cable-task');
  }
  await until(()=>operator.s.self.assignments.some(a=>a.id===wire.id&&a.stage===1&&!a.done),'Wiring advances to the next room');
  assert.equal(operator.s.progress.done,0);
  const badge=tasks.find(t=>t.id==='card').stops[0];
  // Keep the position marker clear of the station marker when checking canvas pixels.
  await navigate(operator,{x:badge.x-36,y:badge.y});
  await get(operator,'Map').click();
  assert.equal(await stationMarker(operator,badge),true);
  await operator.page.keyboard.press('Escape');
  await operator.page.keyboard.press('Space');
  await operator.page.getByRole('dialog',{name:'Swipe Card'}).waitFor();
  await shot(operator,'09-badge-task');
  const badgeButton=operator.page.getByRole('button',{name:'Swipe access badge'});
  const bounds=await badgeButton.boundingBox(), box=await operator.page.locator('.reader').boundingBox();
  await operator.page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
  await operator.page.mouse.down();
  await wait(350);
  await operator.page.mouse.move(box.x+box.width-15,bounds.y+bounds.height/2,{steps:5});
  await operator.page.mouse.up();
  await until(()=>operator.s.progress.done===1,'Badge credited by server');
  await get(operator,'Map').click();
  assert.equal(await stationMarker(operator,badge),false);
  await operator.page.keyboard.press('Escape');
  await advance(16000);
  await get(infiltrator,'Sabotage').click();
  await shot(infiltrator,'10a-sabotage-map');
  await get(infiltrator,'LIGHTS').click();
  await until(()=>crew.every(p=>p.s.sabotage?.kind==='lights'),'Lights disruption reaches crew');
  await navigate(operator,repairs.lights[0]);
  await operator.page.keyboard.press('Space');
  await operator.page.getByRole('dialog',{name:'Lights recovery'}).waitFor();
  await shot(operator,'10-sabotage-repair');
  const switches=operator.s.sabotage.pattern.flatMap((on,i)=>on?[]:[i]);
  for(const i of switches)await operator.page.locator('[data-switch="'+i+'"]').click();
  await until(()=>!operator.s.sabotage,'Repair restores lights');
  const [,victim,reporter]=crew;
  for(const p of [infiltrator,victim,reporter])await navigate(p,deck.cafe);
  // Keep the reporter and the intended target within strike/report range but apart.
  await navigate(reporter,{x:deck.cafe.x+84,y:deck.cafe.y});
  await infiltrator.page.keyboard.press('q');
  await until(()=>!victim.s.self.alive,'Victim becomes ghost');
  await navigate(reporter,victim.s.self);
  await until(()=>reporter.s.bodies.some(b=>b.id===victim.s.self.id&&dist(b,reporter.s.self)<60),'Incident is within report range');
  await reporter.page.locator('.space-action').filter({hasText:'Report incident'}).waitFor();
  await reporter.page.keyboard.press('Space');
  await until(()=>players.every(p=>p.s.phase==='meeting'&&p.s.meeting.kind==='report'),'Incident opens the same meeting on all clients');
  assert.ok(players.every(p=>p.s.meeting.caller===reporter.s.self.id&&p.s.meeting.introUntil===reporter.s.meeting.introUntil));
  for(const p of players)await p.page.getByRole('heading',{name:'Body reported',exact:true}).waitFor({timeout:3000});
  await shot(reporter,'25-report-intro');
  await advance(1950);
  for(const p of players){
    await p.page.getByText(/^DISCUSSION:/).waitFor();
    await p.page.locator('.ballot-row').filter({hasText:reporter.name}).getByRole('img',{name:'Body reporter',exact:true}).waitFor();
  }
  const message=reporter.page.getByLabel('Chat message');
  await get(reporter,'Chat').click();
  await message.fill('I found a suit in the');
  await message.press('End');
  await message.press('Space');
  await message.pressSequentially('cafeteria.');
  assert.equal(await message.inputValue(),'I found a suit in the cafeteria.');
  await get(reporter,'Ballot').click();
  await get(reporter,'Chat').click();
  assert.equal(await message.inputValue(),'I found a suit in the cafeteria.');
  await get(reporter,'Send').click();
  await operator.page.locator('#unread-chat').filter({hasText:'1'}).waitFor();
  await get(reporter,'Chat').click();
  await shot(reporter,'32-meeting-chat');
  await operator.page.locator('#meeting-chat-button').click();
  await operator.page.getByText('I found a suit in the cafeteria.').waitFor();
  await operator.page.locator('#unread-chat').waitFor({state:'hidden'});
  await get(operator,'Ballot').click();
  await operator.page.locator('.ballot-row').filter({hasText:reporter.name}).getByRole('button',{name:'Mute',exact:true}).click();
  await get(operator,'Chat').click();
  assert.equal(await operator.page.getByText('I found a suit in the cafeteria.').count(),0);
  await get(operator,'Ballot').click();
  await get(reporter,'Ballot').click();
  assert.equal(await reporter.page.locator('.ballot-row img.suit-avatar').count(),4);
  await shot(reporter,'11-meeting');
  await advance(5300);
  await get(reporter,'Skip Vote').waitFor();
  await shot(reporter,'12-ballot');
  for(const p of [reporter,operator]){
    const row=p.page.locator('.ballot-row').filter({hasText:infiltrator.name});
    await row.getByRole('button',{name:'Vote',exact:true}).click();
    await get(p,'Confirm vote').click();
  }
  await get(infiltrator,'Skip Vote').click();
  await get(infiltrator,'Confirm vote').click();
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
  await get(host,'START').click();
  await until(()=>players.every(p=>p.s.round===2&&p.s.phase==='reveal'),'Second round starts in same room');
  const solo=await player('Nova');
  await get(solo,'CREATE ROOM').click();
  await solo.page.getByLabel('Nickname').fill(solo.name);
  await get(solo,'Create room').click();
  await until(()=>solo.s?.roster.length===1,'Single player lobby');
  const code=solo.s.code;
  await drive(solo,terminal.x,terminal.y);
  await solo.page.keyboard.press('Space');
  await solo.page.getByRole('dialog',{name:'Suit locker'}).waitFor();
  assert.equal(await solo.page.locator('.suit-palette button:enabled').count(),18);
  await shot(solo,'21-color-grid');
  await solo.page.keyboard.press('Escape');
  await get(solo,'START').click();
  await solo.page.getByRole('heading',{name:/^[1-3]$/}).waitFor();
  await shot(solo,'17-solo-countdown');
  await advance(3100);
  await solo.page.getByRole('heading',{name:'Crewmate',exact:true}).waitFor();
  await shot(solo,'18-solo-role');
  await advance(3600);
  await until(()=>solo.s.phase==='play'&&solo.s.solo,'Solo map stays playable');
  await shot(solo,'19-solo-gameplay');
  for(const [key,direction] of [['a','left'],['d','right'],['w','up'],['s','down']]){
    await solo.page.keyboard.down(key);
    await until(()=>solo.s.positions.some(q=>q.id===solo.s.self.id&&q.moving&&q.direction===direction),'Walk '+direction);
    await solo.page.keyboard.up(key);
  }
  await until(()=>solo.s.positions.some(q=>q.id===solo.s.self.id&&!q.moving&&q.direction==='down'),'Standing retains last facing');

  await get(solo,'Map').click();
  await solo.page.getByRole('dialog',{name:'Meridian deck plan'}).waitFor();
  await solo.page.keyboard.press('Escape');
  await get(solo,'Test controls').click();
  await get(solo,'Deck overview').click();
  await shot(solo,'26-full-deck');
  await solo.page.keyboard.press('Escape');
  const hatch=doors.find(d=>d.label==='Cafeteria · east hall');
  await navigate(solo,{x:hatch.x+64,y:hatch.y});
  await until(()=>solo.s.positions.some(q=>q.id===solo.s.self.id&&!q.moving),'Stopped at the east shutter');
  assert.ok(solo.s.self.x>hatch.x+hatch.w/2+playerRadius+2,'Standing clear of the shutter collision footprint');
  await shot(solo,'33-hall-open');
  await get(solo,'Test controls').click();
  await get(solo,'Sabotage').click();
  await solo.page.getByLabel('Bulkhead').selectOption(String(hatch.id));
  await get(solo,'Seal bulkhead').click();
  try {
    await until(()=>solo.s.doors.includes(hatch.id),'East corridor shutter closes');
  } catch (error) {
    const notice=await solo.page.locator('#notice').textContent();
    throw new Error(`East shutter did not close. Player ${solo.s.self.x},${solo.s.self.y}. Relay notice: ${notice || '(none)'}`,{cause:error});
  }
  await shot(solo,'34-hall-closed');
  await advance(9800);
  await until(()=>!solo.s.doors.includes(hatch.id),'East corridor shutter reopens');
  const demonstrations=new Map([
    ['electrical',['calibrate','35-calibrate']],['reactor',['reactor','36-start-reactor']],
    ['nav',['chart','37-chart-course']],['oxygen',['filter','38-oxygen-filter']]
  ]);
  for(const [room,file] of [[deck.storage,'29-storage'],[deck.electrical,'30-solo-electrical'],[deck.reactor,'27-reactor'],[deck.nav,'28-navigation'],[deck.oxygen,'39-oxygen']]){
    await navigate(solo,room);
    assert.ok(contains(room,solo.s.self.x,solo.s.self.y));
    await shot(solo,file);
    const example=demonstrations.get(room.id);
    if(!example)continue;
    const task=tasks.find(t=>t.id===example[0]);
    const station=task.stops[0];
    // Enter from the distributor side so the nearby vent is not the closer station.
    const approach=task.id==='calibrate'?{x:station.x+24,y:station.y+12}:station;
    await navigate(solo,approach);
    await solo.page.locator('.space-action').filter({hasText:task.label}).waitFor();
    await solo.page.keyboard.press('Space');
    await solo.page.getByRole('dialog',{name:task.label}).waitFor();
    await shot(solo,example[1]);
    if(task.id==='chart'){
      const points=await solo.page.locator('[data-key=waypoint]').all();
      for(const [i,point] of points.entries()){
        const b=await point.boundingBox();
        await solo.page.mouse.move(b.x+b.width/2,b.y+b.height/2);
        if(i===0)await solo.page.mouse.down();
        await until(()=>solo.s.puzzle?.progress===i+1||solo.s.self.assignments.some(a=>a.id==='chart'&&a.done),'Dragged chart waypoint '+i);
      }
      await solo.page.mouse.up();
    }else if(task.id==='filter'){
      const particles=[0,1,2,3,4].map(i=>solo.page.locator('[data-key=clear][data-value="'+i+'"]'));
      const exhaust=await solo.page.locator('.filter-exhaust').boundingBox();
      for(const point of particles){
        const b=await point.boundingBox(), count=solo.s.puzzle.debris.length;
        await solo.page.mouse.move(b.x+b.width/2,b.y+b.height/2);
        await solo.page.mouse.down();
        await solo.page.mouse.move(exhaust.x+exhaust.width/2,exhaust.y+exhaust.height/2,{steps:5});
        await solo.page.mouse.up();
        await until(()=>solo.s.puzzle?.debris?.length===count-1||solo.s.self.assignments.some(a=>a.id==='filter'&&a.done),'Dragged intake particle');
      }
    }else await solo.page.keyboard.press('Escape');
  }
  const sample=tasks.find(t=>t.id==='sample');
  await navigate(solo,sample.stops[0]);
  await solo.page.setViewportSize({width:412,height:756});
  const touchPrompt=solo.page.locator('.space-action').filter({hasText:sample.label});
  await touchPrompt.waitFor();
  const promptBox=await touchPrompt.boundingBox();
  assert.ok(Math.abs(promptBox.x+promptBox.width/2-206)<2);
  assert.ok((await get(solo,'Map').boundingBox()).x>350);
  await touchPrompt.click();
  await solo.page.getByRole('dialog',{name:sample.label}).waitFor();
  await get(solo,'Start analysis').click();
  await solo.page.keyboard.press('Escape');
  await advance(12100);
  await solo.page.setViewportSize({width:1365,height:835});
  await solo.page.keyboard.press('Space');
  await solo.page.locator('.samples .anomaly').waitFor();
  await shot(solo,'40-sample-analysis');
  await solo.page.locator('.samples .anomaly').click();
  await until(()=>solo.s.self.assignments.some(a=>a.id==='sample'&&a.done),'Sample completes using the preserved analyzer');
  await get(solo,'Test controls').click();
  await solo.page.getByLabel('Practice role').selectOption('scientist');
  await get(solo,'Apply role').click();
  await get(solo,'Ability').click();
  await get(solo,'Remote vitals').click();
  await until(()=>solo.s.tactical.vitals?.[0]?.alive,'Solo scientist can test vitals');
  await solo.page.keyboard.press('Escape');
  await get(solo,'Test controls').click();
  await shot(solo,'20-solo-controls');
  await get(solo,'Return to dropship').click();
  await until(()=>solo.s.phase==='lobby'&&solo.s.code===code,'Solo returns to the same private room');
  await get(solo,'START').click();
  await until(()=>solo.s.phase==='countdown','Solo can start again');
  assert.deepEqual(runtimeErrors,[]);
  console.log('Four independent Chromium contexts passed multiplayer, and a fifth passed solo practice and replay.');
} finally {
  await browser?.close();
  await close();
}
