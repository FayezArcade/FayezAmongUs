import {io} from 'socket.io-client';
import {colors,hats,rooms,doors,vents,tasks,repairs,terminal,meetingPoint,contains,dist} from '../shared/deck.js';
import {special} from '../shared/roles.js';
import {astronaut,renderer,drawMap} from './art.js';
import {taskPanel} from './tasks.js';
import './style.css';

const screen=document.querySelector('#screen'), layer=document.querySelector('#overlay'), flash=document.querySelector('#notice');
const render=renderer(document.querySelector('#deck'));
const relay=(import.meta.env.VITE_SERVER_URL||'').replace(/\/$/,'');
const socket=io(relay||location.origin,{autoConnect:false,reconnectionDelayMax:2000,timeout:9000});
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=(end,t)=>Math.ceil(Math.max(0,end-t)/1000).toString().padStart(2,'0');
const nearest=(items,p,range)=>items.filter(q=>dist(p,q)<range).sort((a,b)=>dist(p,a)-dist(p,b))[0];
const btn=(label,cmd,style='',attrs='')=>`<button type="button" class="${style}" data-do="${cmd}" ${attrs}>${label}</button>`;
function markup(id,html){
  const el=document.getElementById(id);
  if(el.dataset.html!==html){el.innerHTML=html;el.dataset.html=html;}
}
const tag=id=>`<i class="swatch" style="--suit:${colors[id]||'#7a9cab'}"></i>`;
const brand='<span class="brand-mark" aria-hidden="true">✦</span> FAYEZ <b>CREW</b>';
const roleName=p=>special[p.alive?p.role:p.ghost]?.name||(p.alive?p.team==='impostor'?'Infiltrator':'Crewmate':p.team==='impostor'?'Infiltrator Ghost':'Crew Ghost');

