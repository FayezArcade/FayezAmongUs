import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdir} from 'node:fs/promises';
import {setTimeout as wait} from 'node:timers/promises';
import {chromium} from 'playwright-core';
import {createGameServer} from '../server/index.js';
import {deck,deckBounds,dist,terminal,tasks,repairs,cameraSites,securityConsole,vents} from '../shared/deck.js';

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
  assert.equal(await get(host,'START').isEnabled(),false);
  await host.page.getByText('Waiting for at least 4 players').waitFor();
  await shot(host,'50-minimum-four');
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
  await drive(host,terminal.x,terminal.y);
  assert.ok(dist(host.s.self,terminal)<20);
  await until(()=>guests.every(p=>p.s.positions.some(q=>q.id===host.s.self.id&&dist(q,host.s.self)<7)),'Movement reached remote browsers');
  await shot(host,'02-shuttle');
  assert.equal(await host.page.getByLabel('Chat message').count(),0);
  await host.page.keyboard.press('Space');
  await host.page.getByRole('dialog',{name:'Customize'}).waitFor();
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
  const setting=async(label,value)=>host.page.getByLabel(label,{exact:true}).selectOption(String(value));
  assert.equal(await host.page.locator('#settings-form input[type=number]').count(),0);
  await setting('Player Speed',210);
  await get(host,'Reset to Recommended').click();
  assert.equal(await host.page.getByLabel('Player Speed',{exact:true}).inputValue(),'175');
  await setting('Player Speed',210);
  await setting('Crewmate Vision',218);
  await setting('Impostor Vision',435);
  await setting('Kill Cooldown',10);
  await shot(host,'04a-match-settings');
  await get(host,'Tasks').click();
  for(const [label,value] of [['Common Tasks',2],['Long Tasks',0],['Short Tasks',2],['Visual Tasks',false]])await setting(label,value);
  await get(host,'Meetings').click();
  for(const [label,value] of [['Emergency Meetings',2],['Discussion Time',15],['Voting Time',15],['Anonymous Votes',true]])await setting(label,value);
  await get(host,'Impostors').click();
  const phantom=host.page.locator('details').filter({hasText:'Phantom'});
  await phantom.locator('summary').click();
  await phantom.getByLabel('Enabled').check();
  await phantom.getByLabel('Spawn Chance',{exact:true}).selectOption('100');
  await shot(host,'04-role-settings');
  await get(host,'Save Settings').click();
  await until(()=>players.every(p=>p.s.settings.longTasks===0&&p.s.settings.shortTasks===2&&p.s.settings.speed===210),'Host changes reached every browser');
  await shot(host,'51-settings-saved');
  await get(host,'START').click();
  await until(()=>players.every(p=>p.s.phase==='reveal'),'Round starts on four browsers');
  const impostor=players.find(p=>p.s.self.role==='phantom'), crew=players.filter(p=>p!==impostor);
  assert.ok(impostor&&crew.length===3);
  assert.ok(crew.every(p=>p.s.roster.every(q=>!('role' in q)&&!('team' in q))));
  assert.ok(players.every(p=>p.s.self.assignments.length===4&&p.s.progress.total===12));
  assert.ok(crew.every(p=>p.s.vision===218));
  assert.equal(impostor.s.vision,435);
  await shot(impostor,'05-role-reveal');
  await advance(4000);
  await get(impostor,'Ability').click();
  await get(impostor,'Cloak').click();
  await until(()=>impostor.s.self.effect==='phantom','Phantom cloaks');
  await until(()=>crew.every(p=>p.s.positions.every(q=>q.id!==impostor.s.self.id)),'Phantom absent from crew snapshots');
  await shot(impostor,'06-phantom-ability');
  await impostor.page.keyboard.press('Escape');
  const operator=crew[0];
  await advance(19000);
  await navigate(operator,deck.cafe);
  await operator.page.keyboard.press('Space');
  await until(()=>players.every(p=>p.s.phase==='meeting'&&p.s.meeting.kind==='emergency'),'Server starts the same emergency for all four clients');
  assert.equal(new Set(players.map(p=>p.s.meeting.start)).size,1);
  for(const p of players)await p.page.getByRole('heading',{name:'Emergency Meeting',exact:true}).waitFor({timeout:3000});
  await wait(730);
  await shot(operator,'23-emergency-intro');
  await advance(1950);
  await operator.page.getByText(/^DISCUSSION:/).waitFor();
  assert.equal(await operator.page.getByRole('img',{name:'Body reporter',exact:true}).count(),0);
  assert.equal(await get(operator,'Skip Vote').count(),0);
  await advance(15200);
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
  await operator.page.getByRole('dialog',{name:'Map'}).waitFor({state:'hidden'});
  await operator.page.keyboard.press('m');
  await operator.page.getByRole('dialog',{name:'Map'}).waitFor();
  await operator.page.keyboard.press('m');
  await operator.page.keyboard.down('Tab');
  await operator.page.getByRole('dialog',{name:'Map'}).waitFor();
  await shot(operator,'41-tab-map');
  await operator.page.keyboard.up('Tab');
  await operator.page.getByRole('dialog',{name:'Map'}).waitFor({state:'hidden'});
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
  await navigate(operator,badge);
  await operator.page.locator('.space-action').filter({hasText:'Swipe Card'}).waitFor();
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
  await get(operator,'Tasks').click();
  await operator.page.getByText('1 / 4 personal tasks complete').waitFor();
  assert.equal(await operator.page.locator('.mission-list li').count(),4);
  assert.equal(await operator.page.locator('#task-count').textContent(),'1 / 12');
  await shot(operator,'52-personal-and-crew-tasks');
  await operator.page.keyboard.press('Escape');
  await get(operator,'Map').click();
  assert.equal(await stationMarker(operator,badge),false);
  await operator.page.keyboard.press('Escape');
  await advance(16000);
  await get(impostor,'Sabotage').click();
  await shot(impostor,'10a-sabotage-map');
  await get(impostor,'LIGHTS').click();
  await until(()=>crew.every(p=>p.s.sabotage?.kind==='lights'),'Lights disruption reaches crew');
  await navigate(operator,repairs.lights[0]);
  await operator.page.keyboard.press('Space');
  await operator.page.getByRole('dialog',{name:'Lights Repair'}).waitFor();
  await shot(operator,'10-sabotage-repair');
  const switches=operator.s.sabotage.pattern.flatMap((on,i)=>on?[]:[i]);
  for(const i of switches)await operator.page.locator('[data-switch="'+i+'"]').click();
  await until(()=>!operator.s.sabotage,'Repair restores lights');
  const [,victim,reporter]=crew;
  const openRepair=async(p,kind)=>{
    await until(()=>p.s.sabotage?.kind===kind&&p.s.sabotage.nearby.length,
      p.name+' is within reach of '+kind);
    await p.page.locator('.space-action').filter({hasText:'Repair '+kind}).click({timeout:3500});
    await p.page.getByRole('dialog',{name:kind[0].toUpperCase()+kind.slice(1)+' Repair'}).waitFor({timeout:3500});
  };
  const alarm=async(kind)=>{
    await advance(18200);
    await get(impostor,'Sabotage').click();
    await get(impostor,kind.toUpperCase()).click();
    await until(()=>players.every(p=>p.s.sabotage?.kind===kind),'All receive '+kind);
  };
  await Promise.all([navigate(operator,securityConsole),navigate(victim,{x:cameraSites[0].x-44,y:cameraSites[0].y}),navigate(impostor,vents[1])]);
  await operator.page.keyboard.press('Space');
  const surveillance=operator.page.getByRole('dialog',{name:'Security Cameras'});
  await surveillance.waitFor();
  assert.equal(await surveillance.locator('canvas').count(),4);
  await until(()=>operator.s.tactical.cameras?.[0].players.some(q=>q.color===victim.s.self.color),'Surveillance sees a real player');
  assert.ok(players.filter(p=>p!==operator).every(p=>!p.s.tactical.cameras));
  await until(()=>victim.s.cameraLights.includes(0),'Nearby viewer sees the active indicator');
  const cameraImage=()=>surveillance.locator('canvas').first().evaluate(canvas=>canvas.toDataURL());
  const imageBefore=await cameraImage();
  await navigate(victim,{x:cameraSites[0].x+28,y:cameraSites[0].y});
  await until(()=>operator.s.tactical.cameras?.[0].players.some(q=>q.color===victim.s.self.color&&q.x>cameraSites[0].x),'Surveillance sees movement');
  assert.notEqual(await cameraImage(),imageBefore);
  await shot(operator,'42-security-feeds');
  await get(operator,'Exit Cameras').click();
  await until(()=>!operator.s.tactical.cameras&&!victim.s.cameraLights.includes(0),'Exit releases the feeds and indicator');
  await operator.page.keyboard.press('Space');
  await surveillance.waitFor();
  await impostor.page.keyboard.press('v');
  await impostor.page.getByRole('dialog',{name:'Vent Network'}).waitFor();
  await until(()=>impostor.s.self.ventIndex===1,'V enters MedBay hatch');
  assert.ok(operator.s.positions.every(q=>q.id!==impostor.s.self.id));
  await shot(impostor,'43-vent-network');
  await get(impostor,'Security').click();
  await until(()=>impostor.s.self.ventIndex===3,'Travel to connected Security hatch');
  await get(impostor,'Exit Vent').click();
  await until(()=>impostor.s.self.ventIndex===null,'Exit Vent returns to the deck');

  await alarm('comms');
  await surveillance.waitFor({state:'hidden'});
  assert.ok(!operator.s.tactical.cameras);
  await navigate(reporter,repairs.comms[0]);
  await openRepair(reporter,'comms');
  await shot(reporter,'44-comms-repair');
  await reporter.page.getByLabel('Receiver frequency').fill(String(reporter.s.sabotage.nearby[0].dial));
  await get(reporter,'Lock frequency').click();
  await until(()=>players.every(p=>!p.s.sabotage),'Comms repaired');

  await Promise.all([navigate(victim,repairs.oxygen[0]),navigate(operator,repairs.oxygen[1])]);
  await alarm('oxygen');
  for(const p of [victim,operator]){
    await openRepair(p,'oxygen');
    if(p===victim)await shot(p,'45-oxygen-repair');
    await p.page.getByLabel('Pressure code').fill(p.s.sabotage.nearby[0].code);
    await get(p,'Restore pressure').click();
  }
  await until(()=>players.every(p=>!p.s.sabotage),'Two oxygen stations repaired');

  await Promise.all([navigate(victim,repairs.reactor[0]),navigate(operator,repairs.reactor[1])]);
  await alarm('reactor');
  for(const p of [victim,operator])await openRepair(p,'reactor');
  await get(victim,'Press relay pad').click();
  await until(()=>operator.s.sabotage.fixed.length===1,'First reactor link reached all clients');
  await shot(operator,'46-reactor-repair');
  await get(operator,'Press relay pad').click();
  await until(()=>players.every(p=>!p.s.sabotage),'Two people repaired Reactor');
  for(const p of [impostor,victim,reporter])await navigate(p,deck.cafe);
  // Keep the reporter and the intended target within strike/report range but apart.
  await navigate(reporter,{x:deck.cafe.x+84,y:deck.cafe.y});
  await impostor.page.keyboard.press('q');
  await until(()=>!victim.s.self.alive,'Victim becomes ghost');
  await navigate(reporter,victim.s.self);
  await until(()=>reporter.s.bodies.some(b=>b.id===victim.s.self.id&&dist(b,reporter.s.self)<60),'Incident is within report range');
  await reporter.page.locator('.space-action').filter({hasText:'Report'}).waitFor();
  await reporter.page.keyboard.press('Space');
  await until(()=>players.every(p=>p.s.phase==='meeting'&&p.s.meeting.kind==='report'),'Incident opens the same meeting on all clients');
  assert.ok(players.every(p=>p.s.meeting.caller===reporter.s.self.id&&p.s.meeting.introUntil===reporter.s.meeting.introUntil));
  for(const p of players)await p.page.getByRole('heading',{name:'Body Reported',exact:true}).waitFor({timeout:3000});
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
  await get(reporter,'Voting').click();
  await get(reporter,'Chat').click();
  assert.equal(await message.inputValue(),'I found a suit in the cafeteria.');
  await get(reporter,'Send').click();
  await operator.page.locator('#unread-chat').filter({hasText:'1'}).waitFor();
  await get(reporter,'Chat').click();
  await shot(reporter,'32-meeting-chat');
  await operator.page.locator('#meeting-chat-button').click();
  await operator.page.getByText('I found a suit in the cafeteria.').waitFor();
  await operator.page.locator('#unread-chat').waitFor({state:'hidden'});
  await get(operator,'Voting').click();
  await operator.page.locator('.ballot-row').filter({hasText:reporter.name}).getByRole('button',{name:'Mute',exact:true}).click();
  await get(operator,'Chat').click();
  assert.equal(await operator.page.getByText('I found a suit in the cafeteria.').count(),0);
  await get(operator,'Voting').click();
  await get(reporter,'Voting').click();
  assert.equal(await reporter.page.locator('.ballot-row img.suit-avatar').count(),4);
  await shot(reporter,'11-meeting');
  await advance(15300);
  await get(reporter,'Skip Vote').waitFor();
  await shot(reporter,'12-ballot');
  for(const p of [reporter,operator]){
    const row=p.page.locator('.ballot-row').filter({hasText:impostor.name});
    await row.getByRole('button',{name:'Vote',exact:true}).click();
    await get(p,'Confirm vote').click();
  }
  await get(impostor,'Skip Vote').click();
  await get(impostor,'Confirm vote').click();
  await until(()=>players.every(p=>p.s.phase==='verdict'),'Ballot ejection on all browsers');
  await shot(reporter,'13-vote-result');
  await advance(4900);
  await until(()=>players.every(p=>p.s.outcome?.team==='crew'),'Crew wins');
  await shot(host,'14-victory');
  await get(host,'Play Again').click();
  await until(()=>players.every(p=>p.s.phase==='lobby'),'Private room returns to shuttle');
  guests[0].s=null;
  await guests[0].page.reload();
  await until(()=>guests[0].s?.roster.some(q=>q.name===guests[0].name&&q.online),'Guest resumes after reload');
  await get(host,'START').click();
  await until(()=>players.every(p=>p.s.round===2&&p.s.phase==='reveal'),'Second round starts in same room');
  assert.ok(players.every(p=>p.s.settings.speed===210&&p.s.self.assignments.length===4));
  await advance(11000);
  const secondImpostor=players.find(p=>p.s.self.team==='impostor');
  await get(secondImpostor,'Sabotage').click();
  await get(secondImpostor,'OXYGEN').click();
  await until(()=>players.every(p=>p.s.sabotage?.kind==='oxygen'),'Second round started with the same lobby settings');
  await advance(40500);
  await until(()=>players.every(p=>p.s.outcome?.team==='impostor'),'Second round ends after the alarm deadline');
  await get(host,'Play Again').click();
  await until(()=>players.every(p=>p.s.phase==='lobby'),'Return to dropship again');

  const fifth=await player('Noor');
  await get(fifth,'JOIN ROOM').click();
  await fifth.page.getByLabel('Nickname').fill(fifth.name);
  await fifth.page.getByLabel('Room code').fill(host.s.code);
  await get(fifth,'Join room').click();
  const five=[...players,fifth];
  await until(()=>five.every(p=>p.s?.roster.length===5),'Fifth independent browser joins');
  await get(host,'Settings').click();
  await get(host,'Meetings').click();
  for(const [label,value] of [['Emergency Meetings',5],['Emergency Cooldown',5],['Voting Time',15],['Discussion Time',15],['End Voting Early',false],['Confirm Ejects',false]])await setting(label,value);
  await get(host,'Tasks').click();
  for(const [label,value] of [['Common Tasks',0],['Long Tasks',1],['Short Tasks',0],['Task Bar Updates','meetings']])await setting(label,value);
  await shot(host,'53-settings-selection');
  await get(host,'Save Settings').click();
  await until(()=>five.every(p=>p.s.settings.voting===15),'Updated ballot settings reached all five players');
  await get(host,'START').click();
  await until(()=>five.every(p=>p.s.round===3&&p.s.phase==='reveal'),'Five browsers start the next round');
  assert.ok(five.every(p=>p.s.self.assignments.length===1&&p.s.progress===null));
  await advance(8500);
  const thirdImpostor=five.find(p=>p.s.self.team==='impostor');
  const [suspect,other]=five.filter(p=>p!==thirdImpostor&&p!==fifth);
  const verdict=async (targets,{name,tie=false,ejected=null,ratings,disconnect,heading})=>{
    await navigate(host,deck.cafe);
    await host.page.keyboard.press('Space');
    await until(()=>five.every(p=>p.s.meeting?.kind==='emergency'),'New emergency reaches five players');
    const deadline=host.s.meeting;
    assert.equal(deadline.voteAt-deadline.introUntil,15000);
    assert.equal(deadline.end-deadline.voteAt,15000);
    assert.deepEqual(host.s.progress,{done:0,total:4});
    await advance(16900);
    for(const [i,who] of targets.entries()){
      if(who===null)continue;
      const voter=five[i];
      if(who==='skip')await get(voter,'Skip Vote').click();
      else await voter.page.locator('.ballot-row').filter({hasText:who.name}).getByRole('button',{name:'Vote',exact:true}).click();
      await get(voter,'Confirm vote').click();
      await until(()=>voter.s.meeting?.myVote===(who==='skip'?'skip':who.s.self.id),'Ballot acknowledged for '+voter.name);
    }
    if(disconnect){
      await disconnect.page.goto('about:blank');
      await until(()=>host.s.roster.some(p=>p.id===disconnect.s.self.id&&!p.online),'Disconnected candidate is offline');
    }
    assert.ok(host.s.phase==='meeting');
    const online=five.filter(p=>p!==disconnect);
    await advance(15300);
    await until(()=>online.every(p=>p.s.phase==='verdict'),'Every connected browser sees the same verdict');
    const result=host.s.meeting.result;
    assert.deepEqual(result.counts,Object.fromEntries(ratings.map(([candidate,count])=>[candidate==='skip'?'skip':candidate.s.self.id,count])));
    assert.equal(result.target?.id||null,ejected?.s.self.id||null);
    assert.equal(result.tie,tie);assert.equal(result.votes,null);assert.equal(result.role,null);assert.equal(result.override,false);
    assert.ok(online.every(p=>JSON.stringify(p.s.meeting.result)===JSON.stringify(result)));
    await host.page.getByRole('heading',{name:heading,exact:true}).waitFor();
    await shot(host,name);
    if(disconnect){
      await disconnect.page.goto(address);
      await until(()=>host.s.roster.some(p=>p.id===disconnect.s.self.id&&p.online),'Offline player resumes');
    }
    await advance(ejected?4900:10100);
    if(!ejected)await until(()=>five.every(p=>p.s.phase==='play'),'No player was ejected and play continues');
    if(!ejected)await advance(5100);
  };
  await verdict([suspect,suspect,other,other,null],{name:'54-player-tie',tie:true,ratings:[[suspect,2],[other,2]],heading:'Vote tied'});
  await verdict(['skip','skip','skip',suspect,suspect],{name:'55-skip-majority',ratings:[['skip',3],[suspect,2]],heading:'Skipped vote'});
  await verdict(['skip','skip',suspect,suspect,fifth],{name:'56-offline-tie',tie:true,ratings:[['skip',2],[suspect,2]],disconnect:fifth,heading:'Vote tied'});
  await verdict(Array(5).fill('skip'),{name:'57-all-skip',ratings:[['skip',5]],heading:'Skipped vote'});
  await verdict([thirdImpostor,thirdImpostor,thirdImpostor,suspect,suspect],{name:'58-majority-ejects',ejected:thirdImpostor,ratings:[[thirdImpostor,3],[suspect,2]],heading:thirdImpostor.name+' ejected'});
  await until(()=>five.every(p=>p.s.outcome?.team==='crew'),'Crew wins after the majority ejection');
  assert.deepEqual(runtimeErrors,[]);
  console.log('Five independent Chromium contexts verified task settings and five ballot outcomes across three consecutive matches.');
} finally {
  await browser?.close();
  await close();
}
