import {io} from 'socket.io-client';
import {colors,suitPalette,hats,rooms,deckRevision,deck,deckBounds,doors,vents,ventDestinations,tasks,taskRange,taskStageName,repairs,terminal,meetingPoint,emergencyRange,contains,clearDeckLine,dist} from '../shared/deck.js';
import {special} from '../shared/roles.js';
import {astronaut,renderer,drawMap,drawDeckOverview,suitPortrait} from './art.js';
import {taskPanel} from './tasks.js';
import {movement} from './movement.js';
import './style.css';
import './flight.css';

const deckCanvas=(width,classes='map')=>`<canvas class="${classes}" width="${width}" height="${Math.round(width*deckBounds.height/deckBounds.width)}"></canvas>`;
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
const portrait=(color,hat,alive)=>`<img class="suit-avatar" src="${suitPortrait(color,hat,alive)}" alt="" aria-hidden="true">`;
const glyph=(name)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${{
  launch:'<path d="m3 19 6-2 2-5 5-2 5-7-7 2-2 5-5 2zM15 9l-5 5"/>',
  join:'<path d="M13 4h6v16h-6M3 12h12m-4-4 4 4-4 4"/>',
  settings:'<path d="M4 7h16M4 12h16M4 17h16"/><path d="M8 5v4m8 1v4m-6 1v4" stroke-width="3"/>',
  map:'<path d="m3 5 6-2 6 3 6-2v15l-6 2-6-3-6 2zM9 3v15m6-12v15"/>',
  radio:'<path d="M4 6h16v10h-9l-4 4v-4H4zM8 10h8m-8 3h5"/>'
}[name]}</svg>`;
const roleName=p=>special[p.alive?p.role:p.ghost]?.name||(p.alive?p.team==='impostor'?'Infiltrator':'Crewmate':p.team==='impostor'?'Infiltrator Ghost':'Crew Ghost');

let selectedVote=null,meetingTab='ballot',chatSeen=0;
const mapButton=id=>btn(glyph('map'),'map','map-toggle',
  'id="'+id+'" aria-label="Map" title="Map [M]" aria-expanded="'+(id==='map-open'?'false':'true')+'"');
const promptButton=action=>action?btn('<kbd>SPACE</kbd> '+escape(action.label),'interact','space-action'):'';

let state=null,session=null,joining=false,entry=null,modal=null,phase='',skew=0,noticeTimer,wasReady=false,uiKey='',audio;
const held=new Set(), touch=new Set(), muted=new Set();
const directions={arrowup:'up',w:'up',arrowdown:'down',s:'down',arrowleft:'left',a:'left',arrowright:'right',d:'right'};
const motion=movement((input,repeat)=>(repeat?socket.volatile:socket).emit('move',input));
let pendingInteraction=null;
function syncMovement(at=performance.now()){
  if(!session||!state||!socket.connected)return false;
  const allowed=(!modal||modal.kind==='map')&&
    (state.phase==='lobby'||(state.phase==='play'&&state.self.ventIndex===null&&!state.puzzle));
  if(allowed&&(held.size||touch.size)){
    const dirs=new Set([...held].map(key=>directions[key]));
    for(const direction of touch)dirs.add(direction);
    motion.sync(Number(dirs.has('right'))-Number(dirs.has('left')),Number(dirs.has('down'))-Number(dirs.has('up')),at);
  }else motion.sync(0,0,at);
  return true;
}
function clearMovement(){
  held.clear();touch.clear();pendingInteraction=null;
  syncMovement();
}
const nickname=()=>localStorage.getItem('fayez-name')||'';
const now=()=>Date.now()+skew;
function tone(kind='tap'){
  if(localStorage.getItem('fayez-sound')==='off')return;
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
  return new Promise(resolve=>socket.timeout(timeout).emit(event,event==='enter'?{...data,deck:deckRevision}:data,(err,res)=>resolve(err?{ok:false,error:'The relay did not respond.'}:res)));
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
  screen.innerHTML=`<main class="home classic-menu"><div class="flight-brand"><div class="flight-insignia" aria-hidden="true">${glyph('launch')}</div><h1>FAYEZ <em>CREW</em></h1><div class="home-buttons">${btn(glyph('launch')+'<span>CREATE ROOM</span>','create','outline')}${btn(glyph('join')+'<span>JOIN ROOM</span>','join','outline')}</div></div></main>`;
}
function entryForm(kind){
  entry=kind;modal={kind:'entry'};
  modalShell('PRIVATE FLIGHT',kind==='create'?'Create room':'Join room',`<form id="entry-form"><label>Nickname<input name="name" required maxlength="18" value="${escape(nickname())}" autocomplete="nickname" placeholder="Your call sign"></label>${kind==='join'?'<label>Room code<input name="code" required minlength="6" maxlength="6" placeholder="ABC123" autocomplete="off" class="code-input"></label>':''}<button class="primary" type="submit">${kind==='create'?'Create room':'Join room'}</button><p id="entry-status" class="feedback" role="status"></p></form>`,'entry-panel');
  const input=layer.querySelector('input');
  if(kind==='create'&&input.value.trim())input.form.requestSubmit();
  else input.focus();
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
    if(reply.deck!==deckRevision){
      await command('leave');
      throw new Error('The relay is updating to this deck version. Try again shortly.');
    }
    session={code:reply.code,id:reply.id,token:reply.token};sessionStorage.setItem('fayez-session',JSON.stringify(session));localStorage.setItem('fayez-name',name);
    closeModal();tone('ok');
  }catch(e){error.textContent=e.message;}
  finally{joining=false;form.querySelector('button[type=submit]').disabled=false;}
}
socket.on('connect',async()=>{
  if(!session)return;
  const reply=await send('enter',{kind:'resume',...session});
  if(reply.ok&&reply.deck===deckRevision){notice(wasReady?'Flight connection restored.':'');wasReady=true;}
  else if(socket.connected){session=null;state=null;phase='';sessionStorage.removeItem('fayez-session');closeModal();home();notice(reply.error||'The relay is updating to this deck version. Try again shortly.');}
});
socket.on('disconnect',()=>{
  clearMovement();motion.reset();
  if(session)notice('Relay disconnected. Reconnecting…');
});
socket.on('state',s=>{
  if(!session||s.self.id!==session.id)return;
  skew=s.now-Date.now();const old=state;state=s;wasReady=true;
  if(phase!==s.phase){
    phase=s.phase;uiKey='';selectedVote=null;meetingTab='ballot';chatSeen=0;closeModal(false);clearMovement();notice('');
    tone(({lobby:'ok',reveal:'launch',meeting:'alarm',verdict:'vote',result:'ok'})[phase]||'tap');
  }
  if(old?.phase==='countdown'&&s.phase==='lobby')notice('Launch canceled because a player disconnected.');
  if(old?.sabotage?.kind!==s.sabotage?.kind&&s.sabotage){tone('alarm');if(s.sabotage.kind==='comms'&&modal?.kind==='tasks')missionList();}
  if(old?.self.alive&&!s.self.alive)notice(s.self.ghost?'Ghost role: '+special[s.self.ghost].name:'You are now a ghost.');
  if(s.self.signal&&s.self.signal.text!==old?.self.signal?.text)notice(s.self.signal.text);
  motion.receive(s,performance.now());
  update();
  if(pendingInteraction){
    const action=contextAction();
    if(modal){pendingInteraction=null;}
    else if(performance.now()>pendingInteraction.until){pendingInteraction=null;notice('Approach a marked station.');}
    else if(sameAction(action,pendingInteraction.action)){
      pendingInteraction=null;
      void performInteraction(action);
    }
  }
});
function closeModal(cancel=true) {
  if(cancel&&modal?.kind==='task')void command('taskClose');
  const mapWasOpen=modal?.kind==='map';
  modal=null;layer.replaceChildren();touch.clear();
  if(mapWasOpen){
    const button=document.getElementById('map-open');
    if(button)button.hidden=false;
  }
}
function panel(kind,title,body,options={}){
  modal={kind,...options};modalShell('MERIDIAN FLIGHT SYSTEMS',title,body,options.className||'');
}
function chatForm() {
  return '<div class="messages" id="messages" aria-live="polite"></div><form id="chat-form" class="chat-form"><input name="text" maxlength="180" placeholder="Send to the intercom" aria-label="Chat message" autocomplete="off" required><button class="primary">Send</button></form>';
}
function hud(){
  const s=state, me=s.self, inLobby=s.phase==='lobby', captain=s.host===me.id;
  const roleText=s.solo?'SOLO TEST MODE':roleName(me).toUpperCase();
  screen.innerHTML=`<main class="hud ${inLobby?'dropship-hud':''}">${inLobby?`
    <aside class="lobby-summary"><h2>Flight settings</h2><div id="lobby-settings"></div>${captain?btn(glyph('settings')+' Settings','settings','outline'):''}</aside>
    <aside class="lobby-roster"><h2>On board</h2><div class="side-info" id="side-info"></div></aside>
    <div class="lobby-actions actions">${btn('Leave','leave','quiet')}</div>
    <div class="boarding">
      ${captain?btn('START','start','start-launch','id="start-flight"'):''}
      <p class="launch-hint" id="launch-hint"></p>
      <div class="boarding-code">
        <button type="button" class="room-code" data-do="copy" title="Copy room code"><small>ROOM CODE</small><strong id="room-code"></strong></button>
        <button type="button" data-do="copy" class="outline copy-code">COPY CODE</button>
        <div class="count"><small>PLAYER COUNT</small><strong id="crew-count"></strong></div>
      </div>
    </div>`:`<aside class="deck-brief"><div class="flight-data"><div class="bar"><small>SHIP RESTORATION <span id="task-count"></span></small><progress max="1" value="0" id="task-progress"></progress></div></div><div id="side-info"></div></aside><div class="flight-tools">${mapButton('map-open')}${btn(glyph('settings'),'flight-settings','flight-options','aria-label="Settings" title="Settings"')}</div><div class="location"><span id="current-room"></span></div><div class="role-label">${roleText}</div>`}
    <div class="alert" id="emergency" hidden></div>
  <footer class="controls"><div class="controls-hint"><span>WASD / ↑↓←→</span> Move <span>SPACE</span> Use</div>${inLobby?'':`<div class="actions">${me.team==='impostor'&&me.alive?btn('Eliminate','strike','danger','id="strike-action"'):''}${me.team==='impostor'?btn('Sabotage','sabotage','danger'):''}${me.role||me.ghost?btn('Ability','ability'):''}${s.solo?btn('Test controls','practice','outline'):''}</div>`}</footer><div class="touch" aria-label="Movement controls">${[['up','↑'],['left','←'],['down','↓'],['right','→']].map(([d,label])=>`<button type="button" data-move="${d}" aria-label="Move ${d}">${label}</button>`).join('')}</div><div class="prompt" id="prompt"></div></main>`;
}
function contextAction(p=state.self){
  const s=state;
  if(s.phase==='lobby')return dist(p,terminal)<76?{label:'Open suit locker',kind:'suit'}:null;
  if(s.phase!=='play')return null;
  if(Number.isInteger(p.ventIndex))return {label:'Open hatch controls',kind:'vent'};
  const line=point=>!p.alive||clearDeckLine(p,point,s.doors);
  const b=p.alive&&nearest(s.bodies.filter(line),p,70);
  if(b)return {label:'Report incident',kind:'report',data:{id:b.id}};
  if(s.sabotage?.nearby.length)return {label:'Repair '+s.sabotage.kind,kind:'repair'};
  const available=p.assignments.filter(a=>!a.done).map(a=>{
    const task=tasks.find(t=>t.id===a.id);
    return {...task.stops[a.stage],id:a.id,label:taskStageName(task,a.stage)};
  });
  const a=nearest(available.filter(q=>dist(p,q)<taskRange(q.id)&&line(q)),p,57);
  if(a&&s.sabotage?.kind!=='comms')return {label:a.label,kind:'task',data:a.id};
  if(p.alive&&(p.team==='impostor'||p.effect==='engineer')&&vents.some(v=>dist(p,v)<48&&line(v)))return {label:'Use service hatch',kind:'vent'};
  if(p.alive&&dist(p,meetingPoint)<emergencyRange&&line(meetingPoint)&&p.emergencies>0&&!s.sabotage&&now()>p.meetingAt)return {label:'Call emergency assembly',kind:'emergency'};
  if(p.alive&&dist(p,deck.admin)<85&&line(deck.admin)&&s.sabotage?.kind!=='comms')return {label:'View command telemetry',kind:'monitor',data:'command'};
  if(p.alive&&dist(p,deck.security)<85&&line(deck.security)&&s.sabotage?.kind!=='comms')return {label:'View sector activity',kind:'monitor',data:'security'};
  return null;
}
function update(){
  const s=state,p=s.self;
  const intro=s.phase==='meeting'&&s.now<s.meeting.introUntil;
  const key=[s.phase,s.host,p.alive,p.role,p.ghost,intro].join('|');
  if(key!==uiKey){
    uiKey=key;
    if(s.phase==='lobby'||s.phase==='play')hud();
    else cinematic();
  }
  if(s.phase==='lobby'){
    const count=s.roster.filter(q=>q.online).length, solo=count===1&&s.roster.length===1, settings=s.settings;
    document.querySelector('#room-code').textContent=s.code;document.querySelector('#crew-count').textContent=count+'/10';
    const start=document.querySelector('#start-flight');
    if(start){
      start.disabled=!solo&&count<4;
      document.querySelector('#launch-hint').textContent=solo?'Solo test available':count<4?'Waiting for at least 4 players':'';
    }
    markup('lobby-settings',`<dl><div><dt>Map</dt><dd>Meridian</dd></div><div><dt>Infiltrators</dt><dd>${settings.impostors}</dd></div><div><dt>Discussion</dt><dd>${settings.discussion}s</dd></div><div><dt>Voting</dt><dd>${settings.voting}s</dd></div><div><dt>Tasks</dt><dd>${settings.commonTasks} / ${settings.shortTasks} / ${settings.longTasks}</dd></div></dl>`);
    markup('side-info',s.roster.map(q=>`<div>${tag(q.color)}${escape(q.name)}${q.id===s.host?' <span>CAPTAIN</span>':''}${!q.online?' <span>OFFLINE</span>':''}</div>`).join(''));
    markup('prompt',promptButton(contextAction(motion.position()||p)));
  }
  if(s.phase==='countdown')document.querySelector('#countdown-number').textContent=Math.max(1,Math.ceil((s.until-now())/1000));
  if(s.phase==='play'){
    const progress=document.querySelector('#task-progress');progress.value=s.progress.total?s.progress.done/s.progress.total:0;
    document.querySelector('#task-count').textContent=s.progress.done+' / '+s.progress.total;
    const current=rooms.find(r=>contains(r,p.x,p.y))?.name||'Transit';
    const stationList=s.sabotage?.kind==='comms'?'<li>Communications offline</li>':
      p.assignments.filter(a=>!a.done).slice(0,4).map(a=>{
        const task=tasks.find(t=>t.id===a.id),stop=task.stops[a.stage];
        return '<li><span>'+escape(taskStageName(task,a.stage))+'</span><small>'+escape(deck[stop.room].name)+(task.stops.length>1?' · '+(a.stage+1)+'/'+task.stops.length:'')+'</small></li>';
      }).join('')||'<li>Assignments complete</li>';
    document.querySelector('#current-room').textContent=current;
    markup('side-info',`<div class="task-brief">${btn(p.team==='impostor'?'Cover tasks':'Tasks','tasks','quiet')}<ul>${stationList}</ul></div>`);
    const strike=document.getElementById('strike-action');
    if(strike){strike.disabled=now()<p.killAt;strike.textContent=strike.disabled?'Eliminate '+clock(p.killAt,now())+'s':'Eliminate [Q]';}
    const danger=document.querySelector('#emergency');danger.hidden=!s.sabotage;
    if(s.sabotage)danger.textContent=s.sabotage.kind.toUpperCase()+' FAILURE'+(s.sabotage.until?' · '+clock(s.sabotage.until,now())+'s':' · Find a repair station');
    markup('prompt',promptButton(contextAction(motion.position()||p)));
  }
  if(s.phase==='meeting'&&!intro){refreshMeeting();refreshChat();}
  if(modal?.kind==='suit'&&dist(p,terminal)>=76)closeModal(false);
  for(const [id,end] of [['ability-time',p.abilityAt],['effect-time',p.effectUntil]]){
    const timer=document.getElementById(id);if(timer){timer.textContent=clock(end||0,now());if(timer.textContent==='00')abilityPanel();}
  }
  if(modal?.kind==='ability'&&modal.role==='scientist'){
    const vitals=layer.querySelector('#vitals');
    if(vitals)vitals.innerHTML=(s.tactical.vitals||[]).map(q=>'<li><b>'+escape(q.name)+'</b><span>'+(q.alive?'Online':'No pulse')+'</span></li>').join('');
  }
  if(modal?.kind==='sabotage'){
    drawMap(layer.querySelector('canvas'),s,true);
    document.querySelector('#sabotage-status').textContent=s.sabotage?
      s.sabotage.kind.toUpperCase()+' ACTIVE'+(s.sabotage.until?' · '+clock(s.sabotage.until,now())+'s':''):
      now()>=p.sabotageAt?'Ready to disrupt':'Cooldown · '+clock(p.sabotageAt,now())+'s';
  }
  if(modal?.kind==='map')drawMap(layer.querySelector('canvas'),s);
  if(modal?.kind==='task'){
    if(s.puzzle?.id!==modal.id&&!modal.pending&&now()-modal.openedAt>300)closeModal(false);
    else if(s.puzzle)modal.task.update(s.puzzle,now());
  }
  if(modal?.kind==='repair'&&(!s.sabotage||!s.sabotage.nearby.length))closeModal(false);
  if(modal?.kind==='repair'&&s.sabotage?.kind==='lights') for(const [i,b] of [...layer.querySelectorAll('[data-switch]')].entries()){b.classList.toggle('active',s.sabotage.pattern[i]);b.textContent=s.sabotage.pattern[i]?'ON':'OFF';}
  if(modal?.kind==='suit')for(const b of layer.querySelectorAll('[data-color]')){b.disabled=s.roster.some(q=>q.id!==p.id&&q.color===b.dataset.color);b.classList.toggle('active',p.color===b.dataset.color);b.setAttribute('aria-pressed',String(p.color===b.dataset.color));}
}
function cinemaSuit(canvas,p){
  const ctx=canvas.getContext('2d');
  astronaut(ctx,{...p,x:canvas.width/2,y:canvas.height*.68,facing:1},0,2.5);
}
function cinematic(){
  const s=state,p=s.self;
  if(s.phase==='countdown'){
    screen.innerHTML=`<main class="launch-countdown"><div>${s.solo?'SOLO TEST MODE':'PRIVATE FLIGHT'}</div><h1 id="countdown-number"></h1><p>Launching</p></main>`;
  }else if(s.phase==='reveal'){
    const role=p.role&&special[p.role];
    screen.innerHTML=`<main class="cinema reveal ${p.team==='impostor'?'red':''}"><div class="eyebrow">${s.solo?'SOLO TEST MODE':'PRIVATE ROLE'} · FLIGHT ${s.round}</div><canvas class="role-portrait" width="220" height="145"></canvas><h1>${escape(roleName(p))}</h1><p>${escape(role?.description||(p.team==='impostor'?'Disrupt the ship. Blend in with the crew.':'Restore the ship. Watch your crewmates.'))}</p>${p.allies.length>1?'<p class="muted">Allies · '+s.roster.filter(q=>q.id!==p.id&&p.allies.includes(q.id)).map(q=>escape(q.name)).join(', ')+'</p>':''}</main>`;
    cinemaSuit(screen.querySelector('canvas'),p);
  }else if(s.phase==='meeting'){
    const m=s.meeting, caller=s.roster.find(q=>q.id===m.caller);
    const report=m.kind==='report';
    const byline=(report?'Reported by ':'Called by ')+ (caller?.name||'Crew');
    if(s.now<m.introUntil){
      const title=report?'Body reported':'Emergency meeting';
      const illustration=report?
        `<div class="incident-beacon"><span aria-hidden="true">!</span>${portrait(m.incident?.color||caller?.color,0,false)}</div>`:
        '<div class="intercom-switch"><i></i><b></b></div>';
      screen.innerHTML=`<main class="assembly-intro ${report?'report-intro':'emergency-intro'}" style="--elapsed:-${Math.max(0,s.now-m.start)}ms;--sleeve:${colors[caller?.color]||colors.red}">
      <div class="assembly-motion"></div><div class="announcement"><span>MERIDIAN ALERT</span><h1>${title}</h1><p>${escape(byline)}</p></div>
      <div class="assembly-illustration">${portrait(caller?.color,caller?.hat,true)}${illustration}</div><div class="assembly-stripes"></div></main>`;
    }else{
      screen.innerHTML=`<main class="meeting tablet-meeting"><div class="tablet-frame"><div class="tablet-screen">
      <header><div class="meeting-heading"><h1>Crew assembly</h1>
      <div class="meeting-tabs" aria-label="Meeting views">
        ${btn('Ballot','meeting-tab','outline','data-id="ballot" id="meeting-ballot-button" aria-controls="meeting-ballot"')}
        ${btn(glyph('radio')+' Chat <span id="unread-chat" hidden></span>','meeting-tab','outline','data-id="chat" id="meeting-chat-button" aria-controls="meeting-chat"')}</div></div>
      <p class="meeting-caller">${escape(byline)}${s.solo?' · Solo drill':''}</p><p id="meeting-time"></p></header>
      <div class="meeting-views"><section id="meeting-ballot"><div id="ballot" class="ballot-grid"></div><div id="ballot-controls"></div></section>
      <section id="meeting-chat" class="tablet-comms" hidden><h2>Meeting chat</h2>${chatForm()}</section></div></div></div></main>`;
    }
  }else if(s.phase==='verdict'){
    const v=s.meeting.result;
    screen.innerHTML=`<main class="cinema verdict ${v.target?'red':''}"><div class="eyebrow">BALLOT COMPLETE</div>${v.target?'<canvas class="eject" width="220" height="145"></canvas>':'<div class="airlock-icon">◈</div>'}<h1>${v.target?escape(v.target.name)+' ejected':v.tie?'Ballot tied':'Airlock held'}</h1><p>${v.target&&v.role?(v.role==='impostor'?'An infiltrator was removed.':'A crewmate was removed.'):'No additional identity information was released.'}</p><div class="verdict-votes">${Object.entries(v.counts).map(([id,n])=>`<span>${id==='skip'?'Skip':escape(s.roster.find(p=>p.id===id)?.name)} · ${n}</span>`).join('')}</div>${v.votes?`<div class="verdict-votes">${v.votes.map(([from,to])=>`<span>${escape(s.roster.find(q=>q.id===from)?.name)} voted ${to==='skip'?'Skip':escape(s.roster.find(q=>q.id===to)?.name)}</span>`).join('')}</div>`:''}</main>`;
    if(v.target)cinemaSuit(screen.querySelector('canvas'),{...v.target,alive:true});
  }else if(s.phase==='result'){
    const v=s.outcome;
    screen.innerHTML=`<main class="cinema result ${v.team==='impostor'?'red':''}"><div class="eyebrow">FLIGHT ${s.round} COMPLETE</div><div class="airlock-icon">✦</div><h1>${v.team==='impostor'?'Infiltrator victory':'Crew victory'}</h1><p>${escape(v.reason)}</p><div class="result-roster">${v.crew.map(q=>`<span>${portrait(q.color,q.hat,true)}${escape(q.name)}<small>${escape(special[q.role]?.name||(q.team==='impostor'?'Infiltrator':'Crew'))}</small></span>`).join('')}</div><div class="actions">${s.host===p.id?btn('Return to shuttle','reset','primary'):'<span class="muted">Waiting for the captain to re-dock.</span>'}${btn('Leave','leave','quiet')}</div></main>`;
  }
}
function refreshMeeting(){
  const s=state,m=s.meeting,p=s.self,discuss=s.now<m.voteAt;
  document.querySelector('#meeting-time').textContent=(discuss?'DISCUSSION: '+clock(m.voteAt,now()):'VOTING ENDS IN: '+clock(m.end,now()))+' SECONDS';
  const can=!discuss&&p.alive&&!m.myVote;
  const eligible=s.roster.filter(q=>q.alive&&q.online);
  if(selectedVote!==null&&selectedVote!=='skip'&&!eligible.some(q=>q.id===selectedVote))selectedVote=null;
  const rows=s.roster.map(q=>`<div class="ballot-row ${q.alive?'':'dead'} ${selectedVote===q.id?'picked':''}">
    <span class="ballot-player">${portrait(q.color,q.hat,q.alive)} <b>${escape(q.name)}</b>
    ${q.id===m.caller&&m.kind==='report'?'<span class="reporter" role="img" aria-label="Body reporter" title="Body reporter">📣</span>':''}
    ${q.alive?(q.online?'':'<small>OFFLINE</small>'):'<small>GHOST</small>'}</span>
    ${m.voted?.includes(q.id)?'<small class="voted-stamp">VOTED</small>':''}
    ${q.alive&&q.online&&can&&!s.solo?btn('Vote','pick-vote','','data-id="'+q.id+'"'):''}
    ${!discuss&&q.alive&&q.id!==p.id&&p.alive&&p.role==='judge'&&!p.used&&p.assignments.some(a=>a.done)?btn('Override','judge','danger','data-id="'+q.id+'"'):''}
    ${q.id!==p.id?btn(muted.has(q.id)?'Unmute':'Mute','mute','quiet','data-id="'+q.id+'"'):''}</div>`).join('');
  markup('ballot',rows);
  const selected=selectedVote==='skip'?'Skip Vote':s.roster.find(q=>q.id===selectedVote)?.name;
  markup('ballot-controls',`<div class="ballot-actions">${can?btn('Skip Vote','pick-vote','outline','data-id="skip"'):''}
    ${can&&selected?`<span>Vote for <strong>${escape(selected)}</strong>?</span>${btn('Confirm vote','vote','primary')}${btn('Cancel','cancel-vote','quiet')}`:''}
    ${m.myVote?'<span class="ballot-saved">Ballot submitted</span>':''}
    <span class="ballot-progress">${eligible.filter(q=>m.voted?.includes(q.id)).length} / ${eligible.length} voted</span></div>`);
}
function refreshChat(){
  const box=document.querySelector('#messages');
  if(!box)return;
  const messages=state.chat.filter(q=>!muted.has(q.id));
  if(meetingTab==='chat')chatSeen=Math.max(chatSeen,messages.at(-1)?.sequence||0);
  const unread=messages.filter(q=>q.sequence>chatSeen&&q.id!==state.self.id).length;
  const badge=document.querySelector('#unread-chat');
  badge.hidden=unread===0;badge.textContent=unread;
  const chatActive=meetingTab==='chat';
  document.querySelector('#meeting-chat').hidden=!chatActive;
  document.querySelector('#meeting-ballot').hidden=chatActive;
  document.querySelector('#meeting-chat-button').setAttribute('aria-pressed',String(chatActive));
  document.querySelector('#meeting-ballot-button').setAttribute('aria-pressed',String(!chatActive));
  const msg=messages.map(q=>`<p>${tag(q.color)} <b>${escape(q.name)}${q.ghost?' · Ghost':''}</b> ${escape(q.text)}</p>`).join('')||'<p class="muted">Channel is quiet.</p>';
  if(box.dataset.content===msg)return;
  const bottom=box.scrollTop+box.clientHeight>box.scrollHeight-42;
  box.innerHTML=msg;box.dataset.content=msg;if(bottom)box.scrollTop=box.scrollHeight;
}
const numbers={impostors:['Infiltrators',1,3],discussion:['Discussion (s)',5,90],voting:['Voting (s)',10,120],killCooldown:['Strike cooldown (s)',10,60],meetingCooldown:['Intercom cooldown (s)',5,60],shortTasks:['Short tasks',0,8],longTasks:['Long tasks',0,5],commonTasks:['Common tasks',0,2],crewVision:['Crew vision',120,450],speed:['Walk speed',95,240]};
const numberField=(name,label,min,max,value)=>`<label>${label}<input type="number" name="${name}" min="${min}" max="${max}" value="${value}" required></label>`;
function settingsPanel(){
  const cfg=state.settings;
  panel('settings','Lobby settings',`<form id="settings-form"><div class="settings-grid">${Object.entries(numbers).map(([key,[label,min,max]])=>numberField(key,label,min,max,cfg[key])).join('')}</div><div class="checks"><label><input type="checkbox" name="anonymous" ${cfg.anonymous?'checked':''}> Anonymous voting</label><label><input type="checkbox" name="confirm" ${cfg.confirm?'checked':''}> Confirm ejection team</label><label><input type="checkbox" name="early" ${cfg.early?'checked':''}> End voting when all eligible players vote</label></div><h3>Optional roles</h3><p class="muted">Each role starts disabled. Available seats depend on team size.</p><div class="roles-grid">${Object.entries(special).map(([id,v])=>`<details><summary>${v.name} <small>${v.team}</small></summary><p>${v.description}</p><label><input type="checkbox" name="${id}:enabled" ${cfg.roles[id].enabled?'checked':''}> Enabled</label><div class="settings-grid">${[['max','Max',0,4],['chance','Chance (%)',0,100],['cooldown','Cooldown (s)',0,100],['duration','Duration (s)',0,55]].map(([k,l,a,b])=>numberField(id+':'+k,l,a,b,cfg.roles[id][k])).join('')}</div></details>`).join('')}</div><button class="primary">Save settings</button></form>`,{className:'wide'});
}
function suitPanel(){
  const p=state.self;
  panel('suit','Suit locker',`<div class="gear-preview"><canvas width="220" height="145" aria-label="Selected suit preview"></canvas><div class="gear-controls"><label>Equipment<select id="hat">${hats.map((h,i)=>`<option value="${i}" ${i===p.hat?'selected':''}>${h}</option>`).join('')}</select></label><label><input id="show-name" type="checkbox" ${p.showName?'checked':''}> Display nickname above suit</label></div></div>
    <div class="swatches suit-palette" aria-label="Suit colors">${suitPalette.map(([id,name])=>btn(`${portrait(id,0,true)}<span>${name}</span>`,'color','color-button','data-color="'+id+'" aria-label="'+name+'" title="'+name+'"')).join('')}</div>`,{className:'suit-panel'});
  cinemaSuit(layer.querySelector('canvas'),p);update();
}
function missionList(){
  if(state.sabotage?.kind==='comms'){panel('tasks','Assignments offline','<p>Restore comms to recover ship assignments.</p>');return;}
  const p=state.self;
  panel('tasks',p.team==='impostor'?'Cover assignments':'Assigned maintenance',`<ul class="mission-list">${p.assignments.map(a=>{const task=tasks.find(v=>v.id===a.id);return '<li class="'+(a.done?'done':'')+'"><b>'+escape(a.done?task.label:taskStageName(task,a.stage))+'</b><span>'+(a.done?'Complete':deck[task.stops[a.stage].room].name+' • '+task.kind+(task.stops.length>1?' '+(a.stage+1)+'/'+task.stops.length:'')+(task.instrument==='route'&&a.stage===0?' → '+deck[task.stops[1].room].name:''))+'</span></li>';}).join('')}</ul>`);
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
  const available=now()>=p.abilityAt&&(id!=='scientist'||p.battery), target=(['angel','influencer','shapeshifter'].includes(id)?s.roster:s.positions).filter(q=>q.id!==p.id&&q.alive!==false);
  let body='<p>'+escape(role.description)+'</p>';
  if(id==='scientist')body+='<ul class="mission-list" id="vitals"></ul>';
  if(id==='detective'&&s.tactical.notes)body+='<ul>'+s.tactical.notes.map(q=>'<li>'+escape(q.text)+'</li>').join('')+'</ul>';
  if(id==='tracker'&&s.tactical.track)body+='<p>Tracking '+escape(s.tactical.track.name)+'. Check the deck map.</p>';
  if(id==='judge')body+='<p>Complete an assignment to unlock the override. Use it from the voting panel.</p>';
  if(p.effectUntil>now())body+='<p class="cooldown">Effect active · <span id="effect-time">'+clock(p.effectUntil,now())+'</span>s</p>';
  if(now()<p.abilityAt)body+='<p class="cooldown">Ready in <span id="ability-time">'+clock(p.abilityAt,now())+'</span>s</p>';
  if(id==='scientist'&&!p.battery)body+='<p>Complete an assignment to recharge the vitals battery.</p>';
  if(available&&['engineer','scientist','phantom'].includes(id))body+=btn(role.ability,'activate','primary');
  if(available&&['angel','influencer','shapeshifter','tracker','detective'].includes(id)){
    if(id==='influencer')body+='<div class="signal-hand">'+(s.tactical.signals||[]).map((symbol,i)=>'<label><input type="checkbox" name="signal" value="'+escape(symbol)+'" aria-label="Symbol '+(i+1)+'"> '+escape(symbol)+'</label>').join('')+'</div>'+(s.tactical.refresh?btn('Refresh symbols','refresh-signals','quiet'):'');
    body+='<div class="targets">'+target.filter(q=>!q.id.startsWith('echo-')).map(q=>btn(tag(q.color)+' '+escape(q.name),'activate','','data-id="'+q.id+'"')).join('');
    if(id==='detective')body+=s.bodies.map(q=>btn('Record incident: '+escape(q.name),'activate','','data-id="'+q.id+'"')).join('');
    body+='</div>';
  }
  panel('ability',role.name,body,{role:id});
}
const sameAction=(a,b)=>a?.kind===b.kind&&a.label===b.label&&
  (typeof b.data==='object'?a.data?.id===b.data?.id:a.data===b.data);
function interact(){
  pendingInteraction=null;
  const action=contextAction();
  const predicted=!modal&&motion.position()?contextAction(motion.position()):null;
  if(predicted&&!sameAction(action,predicted)){
    pendingInteraction={action:predicted,until:performance.now()+300};
    return;
  }
  if(action)return performInteraction(action);
  notice('Approach a marked station.');
}
async function performInteraction(action){
  if(action.kind==='suit'){suitPanel();return;}
  if(action.kind==='repair'){repairPanel();return;}
  if(action.kind==='task'){
    const res=await command('taskOpen',{id:action.data});
    if(!res.ok||state.phase!=='play')return;
    const task=tasks.find(t=>t.id===action.data);
    panel('task',taskStageName(task,res.puzzle.stage),'<div id="instrument"></div>',{id:task.id,openedAt:now(),className:'instrument'});
    const opening=modal;
    opening.task=taskPanel(layer.querySelector('#instrument'),res.puzzle,now,async value=>{
      if(modal!==opening||opening.pending)return {ok:false};
      opening.pending=true;
      const step=await command('taskStep',value);
      opening.pending=false;
      if(step.done&&modal===opening){tone('ok');notice('Station verified.');closeModal(false);}
      return step;
    });
    return;
  }
  if(action.kind==='vent'){
    if(Number.isInteger(state.self.ventIndex))showHatch(state.self.ventIndex);
    else {const res=await command('vent',{action:'enter'});if(res.ok)showHatch(vents.findIndex(v=>dist(state.self,v)<48));}
    return;
  }
  if(action.kind==='monitor'){
    const res=await command('monitor',{kind:action.data});
    if(res.ok)panel('monitor',action.data==='security'?'Sector activity':'Command telemetry','<ul class="mission-list">'+res.readings.map(([k,v])=>'<li><b>'+escape(k)+'</b><span>'+escape(v)+'</span></li>').join('')+'</ul>'+btn('Refresh','interact'));
    return;
  }
  await command(action.kind,action.data);
}
function showHatch(at){
  if(at<0)return;
  panel('vent','Service hatch','<p>Choose a connected hatch or return to the deck.</p><div class="targets">'+ventDestinations(at).map(i=>{return btn(deck[vents[i].room].name,'vent','outline','data-id="'+i+'"');}).join('')+btn('Exit hatch','exit-vent','primary')+'</div>');
}
async function suitChange(color){
  const me=state.self, locker=modal;
  if(locker?.kind!=='suit')return;
  const selected=color||locker.color||me.color;
  locker.color=selected;
  const hat=Number(document.querySelector('#hat').value),showName=document.querySelector('#show-name').checked;
  const reply=await command('suit',{color:selected,hat,showName});
  if(!reply.ok&&modal===locker&&locker.color===selected)locker.color=state.self.color;
  if(reply.ok&&modal===locker){
    const can=layer.querySelector('canvas');can.getContext('2d').clearRect(0,0,can.width,can.height);
    cinemaSuit(can,{...me,color:selected,hat});
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
  if(action==='flight-settings'){
    const soundOn=localStorage.getItem('fayez-sound')!=='off';
    panel('flight-settings','Flight settings',`<p>Move with WASD or the arrow keys. Use Space to interact and M to open the map.</p>
      <label class="sound-setting"><input type="checkbox" id="flight-sound" ${soundOn?'checked':''}> Game sounds</label>
      ${btn('Leave flight','leave','danger')}`);
  }
  if(action==='meeting-tab'&&s.phase==='meeting'){
    meetingTab=id;refreshChat();
    if(id==='chat')document.querySelector('#chat-form input').focus();
  }
  if(action==='tasks')missionList();
  if(action==='ability')abilityPanel();
  if(action==='practice'&&s.solo){
    panel('practice','Solo test controls',`<p>Try ship systems and untargeted abilities. End the test whenever you’re ready.</p>
      <label>Practice role<select id="practice-role">${[['','Crewmate'],['engineer','Engineer'],['scientist','Scientist'],['phantom','Phantom']].map(([value,name])=>`<option value="${value}" ${(p.role||'')===value?'selected':''}>${name}</option>`).join('')}</select></label>
      <div class="targets">${btn('Apply role','practice-role','primary')}${btn('Sabotage','sabotage','danger')}${btn('Deck overview','deck-overview')}${btn('Emergency drill','practice-meeting','outline','data-id="emergency"')}${btn('Body report drill','practice-meeting','outline','data-id="report"')}${btn('Reset systems','practice-clear','outline')}${btn('Return to dropship','practice-return','outline')}</div>`);
  }
  if(action==='practice-meeting')await command('practiceMeeting',{kind:id});
  if(action==='deck-overview'&&s.solo){
    panel('deck-overview','Meridian flight deck',deckCanvas(1092),{className:'map-panel'});
    drawDeckOverview(layer.querySelector('canvas'));
  }
  if(action==='practice-role'){
    const result=await command('practiceRole',{role:document.querySelector('#practice-role').value||null});
    if(result.ok){closeModal(false);notice('Practice role selected.');}
  }
  if(action==='practice-clear'&&(await command('practiceClear')).ok){closeModal(false);notice('Ship systems restored.');}
  if(action==='practice-return')await command('practiceReturn');
  if(action==='map'&&s.phase==='play'){
    if(modal?.kind==='map'){closeModal(false);return;}
    panel('map','Meridian deck plan',deckCanvas(980)+'<div class="map-legend"><span>● Your position</span><span>● Assigned station</span><span>● Active repairs</span></div>',{className:'map-panel blue-map'});
    document.getElementById('map-open').hidden=true;
    layer.firstElementChild.insertAdjacentHTML('beforeend',mapButton('map-close'));
    drawMap(layer.querySelector('canvas'),state);
  }
  if(action==='sabotage'&&s.phase==='play'&&(p.team==='impostor'||s.solo)){
    panel('sabotage','Sabotage controls',`${deckCanvas(900,'map sabotage-map')}<p id="sabotage-status"></p><p class="sabotage-legend">Dashed lines show hatch links. Squares show bulkheads. L / C / O / R mark lights, comms, oxygen and reactor.</p><div class="targets">${Object.keys(repairs).map(k=>btn(k.toUpperCase(),'target-sabotage','danger','data-id="'+k+'"')).join('')}</div><label>Bulkhead<select id="door">${doors.map(d=>'<option value="'+d.id+'">'+escape(d.label)+'</option>').join('')}</select></label>${btn('Seal bulkhead','target-sabotage','outline','data-id="doors"')}`,{className:'map-panel'});
    drawMap(layer.querySelector('canvas'),state,true);
  }
  if(action==='target-sabotage'&&(await command('sabotage',{kind:id,door:Number(document.querySelector('#door').value)})).ok)closeModal(false);
  if(action==='interact')await interact();
  if(action==='start'||action==='reset')await command(action);
  if(action==='pick-vote'){selectedVote=id;refreshMeeting();}
  if(action==='cancel-vote'){selectedVote=null;refreshMeeting();}
  if(action==='vote'&&selectedVote){
    if((await command('vote',{id:selectedVote})).ok)selectedVote=null;
  }
  if(action==='judge')await command('ability',{target:id});
  if(action==='mute'){if(muted.has(id))muted.delete(id);else muted.add(id);update();}
  if(action==='activate'){
    const res=await command('ability',{target:id,signals:[...layer.querySelectorAll('input[name=signal]:checked')].map(v=>v.value)});
    if(res.ok){notice('Ability activated.');setTimeout(()=>{if(modal?.kind==='ability')abilityPanel();},115);}
  }
  if(action==='strike'){
    const q=nearest(s.positions.filter(q=>q.id!==p.id&&q.alive&&!p.allies.includes(q.id)&&!q.id.startsWith('echo-')),p,61);
    if(q)await command('strike',{target:q.id});else notice('There is no target in range.');
  }
  if(action==='refresh-signals'&&(await command('ability',{refresh:true})).ok)setTimeout(()=>{if(modal?.kind==='ability')abilityPanel();},115);
  if(action==='vent'&&(await command('vent',{dest:Number(id)})).ok)showHatch(Number(id));
  if(action==='exit-vent'&&(await command('vent',{action:'exit'})).ok)closeModal(false);
  if(action==='switch')await command('repair',{index:modal.station,a:Number(b.dataset.switch)});
  if(action==='relay-pad'){
    const res=await command('repair',{index:modal.station});if(res.ok)notice('Relay signal sent.');
  }
  if(action==='color')await suitChange(b.dataset.color);
  if(action==='copy'){
    try{
      try{await navigator.clipboard.writeText(s.code);}
      catch{
        const input=document.createElement('textarea');
        input.value=s.code;input.className='copy-buffer';
        document.body.append(input);input.select();
        try{if(!document.execCommand('copy'))throw Error('Clipboard unavailable');}
        finally{input.remove();b.focus();}
      }
      notice('Room code copied.');
    }catch{notice('Room code · '+s.code);}
  }
  if(action==='leave'){
    await command('leave');session=null;state=null;phase='';sessionStorage.removeItem('fayez-session');closeModal(false);home();
  }
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-do]');if(!b)return;
  if(e.detail>0&&b.closest('.hud'))b.blur();
  void click(b);
});
document.addEventListener('change',e=>{
  if(e.target.matches('#hat,#show-name'))void suitChange();
  if(e.target.matches('#flight-sound'))localStorage.setItem('fayez-sound',e.target.checked?'on':'off');
});
document.addEventListener('submit',async e=>{
  const form=e.target;
  if(!form.id)return;
  e.preventDefault();
  if(form.id==='entry-form'){await enter(form);return;}
  const data=new FormData(form);
  if(form.id==='settings-form'){
    const cfg=Object.fromEntries(Object.keys(numbers).map(k=>[k,Number(data.get(k))]));
    for(const key of ['anonymous','confirm','early'])cfg[key]=data.has(key);
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
addEventListener('keydown',e=>{
  if(e.key==='Escape'&&modal){closeModal();return;}
  if(!state||e.target.closest?.('input,textarea,select,[contenteditable]')||e.ctrlKey||e.metaKey||e.altKey)return;
  const k=e.key.toLowerCase();
  if(directions[k]&&(!modal||modal.kind==='map')){held.add(k);e.preventDefault();if(!e.repeat)syncMovement();}
  if(k===' '&&!modal&&['play','lobby'].includes(state.phase)&&!e.target.closest?.('button')){
    e.preventDefault();if(!e.repeat)void interact();return;
  }
  if(e.repeat)return;
  if(!modal&&k==='r'&&state.phase==='play'){
    const body=nearest(state.bodies,state.self,70);
    if(body)void command('report',{id:body.id});
  }
  if(!modal&&k==='q'&&state.phase==='play'&&state.self.team==='impostor')void click({dataset:{do:'strike'}});
  if(k==='m'&&state.phase==='play'){if(modal?.kind==='map')closeModal();else if(!modal)void click({dataset:{do:'map'}});}
});
addEventListener('keyup',e=>{if(held.delete(e.key.toLowerCase()))syncMovement();});
addEventListener('blur',clearMovement);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearMovement();});
document.addEventListener('pointerdown',e=>{
  const b=e.target.closest('[data-move]');if(!b)return;
  e.preventDefault();b.setPointerCapture(e.pointerId);touch.add(b.dataset.move);syncMovement();
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(event,e=>{if(touch.delete(e.target.dataset?.move))syncMovement();});
function frame(t){
  const predicted=syncMovement(t)?motion.draw(t):null;
  render(state,t,predicted);
  requestAnimationFrame(frame);
}
home();requestAnimationFrame(frame);
try{session=JSON.parse(sessionStorage.getItem('fayez-session'));}catch{}
if(session)socket.connect();
