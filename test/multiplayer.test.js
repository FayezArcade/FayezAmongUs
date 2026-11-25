import assert from 'node:assert/strict';
import {test} from 'node:test';
import {once} from 'node:events';
import {setTimeout as wait} from 'node:timers/promises';
import {io} from 'socket.io-client';
import {createGameServer} from '../server/index.js';
import {deck,deckRevision,dist,tasks,terminal,vents,repairs,doors} from '../shared/deck.js';

import {deckWaypoints} from './deck-route.mjs';

async function navigate(p,point){
  for(const q of deckWaypoints(p.s.self,point))await drive(p,q.x,q.y);
}
async function until(fn,limit=6500){
  const end=Date.now()+limit;
  while(Date.now()<end){
    const value=fn();if(value)return value;
    await wait(22);
  }
  assert.fail('Expected state transition timed out.');
}
async function fixture(t,count=4){
  let jump=0;
  const server=createGameServer({now:()=>Date.now()+jump});
  server.server.listen(0,'127.0.0.1');await once(server.server,'listening');
  const root='http://127.0.0.1:'+server.server.address().port;
  const peers=[];
  async function connect(){
    const socket=io(root,{transports:['websocket'],forceNew:true});
    const p={socket,s:null,entry:(data)=>socket.timeout(2500).emitWithAck('enter',{deck:deckRevision,...data}),act:(kind,data)=>socket.timeout(2500).emitWithAck('command',{kind,data})};
    peers.push(p);socket.on('state',s=>{p.s=s;});
    await once(socket,'connect');return p;
  }
  t.after(async()=>{for(const p of peers)p.socket.disconnect();await server.close();});
  assert.deepEqual(await fetch(root+'/health').then(r=>r.json()),{ok:true,game:'Fayez Crew',deck:deckRevision});
  assert.equal((await fetch(root+'/socket.io/?EIO=4&transport=polling',{headers:{Origin:'https://untrusted.invalid'}})).status,403);
  const players=await Promise.all(Array.from({length:count},connect));
  const [host,...others]=players;
  const session=await host.entry({kind:'create',name:'Ari'});assert.ok(session.ok);
  for(const [i,p] of others.entries())assert.ok((await p.entry({kind:'join',name:['Jun','Mina','Sol','Noor','Sam'][i],code:session.code})).ok);
  await until(()=>players.every(p=>p.s?.roster.length===count));
  const advance=async millis=>{jump+=millis;await wait(105);};
  return {players,host,session,connect,advance};
}
async function drive(p,x,y){
  const start=Date.now();
  while(Date.now()-start<6200){
    const here=p.s.self, d=dist(here,{x,y});
    if(d<8){p.socket.emit('move',{x:0,y:0});return;}
    p.socket.emit('move',{x:(x-here.x)/Math.max(32,d),y:(y-here.y)/Math.max(32,d)});
    await wait(45);
  }
  assert.fail('Could not reach '+x+', '+y+' from '+JSON.stringify(p.s.self));
}
test('four private clients play, repair, report, vote, reset and start a second round', {timeout:75000}, async t=>{
  const {players,host,advance,connect,session}=await fixture(t);
  assert.ok(Object.values(host.s.settings.roles).every(r=>!r.enabled));
  assert.equal((await players[1].act('start')).ok,false);
  assert.equal((await host.act('practiceRole',{role:'phantom'})).ok,false);
  assert.equal((await host.act('chat',{text:'Lobby text'})).ok,false);
  assert.equal((await host.act('suit',{color:'sky',hat:1})).ok,false);
  await drive(host,terminal.x,terminal.y);
  assert.equal((await host.act('suit',{color:players[1].s.self.color,hat:1})).ok,false);
  assert.ok((await host.act('suit',{color:'sky',hat:2})).ok);
  await until(()=>players[2].s.roster.some(q=>q.color==='sky'&&q.hat===2));
  assert.ok((await host.act('settings',{impostors:3})).ok);
  assert.equal((await host.act('start')).ok,false);
  assert.ok((await host.act('settings',{impostors:1,discussion:5,voting:10,shortTasks:1,longTasks:0,commonTasks:2,killCooldown:10,anonymous:false,speed:240})).ok);
  assert.ok((await host.act('start')).ok);
  await until(()=>players.every(p=>p.s.phase==='reveal'));
  const villain=players.find(p=>p.s.self.team==='impostor'), crew=players.filter(p=>p!==villain);
  assert.ok(villain&&crew.length===3);
  for(const p of crew){
    assert.deepEqual(p.s.self.allies,[]);
    assert.ok(p.s.roster.every(q=>!('team' in q)&&!('role' in q)&&!('token' in q)));
  }
  await advance(3900);
  assert.equal((await villain.act('sabotage',{kind:'lights'})).ok,false);
  assert.equal((await villain.act('strike',{target:crew[0].s.self.id})).ok,false);
  const worker=crew[0];
  assert.equal((await worker.act('chat',{text:'Gameplay text'})).ok,false);
  const card=tasks.find(v=>v.id==='card').stops[0];
  assert.equal((await worker.act('taskOpen',{id:'card'})).ok,false);
  await navigate(worker,card);
  assert.ok((await worker.act('taskOpen',{id:'card'})).puzzle);
  assert.equal((await worker.act('taskStep',{type:'swipe'})).done,undefined);
  await worker.act('taskStep',{type:'begin'});await advance(450);
  assert.equal((await worker.act('taskStep',{type:'swipe'})).done,true);
  assert.equal((await worker.act('taskStep',{type:'swipe'})).ok,false);
  await until(()=>worker.s.progress.done===1);
  await advance(11000);
  assert.ok((await villain.act('sabotage',{kind:'lights'})).ok);
  await until(()=>crew.every(p=>p.s.sabotage?.kind==='lights'&&p.s.vision===82));
  await navigate(worker,repairs.lights[0]);
  await until(()=>worker.s.sabotage.nearby.length);
  for(const [i,on] of worker.s.sabotage.pattern.entries())if(!on)assert.ok((await worker.act('repair',{index:0,a:i})).ok);
  await until(()=>!worker.s.sabotage);
  const [victim,reporter]=crew.filter(p=>p!==worker);
  await Promise.all([villain,victim,reporter].map(p=>navigate(p,deck.cafe)));
  assert.ok((await villain.act('strike',{target:victim.s.self.id})).ok);
  assert.equal((await villain.act('strike',{target:reporter.s.self.id})).ok,false);
  await until(()=>!victim.s.self.alive&&reporter.s.bodies.length);
  assert.ok((await reporter.act('report',{id:victim.s.self.id})).ok);
  await until(()=>players.every(p=>p.s.phase==='meeting'));
  assert.equal((await reporter.act('chat',{text:'Intro text'})).ok,false);
  await advance(1900);
  assert.ok((await victim.act('chat',{text:'Ghost channel'})).ok);
  assert.ok((await reporter.act('chat',{text:'I found the incident.'})).ok);
  assert.equal((await reporter.act('chat',{text:'spam'})).ok,false);
  await until(()=>reporter.s.chat.length===1&&victim.s.chat.length===2);
  assert.equal((await reporter.act('vote',{id:villain.s.self.id})).ok,false);
  await advance(7000);
  assert.equal((await victim.act('vote',{id:villain.s.self.id})).ok,false);
  for(const p of [reporter,worker,villain])assert.ok((await p.act('vote',{id:p===villain?'skip':villain.s.self.id})).ok);
  await until(()=>players.every(p=>p.s.phase==='verdict'));
  assert.equal(reporter.s.meeting.result.target.id,villain.s.self.id);
  await advance(5000);
  await until(()=>players.every(p=>p.s.outcome?.team==='crew'));
  assert.ok((await host.act('reset')).ok);
  await until(()=>players.every(p=>p.s.phase==='lobby'&&p.s.self.alive&&p.s.progress.total===0));
  host.socket.disconnect();
  await until(()=>players[1].s.host!==session.id);
  const rejoined=await connect();
  assert.ok((await rejoined.entry({kind:'resume',code:session.code,token:session.token})).ok);
  await until(()=>rejoined.s?.roster.every(q=>q.online));
  const newHost=players.find(p=>p!==host&&p.s.self.id===rejoined.s.host);
  assert.ok((await newHost.act('start')).ok);
  await until(()=>rejoined.s.round===2&&rejoined.s.phase==='reveal');
});

