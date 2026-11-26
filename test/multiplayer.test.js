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
async function fixture(t,count=4,options={}){
  let jump=0;
  const server=createGameServer({now:()=>Date.now()+jump,...options});
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
  assert.deepEqual(await fetch(root+'/health').then(r=>r.json()),{ok:true,game:'Fayez Among Us',deck:deckRevision});
  assert.equal((await fetch(root+'/socket.io/?EIO=4&transport=polling',{headers:{Origin:'https://untrusted.invalid'}})).status,403);
  const players=await Promise.all(Array.from({length:count},connect));
  const [host,...others]=players;
  const session=await host.entry({kind:'create',name:'Ari'});assert.ok(session.ok);
  for(const [i,p] of others.entries())assert.ok((await p.entry({kind:'join',name:['Jun','Mina','Sol','Noor','Sam'][i],code:session.code})).ok);
  await until(()=>players.every(p=>p.s?.roster.length===count));
  const advance=async millis=>{jump+=millis;await wait(105);};
  return {players,host,session,connect,advance};
}
const prioritizeTask=id=>families=>families.sort((a,b)=>Number(b.some(task=>task.id===id))-Number(a.some(task=>task.id===id)));
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
  assert.ok((await host.act('settings',{impostors:1,discussion:15,voting:15,shortTasks:1,longTasks:0,commonTasks:2,killCooldown:10,anonymous:false,speed:245})).ok);
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
  assert.equal(worker.s.progress.total,9);
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
  await advance(16000);
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
  const roles={scientist:{enabled:true,max:1,chance:0},phantom:{enabled:true,max:1,chance:100,cooldown:15,duration:5},angel:{enabled:true,max:1,chance:100}};
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
  assert.ok((await host.act('settings',{shortTasks:0,longTasks:0,commonTasks:2,speed:245,
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
      const stage=wire.stops.indexOf(stop)+1;
      await until(()=>p.s.self.assignments.some(a=>a.id===wire.id&&a.stage===stage&&a.done===(stage===wire.stops.length)));
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

test('fewer than four clients cannot launch, including after a disconnect',async t=>{
  const {host,session,advance,connect}=await fixture(t,3);
  assert.match((await host.act('start')).error,/at least 4/);
  const guest=await connect();
  assert.ok((await guest.entry({kind:'join',code:session.code,name:'Noor'})).ok);
  await until(()=>host.s.roster.filter(p=>p.online).length===4);
  assert.ok((await host.act('start')).ok);
  guest.socket.disconnect();
  await until(()=>host.s.roster.filter(p=>p.online).length===3);
  await advance(3100);
  assert.equal(host.s.phase,'lobby');
  assert.match((await host.act('start')).error,/at least 4/);
  for(const cmd of ['practiceRole','practiceMeeting','practiceClear','practiceReturn']){
    assert.match((await host.act(cmd)).error,/unknown action/i);
  }
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
  await host.act('settings',{discussion:15,voting:15,anonymous:true,confirm:false,early:false,taskBar:'meetings',emergencies:2});
  await host.act('start');
  await advance(3100);
  await advance(19000);
  assert.ok(players.every(p=>p.s.progress===null));
  await navigate(host,deck.cafe);
  assert.ok((await host.act('emergency')).ok);
  await until(()=>players.every(p=>p.s.meeting?.kind==='emergency'&&p.s.progress));
  assert.equal(host.s.self.emergencies,1);
  assert.ok(players.filter(p=>p!==host).every(p=>p.s.self.emergencies===2));
  const m=host.s.meeting;
  assert.ok(players.every(p=>p.s.meeting.caller===host.s.self.id&&p.s.meeting.introUntil===m.introUntil));
  assert.equal(m.voteAt-m.introUntil,15000);
  assert.equal(m.end-m.voteAt,15000);
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
  assert.ok((await host.act('settings',{speed:245})).ok);
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
  const {host,players,advance}=await fixture(t,4,{orderTasks:prioritizeTask('sample')});
  assert.ok((await host.act('settings',{speed:245,longTasks:1})).ok);
  assert.ok((await host.act('start')).ok);
  await advance(3100);
  await advance(3500);
  const worker=players.find(p=>p.s.self.team==='crew');
  const station=tasks.find(v=>v.id==='sample').stops[0];
  await navigate(worker,station);
  const opened=await worker.act('taskOpen',{id:'sample'});
  assert.equal(opened.puzzle.ready,null);
  const started=await worker.act('taskStep',{type:'beginSample'});
  assert.ok(started.puzzle.ready);
  assert.equal(started.puzzle.odd,undefined);
  assert.ok((await worker.act('taskClose')).ok);
  await advance(12100);
  const resumed=await worker.act('taskOpen',{id:'sample'});
  assert.equal(resumed.puzzle.ready,started.puzzle.ready);
  assert.ok(Number.isInteger(resumed.puzzle.odd));
  assert.equal((await worker.act('taskStep',{type:'sample',a:resumed.puzzle.odd})).done,true);
  assert.equal((await worker.act('taskStep',{type:'sample',a:resumed.puzzle.odd})).ok,false);
  await until(()=>worker.s.progress.done===1);
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
  const slow=await slide(105,1),fast=await slide(210,-1);
  assert.ok(slow>18&&fast>slow*1.55,{slow,fast});
  const config={emergencies:0,meetingCooldown:15,crewVision:145,impostorVision:435,killDistance:32,killCooldown:32.5,
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
  assert.equal(villain.s.self.killAt-villain.s.until,32500);
  assert.equal(villain.s.self.meetingAt-villain.s.until,15000);
  for(const p of players){
    assert.equal(p.s.vision,p===villain?435:145);
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
  await advance(33000);
  assert.equal((await villain.act('strike',{target:victim.s.self.id})).ok,false);
  assert.equal((await villain.act('emergency')).ok,false);
  await navigate(villain,{x:victim.s.self.x-14,y:victim.s.self.y});
  assert.ok((await villain.act('strike',{target:victim.s.self.id})).ok);
  await navigate(second,villain.s.self);
  assert.equal((await villain.act('strike',{target:second.s.self.id})).ok,false);
  await advance(32700);
  assert.ok((await villain.act('strike',{target:second.s.self.id})).ok);
  await until(()=>host.s.outcome?.team==='impostor');
  assert.ok((await host.act('reset')).ok);
  await until(()=>players.every(p=>p.s.phase==='lobby'&&p.s.settings.killCooldown===32.5&&p.s.settings.visualTasks===false));
  assert.ok((await host.act('start')).ok);
  await advance(3100);
  await until(()=>players.every(p=>p.s.round===2&&p.s.self.emergencies===0));
});

test('visual scanner cues follow the host setting for nearby crewmates',{timeout:28000},async t=>{
  const {host,players,advance}=await fixture(t,4,{orderTasks:prioritizeTask('scan')});
  const scan=tasks.find(task=>task.id==='scan').stops[0];
  for(const visualTasks of [false,true]){
    assert.ok((await host.act('settings',{visualTasks,speed:245,longTasks:1})).ok);
    assert.ok((await host.act('start')).ok);
    await advance(3100);await advance(3500);
    const [worker,observer]=players.filter(p=>p.s.self.team==='crew');
    await Promise.all([navigate(worker,scan),navigate(observer,scan)]);
    const opened=await worker.act('taskOpen',{id:'scan'});
    assert.ok(opened.ok,opened.error);
    assert.ok((await worker.act('taskStep',{type:'begin'})).ok);
    await until(()=>Number.isFinite(worker.s.puzzle?.hold)&&observer.s.positions.some(p=>p.id===worker.s.self.id&&p.scanning===visualTasks));
    await advance(1600);
    assert.ok((await worker.act('taskStep',{type:'finish'})).done);
    const villain=players.find(p=>p.s.self.team==='impostor');
    await advance(8000);
    assert.ok((await villain.act('sabotage',{kind:'oxygen'})).ok);
    await advance(41000);
    assert.ok((await host.act('reset')).ok);
    await until(()=>host.s.phase==='lobby');
  }
});

test('six players receive two impostors when the host selects two',{timeout:10000},async t=>{
  const {host,players,advance}=await fixture(t,6);
  assert.ok((await host.act('settings',{impostors:2})).ok);
  assert.ok((await host.act('start')).ok);
  await advance(3100);
  await until(()=>players.every(p=>p.s.phase==='reveal'));
  const impostors=players.filter(p=>p.s.self.team==='impostor');
  assert.equal(impostors.length,2);
  assert.ok(impostors.every(p=>p.s.self.allies.length===2));
  assert.ok(players.filter(p=>!impostors.includes(p)).every(p=>p.s.self.allies.length===0));
});


test('a living cleaner ejects a concealed hatch occupant and temporarily blocks re-entry',{timeout:23000},async t=>{
  const {host,players,advance}=await fixture(t);
  assert.ok((await host.act('settings',{shortTasks:10,speed:245})).ok);
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
  assert.match((await villain.act('vent',{action:'enter'})).error,/being cleaned/);
  assert.ok((await cleaner.act('taskClose')).ok);
  assert.ok((await villain.act('vent',{action:'enter'})).ok);
});

test('task counts, shared common routes and crew totals follow four different lobby configurations',async t=>{
  const {host,players,advance}=await fixture(t);
  const combos=[[1,1,3],[2,0,1],[0,0,0],[2,5,10]];
  for(const [index,[commonTasks,longTasks,shortTasks]] of combos.entries()){
    const saved=await host.act('settings',{commonTasks,longTasks,shortTasks});
    assert.ok(saved.ok);
    assert.deepEqual([saved.settings.commonTasks,saved.settings.longTasks,saved.settings.shortTasks],combos[index]);
    assert.ok((await host.act('start')).ok);
    await advance(3100);await advance(3500);
    await until(()=>players.every(p=>p.s.phase==='play'&&p.s.round===index+1));
    const expected=commonTasks+longTasks+shortTasks;
    const commonIds=p=>p.s.self.assignments.filter(a=>tasks.find(task=>task.id===a.id).kind==='common').map(a=>a.id);
    for(const p of players){
      const assignments=p.s.self.assignments;
      assert.equal(assignments.length,expected);
      assert.equal(new Set(assignments.map(a=>a.id)).size,expected);
      assert.deepEqual(commonIds(p),commonIds(host));
      for(const [kind,count] of [['common',commonTasks],['long',longTasks],['short',shortTasks]]){
        assert.equal(assignments.filter(a=>tasks.find(task=>task.id===a.id).kind===kind).length,count);
      }
      assert.deepEqual(p.s.progress,{done:0,total:3*expected});
    }
    if(commonTasks===2){
      const villain=players.find(p=>p.s.self.team==='impostor');
      await navigate(villain,tasks.find(task=>task.id==='card').stops[0]);
      assert.ok((await villain.act('taskOpen',{id:'card'})).ok);
      await villain.act('taskStep',{type:'begin'});await advance(450);
      assert.equal((await villain.act('taskStep',{type:'swipe'})).done,true);
      await until(()=>villain.s.self.assignments.find(a=>a.id==='card').done);
      assert.equal(villain.s.progress.done,0);
    }
    await advance(8000);
    const villain=players.find(p=>p.s.self.team==='impostor');
    assert.ok((await villain.act('sabotage',{kind:'reactor'})).ok);
    await advance(41000);
    assert.ok((await host.act('reset')).ok);
    await until(()=>players.every(p=>p.s.phase==='lobby'));
  }
});

test('a disconnected candidate cannot win and a reconnected voter cannot vote twice',async t=>{
  const {host,session,players,advance,connect}=await fixture(t);
  const [,a,b,c]=players;
  await host.act('settings',{discussion:15,voting:15,anonymous:false,early:false,meetingCooldown:5,killCooldown:30});
  await host.act('start');await advance(3100);await advance(8500);
  await navigate(host,deck.cafe);
  assert.ok((await host.act('emergency')).ok);
  await advance(17000);
  assert.ok((await host.act('vote',{id:a.s.self.id})).ok);
  assert.ok((await a.act('vote',{id:'skip'})).ok);
  host.socket.disconnect();
  await until(()=>a.s.roster.some(p=>p.id===session.id&&!p.online));
  assert.equal((await c.act('vote',{id:session.id})).ok,false);
  const resumed=await connect();
  assert.ok((await resumed.entry({kind:'resume',code:session.code,token:session.token})).ok);
  await until(()=>resumed.s?.meeting?.myVote===a.s.self.id);
  assert.equal((await resumed.act('vote',{id:'skip'})).ok,false);
  a.socket.disconnect();
  await until(()=>b.s.roster.some(p=>p.id===a.s.self.id&&!p.online));
  assert.ok((await b.act('vote',{id:'skip'})).ok);
  await advance(15200);
  const verdict=b.s.meeting.result;
  assert.equal(verdict.target,null);
  assert.equal(verdict.tie,false);
  assert.deepEqual(verdict.counts,{skip:2});
  assert.deepEqual(verdict.votes,[[a.s.self.id,'skip'],[b.s.self.id,'skip']]);
  assert.equal((await c.act('vote',{id:'skip'})).ok,false);
  await advance(4900);
  const impostor=[resumed,b,c].find(p=>p.s.self.team==='impostor');
  if(impostor)assert.ok(impostor.s.self.killAt-impostor.s.now>29500);
});

test('the enabled Judge override is explicit and keeps the actual tally and confirmation',async t=>{
  const {host,players,advance}=await fixture(t);
  await host.act('settings',{commonTasks:2,shortTasks:0,longTasks:0,speed:245,discussion:15,voting:15,
    early:false,anonymous:false,confirm:true,meetingCooldown:5,roles:{judge:{enabled:true,max:1,chance:100}}});
  await host.act('start');await advance(3100);await advance(9000);
  const judges=players.filter(p=>p.s.self.role==='judge');
  assert.equal(judges.length,1);
  const [judge]=judges, villain=players.find(p=>p.s.self.team==='impostor');
  await navigate(judge,tasks.find(task=>task.id==='card').stops[0]);
  assert.ok((await judge.act('taskOpen',{id:'card'})).ok);
  await judge.act('taskStep',{type:'begin'});await advance(450);
  assert.equal((await judge.act('taskStep',{type:'swipe'})).done,true);
  await navigate(judge,deck.cafe);
  assert.ok((await judge.act('emergency')).ok);
  assert.equal((await judge.act('ability',{target:villain.s.self.id})).ok,false);
  await advance(17000);
  for(const p of players)assert.ok((await p.act('vote',{id:'skip'})).ok);
  assert.equal((await villain.act('ability',{target:judge.s.self.id})).ok,false);
  assert.ok((await judge.act('ability',{target:villain.s.self.id})).ok);
  assert.equal((await judge.act('ability',{target:villain.s.self.id})).ok,false);
  await advance(15200);
  assert.equal(host.s.meeting.result.target.id,villain.s.self.id);
  assert.equal(host.s.meeting.result.override,true);
  assert.equal(host.s.meeting.result.role,'impostor');
  assert.deepEqual(host.s.meeting.result.counts,{skip:4});
  assert.equal(host.s.meeting.result.votes.length,4);
});

test('the relay validates presets atomically and caps neutral seats in small rooms',async t=>{
  const {host,players,advance}=await fixture(t);
  const invalid=await host.act('settings',{speed:210,killCooldown:11});
  assert.equal(invalid.ok,false);
  assert.equal(host.s.settings.speed,175);
  assert.equal((await players[1].act('settings',{speed:210})).ok,false);
  assert.ok((await host.act('settings',{roles:{jester:{enabled:true,max:4,chance:0},vulture:{enabled:true,max:4,chance:100,goal:5}}})).ok);
  assert.ok((await host.act('start')).ok);
  await advance(3100);
  const neutrals=players.filter(p=>p.s.self.team==='neutral');
  assert.equal(neutrals.length,1);
  assert.equal(neutrals[0].s.self.role,'vulture');
  assert.deepEqual(neutrals[0].s.self.objective,{done:0,goal:1});
  assert.deepEqual(neutrals[0].s.self.assignments,[]);
  assert.ok(players.every(p=>p.s.progress.total===10&&p.s.roster.every(q=>!('team' in q))));
});

test('Jester wins only when a regular vote ejects them',async t=>{
  const {host,players,advance}=await fixture(t);
  await host.act('settings',{discussion:0,voting:15,meetingCooldown:0,killCooldown:10,roles:{jester:{enabled:true,max:1,chance:100}}});
  assert.ok((await host.act('start')).ok);
  await advance(3100);await advance(3800);
  const jester=players.find(p=>p.s.self.role==='jester');
  await navigate(host,deck.cafe);
  assert.ok((await host.act('emergency')).ok);
  await advance(1900);
  await Promise.all(players.map(p=>p.act('vote',{id:jester.s.self.id}).then(reply=>assert.ok(reply.ok))));
  await until(()=>players.every(p=>p.s.phase==='verdict'));
  assert.ok(players.every(p=>p.s.meeting.result.target.id===jester.s.self.id));
  await advance(5000);
  assert.ok(players.every(p=>p.s.outcome?.winner?.role==='jester'&&p.s.outcome.winner.id===jester.s.self.id));
  assert.ok((await host.act('reset')).ok);
  assert.ok((await host.act('start')).ok);
  await advance(3100);await advance(14400);
  const updated=players.find(p=>p.s.self.role==='jester'), killer=players.find(p=>p.s.self.team==='impostor');
  await Promise.all([navigate(updated,deck.cafe),navigate(killer,deck.cafe)]);
  assert.ok((await killer.act('strike',{target:updated.s.self.id})).ok);
  await until(()=>!updated.s.self.alive);
  assert.equal(updated.s.self.ghost,null);
  assert.ok(players.every(p=>p.s.phase==='play'&&!p.s.outcome));
});

test('Vulture claims two reported sites privately and wins across the entire room',async t=>{
  const {host,players,advance}=await fixture(t,5);
  await host.act('settings',{speed:245,discussion:0,voting:15,meetingCooldown:0,killCooldown:10,
    roles:{vulture:{enabled:true,chance:100,goal:2,cooldown:40}}});
  assert.ok((await host.act('start')).ok);
  await advance(3100);await advance(14000);
  const vulture=players.find(p=>p.s.self.role==='vulture'), killer=players.find(p=>p.s.self.team==='impostor');
  const [reporter,...victims]=players.filter(p=>p.s.self.team==='crew');
  for(const [i,victim] of victims.entries()){
    await Promise.all([killer,victim,reporter,vulture].map(p=>navigate(p,deck.cafe)));
    const id=victim.s.self.id;
    assert.ok((await killer.act('strike',{target:id})).ok);
    await until(()=>reporter.s.bodies.some(q=>q.id===id));
    assert.equal((await vulture.act('collect',{id})).ok,false);
    assert.ok((await reporter.act('report',{id})).ok);
    assert.equal((await vulture.act('collect',{id})).ok,false);
    await advance(1900);
    for(const p of players.filter(p=>p.s.self.alive))assert.ok((await p.act('vote',{id:'skip'})).ok);
    await until(()=>host.s.phase==='verdict');
    await advance(4900);
    await until(()=>vulture.s.tactical.remains?.some(q=>q.id===id));
    assert.ok(players.filter(p=>p!==vulture).every(p=>p.s.tactical.remains===undefined));
    await navigate(vulture,deck.cafe);
    assert.equal((await reporter.act('collect',{id})).ok,false);
    if(i===1){
      assert.match((await vulture.act('collect',{id})).error,/unavailable/);
      await advance(40000);
    }
    const collection=await vulture.act('collect',{id});
    assert.equal(collection.ok,true,collection.error);
    assert.equal(collection.done,i+1);
    assert.equal((await vulture.act('collect',{id})).ok,false);
    if(i===0)await advance(10200);
  }
  await until(()=>players.every(p=>p.s.outcome?.winner?.role==='vulture'));
  assert.ok(players.every(p=>p.s.outcome.winner.id===vulture.s.self.id));
});
