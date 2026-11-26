import {io} from 'socket.io-client';
import {colors,suitPalette,hats,rooms,deckRevision,deck,deckBounds,doors,vents,ventDestinations,tasks,taskRange,taskStageName,repairs,terminal,meetingPoint,emergencyRange,securityConsole,securityRange,cameraSites,contains,clearDeckLine,dist} from '../shared/deck.js';
import {gameNumbers,gameChecks,taskBars,requiredPlayers,gameDefaults} from '../shared/settings.js';
import {special,roleFields,roleNumbers,roleChoices,defaultRoles,remainsRange} from '../shared/roles.js';
import {astronaut,renderer,drawMap,drawSecurityFeeds,suitPortrait} from './art.js';
import {taskPanel} from './tasks.js';
import {movement} from './movement.js';
import {actionIcon} from './icons.js';
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
const killTarget=(s,p)=>nearest(s.positions.filter(q=>q.id!==p.id&&q.alive&&!p.allies.includes(q.id)&&!q.id.startsWith('echo-')),p,s.settings.killDistance);
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
const teamName={crew:'Crewmate',impostor:'Impostor',neutral:'Neutral'};
const roleName=p=>p.alive?(special[p.role]?.name||teamName[p.team]||'Crewmate'):(special[p.ghost]?.name||`${special[p.role]?.team==='neutral'?special[p.role].name:teamName[p.team]} Ghost`);
const collectionText=p=>`${p.objective.done} / ${p.objective.goal} collected`;

let selectedVote=null,submittedVote=null,votePending=false,meetingTab='ballot',chatSeen=0;
const mapButton=id=>btn(actionIcon('map'),'map','map-toggle',
  'id="'+id+'" aria-label="Map" title="Map [M or hold Tab]" aria-expanded="'+(id==='map-open'?'false':'true')+'"');
