import {randomBytes,randomInt} from 'node:crypto';
import {colors,hats,rooms,deckRevision,deck,playerRadius,doors,vents,ventDestinations,tasks,taskRange,repairs,dist,walkable,clearDeckLine as hasLine,spawn,terminal,meetingPoint,emergencyRange,contains,cameraSites,securityConsole,securityRange} from '../shared/deck.js';
import {gameNumbers,gameChecks,taskBars,requiredPlayers} from '../shared/settings.js';
import {special,defaultRoles,signals} from '../shared/roles.js';
import {advanceMovement} from '../shared/movement.js';
import {puzzle,publicPuzzle,stepPuzzle,randomOrder} from './puzzles.js';

const fail = message => {throw new Error(message);};
const valid = (condition,message) => {if(!condition) fail(message);};
const cap = (x,min,max,fallback) => Number.isFinite(x)?Math.max(min,Math.min(max,Math.round(x))):fallback;
const systemsCooldown=18000,doorCooldown=30000,criticalDuration=40000,relayWindow=5200;
const settings = () => ({
  ...Object.fromEntries(Object.entries(gameNumbers).map(([key,[,,,value]])=>[key,value])),
  ...Object.fromEntries(Object.keys(gameChecks).map(key=>[key,true])),
  taskBar:'always',roles:defaultRoles()
});
const alphabet='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const point=(p)=>({x:Math.round(p.x),y:Math.round(p.y)});
const label=(p)=>({id:p.id,name:p.name,color:p.color,hat:p.hat,online:Boolean(p.socket)});
const roomName=(p)=>rooms.find(r=>contains(r,p.x,p.y))?.name||'Transit';
const active=(p)=>p?.alive&&!p.retired;
const canVote=p=>active(p)&&Boolean(p.socket);
const strikeCooldown=(r,p)=>(p.role==='viper'?r.settings.roles.viper.cooldown:r.settings.killCooldown)*1000;
const taskVariants=new Set(['wire','data','route','clean']);
const taskPools={common:new Map(),long:new Map(),short:new Map()};
for(const task of tasks){
  const pool=taskPools[task.kind],family=taskVariants.has(task.instrument)?task.instrument:task.id;
  if(!pool.has(family))pool.set(family,[]);
  pool.get(family).push(task);
}
export function attach(io,{now=Date.now,maxRooms=250,orderTasks=randomOrder}={}) {
  const drawTasks=(kind,count)=>orderTasks([...taskPools[kind].values()]).slice(0,count).map(variants=>variants[randomInt(variants.length)]);
  const roomsByCode=new Map();
  const bound=new Map();
  function reset(r) {
    Object.assign(r,{phase:'lobby',until:null,launchCrew:null,players:r.players.filter(p=>p.socket),meeting:null,outcome:null,bodies:[],doors:{},sabotage:null,alerts:[],chat:[],ghostSlots:[]});
    r.players.forEach((p,i)=>Object.assign(p,spawn(i,true),{alive:true,retired:false,team:null,role:null,ghost:null,assignments:[],opened:null,ventIndex:null,direction:'down',effect:null,shield:0,signal:null,notes:[],moving:false,input:{x:0,y:0}}));
    migrate(r);
  }
  function migrate(r) {
    if(!r.players.some(p=>p.id===r.host&&p.socket)) r.host=r.players.find(p=>p.socket)?.id||null;
  }
  function roomCode() {
    let code;
    do {code=Array.from({length:6},()=>alphabet[randomInt(alphabet.length)]).join('');}while(roomsByCode.has(code));
    return code;
  }
  function bind(socket,r,p) {
    p.socket=socket.id;p.disconnected=null;bound.set(socket.id,{r,p});
    p.moveSeq=p.appliedMoveSeq=null;
    return {code:r.code,id:p.id,token:p.token,deck:deckRevision};
  }
  function add(socket,r,name) {
    valid(!bound.has(socket.id),'Leave the current room first.');
    valid(r.phase==='lobby','This room has a match in progress.');
    valid(r.players.length<10,'The shuttle is full.');
    name=typeof name==='string'?Array.from(name.trim().replace(/[\p{Cc}\p{Cf}]/gu,'')).slice(0,18).join(''):'';
    valid(name.length>0,'Enter a nickname.');
    valid(!r.players.some(p=>p.name.toLowerCase()===name.toLowerCase()),'That nickname is in use.');
    const p={id:randomBytes(8).toString('hex'),token:randomBytes(24).toString('hex'),name,hat:0,showName:true,
      color:Object.keys(colors).find(c=>!r.players.some(p=>p.color===c)),...spawn(r.players.length,true),
      alive:true,ventIndex:null,facing:1,direction:'down',input:{x:0,y:0},moving:false,assignments:[]};
    r.players.push(p);
    const result=bind(socket,r,p);
    migrate(r);
    return result;
  }
  function updateSettings(r,req) {
    for(const [key,[,lo,hi]] of Object.entries(gameNumbers)) r.settings[key]=cap(req?.[key],lo,hi,r.settings[key]);
    for(const key of Object.keys(gameChecks)) if(typeof req?.[key]==='boolean')r.settings[key]=req[key];
    if(Object.hasOwn(taskBars,req?.taskBar))r.settings.taskBar=req.taskBar;
    for(const [key,value] of Object.entries(r.settings.roles)) {
      const role=req?.roles?.[key];
      if(!role)continue;
      if(typeof role.enabled==='boolean')value.enabled=role.enabled;
      value.max=cap(role.max,0,4,value.max);
      value.chance=cap(role.chance,0,100,value.chance);
      value.cooldown=cap(role.cooldown,0,100,value.cooldown);
      value.duration=cap(role.duration,key==='judge'?0:1,55,value.duration);
    }
  }
  function rollSlots(r,team) {
    return randomOrder(Object.keys(special).filter(id=>special[id].team===team).flatMap(id=>{
      const cfg=r.settings.roles[id];
      return cfg.enabled?Array.from({length:cfg.max},()=>id).filter(()=>randomInt(100)<cfg.chance):[];
    }));
  }
  function startCountdown(r,t) {
    const count=r.players.filter(p=>p.socket).length;
    const minimum=requiredPlayers(r.settings.impostors);
    valid(count>=minimum,`Invite at least ${minimum} connected players for these settings.`);
    Object.assign(r,{phase:'countdown',until:t+3000,launchCrew:r.players.filter(p=>p.socket).map(p=>p.id)});
    for(const p of r.players)p.input={x:0,y:0};
  }
  function start(r,t) {
    if(!r.launchCrew.every(id=>r.players.some(p=>p.id===id&&p.socket))){
      Object.assign(r,{phase:'lobby',until:null,launchCrew:null});
      return;
    }
    const n=r.settings.impostors;
    r.players=r.players.filter(p=>p.socket);
    Object.assign(r,{phase:'reveal',until:t+3400,round:(r.round||0)+1,meeting:null,bodies:[],doors:{},doorReady:{},hatchEffects:[],sabotage:null,alerts:[],taskEffects:{},chat:[],outcome:null,sabotageAt:t+10500,meetingAt:t+3400+r.settings.meetingCooldown*1000});
    const order=randomOrder(r.players), slots={impostor:rollSlots(r,'impostor'),crew:rollSlots(r,'crew')};
    r.ghostSlots=rollSlots(r,'ghost');
    const commons=drawTasks('common',r.settings.commonTasks);
    order.forEach((p,i)=>{
      const team=i<n?'impostor':'crew';
      // Practice exposes every station. Multiplayer continues to draw from the host's configured pools.
      const assignments=[...commons,...drawTasks('long',r.settings.longTasks),...drawTasks('short',r.settings.shortTasks)];
      const role=slots[team].shift()||null;
      Object.assign(p,spawn(i,false),{alive:true,retired:false,team,role,ghost:null,opened:null,
        abilityAt:t+3400,reported:false,emergencies:r.settings.emergencies,cameras:false,
        sampleLab:null,ventExitUntil:0,assignments:assignments.map(({id})=>({id,stage:0,done:false})),shield:0,effect:null,used:false,notes:[],seen:[],signal:null,signalHand:null,signalReroll:true,battery:true,trail:[],ventIndex:null,ventAt:0,roomStamp:null,input:{x:0,y:0}});
      p.killAt=t+3400+strikeCooldown(r,p);
    });
  }
  function progress(r) {
    const all=r.players.filter(p=>p.team==='crew'&&!p.retired).flatMap(p=>p.assignments);
    return {done:all.filter(a=>a.done).length,total:all.length};
  }
  function result(r,team,reason) {
    r.phase='result';r.outcome={team,reason,crew:r.players.map(p=>({...label(p),team:p.team,role:p.role,ghost:p.ghost}))};
    for(const p of r.players)p.opened=null;
  }
  function win(r) {
    if(r.phase!=='play')return;
    const live=r.players.filter(active), impostors=live.filter(p=>p.team==='impostor').length, crew=live.length-impostors;
    const completed=progress(r);
    if(!impostors)result(r,'crew','All infiltrators were removed.');
    else if(impostors>=crew)result(r,'impostor','The infiltrators reached parity.');
    else if(completed.total&&completed.done===completed.total)result(r,'crew','The crew restored every assigned system.');
  }
  function die(r,p,t,body) {
    p.alive=false;p.opened=null;p.cameras=false;p.effect=null;p.ventIndex=null;p.input={x:0,y:0};
    if(p.team==='crew'&&!p.retired){
      p.ghost=r.ghostSlots.shift()||null;
      if(p.ghost==='influencer')p.signalHand=randomOrder(signals).slice(0,5);
    }
    if(body)r.bodies.push({id:p.id,color:p.color,name:p.name,...point(p),expires:body===true?null:body,created:t,room:roomName(p)});
    if(body&&p.role==='noisemaker')r.alerts.push({text:'A distress beacon is broadcasting',...point(p),until:t+r.settings.roles.noisemaker.duration*1000});
  }
  function usable(r,p,id) {
    const a=p.assignments.find(v=>v.id===id&&!v.done);
    const stop=tasks.find(v=>v.id===id)?.stops[a?.stage];
    valid(r.phase==='play'&&p.ventIndex===null&&a&&stop&&dist(p,stop)<taskRange(id)&&(p.alive?hasLine(p,stop,Object.keys(r.doors).map(Number)):true)&&r.sabotage?.kind!=='comms','Move to the marked station. Repair comms if needed.');
    return a;
  }
  function assembly(r,p,t,kind,body) {
    r.phase='meeting';
    const introUntil=t+1800, voteAt=introUntil+r.settings.discussion*1000;
    r.meeting={kind,caller:p.id,incident:body?{name:body.name,color:body.color}:null,
      start:t,introUntil,voteAt,end:voteAt+r.settings.voting*1000,votes:{},judge:null,result:null};
    r.bodies=[];r.chat=[];r.chatSequence=0;r.doors={};
    for(const id of ['target','waste'])delete r.taskEffects[id];
    if(r.sabotage?.until)restoreSystems(r,t);
    for(const q of r.players){q.input={x:0,y:0};q.opened=null;q.cameras=false;q.effect=null;q.ventIndex=null;}
  }
  function tally(r,t) {
    const m=r.meeting, live=r.players.filter(active), eligible=live.filter(canVote);
    // A submitted ballot survives a temporary disconnect during its reconnect window.
    // A candidate must still be connected to be ejected.
    const votes=Object.entries(m.votes).filter(([id,v])=>live.some(p=>p.id===id)&&(v==='skip'||eligible.some(p=>p.id===v)));
    const counts={}; for(const [,v] of votes) counts[v]=(counts[v]||0)+1;
    const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
    const leader=sorted[0], tie=Boolean(leader&&leader[1]===sorted[1]?.[1]);
    let target=leader&&!tie&&leader[0]!=='skip'?r.players.find(p=>p.id===leader[0]):null;
    const override=Boolean(r.settings.roles.judge.enabled&&m.judge&&eligible.some(p=>p.id===m.judge.id)&&eligible.some(p=>p.id===m.judge.target));
    if(override){
      const verdict=r.players.find(p=>p.id===m.judge.target);
      target=verdict.team==='impostor'?verdict:r.players.find(p=>p.id===m.judge.id);
    }
    if(target)die(r,target,t,false);
    m.result={target:target?label(target):null,tie:!target&&tie,counts,override,role:target&&r.settings.confirm?target.team:null,
      votes:r.settings.anonymous?null:votes};
    r.phase='verdict';r.until=t+4800;
  }

  function privateAbility(r,p,req,t) {
    const id=p.alive?p.role:p.ghost,spec=special[id],cfg=r.settings.roles[id];
    valid(spec&&cfg.enabled&&id!=='noisemaker'&&id!=='viper','No manual ability is available.');
    if(id==='judge'){
      valid(r.phase==='meeting'&&t>=r.meeting.voteAt&&t<r.meeting.end&&!p.used&&!r.meeting.judge&&p.assignments.some(a=>a.done),'Use the verdict during a ballot.');
      const target=r.players.find(q=>q.id===req?.target&&q.id!==p.id&&canVote(q));
      valid(target,'Choose an eligible player.');
      p.used=true;r.meeting.judge={id:p.id,target:target.id};return;
    }
    valid(r.phase==='play'&&t>=p.abilityAt,'Ability is cooling down.');
    valid(r.sabotage?.kind!=='comms'||!['tracker','scientist','detective'].includes(id),'Restore comms to use this ability.');
    const target=r.players.find(q=>q.id===req?.target&&q.id!==p.id&&active(q));
    const blocked=Object.keys(r.doors).map(Number);
    const nearby=target&&dist(p,target)<116&&(!p.alive||hasLine(p,target,blocked));
    valid(p.ventIndex===null,'Exit the service hatch first.');
    const until=t+cfg.duration*1000;
    if(id==='engineer') {
      valid(vents.some(v=>dist(p,v)<48&&hasLine(p,v,blocked)),'Approach a service hatch.');
      p.effect={id,until};
    } else if(id==='scientist'){
      valid(p.battery,'Complete an assignment to recharge your battery.');
      p.battery=false;p.effect={id,until};
    } else if(id==='phantom')p.effect={id,until};
    else if(id==='tracker'){
      valid(nearby,'Choose a nearby player.');
      p.effect={id,until,target:target.id};
    } else if(id==='angel') {
      valid(nearby&&target.team==='crew'&&target.shield<=t,'Choose a nearby unshielded crewmate.');
      target.shield=until;
    } else if(id==='influencer') {
      if(req?.refresh){
        valid(p.signalReroll,'No more refreshes remain during this flight.');
        p.signalReroll=false;p.signalHand=randomOrder(signals).slice(0,5);return;
      }
      const hand=req?.signals;
      valid(target&&target.team==='crew'&&Array.isArray(hand)&&hand.length>=1&&hand.length<=3&&new Set(hand).size===hand.length&&hand.every(v=>p.signalHand.includes(v)),'Choose a living crewmate and up to three available symbols.');
      target.signal={text:'Ghost signal: '+hand.join(' '),until};
      p.signalHand=randomOrder(signals).slice(0,5);
    } else if(id==='shapeshifter') {
      valid(target,'Choose a living player to mimic.');
      p.effect={id,until,target:target.id};
    } else if(id==='detective'){
      const body=r.bodies.find(b=>b.id===req?.target&&dist(p,b)<64&&hasLine(p,b,blocked));
      valid(body||nearby,'Approach a witness or an incident.');
      if(body)p.notes=[...p.notes,{text:'Incident recorded in '+body.room}].slice(-8);
      else p.notes=[...p.notes,{text:target.name+' recently passed '+target.seen.slice(-3).join(', ')}].slice(-8);
      p.effect={id,until};
    }
    p.abilityAt=until+cfg.cooldown*1000;
  }

  function restoreSystems(r,t){
    r.sabotage=null;
    r.sabotageAt=t+systemsCooldown;
  }
  function hatchEffect(r,p,index,kind,t){
    if(p.effect?.id==='phantom'||index===null)return;
    const suit=p.effect?.id==='shapeshifter'&&r.players.find(q=>q.id===p.effect.target)||p;
    r.hatchEffects.push({index,kind,color:suit.color,hat:suit.hat,start:t,until:t+520});
  }
  function leaveHatch(r,p,t){
    hatchEffect(r,p,p.ventIndex,'exit',t);
    p.ventIndex=null;
    p.ventAt=t+800;
    p.ventExitUntil=t+360;
    if(p.role==='engineer'&&p.effect?.id==='engineer'){
      p.effect=null;
      p.abilityAt=t+r.settings.roles.engineer.cooldown*1000;
    }
  }

  function canWatch(r,p,blocked){
    return r.phase==='play'&&p.socket&&active(p)&&p.ventIndex===null&&r.sabotage?.kind!=='comms'&&
      dist(p,securityConsole)<securityRange&&hasLine(p,securityConsole,blocked);
  }
  function captureCameras(r,blocked){
    const seen=(site,p)=>contains(site,p.x,p.y)&&hasLine(site,p,blocked);
    const actors=r.players.filter(q=>active(q)&&q.socket&&q.ventIndex===null&&q.effect?.id!=='phantom');
    return cameraSites.map(site=>({
      players:actors.filter(p=>seen(site,p)).map(p=>{
        const suit=p.effect?.id==='shapeshifter'&&r.players.find(q=>q.id===p.effect.target)||p;
        return {...point(p),color:suit.color,hat:suit.hat,facing:p.facing,direction:p.direction,moving:p.moving,alive:true};
      }),
      bodies:r.bodies.filter(b=>seen(site,b)).map(b=>({...point(b),color:b.color}))
    }));
  }

  function expireCritical(r,t){
    if(r.phase!=='play'||!r.sabotage?.until||t<r.sabotage.until)return;
    result(r,'impostor','The ship could not recover from the '+r.sabotage.kind+' emergency.');
  }
  function command(r,p,kind,req,t) {
    expireCritical(r,t);
    const blocked=Object.keys(r.doors).map(Number);
    const isHost=p.id===r.host;
    switch(kind) {
      case 'settings': valid(isHost&&r.phase==='lobby','Only the captain configures the lobby.');updateSettings(r,req);return {settings:r.settings};
      case 'start': valid(isHost&&r.phase==='lobby','Only the captain starts the flight.');startCountdown(r,t);break;
      case 'reset': valid(isHost&&r.phase==='result','Only the captain can re-dock.');reset(r);break;
      case 'suit': {
        valid(r.phase==='lobby'&&dist(p,terminal)<76,'Approach the gear terminal.');
        valid(Object.hasOwn(colors,req?.color)&&!r.players.some(q=>q!==p&&q.color===req.color),'That suit color is already assigned.');
        valid(Number.isInteger(req.hat)&&hats[req.hat],'Invalid accessory.');
        Object.assign(p,{color:req.color,hat:req.hat,showName:req.showName!==false});break;
      }
      case 'taskOpen': {
        const a=usable(r,p,req?.id);
        p.cameras=false;
        if(p.opened?.id!==a.id||p.opened.stage!==a.stage){
          const instrument=tasks.find(task=>task.id===a.id).instrument;
          if(instrument==='clean'&&p.alive&&p.team==='crew'){
            const hatch=vents.indexOf(tasks.find(task=>task.id===a.id).stops[a.stage]);
            for(const other of r.players)if(other.ventIndex===hatch)leaveHatch(r,other,t);
          }
          p.opened=instrument==='sample'?(p.sampleLab??=puzzle(a.id,a.stage,t,instrument)):puzzle(a.id,a.stage,t,instrument);
        }
        return {puzzle:publicPuzzle(p.opened,t)};
      }
      case 'taskClose': p.opened=null;break;
      case 'taskStep': {
        const opened=p.opened;
        valid(opened,'Open a task first.');
        const a=usable(r,p,opened.id);
        const task=tasks.find(v=>v.id===a.id), stop=task.stops[a.stage];
        const attempt=stepPuzzle(opened,req,t);
        if(r.settings.visualTasks&&p.team==='crew'&&p.alive&&!attempt.error){
          const kind=opened.instrument;
          if(kind==='target')r.taskEffects.target={kind,x:deck.weapons.x+55,y:deck.weapons.y-5,until:t+520};
          if(kind==='shield'&&attempt.done)r.taskEffects.shield={kind,x:deck.shields.x,y:deck.shields.y};
          if(kind==='waste'&&a.stage===1&&attempt.done)r.taskEffects.waste={kind,x:stop.x,y:stop.y+15,until:t+1300};
        }
        if(attempt.done){
          a.stage++;a.done=a.stage===task.stops.length;if(a.done&&p.role==='scientist')p.battery=true;p.opened=null;win(r);
        }
        return {...attempt,puzzle:publicPuzzle(p.opened,t)};
      }
      case 'strike': {
        const target=r.players.find(q=>q.id===req?.target && q.team==='crew'&&active(q)&&q.ventIndex===null);
        valid(r.phase==='play'&&p.team==='impostor'&&p.alive&&p.ventIndex===null&&t>=p.killAt,'Elimination is cooling down.');
        valid(target&&dist(p,target)<r.settings.killDistance&&hasLine(p,target,blocked),'Get closer to a target.');
        p.killAt=t+strikeCooldown(r,p);p.effect=null;
        if(target.shield>t){target.shield=0;return {notice:'The strike hit a shield.'};}
        const body=p.role==='viper'?t+Math.max(1,r.settings.roles.viper.duration)*1000:true;
        die(r,target,t,body);p.x=target.x;p.y=target.y;win(r);break;
      }
      case 'vent': {
        const dest=req?.dest;
        const inService=index=>r.players.some(q=>q.alive&&q.team==='crew'&&q.opened?.instrument==='clean'&&
          tasks.find(v=>v.id===q.opened.id).stops[0]===vents[index]&&dist(q,vents[index])<taskRange(q.opened.id));
        valid(r.phase==='play'&&p.alive,'Service hatch is unavailable.');
        if(req?.action==='exit'){
          valid(p.ventIndex!==null,'You are already on the deck.');
          leaveHatch(r,p,t);
          return {index:null};
        }
        valid(t>=(p.ventAt||0),'Hatch is cycling.');
        if(p.ventIndex===null){
          const here=vents.findIndex(v=>dist(p,v)<48&&hasLine(p,v,blocked));
          valid(here>=0&&req?.action==='enter','Approach a service hatch.');
          valid(!inService(here),'This hatch is being serviced.');
          if(p.role==='engineer'&&!p.effect)privateAbility(r,p,{},t);
          valid(p.team==='impostor'||p.effect?.id==='engineer'&&p.effect.until>t,'Service hatch is unavailable.');
          p.ventIndex=here;
          hatchEffect(r,p,here,'enter',t);
        }else{
          const here=p.ventIndex;
          valid(p.team==='impostor'||p.effect?.id==='engineer'&&p.effect.until>t,'Service hatch is unavailable.');
          valid(Number.isInteger(dest)&&ventDestinations(here).includes(dest),'Choose a connected hatch.');
          valid(!inService(dest),'That hatch is being serviced.');
          p.ventIndex=dest;
        }
        Object.assign(p,point(vents[p.ventIndex]));p.ventAt=t+650;p.opened=null;p.cameras=false;
        p.input={x:0,y:0};return {index:p.ventIndex};
      }
      case 'sabotage': {
        valid(r.phase==='play'&&p.team==='impostor','Sabotage requires an infiltrator.');
        valid(!r.sabotage,'A ship system is already disrupted.');
        const id=req?.kind;
        if(id==='doors') {
          valid(Number.isInteger(req.door)&&doors[req.door]&&!r.doors[req.door],'Choose an open bulkhead.');
          valid(t>=(r.doorReady[req.door]||0),'Bulkhead is cooling down.');
          valid(!r.players.some(q=>active(q)&&q.ventIndex===null&&contains(doors[req.door],q.x,q.y,-(playerRadius+2))),'Bulkhead obstructed.');
          r.doors[req.door]=t+9500;
          r.doorReady[req.door]=t+doorCooldown;
        }else{
          valid(Object.hasOwn(repairs,id),'Unknown ship system.');
          valid(t>=r.sabotageAt,'Sabotage is cooling down.');
          valid(!blocked.length,'Wait for the bulkheads to reopen.');
          r.sabotage={kind:id,until:id==='oxygen'||id==='reactor'?t+criticalDuration:null,
            fixed:[],pattern:id==='lights'?Array.from({length:5},()=>randomInt(2)===1):null,
            code:id==='oxygen'?repairs[id].map(()=>String(randomInt(10000,100000))):null,dial:id==='comms'?randomInt(12,89):null};
          if(id==='lights'&&r.sabotage.pattern.every(Boolean))r.sabotage.pattern[0]=false;
          if(id==='comms')for(const q of r.players){q.opened=null;q.cameras=false;}
        }
        break;
      }
      case 'repair': {
        const s=r.sabotage, index=req?.index, location=s&&repairs[s.kind][index];
        valid(r.phase==='play'&&p.alive&&p.ventIndex===null&&location&&(!s.until||t<s.until)&&dist(p,location)<58&&hasLine(p,location,blocked),'Approach an active repair station.');
        if(s.kind==='lights'){
          valid(Number.isInteger(req.a)&&req.a>=0&&req.a<s.pattern.length,'Invalid switch.');
          s.pattern[req.a]=!s.pattern[req.a];if(!s.pattern.every(Boolean))return {};
        }
        if(s.kind==='oxygen')valid(req.a===s.code[index],'Enter the displayed pressure code.');
        if(s.kind==='comms')valid(Number.isFinite(req.a)&&Math.abs(req.a-s.dial)<=3,'Tune to the highlighted frequency.');
        if(s.kind==='reactor'){
          s.fixed=s.fixed.filter(v=>t-v.at<relayWindow&&v.index!==index);
          s.fixed.push({index,at:t,by:p.id});
          if(s.fixed.length!==2||s.fixed[0].by===s.fixed[1].by)return {};
        } else if(s.kind==='oxygen') {
          if(!s.fixed.some(v=>v.index===index))s.fixed.push({index,at:t});
          if(s.fixed.length!==2)return {};
        }
        restoreSystems(r,t);break;
      }
      case 'report': {
        const body=r.bodies.find(b=>b.id===req?.id&&dist(p,b)<72&&hasLine(p,b,blocked));
        valid(r.phase==='play'&&p.alive&&p.ventIndex===null&&body&&(!r.sabotage?.until||t<r.sabotage.until),'No incident is close enough.');
        assembly(r,p,t,'report',body);break;
      }
      case 'emergency':
        valid(r.phase==='play'&&p.alive&&p.ventIndex===null&&p.emergencies>0&&!r.sabotage&&t>=r.meetingAt&&dist(p,meetingPoint)<emergencyRange&&hasLine(p,meetingPoint,blocked),'Intercom is unavailable.');
        p.emergencies--;assembly(r,p,t,'emergency');break;
      case 'vote': {
        const to=req?.id, m=r.meeting;
        valid(r.phase==='meeting'&&canVote(p)&&t>=m.voteAt&&t<m.end&&!Object.hasOwn(m.votes,p.id),'Your ballot is unavailable.');
        valid(to==='skip'||r.players.some(q=>q.id===to&&canVote(q)),'Choose a connected living player.');
        m.votes[p.id]=to;break;
      }
      case 'chat': {
        valid(r.phase==='meeting'&&t>=r.meeting.introUntil,'The intercom is closed.');
        const message=typeof req?.text==='string'?req.text.trim().slice(0,180):'';
        valid(message&&t-(p.chatAt||0)>=950,'Wait briefly before sending another message.');
        p.chatAt=t;r.chat.push({id:p.id,name:p.name,color:p.color,sequence:++r.chatSequence,text:message,ghost:!p.alive,at:t});r.chat=r.chat.slice(-64);break;
      }
      case 'ability': privateAbility(r,p,req,t);break;
      case 'cameraOff': p.cameras=false;break;
      case 'monitor': {
        if(req?.kind==='security'){
          valid(canWatch(r,p,blocked),'Approach the Security console with communications online.');
          p.opened=null;p.cameras=true;return {security:true};
        }
        valid(req?.kind==='command'&&r.phase==='play'&&p.alive&&p.ventIndex===null&&dist(p,deck.admin)<87&&
          hasLine(p,deck.admin,blocked)&&r.sabotage?.kind!=='comms','Approach an online console.');
        return {readings:rooms.map(q=>[q.name,r.players.filter(p=>active(p)&&p.ventIndex===null&&contains(q,p.x,p.y)).length])};
      }
      default: fail('Unknown action.');
    }
    return {};
  }
  function snapshot(r,p,t,feeds) {
    const playable=r.phase==='play', inLobby=['lobby','countdown'].includes(r.phase), blocked=Object.keys(r.doors).map(Number);
    const vision=p.alive?(p.team==='impostor'?r.settings.impostorVision:r.sabotage?.kind==='lights'?Math.round(r.settings.crewVision*82/290):r.settings.crewVision):520;
    const visible=(q)=>inLobby||q===p||q.ventIndex===null&&((!p.alive&&dist(p,q)<vision)||(active(q)&&q.effect?.id!=='phantom'&&dist(p,q)<vision&&hasLine(p,q,blocked)));
    const view=q=>{
      const mask=q!==p&&q.effect?.id==='shapeshifter'?r.players.find(v=>v.id===q.effect.target):null;
      const suit=mask||q;
      // The disguise uses a fresh visual identity and carries no underlying player identifier.
      const scanning=r.settings.visualTasks&&q.alive&&q.team==='crew'&&q.opened?.instrument==='scan'&&q.opened.hold!==null&&t-q.opened.hold<4000;
      return {id:mask?'echo-'+suit.id:q.id,name:suit.showName?suit.name:'',color:suit.color,hat:suit.hat,...point(q),
        alive:q.alive,facing:q.facing,direction:q.direction,moving:q.moving,hidden:q.ventIndex!==null,protected:q===p&&q.shield>t,scanning,ventExitUntil:q.ventExitUntil>t?q.ventExitUntil:undefined};
    };
    const m=r.meeting, s=r.sabotage, e=p.effect;
    const roster=r.players.filter(q=>!q.retired||m).map(q=>({...label(q),alive:inLobby||playable?undefined:active(q)}));
    const tactical={};
    if(e?.id==='scientist'&&s?.kind!=='comms')tactical.vitals=r.players.map(q=>({name:q.name,alive:active(q)}));
    if(e?.id==='tracker'&&s?.kind!=='comms'){
      const q=r.players.find(q=>q.id===e.target);
      if(q&&active(q)&&q.trail?.[0])tactical.track={name:q.name,...q.trail[0]};
    }
    if(p.cameras&&canWatch(r,p,blocked))tactical.cameras=feeds;
    if(p.notes?.length)tactical.notes=p.notes;
    if(p.ghost==='influencer'){tactical.signals=p.signalHand;tactical.refresh=p.signalReroll;}
    const sabotage=s&&{kind:s.kind,until:s.until,fixed:s.fixed.map(f=>({index:f.index,at:f.at})),pattern:s.pattern,
      nearby:repairs[s.kind].flatMap((q,index)=>p.alive&&p.ventIndex===null&&dist(p,q)<58&&hasLine(p,q,blocked)?[{index,code:s.code?.[index],dial:s.dial}]:[])};
    const showProgress=s?.kind!=='comms'&&(r.settings.taskBar==='always'||r.settings.taskBar==='meetings'&&['meeting','verdict'].includes(r.phase));
    const near=q=>playable&&p.ventIndex===null&&dist(p,q)<vision&&(!p.alive||hasLine(p,q,blocked));
    const taskEffects=playable?Object.values(r.taskEffects).filter(q=>(!q.until||q.until>t)&&dist(p,q)<vision&&(!p.alive||hasLine(p,q,blocked))):[];
    return {code:r.code,phase:r.phase,round:r.round||0,host:r.host,now:t,until:r.until,roster,settings:r.settings,
      positions:(playable||inLobby)?r.players.filter(q=>!q.retired&&visible(q)).map(view):[view(p)],
      self:{id:p.id,...point(p),color:p.color,hat:p.hat,showName:p.showName,alive:p.alive,team:p.team,role:p.role,ghost:p.ghost,
        killAt:p.killAt,abilityAt:p.abilityAt,sabotageAt:r.sabotageAt,doorReady:p.team==='impostor'?r.doorReady:undefined,ventAt:p.ventAt,effect:e?.id||null,effectUntil:e?.until,battery:p.battery,ventIndex:p.ventIndex,
        emergencies:p.emergencies,meetingAt:r.meetingAt,used:p.used,signal:p.signal,assignments:p.assignments,
        moveSeq:p.appliedMoveSeq,moveAge:t-p.moveSince,
        allies:p.team==='impostor'?r.players.filter(q=>q.team==='impostor').map(q=>q.id):[]},
      bodies:r.bodies.filter(b=>dist(p,b)<vision&&(!p.alive||hasLine(p,b,blocked))).map(({expires,created,room,...b})=>({...b,decay:expires?Math.min(3,Math.floor((t-created)/(expires-created)*4)):0})),
      vision,doors:blocked,sabotage,alerts:r.alerts,taskEffects,
      cameraLights:feeds?cameraSites.flatMap((site,index)=>near(site)?[index]:[]):[],
      hatchEffects:playable?r.hatchEffects.filter(e=>near(vents[e.index])):[],
      progress:showProgress?progress(r):null,puzzle:publicPuzzle(p.opened,t),tactical,
      meeting:m&&{kind:m.kind,caller:m.caller,incident:m.incident,start:m.start,introUntil:m.introUntil,voteAt:m.voteAt,end:m.end,
        voted:Object.keys(m.votes),myVote:m.votes[p.id],result:m.result},
      chat:r.chat.filter(msg=>!msg.ghost||!p.alive),outcome:r.outcome};
  }
  function release(socket,permanent=false) {
    const session=bound.get(socket.id);
    if(!session)return;
    bound.delete(socket.id);
    const {r,p}=session;
    p.socket=null;p.disconnected=now();p.opened=null;p.cameras=false;p.input={x:0,y:0};
    if(permanent&&r.phase==='lobby')r.players=r.players.filter(q=>q!==p);
    else if(permanent)p.disconnected-=46000;
    migrate(r);
  }
  io.on('connection', socket=>{
    function reply(ack,fn) {
      if(typeof ack!=='function')return;
      try {ack({ok:true,...fn()});}catch(error){ack({ok:false,error:error.message});}
    }
    let entryAt=0, moves=0, commands=0, lastRate=now();
    function limit() {
      const t=now();
      if(t-lastRate>=1000){lastRate=t;moves=0;commands=0;}
      return t;
    }
    socket.on('enter',(req,ack)=>reply(ack,()=>{
      const t=now();
      valid(t-entryAt>380,'Please wait before trying again.');
      entryAt=t;
      valid(req?.deck===deckRevision,'This client and the relay use different deck versions. Reload the updated game.');
      if(req?.kind==='create'){
        valid(roomsByCode.size<maxRooms,'All shuttles are currently in use.');
        const r={code:roomCode(),players:[],host:null,settings:settings(),phase:'lobby',chat:[],doors:{},bodies:[],alerts:[]};
        const session=add(socket,r,req.name);
        roomsByCode.set(r.code,r);return session;
      }
      const code=typeof req?.code==='string'?req.code.trim().toUpperCase():'';
      const r=roomsByCode.get(code);
      valid(r,'Private room code was not found.');
      if(req.kind==='resume'){
        const p=r.players.find(q=>!q.retired&&q.token===req.token);
        valid(p&&!bound.has(socket.id),'Session expired.');
        if(p.socket){const old=io.sockets.sockets.get(p.socket);if(old)release(old);old?.disconnect(true);}
        const session=bind(socket,r,p);migrate(r);return session;
      }
      valid(req.kind==='join','Invalid room request.');
      return add(socket,r,req.name);
    }));
    socket.on('move',req=>{
      const t=limit(), s=bound.get(socket.id);
      if(!s||!['lobby','play'].includes(s.r.phase))return;
      const x=req?.x,y=req?.y;
      if(!Number.isFinite(x)||!Number.isFinite(y))return;
      if(++moves>45&&(x||y))return;
      const length=Math.max(1,Math.hypot(x,y));s.p.input={x:x/length,y:y/length};s.p.inputAt=t;
      s.p.moveSeq=Number.isSafeInteger(req.seq)?req.seq:null;
    });
    socket.on('command',(req,ack)=>reply(ack,()=>{
      const t=limit(), s=bound.get(socket.id);
      valid(s&&++commands<=22,'Request limit reached or room session expired.');
      if(req?.kind==='leave'){release(socket,true);return {};}
      return command(s.r,s.p,req?.kind,req?.data,t);
    }));
    socket.on('disconnect',()=>release(socket));
  });
  let last=now(), frame=0;
  const interval=setInterval(()=>{
    const t=now(), dt=Math.min(.07,Math.max(0,(t-last)/1000));last=t;
    for(const [code,r] of roomsByCode) {
      const lobby=r.phase==='lobby',blocked=Object.keys(r.doors).map(Number);
      for(const p of r.players) {
        if(!p.socket&&p.disconnected!==null&&t-p.disconnected>45000){
          if(lobby)continue;
          if(!p.retired){p.retired=true;if(p.alive)die(r,p,t,false);}
        }
        if(p.effect&&t>=p.effect.until){
          if(p.effect.id==='engineer'&&p.ventIndex!==null)leaveHatch(r,p,t);
          p.effect=null;
        }
        if(p.signal&&t>=p.signal.until)p.signal=null;
        p.moving=false;
        if(p.socket&&(r.phase==='play'||lobby)&&t-(p.inputAt||0)<270&&!p.opened&&(lobby||p.ventIndex===null)){
          if(p.appliedMoveSeq!==p.moveSeq){p.appliedMoveSeq=p.moveSeq;p.moveSince=t-dt*1000;}
          advanceMovement(p,p.input,dt,r.settings.speed*(p.alive?1:1.28),lobby,blocked);
        }
        if(r.phase==='play'&&active(p)){
          const name=roomName(p);
          if(name!==p.roomStamp){p.roomStamp=name;p.seen=[...p.seen,name].slice(-6);}
          if(frame%10===0)p.trail=[...(p.trail||[]),point(p)].slice(-4);
        }
      }
      if(lobby)r.players=r.players.filter(p=>p.socket||t-p.disconnected<=45000);
      if(!r.players.some(p=>p.socket||t-p.disconnected<=45000)){roomsByCode.delete(code);continue;}
      for(const [id,end] of Object.entries(r.doors)) if(t>=end)delete r.doors[id];
      r.bodies=r.bodies.filter(b=>b.expires===null||b.expires>t);
      r.alerts=r.alerts.filter(a=>a.until>t);
      if(r.hatchEffects)r.hatchEffects=r.hatchEffects.filter(e=>e.until>t);
      if(r.sabotage?.kind==='reactor')r.sabotage.fixed=r.sabotage.fixed.filter(v=>t-v.at<relayWindow);
      if(r.phase==='countdown'&&t>=r.until)start(r,t);
      if(r.phase==='reveal'&&t>=r.until){r.phase='play';win(r);}
      expireCritical(r,t);
      if(r.phase==='play')win(r);
      if(r.phase==='meeting'&&(t>=r.meeting.end||r.settings.early&&t>=r.meeting.voteAt&&r.players.filter(canVote).every(p=>Object.hasOwn(r.meeting.votes,p.id))))tally(r,t);
      if(r.phase==='verdict'&&t>=r.until){
        r.phase='play';r.meeting=null;r.meetingAt=t+r.settings.meetingCooldown*1000;r.doors={};
        r.players.forEach((p,i)=>{Object.assign(p,spawn(i,false));p.killAt=t+strikeCooldown(r,p);});
        win(r);
      }
      if(frame%2===0){
        for(const p of r.players)if(p.cameras&&!canWatch(r,p,blocked))p.cameras=false;
        const feeds=r.players.some(p=>p.cameras)?captureCameras(r,blocked):null;
        for(const p of r.players)if(p.socket)io.sockets.sockets.get(p.socket)?.volatile.emit('state',snapshot(r,p,t,feeds));
      }
    }
    frame++;
  },33);
  interval.unref();
  return ()=>clearInterval(interval);
}