test('optional roles respect zero and full chance and critical timeout wins', {timeout:15000},async t=>{
  const {host,players,advance}=await fixture(t);
  const roles={scientist:{enabled:true,max:1,chance:0},phantom:{enabled:true,max:1,chance:100,cooldown:14,duration:7},angel:{enabled:true,max:1,chance:100}};
  assert.equal((await players[2].act('settings',{roles})).ok,false);
  assert.ok((await host.act('settings',{roles})).ok);
  assert.ok((await host.act('start')).ok);
  await until(()=>players.every(p=>p.s.phase==='reveal'));
  assert.equal(players.filter(p=>p.s.self.role==='scientist').length,0);
  const phantom=players.find(p=>p.s.self.role==='phantom');assert.ok(phantom);
  assert.equal(phantom.s.self.team,'impostor');
  await advance(4000);
  assert.ok((await phantom.act('ability')).ok);
  assert.equal((await phantom.act('ability')).ok,false);
  await until(()=>phantom.s.self.effect==='phantom');
  for(const p of players.filter(p=>p!==phantom))assert.ok(!p.s.positions.some(q=>q.id===phantom.s.self.id));
  await advance(7500);
  assert.ok((await phantom.act('sabotage',{kind:'oxygen'})).ok);
  await until(()=>players.every(p=>p.s.sabotage?.kind==='oxygen'));
  assert.equal((await host.act('emergency')).ok,false);
  await advance(41000);
  await until(()=>players.every(p=>p.s.outcome?.team==='impostor'));
  assert.match(host.s.outcome.reason,/oxygen/);
});

