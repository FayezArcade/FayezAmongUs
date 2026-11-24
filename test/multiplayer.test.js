import assert from 'node:assert/strict';
import {test} from 'node:test';
import {once} from 'node:events';
import {setTimeout as wait} from 'node:timers/promises';
import {io} from 'socket.io-client';
import {createGameServer} from '../server/index.js';
import {dist,tasks,terminal} from '../shared/deck.js';

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
    const p={socket,s:null,entry:(data)=>socket.timeout(2500).emitWithAck('enter',data),act:(kind,data)=>socket.timeout(2500).emitWithAck('command',{kind,data})};
    peers.push(p);socket.on('state',s=>{p.s=s;});
    await once(socket,'connect');return p;
  }
  t.after(async()=>{for(const p of peers)p.socket.disconnect();await server.close();});
  assert.deepEqual(await fetch(root+'/health').then(r=>r.json()),{ok:true,game:'Fayez Crew'});
  assert.equal((await fetch(root+'/socket.io/?EIO=4&transport=polling',{headers:{Origin:'https://untrusted.invalid'}})).status,403);
  const players=await Promise.all(Array.from({length:count},connect));
  const [host,...others]=players;
  const session=await host.entry({kind:'create',name:'Ari'});assert.ok(session.ok);
  for(const [i,p] of others.entries())assert.ok((await p.entry({kind:'join',name:['Jun','Mina','Sol'][i],code:session.code})).ok);
  await until(()=>players.every(p=>p.s?.roster.length===count));
  const advance=async millis=>{jump+=millis;await wait(105);};
  return {players,host,session,connect,advance};
}
async function drive(p,x,y){
  const start=Date.now();
  while(Date.now()-start<6200){
    const here=p.s.self, d=dist(here,{x,y});
    if(d<12){p.socket.emit('move',{x:0,y:0});return;}
    p.socket.emit('move',{x:(x-here.x)/Math.max(32,d),y:(y-here.y)/Math.max(32,d)});
    await wait(45);
  }
  assert.fail('Could not reach '+x+', '+y+' from '+JSON.stringify(p.s.self));
}
test('four private clients play, repair, report, vote, reset and start a second round', {timeout:45000}, async t=>{
  const {players,host,advance,connect,session}=await fixture(t);
  assert.ok(Object.values(host.s.settings.roles).every(r=>!r.enabled));
  assert.equal((await players[1].act('start')).ok,false);
  assert.equal((await host.act('practiceRole',{role:'phantom'})).ok,false);
  assert.equal((await host.act('suit',{color:'mint',hat:1})).ok,false);
  await drive(host,terminal.x,terminal.y);
  assert.equal((await host.act('suit',{color:players[1].s.self.color,hat:1})).ok,false);
  assert.ok((await host.act('suit',{color:'mint',hat:2})).ok);
  await until(()=>players[2].s.roster.some(q=>q.color==='mint'&&q.hat===2));
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
  const card=tasks.find(v=>v.id==='card').stops[0];
  assert.equal((await worker.act('taskOpen',{id:'card'})).ok,false);
  await drive(worker,940,335);await drive(worker,660,335);await drive(worker,card.x,card.y);
  assert.ok((await worker.act('taskOpen',{id:'card'})).puzzle);
  assert.equal((await worker.act('taskStep',{type:'swipe'})).done,undefined);
  await worker.act('taskStep',{type:'begin'});await advance(450);
  assert.equal((await worker.act('taskStep',{type:'swipe'})).done,true);
  assert.equal((await worker.act('taskStep',{type:'swipe'})).ok,false);
  await until(()=>worker.s.progress.done===1);
  await advance(11000);
  assert.ok((await villain.act('sabotage',{kind:'lights'})).ok);
  await until(()=>crew.every(p=>p.s.sabotage?.kind==='lights'&&p.s.vision===82));
  await drive(worker,660,335);await drive(worker,940,335);await drive(worker,940,607);
  await until(()=>worker.s.sabotage.nearby.length);
  for(const [i,on] of worker.s.sabotage.pattern.entries())if(!on)assert.ok((await worker.act('repair',{index:0,a:i})).ok);
  await until(()=>!worker.s.sabotage);
  const [victim,reporter]=crew.filter(p=>p!==worker);
  await Promise.all([villain,victim,reporter].map(p=>drive(p,940,335)));
  assert.ok((await villain.act('strike',{target:victim.s.self.id})).ok);
  assert.equal((await villain.act('strike',{target:reporter.s.self.id})).ok,false);
  await until(()=>!victim.s.self.alive&&reporter.s.bodies.length);
  assert.ok((await reporter.act('report',{id:victim.s.self.id})).ok);
  await until(()=>players.every(p=>p.s.phase==='meeting'));
  assert.ok((await victim.act('chat',{text:'Ghost channel'})).ok);
  assert.ok((await reporter.act('chat',{text:'I found the incident.'})).ok);
  assert.equal((await reporter.act('chat',{text:'spam'})).ok,false);
  await until(()=>reporter.s.chat.length===1&&victim.s.chat.length===2);
  assert.equal((await reporter.act('vote',{id:villain.s.self.id})).ok,false);
  await advance(5100);
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

test('engineer hatch travel is gated and the complete assignment pool wins the round',{timeout:25000},async t=>{
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
  await drive(worker,940,335);await drive(worker,940,105);await drive(worker,1005,148);
  assert.ok((await worker.act('ability')).ok);
  assert.ok((await worker.act('vent',{action:'enter'})).ok);
  await until(()=>worker.s.self.ventIndex===0);
  assert.equal((await worker.act('vent',{dest:4})).ok,false);
  await advance(750);
  assert.ok((await worker.act('vent',{dest:6})).ok);
  await until(()=>worker.s.self.ventIndex===6);
  assert.ok((await worker.act('vent',{action:'exit'})).ok);
  await drive(worker,660,800);await drive(worker,660,570);await drive(worker,940,570);
  await Promise.all(crew.slice(1).map(async p=>{await drive(p,940,335);await drive(p,940,570);}));
  const wire=tasks.find(v=>v.id==='wire').stops[0], badge=tasks.find(v=>v.id==='card').stops[0];
  await Promise.all(crew.map(async p=>{
    await drive(p,wire.x,wire.y);
    const open=await p.act('taskOpen',{id:'wire'});assert.ok(open.puzzle);
    for(const c of open.puzzle.left)assert.ok((await p.act('taskStep',{type:'pair',a:c,b:c})).ok);
    await drive(p,940,570);await drive(p,940,335);await drive(p,660,335);await drive(p,badge.x,badge.y);
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
  await drive(host,940,335);await drive(host,660,335);await drive(host,card.x,card.y);
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