const promptButton=action=>action?btn(actionIcon(({suit:'customize',report:'report',vent:'vent',monitor:action.data==='security'?'security':'admin'})[action.kind]||'use')+'<kbd>SPACE</kbd> '+escape(action.label),'interact','space-action'):'';

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
  if(modal?.kind==='map'&&modal.held)closeModal(false);
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
  screen.innerHTML=`<main class="home classic-menu"><div class="flight-brand"><div class="flight-insignia" aria-hidden="true">${glyph('launch')}</div><h1>Fayez <em>Among Us</em></h1><div class="home-buttons">${btn(glyph('launch')+'<span>CREATE ROOM</span>','create','outline')}${btn(glyph('join')+'<span>JOIN ROOM</span>','join','outline')}</div></div></main>`;
}
function entryForm(kind){
  entry=kind;modal={kind:'entry'};
  modalShell('PRIVATE MATCH',kind==='create'?'Create room':'Join room',`<form id="entry-form"><label>Nickname<input name="name" required maxlength="18" value="${escape(nickname())}" autocomplete="nickname" placeholder="Your call sign"></label>${kind==='join'?'<label>Room code<input name="code" required minlength="6" maxlength="6" placeholder="ABC123" autocomplete="off" class="code-input"></label>':''}<button class="primary" type="submit">${kind==='create'?'Create room':'Join room'}</button><p id="entry-status" class="feedback" role="status"></p></form>`,'entry-panel');
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
  error.textContent='Connecting to the Fayez Among Us server…';
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
  if(reply.ok&&reply.deck===deckRevision){notice(wasReady?'Connection restored.':'');wasReady=true;}
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
    phase=s.phase;uiKey='';selectedVote=null;submittedVote=null;votePending=false;meetingTab='ballot';chatSeen=0;closeModal(false);clearMovement();notice('');
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
  if(cancel&&modal?.kind==='cameras')void command('cameraOff');
  if(cancel&&modal?.kind==='task')void command('taskClose');
  const mapWasOpen=modal?.kind==='map';
  modal=null;layer.replaceChildren();touch.clear();
  if(mapWasOpen){
    const button=document.getElementById('map-open');
    if(button)button.hidden=false;
  }
}
function panel(kind,title,body,options={}){
  modal={kind,...options};modalShell('MERIDIAN',title,body,options.className||'');
}
function chatForm() {
  return '<div class="messages" id="messages" aria-live="polite"></div><form id="chat-form" class="chat-form"><input name="text" maxlength="180" placeholder="Send a message" aria-label="Chat message" autocomplete="off" required><button class="primary">Send</button></form>';
}
function hud(){
  const s=state, me=s.self, inLobby=s.phase==='lobby', captain=s.host===me.id;
  const roleText=roleName(me).toUpperCase();
  screen.innerHTML=`<main class="hud ${inLobby?'dropship-hud':''}">${inLobby?`
    <aside class="lobby-summary"><h2>Game Settings</h2><div id="lobby-settings"></div>${captain?btn(actionIcon('settings')+' Settings','settings','outline'):''}</aside>
    <aside class="lobby-roster"><h2>On board</h2><div class="side-info" id="side-info"></div></aside>
    <div class="lobby-actions actions">${btn(actionIcon('quit')+' Quit','leave','quiet')}</div>
    <div class="boarding">
      ${captain?btn(actionIcon('start')+' START','start','start-launch','id="start-flight"'):''}
      <p class="launch-hint" id="launch-hint"></p>
      <div class="boarding-code">
        <button type="button" class="room-code" data-do="copy" title="Copy room code"><small>ROOM CODE</small><strong id="room-code"></strong></button>
        <button type="button" data-do="copy" class="outline copy-code">COPY CODE</button>
        <div class="count"><small>PLAYER COUNT</small><strong id="crew-count"></strong></div>
      </div>
    </div>`:`<aside class="deck-brief"><div class="flight-data"><div class="bar"><small>CREW TASKS <span id="task-count"></span></small><progress max="1" value="0" id="task-progress"></progress></div></div><div id="side-info"></div></aside><div class="flight-tools">${mapButton('map-open')}${btn(actionIcon('settings'),'flight-settings','flight-options','aria-label="Settings" title="Settings"')}</div><div class="location"><span id="current-room"></span></div><div class="role-label">${roleText}</div>`}
    <div class="alert" id="emergency" hidden></div>
  <footer class="controls"><div class="controls-hint"><span>WASD / ↑↓←→</span> Move <span>SPACE</span> Use</div>${inLobby?'':`<div class="actions">${me.team==='impostor'&&me.alive?btn(actionIcon('kill')+' <span id="strike-label">Kill</span>','strike','danger','id="strike-action"'):''}${me.team==='impostor'?btn(actionIcon('sabotage')+' Sabotage','sabotage','danger'):''}${me.alive&&(me.team==='impostor'||me.role==='engineer')?btn(actionIcon('vent')+' Vent [V]','use-hatch','outline','id="vent-action" hidden'):''}${me.role||me.ghost?btn('Ability','ability'):''}</div>`}</footer><div class="touch" aria-label="Movement controls">${[['up','↑'],['left','←'],['down','↓'],['right','→']].map(([d,label])=>`<button type="button" data-move="${d}" aria-label="Move ${d}">${label}</button>`).join('')}</div><div class="prompt" id="prompt"></div></main>`;
}
function canUseHatch(s,p){
  return p.alive&&(Number.isInteger(p.ventIndex)||now()>=(p.ventAt||0)&&
    (p.team==='impostor'||p.role==='engineer'&&(p.effect==='engineer'||now()>=p.abilityAt))&&
    vents.some(v=>dist(p,v)<48&&clearDeckLine(p,v,s.doors)));
}
function contextAction(p=state.self){
  const s=state;
  if(s.phase==='lobby')return dist(p,terminal)<76?{label:'Customize',kind:'suit'}:null;
  if(s.phase!=='play')return null;
  if(Number.isInteger(p.ventIndex))return {label:'Vent Controls',kind:'vent'};
  const line=point=>!p.alive||clearDeckLine(p,point,s.doors);
  const b=p.alive&&nearest(s.bodies.filter(line),p,70);
  if(b)return {label:'Report',kind:'report',data:{id:b.id}};
  if(s.sabotage?.nearby.length)return {label:'Repair '+s.sabotage.kind,kind:'repair'};
  const collection=p.alive&&p.role==='vulture'&&now()>=p.abilityAt&&nearest((s.tactical.remains||[]).filter(line),p,remainsRange);
  if(collection)return {label:'Collect remains',kind:'collect',data:{id:collection.id}};
  const security=p.alive&&dist(p,securityConsole)<securityRange&&line(securityConsole)&&s.sabotage?.kind!=='comms';
  if(security&&dist(p,securityConsole)<22)return {label:'Security Cameras',kind:'monitor',data:'security'};
  const available=p.assignments.filter(a=>!a.done).map(a=>{
    const task=tasks.find(t=>t.id===a.id);
    return {...task.stops[a.stage],id:a.id,label:taskStageName(task,a.stage)};
  });
  const a=nearest(available.filter(q=>dist(p,q)<taskRange(q.id,q)&&line(q)),p,57);
  if(a&&s.sabotage?.kind!=='comms')return {label:a.label,kind:'task',data:a.id};
  if(canUseHatch(s,p))return {label:'Vent',kind:'vent'};
  if(p.alive&&dist(p,meetingPoint)<emergencyRange&&line(meetingPoint)&&p.emergencies>0&&!s.sabotage&&now()>p.meetingAt)return {label:'Emergency Meeting',kind:'emergency'};
  if(p.alive&&dist(p,deck.admin)<85&&line(deck.admin)&&s.sabotage?.kind!=='comms')return {label:'Admin Map',kind:'monitor',data:'command'};
  if(security)return {label:'Security Cameras',kind:'monitor',data:'security'};
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
    const count=s.roster.filter(q=>q.online).length, settings=s.settings;
    document.querySelector('#room-code').textContent=s.code;document.querySelector('#crew-count').textContent=count+'/10';
    const start=document.querySelector('#start-flight');
    if(start){
      const minimum=requiredPlayers(settings.impostors);
      start.disabled=count<minimum;
      document.querySelector('#launch-hint').textContent=count<minimum?`Waiting for at least ${minimum} players`:'';
    }
    markup('lobby-settings',`<dl><div><dt>Map</dt><dd>Meridian</dd></div><div><dt>Impostors</dt><dd>${settings.impostors}</dd></div><div><dt>Discussion</dt><dd>${settings.discussion}s</dd></div><div><dt>Voting</dt><dd>${settings.voting}s</dd></div><div><dt>Tasks per player</dt><dd>${taskTotal(settings)}</dd></div><div><dt>Common / Long / Short</dt><dd>${settings.commonTasks} / ${settings.longTasks} / ${settings.shortTasks}</dd></div></dl>`);
    markup('side-info',s.roster.map(q=>`<div>${tag(q.color)}${escape(q.name)}${q.id===s.host?' <span>HOST</span>':''}${!q.online?' <span>OFFLINE</span>':''}</div>`).join(''));
    markup('prompt',promptButton(contextAction(motion.position()||p)));
  }
  if(s.phase==='countdown')document.querySelector('#countdown-number').textContent=Math.max(1,Math.ceil((s.until-now())/1000));
  if(s.phase==='play'){
    const progress=document.querySelector('#task-progress');
    progress.closest('.flight-data').hidden=!s.progress;
    if(s.progress){
      progress.value=s.progress.total?s.progress.done/s.progress.total:0;
      document.querySelector('#task-count').textContent=s.progress.done+' / '+s.progress.total;
    }
    const current=rooms.find(r=>contains(r,p.x,p.y))?.name||'Transit';
    const stationList=s.sabotage?.kind==='comms'?'<li>Communications offline</li>':
      p.assignments.filter(a=>!a.done).slice(0,4).map(a=>{
        const task=tasks.find(t=>t.id===a.id),stop=task.stops[a.stage];
        return '<li><span>'+escape(taskStageName(task,a.stage))+'</span><small>'+escape(stop.name||deck[stop.room].name)+(task.stops.length>1?' · '+(a.stage+1)+'/'+task.stops.length:'')+'</small></li>';
      }).join('')||'<li>Assignments complete</li>';
    document.querySelector('#current-room').textContent=current;
    const privateObjective=p.role==='vulture'?`<small>${collectionText(p)}${p.alive&&now()<p.abilityAt?' · Ready in '+clock(p.abilityAt,now())+'s':''}</small>`:'<small>Get voted out during a meeting</small>';
    markup('side-info',p.team==='neutral'?`<div class="task-brief neutral-objective">${privateObjective}</div>`:`<div class="task-brief">${btn(p.team==='impostor'?'Fake Tasks':'Tasks','tasks','quiet')}<ul>${stationList}</ul></div>`);
    const ventButton=document.getElementById('vent-action');
    if(ventButton)ventButton.hidden=!canUseHatch(s,p);
    const strike=document.getElementById('strike-action');
    if(strike){
      const cooling=now()<p.killAt;
      strike.disabled=cooling||p.ventIndex!==null||!killTarget(s,p);
      strike.querySelector('#strike-label').textContent=cooling?'Kill · '+clock(p.killAt,now())+'s':'Kill [Q]';
    }
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
    refreshSabotage();
  }
  if(modal?.kind==='map')drawMap(layer.querySelector('canvas'),s);
  if(modal?.kind==='task'){
    if(s.puzzle?.id!==modal.id&&!modal.pending&&now()-modal.openedAt>300)closeModal(false);
    else if(s.puzzle)modal.task.update(s.puzzle,now());
  }
  if(modal?.kind==='cameras'){
    if(s.sabotage?.kind==='comms'){closeModal(false);notice('Communications cut the camera feeds.');}
    else if(s.tactical.cameras)drawSecurityFeeds(layer.querySelectorAll('.camera-feed canvas'),s);
    else if(now()-modal.openedAt>500)closeModal(false);
  }
  if(modal?.kind==='vent'){
    if(!Number.isInteger(p.ventIndex)&&now()-modal.openedAt>500)closeModal(false);
    else{
      const wait=Math.max(0,(p.ventAt||0)-now());
      const timer=p.team==='crew'?clock(p.effectUntil,now()):null;
      layer.querySelector('#hatch-status').textContent=(timer!==null?'Engineer air reserve · '+timer+'s':'Inside a vent')+(wait?' · Vent cooldown':'');
      for(const b of layer.querySelectorAll('[data-do=vent]'))b.disabled=Boolean(wait);
      drawMap(layer.querySelector('canvas'),s,false,modal.index);
    }
  }
  if(modal?.kind==='repair')refreshRepair();
  if(modal?.kind==='suit')for(const b of layer.querySelectorAll('[data-color]')){b.disabled=s.roster.some(q=>q.id!==p.id&&q.color===b.dataset.color);b.classList.toggle('active',p.color===b.dataset.color);b.setAttribute('aria-pressed',String(p.color===b.dataset.color));}
}
function cinemaSuit(canvas,p){
  const ctx=canvas.getContext('2d');
  astronaut(ctx,{...p,x:canvas.width/2,y:canvas.height*.68,facing:1},0,2.5);
}
function cinematic(){
  const s=state,p=s.self;
  if(s.phase==='countdown'){
    screen.innerHTML=`<main class="launch-countdown"><div>PRIVATE MATCH</div><h1 id="countdown-number"></h1><p>Launching</p></main>`;
  }else if(s.phase==='reveal'){
    const role=p.role&&special[p.role];
    const description=role?.description||(p.team==='impostor'?'Blend in, sabotage the ship, and eliminate the other players.':'Complete your tasks and vote out the Impostors.');
    screen.innerHTML=`<main class="cinema reveal ${p.team==='impostor'?'red':p.team==='neutral'?'neutral':''}"><div class="eyebrow">${p.team==='neutral'?'NEUTRAL OBJECTIVE':'PRIVATE ROLE'} · MATCH ${s.round}</div><canvas class="role-portrait" width="220" height="145"></canvas><h1>${escape(roleName(p))}</h1><p>${escape(description)}</p>${p.objective?'<p class="muted">Goal · '+p.objective.goal+' reported '+(p.objective.goal===1?'site':'sites')+'</p>':''}${p.allies.length>1?'<p class="muted">Allies · '+s.roster.filter(q=>q.id!==p.id&&p.allies.includes(q.id)).map(q=>escape(q.name)).join(', ')+'</p>':''}</main>`;
    cinemaSuit(screen.querySelector('canvas'),p);
  }else if(s.phase==='meeting'){
    const m=s.meeting, caller=s.roster.find(q=>q.id===m.caller);
    const report=m.kind==='report';
    const byline=(report?'Reported by ':'Called by ')+ (caller?.name||'Crewmate');
    if(s.now<m.introUntil){
      const title=report?'Body Reported':'Emergency Meeting';
      const illustration=report?
        `<div class="incident-beacon"><span aria-hidden="true">!</span>${portrait(m.incident?.color||caller?.color,0,false)}</div>`:
        '<div class="intercom-switch"><i></i><b></b></div>';
      screen.innerHTML=`<main class="assembly-intro ${report?'report-intro':'emergency-intro'}" style="--elapsed:-${Math.max(0,s.now-m.start)}ms;--sleeve:${colors[caller?.color]||colors.red}">
      <div class="assembly-motion"></div><div class="announcement"><span>MERIDIAN ALERT</span><h1>${title}</h1><p>${escape(byline)}</p></div>
      <div class="assembly-illustration">${portrait(caller?.color,caller?.hat,true)}${illustration}</div><div class="assembly-stripes"></div></main>`;
    }else{
      screen.innerHTML=`<main class="meeting tablet-meeting"><div class="tablet-frame"><div class="tablet-screen">
      <header><div class="meeting-heading"><h1>Emergency Meeting</h1>
      <div class="meeting-tabs" aria-label="Meeting views">
        ${btn('Voting','meeting-tab','outline','data-id="ballot" id="meeting-ballot-button" aria-controls="meeting-ballot"')}
        ${btn(glyph('radio')+' Chat <span id="unread-chat" hidden></span>','meeting-tab','outline','data-id="chat" id="meeting-chat-button" aria-controls="meeting-chat"')}</div></div>
      <p class="meeting-caller">${escape(byline)}</p><p id="meeting-time"></p><progress id="meeting-task-progress" aria-label="Crew task progress" max="1" hidden></progress></header>
      <div class="meeting-views"><section id="meeting-ballot"><div id="ballot" class="ballot-grid"></div><div id="ballot-controls"></div></section>
      <section id="meeting-chat" class="tablet-comms" hidden><h2>Meeting chat</h2>${chatForm()}</section></div></div></div></main>`;
    }
  }else if(s.phase==='verdict'){
    const v=s.meeting.result;
    screen.innerHTML=`<main class="cinema verdict ${v.target?'red':''}"><div class="eyebrow">VOTING RESULTS</div>${v.target?'<canvas class="eject" width="220" height="145"></canvas>':'<div class="airlock-icon">◈</div>'}<h1>${v.target?escape(v.target.name)+' ejected':v.tie?'Vote tied':v.counts.skip?'Skipped vote':'No votes submitted'}</h1>${v.override?'<p>Judge override</p>':''}<p>${v.target?v.role?`${escape(v.target.name)} was ${v.role==='neutral'?'Neutral':v.role==='impostor'?'an Impostor':'a Crewmate'}.`:'Ejection confirmation is off.':'Nobody was ejected.'}</p><div class="verdict-votes">${Object.entries(v.counts).map(([id,n])=>`<span>${id==='skip'?'Skip':escape(s.roster.find(p=>p.id===id)?.name)} · ${n}</span>`).join('')}</div>${v.votes?`<div class="verdict-votes">${v.votes.map(([from,to])=>`<span>${escape(s.roster.find(q=>q.id===from)?.name)} voted ${to==='skip'?'Skip':escape(s.roster.find(q=>q.id===to)?.name)}</span>`).join('')}</div>`:''}</main>`;
    if(v.target)cinemaSuit(screen.querySelector('canvas'),{...v.target,alive:true});
  }else if(s.phase==='result'){
    const v=s.outcome;
    const heading=v.winner?`${special[v.winner.role].name} Wins`:`${v.team==='impostor'?'Impostors':'Crewmates'} Win`;
    screen.innerHTML=`<main class="cinema result ${v.team==='impostor'?'red':v.winner?'neutral':''}"><div class="eyebrow">MATCH ${s.round} COMPLETE</div>${v.winner?'<canvas class="role-portrait" width="220" height="145"></canvas>':'<div class="airlock-icon">✦</div>'}<h1>${heading}</h1><p>${escape(v.reason)}</p><div class="result-roster">${v.crew.map(q=>`<span>${portrait(q.color,q.hat,true)}${escape(q.name)}<small>${escape(special[q.ghost]?.name||special[q.role]?.name||teamName[q.team])}</small></span>`).join('')}</div><div class="actions">${s.host===p.id?btn(actionIcon('again')+' Play Again','reset','primary'):'<span class="muted">Waiting for the host to start another match.</span>'}${btn(actionIcon('quit')+' Quit','leave','quiet')}</div></main>`;
    if(v.winner)cinemaSuit(screen.querySelector('canvas'),{...v.winner,alive:true});
  }
}
function refreshMeeting(){
  const bar=document.querySelector('#meeting-task-progress');
  if(bar&&state.progress){
    bar.hidden=false;
    bar.value=state.progress.total?state.progress.done/state.progress.total:0;
  }
  const s=state,m=s.meeting,p=s.self,discuss=s.now<m.voteAt;
  document.querySelector('#meeting-time').textContent=(discuss?'DISCUSSION: '+clock(m.voteAt,now()):'VOTING ENDS IN: '+clock(m.end,now()))+' SECONDS';
  const ballot=m.myVote||submittedVote;
  const can=!discuss&&s.now<m.end&&p.alive&&!ballot&&!votePending;
  const eligible=s.roster.filter(q=>q.alive&&q.online);
  if(selectedVote!==null&&selectedVote!=='skip'&&!eligible.some(q=>q.id===selectedVote))selectedVote=null;
  const rows=s.roster.map(q=>`<div class="ballot-row ${q.alive?'':'dead'} ${selectedVote===q.id?'picked':''}">
    <span class="ballot-player">${portrait(q.color,q.hat,q.alive)} <b>${escape(q.name)}</b>
    ${q.id===m.caller&&m.kind==='report'?'<span class="reporter" role="img" aria-label="Body reporter" title="Body reporter">📣</span>':''}
    ${q.alive?(q.online?'':'<small>OFFLINE</small>'):'<small>GHOST</small>'}</span>
    ${m.voted?.includes(q.id)?'<small class="voted-stamp">VOTED</small>':''}
    ${q.alive&&q.online&&can?btn('Vote','pick-vote','','data-id="'+q.id+'"'):''}
    ${!discuss&&s.now<m.end&&q.alive&&q.online&&q.id!==p.id&&p.alive&&p.role==='judge'&&!p.used&&p.assignments.some(a=>a.done)?btn('Override','judge','danger','data-id="'+q.id+'"'):''}
    ${q.id!==p.id?btn(muted.has(q.id)?'Unmute':'Mute','mute','quiet','data-id="'+q.id+'"'):''}</div>`).join('');
  markup('ballot',rows);
  const selected=selectedVote==='skip'?'Skip Vote':s.roster.find(q=>q.id===selectedVote)?.name;
  markup('ballot-controls',`<div class="ballot-actions">${can?btn('Skip Vote','pick-vote','outline','data-id="skip"'):''}
    ${can&&selected?`<span>Vote for <strong>${escape(selected)}</strong>?</span>${btn('Confirm vote','vote','primary')}${btn('Cancel','cancel-vote','quiet')}`:''}
    ${ballot?'<span class="ballot-saved">Vote submitted</span>':''}
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
  const msg=messages.map(q=>`<p>${tag(q.color)} <b>${escape(q.name)}${q.ghost?' · Ghost':''}</b> ${escape(q.text)}</p>`).join('')||'<p class="muted">No messages yet.</p>';
  if(box.dataset.content===msg)return;
  const bottom=box.scrollTop+box.clientHeight>box.scrollHeight-42;
  box.innerHTML=msg;box.dataset.content=msg;if(bottom)box.scrollTop=box.scrollHeight;
}
const taskTotal=cfg=>cfg.commonTasks+cfg.longTasks+cfg.shortTasks;
const selectSetting=(key,label,choices,value,description='')=>`<div class="setting-choice"><label>${label}<select name="${key}" aria-label="${label}" ${description?`aria-describedby="setting-${key}"`:''}>${choices.map(([val,name])=>`<option value="${val}" ${val===value?'selected':''}>${name}</option>`).join('')}</select></label>${description?`<small id="setting-${key}">${description}</small>`:''}</div>`;
function settingsPanel(){
  const cfg=state.settings;
  const setting=key=>{
    const [label,,options,description]=gameNumbers[key];
    return selectSetting(key,label,options,cfg[key],description);
  };
  const toggle=key=>{
    const [label,,description]=gameChecks[key];
    return selectSetting(key,label,[[true,'On'],[false,'Off']],cfg[key],description);
  };
  const roleGroup=(...teams)=>Object.entries(special).filter(([,role])=>teams.includes(role.team)).map(([id,role])=>{
    const inputs=['max','chance',...roleFields(id)].map(key=>selectSetting(id+':'+key,roleNumbers[key][0],roleChoices(id,key),cfg.roles[id][key],roleNumbers[key][2])).join('');
    return `<details><summary>${role.name}${role.team==='ghost'?' <small>Ghost role</small>':''}</summary><p>${role.description}</p><label><input type="checkbox" name="${id}:enabled" ${cfg.roles[id].enabled?'checked':''}> Enabled</label><div class="settings-grid">${inputs}</div></details>`;
  }).join('');
  const sections=[
    ['General', ['impostors','speed','crewVision','impostorVision','killCooldown','killDistance'].map(setting).join('')],
    ['Tasks',['commonTasks','longTasks','shortTasks'].map(setting).join('')+toggle('visualTasks')+selectSetting('taskBar','Task Bar Updates',Object.entries(taskBars),cfg.taskBar,'When the shared Crewmate progress meter is visible.')],
    ['Meetings',['emergencies','meetingCooldown','discussion','voting'].map(setting).join('')+['anonymous','confirm','early'].map(toggle).join('')],
    ['Crewmates',roleGroup('crew','ghost')],['Impostors',roleGroup('impostor')],['Neutrals',roleGroup('neutral')]
  ];
  const tabs=sections.map(([label],i)=>btn(label,'settings-section','outline',`data-id="${i}" aria-controls="settings-section-${i}" aria-pressed="${i===0}"`)).join('');
  const groups=sections.map(([label,content],i)=>`<section id="settings-section-${i}" class="settings-section" ${i?'hidden':''}><h3>${label}</h3>${i===5?'<p class="muted">Mod-inspired roles. Up to two neutral seats, depending on lobby size. Vulture goals are limited by starting player count.</p>':''}<div class="${i<3?'settings-grid':'roles-grid'}">${content}</div></section>`).join('');
  panel('settings','Game Settings',`<form id="settings-form"><div class="settings-save"><div class="settings-tabs" aria-label="Settings categories">${tabs}</div><div class="settings-commands"><button class="primary" type="submit">Save Settings</button>${btn('Reset to Recommended','settings-defaults','quiet')}<span id="settings-feedback" class="feedback" role="status"></span></div></div>${groups}</form>`,{className:'wide settings-panel'});
}
function resetSettings(form){
  const defaults=gameDefaults(),roles=defaultRoles();
  for(const [key,value] of Object.entries(defaults))form.elements[key].value=String(value);
  for(const [id,fields] of Object.entries(roles))for(const [field,value] of Object.entries(fields)){
    const input=form.elements[id+':'+field];
    if(field==='enabled')input.checked=value;
    else input.value=String(value);
  }
  form.querySelector('#settings-feedback').textContent='Recommended settings loaded. Save to apply.';
}
function suitPanel(){
  const p=state.self;
  panel('suit','Customize',`<div class="gear-preview"><canvas width="220" height="145" aria-label="Selected suit preview"></canvas><div class="gear-controls"><label>Equipment<select id="hat">${hats.map((h,i)=>`<option value="${i}" ${i===p.hat?'selected':''}>${h}</option>`).join('')}</select></label><label><input id="show-name" type="checkbox" ${p.showName?'checked':''}> Display nickname above suit</label></div></div>
    <div class="swatches suit-palette" aria-label="Suit colors">${suitPalette.map(([id,name])=>btn(`${portrait(id,0,true)}<span>${name}</span>`,'color','color-button','data-color="'+id+'" aria-label="'+name+'" title="'+name+'"')).join('')}</div>`,{className:'suit-panel'});
  cinemaSuit(layer.querySelector('canvas'),p);update();
}
function missionList(){
  if(state.sabotage?.kind==='comms'){panel('tasks','Assignments offline','<p>Restore comms to recover task list.</p>');return;}
  const p=state.self, cover=p.team==='impostor';
  const done=p.assignments.filter(a=>a.done).length;
  const summary=p.assignments.length?`${done} / ${p.assignments.length} ${cover?'cover assignments':'personal tasks'} complete`:'No tasks assigned';
  panel('tasks',cover?'Fake Tasks':'Assigned maintenance',`<p class="task-summary">${summary}</p><ul class="mission-list">${p.assignments.map(a=>{const task=tasks.find(v=>v.id===a.id);return '<li class="'+(a.done?'done':'')+'"><b>'+escape(a.done?task.label:taskStageName(task,a.stage))+'</b><span>'+(a.done?'Complete':(task.stops[a.stage].name||deck[task.stops[a.stage].room].name)+' • '+task.kind+(task.stops.length>1?' '+(a.stage+1)+'/'+task.stops.length:'')+(task.instrument==='route'&&a.stage===0?' → '+deck[task.stops[1].room].name:''))+'</span></li>';}).join('')}</ul>`);
}
const alarmNames={reactor:'Reactor meltdown',oxygen:'Oxygen depletion',lights:'Lighting failure',comms:'Communications failure'};
function repairPanel(){
  const s=state.sabotage, station=s?.nearby[0];
  if(!station)return;
  const body={
    lights:()=>'<div class="repair-chassis"><p>Bring all five circuits online.</p><div class="switches">'+s.pattern.map((on,i)=>btn(on?'ON':'OFF','switch',on?'active':'','data-switch="'+i+'" aria-label="Circuit '+(i+1)+'"')).join('')+'</div></div>',
    oxygen:()=>`<form id="repair-form" class="repair-chassis"><p>Enter the pressure controller code at this panel.</p><div class="digits">${station.code}</div><label>Pressure code<input name="reading" inputmode="numeric" pattern="[0-9]{5}" minlength="5" maxlength="5" autocomplete="off" required></label><button class="primary">Restore pressure</button></form>`,
    reactor:()=>'<div class="repair-chassis"><p>Link both relay pads within five seconds. In a group match, one player operates each pad.</p>'+btn('Press relay pad','relay-pad','primary reactor-pad')+'</div>',
    comms:()=>'<form id="repair-form" class="repair-chassis"><p>Match the receiver trace to the reference.</p><div class="signal-display" aria-hidden="true"><svg viewBox="0 0 300 85" preserveAspectRatio="none"><path id="signal-reference"/><path id="signal-reading"/></svg></div><label>Receiver frequency<input id="receiver-frequency" name="reading" type="range" min="0" max="100" value="50"></label><output id="signal-match" for="receiver-frequency"></output><button class="primary">Lock frequency</button></form>'
  }[s.kind]();
  panel('repair',s.kind[0].toUpperCase()+s.kind.slice(1)+' Repair','<p id="repair-status" role="status"></p>'+body,{station:station.index,className:'repair-console'});
  if(s.kind==='comms'){
    const form=layer.querySelector('form'),input=form.elements.reading;
    const trace=frequency=>Array.from({length:91},(_,i)=>(i?'L':'M')+(i*10/3)+' '+(42+Math.sin(i*frequency/290)*26)).join(' ');
    form.querySelector('#signal-reference').setAttribute('d',trace(station.dial));
    const draw=()=>{
      const value=Number(input.value),delta=value-station.dial;
      form.querySelector('#signal-reading').setAttribute('d',trace(value));
      form.querySelector('#signal-match').textContent=Math.abs(delta)<=3?'Signal aligned':delta<0?'Increase frequency':'Decrease frequency';
    };
    input.addEventListener('input',draw);
    draw();
  }
  refreshRepair();
}
function refreshRepair(){
  const s=state.sabotage;
  if(!s?.nearby.some(v=>v.index===modal.station)){closeModal(false);return;}
  const timer=s.until?' · '+clock(s.until,now())+'s left':'';
  const stations=repairs[s.kind].length>1?' · '+s.fixed.length+' / 2 stations linked':'';
  layer.querySelector('#repair-status').textContent=alarmNames[s.kind]+timer+stations;
  if(s.kind==='lights')for(const [i,b] of [...layer.querySelectorAll('[data-switch]')].entries()){
    b.classList.toggle('active',s.pattern[i]);b.textContent=s.pattern[i]?'ON':'OFF';b.setAttribute('aria-pressed',String(s.pattern[i]));
  }
  if(s.kind==='reactor')layer.querySelector('.reactor-pad').classList.toggle('active',s.fixed.some(v=>v.index===modal.station));
}
function refreshSabotage(){
  const {sabotage,doors:sealed,self:p}=state;
  const t=now(),door=Number(layer.querySelector('#door').value),ready=p.sabotageAt<=t&&!sealed.length&&!sabotage;
  layer.querySelector('#sabotage-status').textContent=sabotage?
    alarmNames[sabotage.kind]+(sabotage.until?' · '+clock(sabotage.until,t)+'s':''):
    sealed.length?'System disruptions wait for the shutters':ready?'System disruption ready':'Systems cooldown · '+clock(p.sabotageAt,t)+'s';
  for(const button of layer.querySelectorAll('[data-do=target-sabotage]')){
    const isDoor=button.dataset.id==='doors',until=p.doorReady?.[door]||0;
    button.disabled=isDoor?Boolean(sabotage||sealed.includes(door)||until>t):!ready;
    if(isDoor)button.querySelector('span').textContent=sealed.includes(door)?'Door Closed':until>t?'Door Cooldown · '+clock(until,t)+'s':'Close Door';
  }
}
function abilityPanel(){
  const s=state,p=s.self,id=p.alive?p.role:p.ghost,role=special[id];
  if(!role)return;
  const available=now()>=p.abilityAt&&(id!=='scientist'||p.battery), target=(['angel','influencer','shapeshifter'].includes(id)?s.roster:s.positions).filter(q=>q.id!==p.id&&q.alive!==false);
  let body='<p>'+escape(role.description)+'</p>';
  if(id==='vulture')body+='<p>'+collectionText(p)+'. Check the purple markers on your map.</p>';
  if(id==='scientist')body+='<ul class="mission-list" id="vitals"></ul>';
  if(id==='detective'&&s.tactical.notes)body+='<ul>'+s.tactical.notes.map(q=>'<li>'+escape(q.text)+'</li>').join('')+'</ul>';
  if(id==='tracker'&&s.tactical.track)body+='<p>Tracking '+escape(s.tactical.track.name)+'. Check the deck map.</p>';
  if(id==='judge')body+='<p>Complete an assignment to unlock the override. Use it from the voting panel.</p>';
  if(p.effectUntil>now())body+='<p class="cooldown">Effect active · <span id="effect-time">'+clock(p.effectUntil,now())+'</span>s</p>';
  if(now()<p.abilityAt)body+='<p class="cooldown">Ready in <span id="ability-time">'+clock(p.abilityAt,now())+'</span>s</p>';
  if(id==='scientist'&&!p.battery)body+='<p>Complete an assignment to recharge the vitals battery.</p>';
  if(available&&['engineer','scientist','phantom'].includes(id))body+=btn((id==='scientist'?actionIcon('vitals')+' ':id==='engineer'?actionIcon('vent')+' ':'')+role.ability,'activate','primary');
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
    else {const res=await command('vent',{action:'enter'});if(res.ok)showHatch(res.index);}
    return;
  }
  if(action.kind==='monitor'){
    const res=await command('monitor',{kind:action.data});
    if(res.security){
      panel('cameras','Security Cameras','<div class="security-grid">'+cameraSites.map((site,i)=>
        `<figure class="camera-feed"><figcaption><span>0${i+1} · ${site.name}</span><small>LIVE</small></figcaption><canvas width="286" height="174" aria-label="${site.name}"></canvas></figure>`
      ).join('')+'</div>'+btn('Exit Cameras','camera-exit','outline'),{openedAt:now(),className:'security-console'});
      if(state.tactical.cameras)drawSecurityFeeds(layer.querySelectorAll('canvas'),state);
    }else if(res.ok)panel('monitor','Admin Map','<ul class="mission-list">'+res.readings.map(([k,v])=>'<li><b>'+escape(k)+'</b><span>'+escape(v)+'</span></li>').join('')+'</ul>'+btn('Refresh','interact'));
    return;
  }
  const reply=await command(action.kind,action.data);
  if(reply.ok&&action.kind==='collect'&&reply.done<reply.goal)notice(`${reply.done} / ${reply.goal} reported sites collected.`);
}
const hatchName=index=>vents[index].name||deck[vents[index].room].name;
function showHatch(at){
  panel('vent','Vent Network',`<h3>${hatchName(at)}</h3><p id="hatch-status" role="status">Vent cooldown</p>${deckCanvas(550,'map hatch-map')}<div class="targets">${ventDestinations(at).map(i=>btn(hatchName(i),'vent','outline','data-id="'+i+'" disabled')).join('')}${btn('Exit Vent','exit-vent','primary')}</div>`,
    {index:at,openedAt:now(),className:'hatch-console'});
  drawMap(layer.querySelector('canvas'),state,false,at);
}
function showMap(held=false){
  panel('map','Map',deckCanvas(980)+'<div class="map-legend"><span>● Your position</span><span>● Tasks</span><span>● Sabotage repairs</span></div>',{held,className:'map-panel blue-map'});
  document.getElementById('map-open').hidden=true;
  layer.firstElementChild.insertAdjacentHTML('beforeend',mapButton('map-close'));
  drawMap(layer.querySelector('canvas'),state);
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
  if(action==='settings'&&s.phase==='lobby'&&s.host===p.id)settingsPanel();
  if(action==='settings-section'){
    const form=b.form;
    for(const section of form.querySelectorAll('.settings-section'))section.hidden=section.id!=='settings-section-'+id;
    for(const tab of form.querySelectorAll('[data-do=settings-section]'))tab.setAttribute('aria-pressed',String(tab===b));
    form.closest('.panel').scrollTop=0;
  }
  if(action==='settings-defaults')resetSettings(b.form);
  if(action==='flight-settings'){
    const soundOn=localStorage.getItem('fayez-sound')!=='off';
    panel('flight-settings','Game Settings',`<p>Move with WASD or the arrow keys. Use Space to interact. Hold Tab to peek at the map or press M to toggle it.</p>
      <label class="sound-setting"><input type="checkbox" id="flight-sound" ${soundOn?'checked':''}> Game sounds</label>
      ${btn(actionIcon('quit')+' Quit','leave','danger')}`);
  }
  if(action==='meeting-tab'&&s.phase==='meeting'){
    meetingTab=id;refreshChat();
    if(id==='chat')document.querySelector('#chat-form input').focus();
  }
  if(action==='tasks')missionList();
  if(action==='ability')abilityPanel();
  if(action==='map'&&s.phase==='play'){
    if(modal?.kind==='map'){closeModal(false);return;}
    showMap();
  }
  if(action==='sabotage'&&s.phase==='play'&&p.team==='impostor'){
    panel('sabotage','Sabotage controls',`${deckCanvas(900,'map sabotage-map')}<p id="sabotage-status" role="status"></p><div class="targets sabotage-targets">${Object.keys(repairs).map(k=>btn(actionIcon(k)+' '+k.toUpperCase(),'target-sabotage','danger','data-id="'+k+'"')).join('')}</div><label>Doors<select id="door">${doors.map(d=>'<option value="'+d.id+'">'+escape(d.label)+'</option>').join('')}</select></label>${btn(actionIcon('doors')+' <span>Close Door</span>','target-sabotage','outline','data-id="doors"')}`,{className:'map-panel sabotage-console'});
    const canvas=layer.querySelector('canvas');
    drawMap(canvas,state,true);
    refreshSabotage();
    canvas.addEventListener('click',event=>{
      const rect=canvas.getBoundingClientRect();
      const point={x:(event.clientX-rect.left)*deckBounds.width/rect.width,y:(event.clientY-rect.top)*deckBounds.height/rect.height};
      const system=Object.keys(repairs).find(kind=>repairs[kind].some(site=>dist(site,point)<26));
      if(system){layer.querySelector(`[data-id="${system}"]`).click();return;}
      const door=nearest(doors,point,26);
      if(door){layer.querySelector('#door').value=door.id;refreshSabotage();}
    });
  }
  if(action==='target-sabotage'&&(await command('sabotage',{kind:id,door:Number(document.querySelector('#door').value)})).ok)closeModal(false);
  if(action==='interact')await interact();
  if(action==='start'||action==='reset')await command(action);
  if(action==='pick-vote'){selectedVote=id;refreshMeeting();}
  if(action==='cancel-vote'){selectedVote=null;refreshMeeting();}
  if(action==='vote'&&selectedVote&&!votePending&&!submittedVote&&s.phase==='meeting'){
    const target=selectedVote, meeting=s.meeting.start;
    votePending=true;refreshMeeting();
    const reply=await command('vote',{id:target});
    if(state?.phase!=='meeting'||state.meeting.start!==meeting)return;
    votePending=false;
    if(reply.ok){submittedVote=target;selectedVote=null;}
    refreshMeeting();
  }
  if(action==='judge')await command('ability',{target:id});
  if(action==='mute'){if(muted.has(id))muted.delete(id);else muted.add(id);update();}
  if(action==='activate'){
    const res=await command('ability',{target:id,signals:[...layer.querySelectorAll('input[name=signal]:checked')].map(v=>v.value)});
    if(res.ok){notice('Ability activated.');setTimeout(()=>{if(modal?.kind==='ability')abilityPanel();},115);}
  }
  if(action==='strike'){
    const q=killTarget(s,p);
    if(q)await command('strike',{target:q.id});else notice('There is no target in range.');
  }
  if(action==='refresh-signals'&&(await command('ability',{refresh:true})).ok)setTimeout(()=>{if(modal?.kind==='ability')abilityPanel();},115);
  if(action==='camera-exit')closeModal();
  if(action==='use-hatch'&&canUseHatch(s,p))await performInteraction({kind:'vent'});
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
  if(e.target.id==='door'&&modal?.kind==='sabotage')refreshSabotage();
  if(e.target.matches('#hat,#show-name'))void suitChange();
  if(e.target.matches('#flight-sound'))localStorage.setItem('fayez-sound',e.target.checked?'on':'off');
});
document.addEventListener('input',e=>{
  const form=e.target.form;
  if(form?.id==='settings-form'&&!form.querySelector('[type=submit]').disabled)form.querySelector('#settings-feedback').textContent='';
});
document.addEventListener('submit',async e=>{
  const form=e.target;
  if(!form.id)return;
  e.preventDefault();
  if(form.id==='entry-form'){await enter(form);return;}
  const data=new FormData(form);
  if(form.id==='settings-form'){
    const feedback=form.querySelector('#settings-feedback'), save=form.querySelector('[type=submit]');
    if(save.disabled)return;
    const cfg=Object.fromEntries(Object.keys(gameNumbers).map(k=>[k,Number(data.get(k))]));
    cfg.taskBar=data.get('taskBar');
    for(const key of Object.keys(gameChecks))cfg[key]=data.get(key)==='true';
    cfg.roles=Object.fromEntries(Object.keys(special).map(id=>[id,{enabled:data.has(id+':enabled'),...Object.fromEntries(['max','chance',...roleFields(id)].map(k=>[k,Number(data.get(id+':'+k))]))}]));
    save.disabled=true;feedback.textContent='Saving settings…';
    const reply=await command('settings',cfg);
    if(!form.isConnected)return;
    if(reply.ok){
      state.settings=reply.settings;update();closeModal(false);
      notice(`Settings saved · ${taskTotal(reply.settings)} tasks per player.`);
    }else{save.disabled=false;feedback.textContent=reply.error;}
  }
  if(form.id==='chat-form'){
    if((await command('chat',{text:data.get('text')})).ok)form.reset();
  }
  if(form.id==='repair-form'){
    const value=data.get('reading'),a=state.sabotage?.kind==='oxygen'?String(value):Number(value);
    if((await command('repair',{index:modal.station,a})).ok){closeModal(false);notice('Repair accepted.');}
  }
});
addEventListener('keydown',e=>{
  if(e.key==='Escape'&&modal){closeModal();return;}
  if(!state||e.target.closest?.('input,textarea,select,[contenteditable]')||e.ctrlKey||e.metaKey||e.altKey)return;
  const k=e.key.toLowerCase();
  if(k==='tab'&&state.phase==='play'&&!modal&&!e.shiftKey&&!e.target.closest?.('button,a')){
    e.preventDefault();if(!e.repeat)showMap(true);return;
  }
  if(k==='tab'&&modal?.kind==='map'&&modal.held){e.preventDefault();return;}
  if(directions[k]&&(!modal||modal.kind==='map')){held.add(k);e.preventDefault();if(!e.repeat)syncMovement();}
  if(k===' '&&!modal&&['play','lobby'].includes(state.phase)&&!e.target.closest?.('button')){
    e.preventDefault();if(!e.repeat)void interact();return;
  }
  if(e.repeat)return;
  if(!modal&&k==='r'&&state.phase==='play'){
    const body=nearest(state.bodies,state.self,70);
    if(body)void command('report',{id:body.id});
  }
  if(!modal&&k==='v'&&state.phase==='play'&&canUseHatch(state,state.self))void performInteraction({kind:'vent'});
  if(!modal&&k==='q'&&state.phase==='play'&&state.self.team==='impostor')void click({dataset:{do:'strike'}});
  if(k==='m'&&state.phase==='play'){if(modal?.kind==='map')closeModal();else if(!modal)void click({dataset:{do:'map'}});}
});
addEventListener('keyup',e=>{
  if(e.key==='Tab'&&modal?.kind==='map'&&modal.held)closeModal(false);
  if(held.delete(e.key.toLowerCase()))syncMovement();
});
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