let state=null,session=null,joining=false,entry=null,modal=null,phase='',skew=0,noticeTimer,wasReady=false,uiKey='',audio;
const held=new Set(), touch=new Set(), muted=new Set();
const nickname=()=>localStorage.getItem('fayez-name')||'';
const now=()=>Date.now()+skew;
function tone(kind='tap'){
  try{
    audio??=new AudioContext();if(audio.state==='suspended')void audio.resume();
    const frequencies={tap:[410],ok:[420,630,870],alarm:[310,227,310],launch:[260,440,710],vote:[320,190]}[kind];
    frequencies.forEach((f,i)=>{
      const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.1;
      o.type='triangle';o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.10,t+.018);g.gain.exponentialRampToValueAtTime(.0001,t+.115);
      o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.13);
    });
  }catch{}
}
function notice(text){
  flash.textContent=text;flash.classList.toggle('show',Boolean(text));clearTimeout(noticeTimer);
  if(text)noticeTimer=setTimeout(()=>flash.classList.remove('show'),3100);
}
function send(event,data,timeout=4500){
  return new Promise(resolve=>socket.timeout(timeout).emit(event,data,(err,res)=>resolve(err?{ok:false,error:'The relay did not respond.'}:res)));
}
async function command(kind,data){
  if(!socket.connected){notice('Reconnecting to the relay…');return {ok:false};}
  const res=await send('command',{kind,data});
  if(!res.ok)notice(res.error);
  else if(res.notice)notice(res.notice);
  return res;
}
function modalShell(kicker,title,body,classes=''){
  layer.innerHTML=`<div class="scrim"><section class="panel ${classes}" role="dialog" aria-modal="true" aria-label="${escape(title)}"><button type="button" class="close" data-do="close" aria-label="Close">×</button><div class="eyebrow">${kicker}</div><h2>${escape(title)}</h2>${body}</section></div>`;
}
function home() {
  screen.innerHTML=`<main class="home"><div class="orbit"></div><div class="orbit-glow"></div><div class="orbit-shuttle" aria-hidden="true"><svg viewBox="0 0 170 61"><path d="M6 43 70 20 114 5 165 19 125 31 93 49 37 57Z" fill="#344c67" stroke="#86c6c8"/><path d="m43 46 38-33 33-8 27 9-32 9-37 23Z" fill="#627b8a"/><path d="M9 43 37 36 51 42 23 49Z" fill="#75ffe3"/><path d="m129 17 26 2-23 9Z" fill="#ffc486"/></svg></div><div class="flight-brand"><span class="crest" aria-hidden="true"><svg viewBox="0 0 80 80"><path d="M40 6 71 23v34L40 74 9 57V23Z" fill="none" stroke="#67f5dd" stroke-width="2"/><path d="m40 18 20 40-20-10-20 10Z" fill="#67f5dd"/><path d="M40 19v29" stroke="#10344a" stroke-width="3"/><path d="M5 40h13m44 0h13" stroke="#67f5dd" stroke-width="2"/></svg></span><h1>FAYEZ <em>CREW</em></h1><div class="home-buttons">${btn('CREATE ROOM','create','primary')}${btn('JOIN ROOM','join','outline')}</div></div></main>`;
}
function entryForm(kind){
  entry=kind;modal={kind:'entry'};
  modalShell('PRIVATE FLIGHT',kind==='create'?'Create room':'Join room',`<form id="entry-form"><label>Nickname<input name="name" required maxlength="18" value="${escape(nickname())}" autocomplete="nickname" placeholder="Your call sign"></label>${kind==='join'?'<label>Room code<input name="code" required minlength="6" maxlength="6" placeholder="ABC123" autocomplete="off" class="code-input"></label>':''}<button class="primary" type="submit">${kind==='create'?'Create room':'Join room'}</button><p id="entry-status" class="feedback" role="status"></p></form>`);
  layer.querySelector('input').focus();
}
function awaitConnection(){
  if(socket.connected)return Promise.resolve(true);
  socket.connect();
  return new Promise(resolve=>{
    const finish=()=>{clearTimeout(timer);resolve(true);};
    const timer=setTimeout(()=>{socket.off('connect',finish);resolve(false);},42000);
    socket.once('connect',finish);
  });
}
async function enter(form){
  if(joining)return;
  joining=true;const data=new FormData(form),name=String(data.get('name')||'').trim(),code=String(data.get('code')||'').toUpperCase();
  const error=form.querySelector('#entry-status');form.querySelector('button[type=submit]').disabled=true;
  error.textContent='Contacting the crew relay. A cold start can take a moment.';
  try{
    if(!await awaitConnection())throw new Error('Relay unavailable. Try again in a moment.');
    if(modal?.kind!=='entry')return;
    const reply=await send('enter',{kind:entry,name,code});
    if(!reply.ok)throw new Error(reply.error);
    session={code:reply.code,id:reply.id,token:reply.token};sessionStorage.setItem('fayez-session',JSON.stringify(session));localStorage.setItem('fayez-name',name);
    closeModal();tone('ok');
  }catch(e){error.textContent=e.message;}
  finally{joining=false;form.querySelector('button[type=submit]').disabled=false;}
}
socket.on('connect',async()=>{
  if(!session)return;
  const reply=await send('enter',{kind:'resume',...session});
  if(reply.ok){notice(wasReady?'Flight connection restored.':'');wasReady=true;}
  else if(socket.connected){session=null;state=null;phase='';sessionStorage.removeItem('fayez-session');closeModal();home();notice(reply.error);}
});
socket.on('disconnect',()=>{if(session)notice('Relay disconnected. Reconnecting…');});
socket.on('state',s=>{
  if(!session||s.self.id!==session.id)return;
  skew=s.now-Date.now();const old=state;state=s;wasReady=true;
  if(phase!==s.phase){
    phase=s.phase;uiKey='';closeModal(false);held.clear();touch.clear();
    tone(({lobby:'ok',reveal:'launch',meeting:'alarm',verdict:'vote',result:'ok'})[phase]||'tap');
  }
  if(old?.sabotage?.kind!==s.sabotage?.kind&&s.sabotage){tone('alarm');if(s.sabotage.kind==='comms'&&modal?.kind==='tasks')missionList();}
  if(old?.self.alive&&!s.self.alive)notice(s.self.ghost?'Ghost role: '+special[s.self.ghost].name:'You are now a ghost.');
  if(s.self.signal&&s.self.signal.text!==old?.self.signal?.text)notice(s.self.signal.text);
  update();
});
function closeModal(cancel=true) {
  if(cancel&&modal?.kind==='task')void command('taskClose');
  modal=null;layer.replaceChildren();touch.clear();
}
function panel(kind,title,body,options={}){
  modal={kind,...options};modalShell('MERIDIAN FLIGHT SYSTEMS',title,body,options.className||'');
}
function chatForm() {
  return '<div class="messages" id="messages" aria-live="polite"></div><form id="chat-form" class="chat-form"><input name="text" maxlength="180" placeholder="Send to the intercom" aria-label="Chat message" autocomplete="off" required><button class="primary">Send</button></form>';
}
function hud(){
  const s=state, me=s.self, inLobby=s.phase==='lobby', captain=s.host===me.id;
  const status=inLobby?'DOCKING SHUTTLE':'MERIDIAN / FLIGHT DECK';
  const roleText=inLobby?'PRIVATE FLIGHT':roleName(me).toUpperCase();
  screen.innerHTML=`<main class="hud"><header class="topbar"><div><div class="wordmark">${brand}</div><div class="eyebrow">${status}</div></div><div class="flight-data">${inLobby?'<button type="button" class="room-code" data-do="copy" title="Copy room code"><small>ROOM CODE</small><strong id="room-code"></strong></button><div class="count"><small>ON BOARD</small><strong id="crew-count"></strong></div>':'<div class="bar"><small>SHIP RESTORATION <span id="task-count"></span></small><progress max="1" value="0" id="task-progress"></progress></div>'}</div><div class="tag">${roleText}</div></header>
  <div class="side-info" id="side-info"></div><div class="alert" id="emergency" hidden></div>
  <footer class="controls"><div class="controls-hint"><span>WASD / ↑↓←→</span> Move <span>E</span> Interact</div><div class="actions">${inLobby?`${btn('Intercom','chat')}${captain?btn('Settings','settings'):''}${captain?btn('Start flight','start','primary','id="start-flight"'):''}${btn('Leave','leave','quiet')}`:`${btn('Map','map')}${btn('Tasks','tasks')}${btn('Interact','interact','primary')}${me.team==='impostor'?btn('Sabotage','sabotage','danger'):''}${me.role||me.ghost?btn('Ability','ability'):''}`}</div></footer><div class="touch" aria-label="Movement controls">${[['up','↑'],['left','←'],['down','↓'],['right','→']].map(([d,label])=>`<button type="button" data-move="${d}" aria-label="Move ${d}">${label}</button>`).join('')}</div><div class="prompt" id="prompt"></div></main>`;
}
function contextAction(){
  const s=state,p=s.self;
  if(s.phase==='lobby')return dist(p,terminal)<76?{label:'Open suit locker',kind:'suit'}:null;
  if(s.phase!=='play')return null;
  const b=p.alive&&nearest(s.bodies,p,70);
  if(b)return {label:'Report incident',kind:'report',data:{id:b.id}};
  if(s.sabotage?.nearby.length)return {label:'Repair '+s.sabotage.kind,kind:'repair'};
  const available=p.assignments.filter(a=>!a.done).map(a=>({...tasks.find(t=>t.id===a.id).stops[a.stage],id:a.id}));
  const a=nearest(available,p,56);
  if(a&&s.sabotage?.kind!=='comms')return {label:tasks.find(t=>t.id===a.id).label,kind:'task',data:a.id};
  if(p.alive&&(p.team==='impostor'||p.effect==='engineer')&&vents.some(v=>dist(p,v)<48))return {label:'Use service hatch',kind:'vent'};
  if(p.alive&&dist(p,meetingPoint)<74&&p.emergencies>0&&!s.sabotage&&now()>p.meetingAt)return {label:'Call emergency assembly',kind:'emergency'};
  if(p.alive&&dist(p,rooms[4])<85&&s.sabotage?.kind!=='comms')return {label:'View command telemetry',kind:'monitor',data:'command'};
  if(p.alive&&dist(p,rooms[8])<85&&s.sabotage?.kind!=='comms')return {label:'View camera feeds',kind:'monitor',data:'security'};
  return null;
}
function update(){
  const s=state,p=s.self;
  const key=[s.phase,s.host,p.alive,p.role,p.ghost].join('|');
  if(key!==uiKey){
    uiKey=key;
    if(s.phase==='lobby'||s.phase==='play')hud();
    else cinematic();
  }
  if(s.phase==='lobby'){
    document.querySelector('#room-code').textContent=s.code;document.querySelector('#crew-count').textContent=s.roster.filter(q=>q.online).length+' / 10';
    const start=document.querySelector('#start-flight');if(start)start.disabled=s.roster.filter(q=>q.online).length<4;
    markup('side-info',s.roster.map(q=>`<div>${tag(q.color)}${escape(q.name)}${q.id===s.host?' <span>CAPTAIN</span>':''}${!q.online?' <span>OFFLINE</span>':''}</div>`).join(''));
    markup('prompt',contextAction()?btn('<kbd>E</kbd> Open suit locker','interact'):'');
  }
  if(s.phase==='play'){
    const progress=document.querySelector('#task-progress');progress.value=s.progress.total?s.progress.done/s.progress.total:0;
    document.querySelector('#task-count').textContent=s.progress.done+' / '+s.progress.total;
    const current=rooms.find(r=>contains(r,p.x,p.y))?.name||'Transit';
    const kill=p.team==='impostor'&&p.alive;
    markup('side-info',`<div class="room-label">${current}</div>${!p.alive?'<div>GHOST · Move through bulkheads</div>':''}${kill?btn(now()>=p.killAt?'Eliminate [Q]':'Eliminate '+clock(p.killAt,now())+'s','strike','danger'):''}`);
    const danger=document.querySelector('#emergency');danger.hidden=!s.sabotage;
    if(s.sabotage)danger.textContent=s.sabotage.kind.toUpperCase()+' FAILURE'+(s.sabotage.until?' · '+clock(s.sabotage.until,now())+'s':' · Find a repair station');
    const action=contextAction();markup('prompt',action?btn('<kbd>E</kbd> '+escape(action.label),'interact'):'');
  }
  if(s.phase==='meeting')refreshMeeting();
  if(modal?.kind==='suit'&&dist(p,terminal)>=76)closeModal(false);
  if(modal?.kind==='ability'&&modal.role==='scientist'){
    const vitals=layer.querySelector('#vitals');
    if(vitals)vitals.innerHTML=(s.tactical.vitals||[]).map(q=>'<li><b>'+escape(q.name)+'</b><span>'+(q.alive?'Online':'No pulse')+'</span></li>').join('');
  }
  if(modal?.kind==='map')drawMap(layer.querySelector('canvas'),s);
  if(modal?.kind==='chat'||s.phase==='meeting')refreshChat();
  if(modal?.kind==='task'){
    if(s.puzzle?.id!==modal.id&&!modal.pending&&now()-modal.openedAt>300)closeModal(false);
    else if(s.puzzle)modal.task.update(s.puzzle,now());
  }
  if(modal?.kind==='repair'&&(!s.sabotage||!s.sabotage.nearby.length))closeModal(false);
  if(modal?.kind==='repair'&&s.sabotage?.kind==='lights') for(const [i,b] of [...layer.querySelectorAll('[data-switch]')].entries()){b.classList.toggle('active',s.sabotage.pattern[i]);b.textContent=s.sabotage.pattern[i]?'ON':'OFF';}
  if(modal?.kind==='suit')for(const b of layer.querySelectorAll('[data-color]')){b.disabled=s.roster.some(q=>q.id!==p.id&&q.color===b.dataset.color);b.classList.toggle('active',p.color===b.dataset.color);}
}
function cinemaSuit(canvas,p){
  const ctx=canvas.getContext('2d');
  astronaut(ctx,{...p,x:canvas.width/2,y:canvas.height*.68,facing:1},0,2.5);
}
function cinematic(){
  const s=state,p=s.self;
  if(s.phase==='reveal'){
    const role=p.role&&special[p.role];
    screen.innerHTML=`<main class="cinema reveal ${p.team==='impostor'?'red':''}"><div class="eyebrow">PRIVATE ROLE · FLIGHT ${s.round}</div><canvas width="220" height="145"></canvas><h1>${escape(roleName(p))}</h1><p>${escape(role?.description||(p.team==='impostor'?'Disrupt the ship. Blend in with the crew.':'Restore the ship. Watch your crewmates.'))}</p>${p.allies.length>1?'<p class="muted">Allies · '+s.roster.filter(q=>q.id!==p.id&&p.allies.includes(q.id)).map(q=>escape(q.name)).join(', ')+'</p>':''}</main>`;
    cinemaSuit(screen.querySelector('canvas'),p);
  }else if(s.phase==='meeting'){
    screen.innerHTML=`<main class="meeting"><header><div class="eyebrow">SHIPWIDE INTERCOM</div><h1>${escape(s.meeting.subject)}</h1><p id="meeting-time"></p></header><div class="meeting-grid"><section><h2>Crew manifest</h2><div id="ballot"></div></section><section><h2>Open channel</h2>${chatForm()}</section></div></main>`;
  }else if(s.phase==='verdict'){
    const v=s.meeting.result;
    screen.innerHTML=`<main class="cinema verdict ${v.target?'red':''}"><div class="eyebrow">BALLOT COMPLETE</div>${v.target?'<canvas class="eject" width="220" height="145"></canvas>':'<div class="airlock-icon">◈</div>'}<h1>${v.target?escape(v.target.name)+' ejected':v.tie?'Ballot tied':'Airlock held'}</h1><p>${v.target&&v.role?(v.role==='impostor'?'An infiltrator was removed.':'A crewmate was removed.'):'No additional identity information was released.'}</p><div class="verdict-votes">${Object.entries(v.counts).map(([id,n])=>`<span>${id==='skip'?'Skip':escape(s.roster.find(p=>p.id===id)?.name)} · ${n}</span>`).join('')}</div>${v.votes?`<div class="verdict-votes">${v.votes.map(([from,to])=>`<span>${escape(s.roster.find(q=>q.id===from)?.name)} voted ${to==='skip'?'Skip':escape(s.roster.find(q=>q.id===to)?.name)}</span>`).join('')}</div>`:''}</main>`;
    if(v.target)cinemaSuit(screen.querySelector('canvas'),{...v.target,alive:true});
  }else if(s.phase==='result'){
    const v=s.outcome;
    screen.innerHTML=`<main class="cinema result ${v.team==='impostor'?'red':''}"><div class="eyebrow">FLIGHT ${s.round} COMPLETE</div><div class="airlock-icon">✦</div><h1>${v.team==='impostor'?'Infiltrator victory':'Crew victory'}</h1><p>${escape(v.reason)}</p><div class="result-roster">${v.crew.map(q=>`<span>${tag(q.color)}${escape(q.name)}<small>${escape(special[q.role]?.name||(q.team==='impostor'?'Infiltrator':'Crew'))}</small></span>`).join('')}</div><div class="actions">${s.host===p.id?btn('Return to shuttle','reset','primary'):'<span class="muted">Waiting for the captain to re-dock.</span>'}${btn('Leave','leave','quiet')}</div></main>`;
  }
}
function refreshMeeting(){
  const s=state,m=s.meeting,p=s.self,discuss=s.now<m.voteAt;
  document.querySelector('#meeting-time').textContent=(discuss?'Discussion · '+clock(m.voteAt,now()):'Voting · '+clock(m.end,now()))+'s';
  const can=!discuss&&p.alive&&!m.myVote;
  const list=document.querySelector('#ballot');
  const markup=s.roster.map(q=>`<div class="ballot-row ${q.alive?'':'dead'}"><span>${tag(q.color)} ${escape(q.name)} <small>${q.alive?(q.online?'':'OFFLINE'):'GHOST'}</small></span>${m.voted?.includes(q.id)?'<small>VOTED</small>':''}${q.alive&&q.online&&can?btn('Vote','vote','','data-id="'+q.id+'"'):''}${!discuss&&q.alive&&q.id!==p.id&&p.alive&&p.role==='judge'&&!p.used&&p.assignments.some(a=>a.done)?btn('Override','judge','danger','data-id="'+q.id+'"'):''}${q.id!==p.id?btn(muted.has(q.id)?'Unmute':'Mute','mute','quiet','data-id="'+q.id+'"'):''}</div>`).join('')+(can?btn('Skip vote','vote','outline','data-id="skip"'):m.myVote?'<p class="muted">Ballot submitted.</p>':'');
  if(list.dataset.markup!==markup){list.innerHTML=markup;list.dataset.markup=markup;}
}
function refreshChat(){
  const box=document.querySelector('#messages');
  if(!box)return;
  const msg=state.chat.filter(q=>!muted.has(q.id)).map(q=>`<p><b>${escape(q.name)}${q.ghost?' · Ghost':''}</b> ${escape(q.text)}</p>`).join('')||'<p class="muted">Channel is quiet.</p>';
  if(box.dataset.content===msg)return;
  const bottom=box.scrollTop+box.clientHeight>box.scrollHeight-42;
  box.innerHTML=msg;box.dataset.content=msg;if(bottom)box.scrollTop=box.scrollHeight;
}
const numbers={impostors:['Infiltrators',1,3],discussion:['Discussion (s)',5,90],voting:['Voting (s)',10,120],killCooldown:['Strike cooldown (s)',10,60],meetingCooldown:['Intercom cooldown (s)',5,60],shortTasks:['Short tasks',1,8],longTasks:['Long tasks',0,3],commonTasks:['Common tasks',0,2],crewVision:['Crew vision',120,450],speed:['Walk speed',95,240]};
const numberField=(name,label,min,max,value)=>`<label>${label}<input type="number" name="${name}" min="${min}" max="${max}" value="${value}" required></label>`;
function settingsPanel(){
  const cfg=state.settings;
  panel('settings','Lobby settings',`<form id="settings-form"><div class="settings-grid">${Object.entries(numbers).map(([key,[label,min,max]])=>numberField(key,label,min,max,cfg[key])).join('')}</div><div class="checks"><label><input type="checkbox" name="anonymous" ${cfg.anonymous?'checked':''}> Anonymous voting</label><label><input type="checkbox" name="confirm" ${cfg.confirm?'checked':''}> Confirm ejection team</label></div><h3>Optional roles</h3><p class="muted">Each role starts disabled. Available seats depend on team size.</p><div class="roles-grid">${Object.entries(special).map(([id,v])=>`<details><summary>${v.name} <small>${v.team}</small></summary><p>${v.description}</p><label><input type="checkbox" name="${id}:enabled" ${cfg.roles[id].enabled?'checked':''}> Enabled</label><div class="settings-grid">${[['max','Max',0,4],['chance','Chance (%)',0,100],['cooldown','Cooldown (s)',0,100],['duration','Duration (s)',0,55]].map(([k,l,a,b])=>numberField(id+':'+k,l,a,b,cfg.roles[id][k])).join('')}</div></details>`).join('')}</div><button class="primary">Save settings</button></form>`,{className:'wide'});
}
function suitPanel(){
  const p=state.self;
  panel('suit','Suit locker',`<div class="gear-preview"><canvas width="220" height="145"></canvas><div class="gear-controls"><div class="swatches">${Object.keys(colors).map(c=>btn(tag(c),'color','color-button','data-color="'+c+'" aria-label="'+c+'" title="'+c+'"')).join('')}</div><label>Equipment<select id="hat">${hats.map((h,i)=>`<option value="${i}" ${i===p.hat?'selected':''}>${h}</option>`).join('')}</select></label><label><input id="show-name" type="checkbox" ${p.showName?'checked':''}> Display nickname above suit</label></div></div>`);
  cinemaSuit(layer.querySelector('canvas'),p);update();
}
function missionList(){
  if(state.sabotage?.kind==='comms'){panel('tasks','Assignments offline','<p>Restore comms to recover ship assignments.</p>');return;}
  const p=state.self;
  panel('tasks',p.team==='impostor'?'Cover assignments':'Assigned maintenance',`<ul class="mission-list">${p.assignments.map(a=>{const task=tasks.find(v=>v.id===a.id);return '<li class="'+(a.done?'done':'')+'"><b>'+escape(task.label)+'</b><span>'+(a.done?'Complete':rooms[task.stops[a.stage].room].name+' • '+task.kind+(task.stops.length>1?' '+(a.stage+1)+'/'+task.stops.length:''))+'</span></li>';}).join('')}</ul>`);
}
function repairPanel(){
  const s=state.sabotage, station=s?.nearby[0];if(!station)return;
  const body={
    lights:'<p>Set all five breaker levers to ON.</p><div class="switches">'+s.pattern.map((on,i)=>btn(on?'ON':'OFF','switch',on?'active':'','data-switch="'+i+'"')).join('')+'</div>',
    oxygen:'<p>Match the pressure controller code at this station.</p><div class="digits">'+station.code+'</div><form id="repair-form"><label>Pressure code<input name="reading" inputmode="numeric" minlength="5" maxlength="5" required></label><button class="primary">Restore pressure</button></form>',
    reactor:'<p>Synchronize two relay stations with another crewmate. Both taps must fall within five seconds.</p>'+btn('Press relay pad','relay-pad','primary'),
    comms:'<p>Tune the receiver to '+station.dial+' kHz.</p><form id="repair-form"><label>Receiver frequency<input name="reading" type="range" min="0" max="100" value="50" oninput="this.nextElementSibling.value=this.value"><output>50</output></label><button class="primary">Lock frequency</button></form>'
  }[s.kind];
  panel('repair',s.kind[0].toUpperCase()+s.kind.slice(1)+' recovery',body,{station:station.index});
}
function abilityPanel(){
  const s=state,p=s.self,id=p.alive?p.role:p.ghost,role=special[id];
  if(!role)return;
  const available=now()>=p.abilityAt, target=(['angel','influencer','shapeshifter'].includes(id)?s.roster:s.positions).filter(q=>q.id!==p.id&&q.alive!==false);
  let body='<p>'+escape(role.description)+'</p>';
  if(id==='scientist')body+='<ul class="mission-list" id="vitals"></ul>';
  if(id==='detective'&&s.tactical.notes)body+='<ul>'+s.tactical.notes.map(q=>'<li>'+escape(q.text)+'</li>').join('')+'</ul>';
  if(id==='tracker'&&s.tactical.track)body+='<p>Tracking '+escape(s.tactical.track.name)+'. Check the deck map.</p>';
  if(id==='judge')body+='<p>Complete an assignment to unlock the override. Use it from the voting panel.</p>';
  if(!available)body+='<p class="cooldown">Ready in '+clock(p.abilityAt,now())+'s</p>';
  if(available&&['engineer','scientist','phantom'].includes(id))body+=btn(role.ability,'activate','primary');
  if(available&&['angel','influencer','shapeshifter','tracker','detective'].includes(id)){
    if(id==='influencer')body+='<label>Signal<select id="signal"><option>Careful</option><option>Follow me</option><option>Check the station</option><option>I saw something</option></select></label>';
    body+='<div class="targets">'+target.filter(q=>!q.id.startsWith('echo-')).map(q=>btn(tag(q.color)+' '+escape(q.name),'activate','','data-id="'+q.id+'"')).join('');
    if(id==='detective')body+=s.bodies.map(q=>btn('Record incident: '+escape(q.name),'activate','','data-id="'+q.id+'"')).join('');
    body+='</div>';
  }
  panel('ability',role.name,body,{role:id});update();
}
async function interact(){
  const action=contextAction();
  if(!action){notice('Approach a marked station.');return;}
  if(action.kind==='suit'){suitPanel();return;}
  if(action.kind==='repair'){repairPanel();return;}
  if(action.kind==='task'){
    const res=await command('taskOpen',{id:action.data});
    if(!res.ok||state.phase!=='play')return;
    const task=tasks.find(t=>t.id===action.data);
    panel('task',task.label,'<div id="instrument"></div>',{id:task.id,openedAt:now(),className:'instrument'});
    const opening=modal;
    opening.task=taskPanel(layer.querySelector('#instrument'),res.puzzle,now,async value=>{
      if(modal!==opening||opening.pending)return {ok:false};
      opening.pending=true;
      const step=await command('taskStep',value);
      opening.pending=false;
      if(step.done){tone('ok');notice('Station verified.');closeModal(false);}
      return step;
    });
    return;
  }
  if(action.kind==='vent'){
    const at=vents.findIndex(v=>dist(state.self,v)<48);
    panel('vent','Service hatch','<p>Choose a connected service hatch.</p><div class="targets">'+[-1,1].map(dir=>{const i=(at+dir+vents.length)%vents.length;return btn(rooms.find(r=>contains(r,vents[i].x,vents[i].y)).name,'vent','outline','data-id="'+i+'"');}).join('')+'</div>');
    return;
  }
  if(action.kind==='monitor'){
    const res=await command('monitor',{kind:action.data});
    if(res.ok)panel('monitor',action.data==='security'?'Camera feeds':'Command telemetry','<ul class="mission-list">'+res.readings.map(([k,v])=>'<li><b>'+escape(k)+'</b><span>'+escape(v)+'</span></li>').join('')+'</ul>'+btn('Refresh','interact'));
    return;
  }
  await command(action.kind,action.data);
}
async function suitChange(color){
  const me=state.self, hat=Number(document.querySelector('#hat').value),showName=document.querySelector('#show-name').checked;
  const reply=await command('suit',{color:color||me.color,hat,showName});
  if(reply.ok&&modal?.kind==='suit'){
    const can=layer.querySelector('canvas');can.getContext('2d').clearRect(0,0,can.width,can.height);
    cinemaSuit(can,{...me,color:color||me.color,hat});
  }
}
async function click(b){
  const action=b.dataset.do, id=b.dataset.id;
  tone();
  if(action==='create'||action==='join'){entryForm(action);return;}
  if(action==='close'){closeModal();return;}
  if(!state)return;
  const s=state,p=s.self;
  if(action==='settings')settingsPanel();
  if(action==='chat'){panel('chat','Shuttle intercom',chatForm());refreshChat();}
  if(action==='tasks')missionList();
  if(action==='ability')abilityPanel();
  if(action==='map'){
    panel('map','Meridian deck plan','<canvas class="map" width="950" height="626"></canvas><div class="map-legend"><span>● Your position</span><span>● Assigned station</span><span>● Active repairs</span></div>',{className:'map-panel'});
    drawMap(layer.querySelector('canvas'),state);
  }
  if(action==='sabotage'){
    const seconds=clock(p.sabotageAt,now());
    panel('sabotage','Sabotage controls',`<p>${seconds==='00'?'Select a system to disrupt.':'System access resets in '+seconds+'s.'}</p><div class="targets">${Object.keys(repairs).map(k=>btn(k.toUpperCase(),'target-sabotage','danger','data-id="'+k+'"')).join('')}</div><label>Bulkhead<select id="door">${doors.map((d,i)=>{
      const near=rooms.map(q=>({name:q.name,d:dist(q,d)})).sort((a,b)=>a.d-b.d).slice(0,2);
      return '<option value="'+i+'">'+near[0].name+' / '+near[1].name+'</option>';
    }).join('')}</select></label>${btn('Seal bulkhead','target-sabotage','outline','data-id="doors"')}`);
  }
  if(action==='target-sabotage'&&(await command('sabotage',{kind:id,door:Number(document.querySelector('#door').value)})).ok)closeModal(false);
  if(action==='interact')await interact();
  if(action==='start'||action==='reset')await command(action);
  if(action==='vote')await command('vote',{id});
  if(action==='judge')await command('ability',{target:id});
  if(action==='mute'){if(muted.has(id))muted.delete(id);else muted.add(id);update();}
  if(action==='activate'){
    const res=await command('ability',{target:id,signal:document.querySelector('#signal')?.selectedIndex});
    if(res.ok){notice('Ability activated.');setTimeout(()=>{if(modal?.kind==='ability')abilityPanel();},115);}
  }
  if(action==='strike'){
    const q=nearest(s.positions.filter(q=>q.id!==p.id&&q.alive&&!p.allies.includes(q.id)&&!q.id.startsWith('echo-')),p,61);
    if(q)await command('strike',{target:q.id});else notice('There is no target in range.');
  }
  if(action==='vent'&&(await command('vent',{dest:Number(id)})).ok)closeModal(false);
  if(action==='switch')await command('repair',{index:modal.station,a:Number(b.dataset.switch)});
  if(action==='relay-pad'){
    const res=await command('repair',{index:modal.station});if(res.ok)notice('Relay signal sent.');
  }
  if(action==='color')await suitChange(b.dataset.color);
  if(action==='copy'){
    try{await navigator.clipboard.writeText(s.code);notice('Room code copied.');}catch{notice('Room code · '+s.code);}
  }
  if(action==='leave'){
    await command('leave');session=null;state=null;phase='';sessionStorage.removeItem('fayez-session');closeModal(false);home();
  }
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-do]');if(b)void click(b);});
document.addEventListener('change',e=>{if(e.target.matches('#hat,#show-name'))void suitChange();});
document.addEventListener('submit',async e=>{
  const form=e.target;
  if(!form.id)return;
  e.preventDefault();
  if(form.id==='entry-form'){await enter(form);return;}
  const data=new FormData(form);
  if(form.id==='settings-form'){
    const cfg=Object.fromEntries(Object.keys(numbers).map(k=>[k,Number(data.get(k))]));
    for(const key of ['anonymous','confirm'])cfg[key]=data.has(key);
    cfg.roles=Object.fromEntries(Object.keys(special).map(id=>[id,{enabled:data.has(id+':enabled'),...Object.fromEntries(['max','chance','cooldown','duration'].map(k=>[k,Number(data.get(id+':'+k))]))}]));
    if((await command('settings',cfg)).ok){closeModal(false);notice('Lobby settings saved.');}
  }
  if(form.id==='chat-form'){
    if((await command('chat',{text:data.get('text')})).ok)form.reset();
  }
  if(form.id==='repair-form'){
    const value=data.get('reading'),a=state.sabotage?.kind==='oxygen'?String(value):Number(value);
    if((await command('repair',{index:modal.station,a})).ok){closeModal(false);notice('Repair input accepted.');}
  }
});
const directions={arrowup:'up',w:'up',arrowdown:'down',s:'down',arrowleft:'left',a:'left',arrowright:'right',d:'right'};
addEventListener('keydown',e=>{
  if(e.key==='Escape'&&modal){closeModal();return;}
  if(!state||e.target.matches?.('input,textarea,select')||e.ctrlKey||e.metaKey||e.altKey)return;
  const k=e.key.toLowerCase();
  if(directions[k]&&(!modal||modal.kind==='map')){held.add(k);e.preventDefault();}
  if(e.repeat)return;
  if(!modal&&k==='e')void interact();
  if(!modal&&k==='q'&&state.phase==='play'&&state.self.team==='impostor')void click({dataset:{do:'strike'}});
  if(k==='m'&&state.phase==='play'){if(modal?.kind==='map')closeModal();else if(!modal)void click({dataset:{do:'map'}});}
});
addEventListener('keyup',e=>held.delete(e.key.toLowerCase()));
addEventListener('blur',()=>{held.clear();touch.clear();});
document.addEventListener('pointerdown',e=>{
  const b=e.target.closest('[data-move]');if(!b)return;
  e.preventDefault();b.setPointerCapture(e.pointerId);touch.add(b.dataset.move);
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(event,e=>{const move=e.target.dataset?.move;if(move)touch.delete(move);});
setInterval(()=>{
  if(!session||!state||!socket.connected)return;
  const dirs=new Set([...held].map(k=>directions[k]).concat([...touch]));
  const can=(!modal||modal.kind==='map')&&['lobby','play'].includes(state.phase);
  const x=can?Number(dirs.has('right'))-Number(dirs.has('left')):0,y=can?Number(dirs.has('down'))-Number(dirs.has('up')):0;
  socket.volatile.emit('move',{x,y});
},45);
function frame(t){render(state,t);requestAnimationFrame(frame);}
home();requestAnimationFrame(frame);
try{session=JSON.parse(sessionStorage.getItem('fayez-session'));}catch{}
if(session)socket.connect();