test('engineer hatch travel is gated and the complete assignment pool wins the round',{timeout:52000},async t=>{
  const {host,players,advance}=await fixture(t);
  assert.ok((await host.act('settings',{shortTasks:0,longTasks:0,commonTasks:2,speed:240,
    roles:{engineer:{enabled:true,max:3,chance:100,cooldown:20,duration:8}}})).ok);
  assert.ok((await host.act('start')).ok);
  await until(()=>players.every(p=>p.s.phase==='reveal'));
  const crew=players.filter(p=>p.s.self.role==='engineer');
  assert.equal(crew.length,3);
  await advance(3800);
  const worker=crew[0];
  assert.equal((await worker.act('vent',{action:'enter'})).ok,false);
  await navigate(worker,vents[0]);
  assert.ok((await worker.act('ability')).ok);
  assert.ok((await worker.act('vent',{action:'enter'})).ok);
  await until(()=>worker.s.self.ventIndex===0);
  assert.ok(worker.s.self.effectUntil-worker.s.now<=8000);
  assert.equal((await worker.act('vent',{dest:4})).ok,false);
  await advance(750);
  assert.ok((await worker.act('vent',{dest:9})).ok);
  await until(()=>worker.s.self.ventIndex===9);
  assert.ok((await worker.act('vent',{action:'exit'})).ok);
  await until(()=>worker.s.self.ventIndex===null&&worker.s.self.abilityAt-worker.s.now>19000);
  assert.equal((await worker.act('ability')).ok,false);
  const wire=tasks.find(v=>v.instrument==='wire'&&worker.s.self.assignments.some(a=>a.id===v.id)), badge=tasks.find(v=>v.id==='card').stops[0];
  await Promise.all(crew.map(async p=>{
    for(const stop of wire.stops){
      await navigate(p,stop);
      const open=await p.act('taskOpen',{id:wire.id});assert.ok(open.puzzle);
      for(const c of open.puzzle.left)assert.ok((await p.act('taskStep',{type:'pair',a:c,b:c})).ok);
    }
    await navigate(p,badge);
    assert.ok((await p.act('taskOpen',{id:'card'})).puzzle);
    assert.ok((await p.act('taskStep',{type:'begin'})).ok);
    await wait(500);
    assert.equal((await p.act('taskStep',{type:'swipe'})).done,true);
  }));
  await until(()=>players.every(p=>p.s.outcome?.team==='crew'));
  assert.match(host.s.outcome.reason,/restored every/);
});

