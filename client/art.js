import {rooms,corridors,lobby,doors,vents,terminal,tasks,repairs,colors,meetingPoint} from '../shared/deck.js';

function box(ctx,x,y,w,h,r,fill,stroke,line=1){
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}
}
function circle(ctx,x,y,r,fill,stroke,line=1){
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}
}
function text(ctx,label,x,y,size=12,color='#cbdcea',align='left'){
  ctx.font='700 '+size+'px monospace';ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(label,x,y);
}
export function astronaut(ctx,p,t,scale=1) {
  const color=colors[p.color]||colors.teal;
  ctx.save();ctx.translate(p.x,p.y);ctx.scale(scale,scale);
  const stride=p.moving?Math.sin(t/70)*3:0, bob=p.moving?Math.abs(stride)/2:Math.sin(t/350)*.65;
  if(p.hidden)ctx.globalAlpha=.32;
  if(!p.alive){ctx.globalAlpha=.48;circle(ctx,0,4,23,'#60e0d42e');circle(ctx,-9,14,6,'#7ffce780');}
  ctx.fillStyle='#03081080';ctx.beginPath();ctx.ellipse(1,13,18,6,0,0,Math.PI*2);ctx.fill();
  ctx.translate(0,-bob);
  box(ctx,-12,4+stride,9,12,4,'#172937','#06101c',2);
  box(ctx,3,4-stride,9,12,4,'#172937','#06101c',2);
  box(ctx,-19,-15,9,24,4,'#35536b','#08141f',2);
  box(ctx,10,-15,9,24,4,'#35536b','#08141f',2);
  box(ctx,-15,-15,30,26,9,color,'#07131f',2.5);
  box(ctx,-5,3,10,3,1,'#defff5');
  circle(ctx,0,-17,17,color,'#07131f',2.7);
  const g=ctx.createLinearGradient(0,-30,0,-5);g.addColorStop(0,'#78b5c6');g.addColorStop(.42,'#25495e');g.addColorStop(1,'#112334');
  circle(ctx,2*(p.facing||1),-17,12.5,g,'#0a2737',1.5);
  box(ctx,-5+2*(p.facing||1),-25,10,3,1,'#d5fbffb0');
  if(p.hat===1){box(ctx,-5,-40,10,8,3,'#fabb69','#361f19');}
  if(p.hat===2){box(ctx,10,-45,2,14,1,'#b4d3df');circle(ctx,11,-45,3,'#67f5dd');}
  if(p.hat===3){box(ctx,-16,-37,31,10,3,'#263954','#081522',2);box(ctx,-5,-35,10,3,1,'#fabb69');}
  if(p.protected)circle(ctx,0,-9,24,'#8dfdd220','#67f5dd',2);
  if(p.name)text(ctx,p.name,0,-(p.hat?52:43),11,'#eef9ff','center');
  ctx.restore();
}
function prop(ctx,r) {
  const {x,y,accent,prop}=r;
  ctx.save();ctx.translate(x,y-7);
  ctx.shadowColor=accent+'55';ctx.shadowBlur=14;
  const panel=(x,y,w,h)=>box(ctx,x,y,w,h,6,'#23394c',accent,1.4);
  const display=(x,y,w,h)=>box(ctx,x,y,w,h,3,'#091b2c',accent,1);
  if(prop==='table'){
    box(ctx,-32,-29,64,59,17,'#273e52',accent,2);circle(ctx,0,0,15,'#4c2635','#ffa992',2);
    circle(ctx,0,0,7,'#fa8c79');text(ctx,'SOS',0,4,7,'#351013','center');
  } else if(prop==='helm'||prop==='command'||prop==='screen'){
    panel(-51,-25,102,47);
    for(let i=0;i<3;i++){display(-45+i*31,-18,25,20);box(ctx,-42+i*31,-7,18,2,1,accent);}
    box(ctx,-32,10,64,2,1,accent);
  } else if(prop==='core'||prop==='atmos'||prop==='power'){
    if(prop==='core'){circle(ctx,0,0,31,'#213449',accent,2);circle(ctx,0,0,22,'#462238',accent,1);circle(ctx,0,0,12,accent);}
    else for(let i=-1;i<=1;i++){panel(i*27-10,-30,20,61);box(ctx,i*27-5,-19,10,36,5,accent+'66',accent);}
  } else if(prop==='engine'||prop==='guns'){
    panel(-47,-24,86,48);
    for(const dy of [-14,5]){box(ctx,-60,dy,33,9,4,accent+'88',accent);box(ctx,-26,dy,54,9,4,'#192d41',accent);}
    circle(ctx,36,0,14,'#314659',accent,2);
  } else if(prop==='med'){
    panel(-45,-23,90,46);display(-30,-15,47,30);box(ctx,1,-5,29,8,2,accent);box(ctx,11,-15,8,28,2,accent);
  } else if(prop==='cargo'){
    for(const [a,b,w] of [[-51,-21,33],[-9,-13,42],[31,-26,27]]){panel(a,b,w,35);box(ctx,a+4,b+4,w-8,3,1,accent);}
  } else if(prop==='shield'){
    for(let i=0;i<6;i++){const a=i*Math.PI/3;circle(ctx,Math.sin(a)*25,Math.cos(a)*25,9,'#254157',accent);}
    circle(ctx,0,0,7,accent);
  } else if(prop==='dish'){
    panel(-43,-18,86,38);ctx.beginPath();ctx.arc(0,-8,24,0,Math.PI);ctx.fillStyle=accent+'55';ctx.fill();ctx.strokeStyle=accent;ctx.stroke();circle(ctx,0,-10,4,accent);
  } else {
    circle(ctx,0,0,32,'#152c43',accent,2);circle(ctx,0,0,21,'#2e4466',accent);
    for(let i=0;i<7;i++)circle(ctx,Math.sin(i*17)*19,Math.cos(i*14)*19,1.8,'#ccefff');
  }
  ctx.restore();
}
function plate(ctx,r,isLobby=false){
  const radius=isLobby?45:17, x=r.x-r.w/2,y=r.y-r.h/2;
  ctx.save();
  ctx.shadowBlur=16;ctx.shadowColor='#02070e';box(ctx,x-5,y-5,r.w+10,r.h+10,radius+2,'#16283b','#476276',2);
  ctx.shadowBlur=0;
  const shade=ctx.createLinearGradient(x,y,x,y+r.h);shade.addColorStop(0,'#253a4e');shade.addColorStop(1,'#182b3d');
  box(ctx,x,y,r.w,r.h,radius,shade,'#476375',2);ctx.clip();
  ctx.strokeStyle='#91b3c115';ctx.lineWidth=1;
  ctx.beginPath();
  for(let j=x+23;j<x+r.w;j+=28){ctx.moveTo(j,y);ctx.lineTo(j,y+r.h);}
  for(let j=y+20;j<y+r.h;j+=26){ctx.moveTo(x,j);ctx.lineTo(x+r.w,j);}
  ctx.stroke();
  box(ctx,x+17,y+6,r.w-34,3,1,r.accent+'aa');
  for(const a of [x+14,x+r.w-14])for(const b of [y+20,y+r.h-18])circle(ctx,a,b,3,'#142435','#49687c');
  ctx.restore();
}
function buildScene(inLobby){
  const cache=document.createElement('canvas');cache.width=inLobby?900:1365;cache.height=inLobby?610:900;
  const ctx=cache.getContext('2d');
  if(inLobby){
    const r=lobby[0];plate(ctx,r,true);
    box(ctx,306,52,287,61,15,'#101e30','#52748b',2);
    box(ctx,321,56,256,32,12,'#080f21','#4a6a84');
    for(let i=0;i<20;i++)circle(ctx,325+i*13,62+(i*17)%20,1,i%4?'#7395b0':'#d0fbff');
    text(ctx,'SHUTTLE / 07',450,107,11,'#76e5cc','center');
    for(const x of [78,740])for(let i=0;i<6;i++){
      const y=141+i*53;box(ctx,x,y,82,44,8,'#29485c','#557b92',2);
      box(ctx,x+9,y+7,64,20,6,'#385e75','#102333');box(ctx,x+14,y+32,54,4,2,'#588296');
    }
    for(const [x,y] of [[200,209],[224,247],[665,390],[646,430]]){box(ctx,x,y,60,52,6,'#354759','#64717f',2);box(ctx,x+7,y+7,46,5,2,'#e8b166');box(ctx,x+9,y+17,42,25,4,'#24384a','#455c71');}
    box(ctx,334,500,232,42,8,'#496276','#7ca1b8',2);
    for(let i=0;i<6;i++)box(ctx,349+i*35,513,16,6,2,'#e9b368');
    const wash=ctx.createRadialGradient(450,300,40,450,300,313);wash.addColorStop(0,'#67f5dd13');wash.addColorStop(1,'#67f5dd00');
    box(ctx,65,115,770,372,44,wash);
    ctx.shadowBlur=22;ctx.shadowColor='#67f5dd';box(ctx,terminal.x-39,terminal.y-23,78,42,7,'#132c3a','#67f5dd',2);ctx.shadowBlur=0;
    box(ctx,terminal.x-30,terminal.y-18,60,24,5,'#204b56','#67f5dd');text(ctx,'GEAR',terminal.x,terminal.y-2,11,'#67f5dd','center');
    text(ctx,'CUSTOMIZATION TERMINAL',terminal.x,terminal.y+34,10,'#9fc7dc','center');
    return cache;
  }
  for(const c of corridors)box(ctx,c.x-c.w/2-4,c.y-c.h/2-4,c.w+8,c.h+8,5,'#172838','#38596e');
  for(const r of rooms)plate(ctx,r);
  for(const {x,y,w,h,horizontal,a,b} of corridors){
    const A=rooms[a],B=rooms[b];
    if(horizontal){
      const left=Math.min(A.x+A.w/2,B.x+B.w/2)-5,right=Math.max(A.x-A.w/2,B.x-B.w/2)+5;
      box(ctx,left,y-h/2+3,right-left,h-6,3,'#22374a');box(ctx,left,y-1,right-left,2,1,'#517b8d55');
    } else {
      const top=Math.min(A.y+A.h/2,B.y+B.h/2)-5,bottom=Math.max(A.y-A.h/2,B.y-B.h/2)+5;
      box(ctx,x-w/2+3,top,w-6,bottom-top,3,'#22374a');box(ctx,x-1,top,2,bottom-top,1,'#517b8d55');
    }
  }
  for(const r of rooms){
    prop(ctx,r);text(ctx,r.name.toUpperCase(),r.x,r.y+r.h/2-16,11,r.accent,'center');
  }
  for(const v of vents){box(ctx,v.x-13,v.y-8,26,16,3,'#122637','#607b91');for(let i=0;i<4;i++)box(ctx,v.x-9+i*5,v.y-5,2,10,1,'#8fb0bf');}
  for(const task of tasks)for(const s of task.stops){box(ctx,s.x-8,s.y-5,16,10,2,'#0d2838','#528295');}
  return cache;
}
const stars=Array.from({length:185},(_,i)=>[(i*137.825)%1,(i*273.901)%1,i%7]);
export function renderer(canvas) {
  const ctx=canvas.getContext('2d'), scenes=[buildScene(false),buildScene(true)], tracks=new Map();
  let camera=null, phase='';
  return (s,t,full=false)=>{
    const w=innerWidth,h=innerHeight,dpr=Math.min(1.75,devicePixelRatio||1);
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#080f1b';ctx.fillRect(0,0,w,h);
    const inLobby=s?.phase==='lobby';
    for(const [x,y,size] of stars){ctx.globalAlpha=.48+Math.sin(t/1400+x*37)*.25;circle(ctx,x*w,y*h,size===0?1.45:.65,size===0?'#91e2f9':'#829cba');}
    ctx.globalAlpha=1;
    if(!s)return;
    const zoom=inLobby?Math.min((w-32)/900,(h-132)/610,1.38):full?Math.min((w-40)/1365,(h-134)/900,1.45):Math.min(Math.max(w/980,.82),1.48);
    const target=inLobby?{x:450,y:303}:full?{x:683,y:450}:s.self;
    if(phase!==s.phase||!camera){camera={x:target.x,y:target.y};tracks.clear();phase=s.phase;}
    camera.x+=(target.x-camera.x)*.2;camera.y+=(target.y-camera.y)*.2;
    const center={x:w/2,y:inLobby?h/2+8:h/2};
    ctx.save();ctx.translate(center.x,center.y);ctx.scale(zoom,zoom);ctx.translate(-camera.x,-camera.y);
    ctx.drawImage(scenes[inLobby?1:0],0,0);
    if(!inLobby){
      for(const id of s.doors){const d=doors[id];box(ctx,d.x-d.w/2,d.y-d.h/2,d.w,d.h,3,'#673142','#ff8191',2);}
      for(const a of (s.sabotage?.kind==='comms'?[]:s.self.assignments)){if(a.done)continue;const q=tasks.find(v=>v.id===a.id).stops[a.stage];circle(ctx,q.x,q.y,7+Math.sin(t/220)*2,'#ffcc6780','#ffdf87');}
      if(s.sabotage)for(const [i,q] of repairs[s.sabotage.kind].entries()){const fixed=s.sabotage.fixed.some(v=>v.index===i);circle(ctx,q.x,q.y,8+Math.sin(t/130)*2,fixed?'#67f5ddaa':'#ff667dab',fixed?'#67f5dd':'#ffbcc7');}
      for(const b of s.bodies){
        ctx.save();ctx.globalAlpha=1-(b.decay||0)*.19;
        box(ctx,b.x-15+(b.decay||0)*3,b.y-6,31-(b.decay||0)*6,15,7,colors[b.color],'#111d2b',2);
        box(ctx,b.x+3,b.y-5,10,8,4,'#7eb7c9');ctx.restore();
      }
      for(const a of s.alerts)circle(ctx,a.x,a.y,17+Math.sin(t/100)*4,'#ff667d65','#ff667d');
      if(s.tactical.track)circle(ctx,s.tactical.track.x,s.tactical.track.y,12,'#67f5dd66','#67f5dd',2);
    }
    for(const p of [...s.positions].sort((a,b)=>a.y-b.y)){
      let q=tracks.get(p.id);
      if(!q||Math.hypot(p.x-q.x,p.y-q.y)>155){q={x:p.x,y:p.y};tracks.set(p.id,q);}
      q.x+=(p.x-q.x)*.28;q.y+=(p.y-q.y)*.28;
      astronaut(ctx,{...p,...q},t,full?.73:1);
    }
    ctx.restore();
    if(!inLobby&&!full&&s.phase==='play'){
      const px=(s.self.x-camera.x)*zoom+center.x,py=(s.self.y-camera.y)*zoom+center.y;
      const radius=Math.max(44,s.vision*zoom);
      const fog=ctx.createRadialGradient(px,py,radius*.41,px,py,radius*1.23);
      fog.addColorStop(0,'#03061100');fog.addColorStop(1,'#030611df');
      ctx.fillStyle=fog;ctx.fillRect(0,0,w,h);
    }
  };
}
export function drawMap(canvas,s) {
  const ctx=canvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.scale(canvas.width/1365,canvas.height/900);
  for(const c of corridors)box(ctx,c.x-c.w/2,c.y-c.h/2,c.w,c.h,5,'#294555');
  for(const r of rooms){box(ctx,r.x-r.w/2,r.y-r.h/2,r.w,r.h,16,'#163043',r.accent,2);text(ctx,r.name,r.x,r.y+8,18,r.accent,'center');}
  for(const a of (s.sabotage?.kind==='comms'?[]:s.self.assignments))if(!a.done){const q=tasks.find(t=>t.id===a.id).stops[a.stage];circle(ctx,q.x,q.y,8,'#ffbf73');}
  if(s.sabotage)for(const q of repairs[s.sabotage.kind])circle(ctx,q.x,q.y,11,'#ff667d');
  if(s.tactical.track)circle(ctx,s.tactical.track.x,s.tactical.track.y,12,'#b593ff');
  circle(ctx,s.self.x,s.self.y,11,'#67f5dd','#fff',3);
}