test('a solo flight exposes stations and practice tools, survives sabotage, and can relaunch',{timeout:18000},async t=>{
  const {host,session,advance,connect}=await fixture(t,1);
  const guest=await connect();
  assert.ok((await guest.entry({kind:'join',code:session.code,name:'Sol'})).ok);
  await until(()=>host.s?.roster.length===2);
  assert.equal((await host.act('start')).ok,false);
  await guest.act('leave');
  await until(()=>host.s?.roster.length===1);
  assert.match(session.code,/^[A-Z2-9]{6}$/);
  assert.ok((await host.act('start')).ok);
  await until(()=>host.s.phase==='countdown'&&host.s.solo);
  await advance(3100);
  assert.equal(host.s.phase,'reveal');
  assert.equal(host.s.self.team,'crew');
  await advance(3500);
  assert.equal(host.s.phase,'play');
  assert.equal(host.s.self.assignments.length,tasks.length);
  const card=tasks.find(q=>q.id==='card').stops[0];
  await navigate(host,card);
  assert.ok((await host.act('taskOpen',{id:'card'})).puzzle);
  await host.act('taskStep',{type:'begin'});await advance(450);
  assert.equal((await host.act('taskStep',{type:'swipe'})).done,true);
  await until(()=>host.s.progress.done===1);
  assert.ok((await host.act('practiceRole',{role:'scientist'})).ok);
  assert.ok((await host.act('ability')).ok);
  await until(()=>host.s.tactical.vitals?.[0]?.alive);
  assert.equal((await host.act('practiceRole',{role:'judge'})).ok,false);
  await advance(8000);
  assert.ok((await host.act('sabotage',{kind:'oxygen'})).ok);
  await until(()=>host.s.sabotage?.kind==='oxygen');
  await advance(41000);
  assert.equal(host.s.phase,'play');
  assert.equal(host.s.sabotage,null);
  assert.ok((await host.act('practiceReturn')).ok);
  await until(()=>host.s.phase==='lobby'&&!host.s.solo);
  assert.equal(host.s.code,session.code);
  assert.ok((await host.act('start')).ok);
  await advance(3200);
  assert.equal(host.s.round,2);
  assert.equal(host.s.self.role,null);
  assert.equal(host.s.progress.done,0);
});

test('a private dropship supports ten people and rejects an eleventh',async t=>{
  const {host,connect,session}=await fixture(t,1);
  const guests=await Promise.all(Array.from({length:10},connect));
  for(const [i,p] of guests.entries()){
    const res=await p.entry({kind:'join',code:session.code,name:'Guest '+i});
    assert.equal(res.ok,i<9);
    if(!res.ok)assert.match(res.error,/full/i);
  }
  await until(()=>host.s.roster.length===10);
  assert.equal(new Set(host.s.roster.map(p=>p.color)).size,10);
});

test('meeting keeps discussion and voting separate, supports a full anonymous tie timer, then resumes',{timeout:13000},async t=>{
  const {host,players,advance}=await fixture(t);
  await host.act('settings',{discussion:15,voting:17,anonymous:true,confirm:false,early:false,taskBar:'meetings',emergencies:2});
  await host.act('start');
  await advance(3100);
  await advance(16000);
  assert.ok(players.every(p=>p.s.progress===null));
  await navigate(host,deck.cafe);
  assert.ok((await host.act('emergency')).ok);
  await until(()=>players.every(p=>p.s.meeting?.kind==='emergency'&&p.s.progress));
  assert.equal(host.s.self.emergencies,1);
  assert.ok(players.filter(p=>p!==host).every(p=>p.s.self.emergencies===2));
  const m=host.s.meeting;
  assert.ok(players.every(p=>p.s.meeting.caller===host.s.self.id&&p.s.meeting.introUntil===m.introUntil));
  assert.equal(m.voteAt-m.introUntil,15000);
  assert.equal(m.end-m.voteAt,17000);
  assert.equal((await host.act('vote',{id:'skip'})).ok,false);
  await advance(15300);
  assert.equal((await host.act('vote',{id:'skip'})).ok,false);
  await advance(1800);
  for(const [i,p] of players.entries())assert.ok((await p.act('vote',{id:i<2?'skip':host.s.self.id})).ok);
  assert.equal((await host.act('vote',{id:'skip'})).ok,false);
  await until(()=>players.every(p=>p.s.meeting?.voted.length===4));
  assert.ok(players.every(p=>p.s.phase==='meeting'&&p.s.meeting.result===null));
  await advance(17300);
  await until(()=>players.every(p=>p.s.phase==='verdict'&&p.s.meeting.result.tie));
  assert.equal(host.s.meeting.result.votes,null);
  assert.equal(host.s.meeting.result.target,null);
  await advance(4900);
  await until(()=>players.every(p=>p.s.phase==='play'&&p.s.self.alive&&p.s.progress===null));
  assert.equal((await host.act('emergency')).ok,false);
});

test('a closed bulkhead blocks movement on every client and reopens on the server',{timeout:20000},async t=>{
  const {host,players,advance}=await fixture(t);
  assert.ok((await host.act('settings',{speed:240})).ok);
  assert.ok((await host.act('start')).ok);
  await advance(3100);
  await advance(11000);
  const villain=players.find(p=>p.s.self.team==='impostor');
  const mover=players.find(p=>p!==villain);
  const door=doors.find(d=>d.label==='Cafeteria · east hall');
  await navigate(mover,door);
  assert.match((await villain.act('sabotage',{kind:'doors',door:door.id})).error,/obstructed/i);
  await drive(mover,door.x-49,door.y);
  assert.ok((await villain.act('sabotage',{kind:'doors',door:door.id})).ok);
  await until(()=>players.every(p=>p.s.doors.includes(door.id)));
  for(let i=0;i<10;i++){
    mover.socket.emit('move',{x:1,y:0});
    await wait(55);
  }
  mover.socket.emit('move',{x:0,y:0});
  assert.ok(mover.s.self.x<=door.x-16);
  await advance(9600);
  await until(()=>players.every(p=>!p.s.doors.includes(door.id)));
  await drive(mover,door.x+38,door.y);
  assert.ok(mover.s.self.x>door.x);
});

test('the sample analyzer keeps its countdown after cancel and reopening',{timeout:15000},async t=>{
  const {host,advance}=await fixture(t,1);
  assert.ok((await host.act('settings',{speed:240})).ok);
  assert.ok((await host.act('start')).ok);
  await advance(3100);
  await advance(3500);
  const station=tasks.find(v=>v.id==='sample').stops[0];
  await navigate(host,station);
  const opened=await host.act('taskOpen',{id:'sample'});
  assert.equal(opened.puzzle.ready,null);
  const started=await host.act('taskStep',{type:'beginSample'});
  assert.ok(started.puzzle.ready);
  assert.equal(started.puzzle.odd,undefined);
  assert.ok((await host.act('taskClose')).ok);
  await advance(12100);
  const resumed=await host.act('taskOpen',{id:'sample'});
  assert.equal(resumed.puzzle.ready,started.puzzle.ready);
  assert.ok(Number.isInteger(resumed.puzzle.odd));
  assert.equal((await host.act('taskStep',{type:'sample',a:resumed.puzzle.odd})).done,true);
  assert.equal((await host.act('taskStep',{type:'sample',a:resumed.puzzle.odd})).ok,false);
  await until(()=>host.s.progress.done===1);
});


test('host values govern movement, vision, assignments and strike distance across rounds',{timeout:26000},async t=>{
  const {host,players,advance}=await fixture(t);
  async function slide(speed,dy){
    assert.ok((await host.act('settings',{speed})).ok);
    await until(()=>host.s.settings.speed===speed);
    const from=host.s.self.y;
    for(let i=0;i<6;i++){host.socket.emit('move',{x:0,y:dy});await wait(65);}
    host.socket.emit('move',{x:0,y:0});
    await wait(90);
    return Math.abs(host.s.self.y-from);
  }
  const slow=await slide(100,1),fast=await slide(210,-1);
  assert.ok(slow>18&&fast>slow*1.55,{slow,fast});
  const config={emergencies:0,meetingCooldown:16,crewVision:155,impostorVision:450,killDistance:32,killCooldown:31,
    commonTasks:2,shortTasks:2,longTasks:2,anonymous:false,confirm:false,early:false,visualTasks:false,taskBar:'never'};
  assert.equal((await players[1].act('settings',config)).ok,false);
  assert.ok((await host.act('settings',config)).ok);
  await until(()=>players.every(p=>p.s.settings.killDistance===32));
  assert.ok((await host.act('start')).ok);
  await advance(3100);
  await advance(4000);
  const villain=players.find(p=>p.s.self.team==='impostor');
  const [victim,second]=players.filter(p=>p!==villain);
  assert.ok(players.every(p=>p.s.progress===null&&p.s.self.emergencies===0));
  assert.equal(villain.s.self.killAt-villain.s.until,31000);
  assert.equal(villain.s.self.meetingAt-villain.s.until,16000);
  for(const p of players){
    assert.equal(p.s.vision,p===villain?450:155);
    const kinds=p.s.self.assignments.map(a=>tasks.find(task=>task.id===a.id).kind).sort();
    assert.deepEqual(kinds,['common','common','long','long','short','short']);
  }
  await Promise.all([
    navigate(villain,{x:deck.cafe.x,y:deck.cafe.y+100}),
    navigate(victim,{x:deck.cafe.x+54,y:deck.cafe.y+100}),
    navigate(second,{x:deck.cafe.x,y:deck.cafe.y+305})
  ]);
  await until(()=>villain.s.positions.some(q=>q.id===second.s.self.id)&&second.s.positions.every(q=>q.id!==villain.s.self.id));
  assert.equal((await villain.act('strike',{target:victim.s.self.id})).ok,false);
  await advance(32000);
  assert.equal((await villain.act('strike',{target:victim.s.self.id})).ok,false);
  assert.equal((await villain.act('emergency')).ok,false);
  await navigate(villain,{x:victim.s.self.x-14,y:victim.s.self.y});
  assert.ok((await villain.act('strike',{target:victim.s.self.id})).ok);
  await navigate(second,villain.s.self);
  assert.equal((await villain.act('strike',{target:second.s.self.id})).ok,false);
  await advance(31200);
  assert.ok((await villain.act('strike',{target:second.s.self.id})).ok);
  await until(()=>host.s.outcome?.team==='impostor');
  assert.ok((await host.act('reset')).ok);
  await until(()=>players.every(p=>p.s.phase==='lobby'&&p.s.settings.killCooldown===31&&p.s.settings.visualTasks===false));
  assert.ok((await host.act('start')).ok);
  await advance(3100);
  await until(()=>players.every(p=>p.s.round===2&&p.s.self.emergencies===0));
});

test('visual scanner cues follow the host setting',{timeout:22000},async t=>{
  const {host,advance}=await fixture(t,1);
  const scan=tasks.find(task=>task.id==='scan').stops[0];
  for(const visualTasks of [false,true]){
    assert.ok((await host.act('settings',{visualTasks,speed:240})).ok);
    await host.act('start');
    await advance(3100);await advance(3500);
    await navigate(host,scan);
    assert.ok((await host.act('taskOpen',{id:'scan'})).ok);
    assert.ok((await host.act('taskStep',{type:'begin'})).ok);
    await until(()=>Number.isFinite(host.s.puzzle?.hold)&&host.s.positions.some(p=>p.id===host.s.self.id&&p.scanning===visualTasks));
    await advance(1600);
    assert.ok((await host.act('taskStep',{type:'finish'})).done);
    assert.ok((await host.act('practiceReturn')).ok);
    await until(()=>host.s.phase==='lobby');
  }
});


test('six players receive two infiltrators when the host selects two',{timeout:10000},async t=>{
  const {host,players,advance}=await fixture(t,6);
  assert.ok((await host.act('settings',{impostors:2})).ok);
  assert.ok((await host.act('start')).ok);
  await advance(3100);
  await until(()=>players.every(p=>p.s.phase==='reveal'));
  const infiltrators=players.filter(p=>p.s.self.team==='impostor');
  assert.equal(infiltrators.length,2);
  assert.ok(infiltrators.every(p=>p.s.self.allies.length===2));
  assert.ok(players.filter(p=>!infiltrators.includes(p)).every(p=>p.s.self.allies.length===0));
});


test('a living cleaner ejects a concealed hatch occupant and temporarily blocks re-entry',{timeout:23000},async t=>{
  const {host,players,advance}=await fixture(t);
  assert.ok((await host.act('settings',{shortTasks:10,speed:240})).ok);
  assert.ok((await host.act('start')).ok);
  await advance(3100);await advance(3600);
  const villain=players.find(p=>p.s.self.team==='impostor');
  const cleaner=players.find(p=>p!==villain);
  const assignment=cleaner.s.self.assignments.find(a=>a.id.startsWith('clean'));
  const stop=tasks.find(task=>task.id===assignment.id).stops[0],index=vents.indexOf(stop);
  await Promise.all([navigate(cleaner,stop),navigate(villain,stop)]);
  assert.ok((await villain.act('vent',{action:'enter'})).ok);
  await until(()=>villain.s.self.ventIndex===index&&cleaner.s.positions.every(p=>p.id!==villain.s.self.id));
  assert.ok(cleaner.s.hatchEffects.some(e=>e.kind==='enter'&&e.index===index));
  assert.ok((await cleaner.act('taskOpen',{id:assignment.id})).ok);
  await until(()=>villain.s.self.ventIndex===null&&cleaner.s.positions.some(p=>p.id===villain.s.self.id));
  await advance(1000);
  assert.match((await villain.act('vent',{action:'enter'})).error,/being serviced/);
  assert.ok((await cleaner.act('taskClose')).ok);
  assert.ok((await villain.act('vent',{action:'enter'})).ok);
});
