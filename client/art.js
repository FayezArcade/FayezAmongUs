import {rooms,corridors,terrain,lobby,entrances,corridorWidth,doors,vents,ventConnections,terminal,tasks,repairs,colors,lobbySeats,lobbyCrates,contains,meetingPoint,playerScale} from '../shared/deck.js';

function box(ctx,x,y,w,h,r,fill,stroke,line=1){
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}
}
function polygon(ctx,points,fill,stroke,line=1){
  ctx.beginPath();ctx.moveTo(...points[0]);
  for(const p of points.slice(1))ctx.lineTo(...p);
  ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.lineJoin='round';ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}
}
function circle(ctx,x,y,r,fill,stroke,line=1){
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();}
}
function paint(ctx,x1,y1,x2,y2,...colors){
  const gradient=ctx.createLinearGradient(x1,y1,x2,y2);
  colors.forEach((color,i)=>gradient.addColorStop(i/(colors.length-1),color));
  return gradient;
}
function text(ctx,label,x,y,size=12,color='#e8edef',align='left'){
  ctx.font='800 '+size+'px system-ui,sans-serif';ctx.textAlign=align;
  ctx.lineWidth=2.3;ctx.strokeStyle='#191b1be6';ctx.lineJoin='round';ctx.strokeText(label,x,y);
  ctx.fillStyle=color;ctx.fillText(label,x,y);
}
const toneCache=new Map();
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
function suitTones(hex){
  if(toneCache.has(hex))return toneCache.get(hex);
  const mix=(weight,towards)=>'#'+[1,3,5].map(i=>{
    const n=Number.parseInt(hex.slice(i,i+2),16);
    return Math.round(n+(towards-n)*weight).toString(16).padStart(2,'0');
  }).join('');
  const result={bright:mix(.19,255),dark:mix(.33,0),deep:mix(.55,0)};
  toneCache.set(hex,result);
  return result;
}
export function astronaut(ctx,p,t,scale=1){
  const color=colors[p.color]||colors.teal, {bright,dark,deep}=suitTones(color), ink='#131923';
  const direction=p.direction||(p.facing<0?'left':'right');
  const front=direction==='down', back=direction==='up', side=!front&&!back;
  const ghost=p.alive===false;
  const walking=p.moving&&!ghost&&!reducedMotion.matches;
  const phase=t/78, stride=walking?Math.sin(phase):0;
  const bob=reducedMotion.matches?0:ghost?Math.sin(t/310)*2.5:walking?Math.abs(stride)*1.7:Math.sin(t/660)*.35;
  ctx.save();ctx.translate(p.x,p.y);ctx.scale(scale,scale);
  if(p.hidden)ctx.globalAlpha*=.35;
  if(ghost){
    ctx.globalAlpha=.27;
    circle(ctx,-10,13,7,'#88cddd');circle(ctx,-15,20,4,'#9fdce4');
    ctx.globalAlpha=.51;
  }else{
    ctx.fillStyle='#07101d6b';ctx.beginPath();ctx.ellipse(0,12,17,4.8,0,0,Math.PI*2);ctx.fill();
  }
  ctx.translate(0,-bob);
  if(direction==='left')ctx.scale(-1,1);
  if(side&&walking)ctx.transform(1,0,-.065,1,0,0);

  if(side){
    box(ctx,-19,-19,12,25,6,dark,ink,3);
    box(ctx,-16,-15,3,13,1,bright);
  }else if(front){
    box(ctx,-16,-17,9,22,4,dark,ink,2.6);
  }
  if(!ghost){
    for(const sideOfBody of [-1,1]){
      const x=sideOfBody===-1?-12:2;
      const forward=sideOfBody*stride;
      const lift=walking?Math.max(0,sideOfBody*Math.cos(phase))*4.2:0;
      const dx=side?forward*4.4:0, dy=(side?0:forward*3)-lift;
      ctx.save();
      ctx.translate(x+dx,1+dy);ctx.rotate(side?forward*.19:0);
      box(ctx,0,0,11,12,4,sideOfBody===1?color:dark,ink,2.8);
      box(ctx,2,8.1,7,2.3,1,deep);
      ctx.restore();
    }
  }

  const body=ctx.createLinearGradient(0,-36,0,11);
  body.addColorStop(0,bright);body.addColorStop(.57,color);body.addColorStop(1,dark);
  ctx.beginPath();
  ctx.moveTo(-14,-20);ctx.bezierCurveTo(-13,-31,-8,-35,1,-35);
  ctx.bezierCurveTo(11,-35,16,-29,16,-19);
  ctx.quadraticCurveTo(17,-10,15,-4);
  if(ghost){
    ctx.bezierCurveTo(12,9,3,13,-13,15);
    ctx.bezierCurveTo(-9,9,-13,4,-13,-5);
  }else{
    ctx.bezierCurveTo(14,3,10,5,4,5);ctx.lineTo(-6,5);ctx.quadraticCurveTo(-15,5,-14,-3);
  }
  ctx.closePath();
  ctx.fillStyle=body;ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=3.4;ctx.lineJoin='round';ctx.stroke();

  if(back){
    box(ctx,-8,-20,17,22,7,dark,ink,2.6);
    box(ctx,-6,-16,5,13,2,bright);
  }else{
    const offset=front?0:3;
    const glass=ctx.createLinearGradient(0,-29,0,-12);
    glass.addColorStop(0,'#c8f1e6');glass.addColorStop(.44,'#7dbfc8');glass.addColorStop(.48,'#5795aa');glass.addColorStop(1,'#2f526c');
    ctx.save();ctx.translate(offset,-23);ctx.rotate(side?-.11:0);
    box(ctx,-12,-7,27,16,7,glass,ink,3);
    box(ctx,-7,-4,12,2.7,1.35,'#eeeef2');
    circle(ctx,9,-2.8,1.1,'#edfaff');
    ctx.restore();
  }

  if(p.hat===1){box(ctx,-7,-42,14,7,3,'#e9ae55',ink,2);box(ctx,-4,-41,6,2,1,'#fff5ae');}
  if(p.hat===2){box(ctx,8,-44,2,10,1,'#b9c9ce',ink,1);circle(ctx,9,-45,3,'#78d9c7',ink);}
  if(p.hat===3){box(ctx,-13,-41,28,9,3,'#546482',ink,2);box(ctx,-2,-39,8,3,1,'#ebc96b');}
  ctx.restore();

  if(p.protected||p.name){
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(scale,scale);
    if(p.protected)circle(ctx,0,-9,24,'#84eece34','#9beed7',2);
    if(p.name)text(ctx,p.name,0,p.hat?-53:-46,scale===playerScale?14.5:11,'#fff','center');
    ctx.restore();
  }
}
const portraits=new Map();
export function suitPortrait(color,hat=0,alive=true){
  const key=[color,hat,alive].join(':');
  if(!portraits.has(key)){
    const canvas=document.createElement('canvas');canvas.width=72;canvas.height=90;
    astronaut(canvas.getContext('2d'),{x:36,y:65,color,hat,alive,direction:'right'},0,1.25);
    portraits.set(key,canvas.toDataURL());
  }
  return portraits.get(key);
}
const inks={line:'#1b1d21',shadow:'#282d34',steel:'#555c64',pale:'#858d91',bolt:'#30363b'};
const floors={
  table:['#929288','#a8a89a','tile'],helm:['#636b7c','#77808d','stripe'],dome:['#6c686d','#81818c','tile'],
  guns:['#817e72','#958b75','rib'],med:['#72828a','#849398','tile'],command:['#775e67','#8b7079','tile'],
  atmos:['#66786b','#7b8b74','rib'],engine:['#665d50','#7c7060','stripe'],screen:['#566755','#6f7968','tile'],
  cargo:['#626a68','#77827a','cargo'],power:['#696359','#7f7665','stripe'],shield:['#827e6c','#979483','rib'],
  core:['#65617b','#76718b','stripe'],dish:['#5d6f73','#73858a','rib'],shuttle:['#687079','#79818a','cargo']
};
function hull(r,extra=0){
  const a=r.x-r.w/2-extra,b=r.x+r.w/2+extra,c=r.y-r.h/2-extra,d=r.y+r.h/2+extra,k=(r.chamfer||14)+extra/2;
  return [[a+k,c],[b-k,c],[b,c+k],[b,d-k],[b-k,d],[a+k,d],[a,d-k],[a,c+k]];
}
function screws(ctx,points){for(const [x,y] of points){circle(ctx,x,y,2.15,'#b6b9ab','#3b3e40');box(ctx,x-1,y-.35,2,.7,.3,'#555b5b');}}
function wallRoom(ctx,r){
  const edge=hull(r), [base,alt,style]=floors[r.prop];
  polygon(ctx,hull(r,12),'#1c2a34','#0e1723',3);
  polygon(ctx,hull(r,7),'#485761','#25303b',2);
  polygon(ctx,hull(r,3),'#738087','#354650',2);
  polygon(ctx,edge,base,inks.line,2.8);
  ctx.save();ctx.clip();
  const left=r.x-r.w/2, right=r.x+r.w/2, top=r.y-r.h/2,bottom=r.y+r.h/2;
  const spacing=style==='cargo'?42:style==='rib'?19:25;
  for(let x=left,i=0;x<right;x+=spacing,i++){
    for(let y=top,j=0;y<bottom;y+=style==='rib'?42:spacing,j++){
      if((i+j)%2===0)box(ctx,x,y,spacing,style==='rib'?42:spacing,0,alt);
      if(style==='cargo'&&((i%2===0)||(j%2===0)))box(ctx,x,y,spacing,spacing,1,null,'#a7ad7660',1);
      if(style==='stripe')box(ctx,x+spacing-2,y,2,spacing,0,'#222b3330');
      if(style==='rib')box(ctx,x+2,y+4,1,34,0,'#1521283c');
    }
  }
  const shade=paint(ctx,0,top,0,bottom,'#18273563','#29364700','#101c303e');
  box(ctx,left,top,r.w,r.h,0,shade);
  box(ctx,left,top,r.w,15,1,'#43525b',inks.line,2);
  for(let x=left+10;x<right;x+=36){
    box(ctx,x,top+3,27,8,2,'#809397',inks.shadow,1.3);
    screws(ctx,[[x+4,top+7],[x+22,top+7]]);
  }
  box(ctx,left,bottom-6,r.w,6,0,'#30343a');
  ctx.restore();
}
function consoleBox(ctx,x,y,w,h,accent='#a7d5ae'){
  box(ctx,x+2,y+4,w,h,4,'#11243370');
  box(ctx,x,y,w,h,4,paint(ctx,x,y,x,y+h,'#83979a','#475960'),inks.line,2.4);
  box(ctx,x+5,y+4,w-10,h*.49,3,'#162e3d',inks.line,1.7);
  for(let i=0;i<3;i++)box(ctx,x+8,y+7+i*3,(w-16)*(1-i*.2),1.1,1,accent);
  box(ctx,x+6,y+h-13,w-12,2,1,'#3e4e52');
  for(let i=0;i<3;i++)circle(ctx,x+8+i*7,y+h-6,1.5,i===0?'#e9c268':'#383d3e');
}
function crate(ctx,r){
  const {x,y,w,h}=r,left=x-w/2,top=y-h/2;
  box(ctx,left+3,top+7,w,h,4,'#262d27a6');
  polygon(ctx,[[left,top+10],[left+9,top],[left+w-5,top],[left+w,top+7],[left+w,top+h-6],[left+w-10,top+h],[left,top+h-3]],
    paint(ctx,left,top,left+w,top+h,'#4e7a70','#27464c'),'#17282f',2.8);
  polygon(ctx,[[left+2,top+10],[left+10,top+2],[left+w-7,top+2],[left+w-3,top+7],[left+w-11,top+14],[left+3,top+14]],
    '#7c9f8a','#3e6254',1.5);
  for(const a of [left+5,left+w-12])box(ctx,a,top+15,5,h-20,1,'#2b514e');
  box(ctx,left+w*.35,top+17,w*.28,4,1,'#c7a96c','#55463b');
  box(ctx,left+w*.30,top+h-9,w*.41,2,1,'#a2bc9a');
  screws(ctx,[[left+7,top+11],[left+w-11,top+10]]);
}
function seat(ctx,{x,y,w,h}){
  const a=x-w/2,b=y-h/2;
  box(ctx,a+3,b+5,w,h,7,'#0c182489');
  box(ctx,a+3,b+1,w-6,h+1,6,'#263543','#141e29',2);
  polygon(ctx,[[a+3,b+3],[a+w*.28,b],[a+w*.72,b],[a+w-3,b+3],[a+w-5,b+h*.54],[a+5,b+h*.54]],'#5e869c','#182b3b',2);
  box(ctx,a+8,b+5,w-16,h*.37,4,'#85acb4');
  box(ctx,a+3,b+h*.56,w-6,h*.34,4,'#45677d','#152b3b',2);
  box(ctx,a+8,b+h*.62,w-16,h*.09,2,'#638d9d');
  for(const dx of [0,w-4])box(ctx,a+dx,b+h*.43,4,h*.32,2,'#799197','#243743',1);
}
function roomProp(ctx,r){
  const {x,y,prop}=r;
  ctx.save();ctx.translate(x,y);
  const plate=(x,y,w,h,c='#718184')=>box(ctx,x,y,w,h,6,c,inks.line,2.5);
  if(prop==='table'){
    for(const [a,b,rad] of [[0,-8,58],[-100,49,43],[96,-51,43],[-95,-51,42],[101,49,44]]){
      ctx.save();ctx.translate(a,b);ctx.scale(1,.78);
      circle(ctx,4,13,rad+2,'#25353f64');
      for(const angle of [.22,2.32,4.41]){
        ctx.beginPath();ctx.arc(0,0,rad+6,angle,angle+1.12);ctx.lineWidth=12;ctx.strokeStyle='#243740';ctx.stroke();
        ctx.lineWidth=8;ctx.strokeStyle='#62919c';ctx.stroke();
      }
      circle(ctx,0,3,rad-4,'#28485a','#172b39',3);
      circle(ctx,0,-2,rad-5,paint(ctx,0,-rad,0,rad,'#70a1a6','#426e83'),'#294e60',2);
      ctx.beginPath();ctx.arc(0,-2,rad-12,3.55,5.48);ctx.strokeStyle='#a8d1c0a8';ctx.lineWidth=2;ctx.stroke();
      ctx.restore();
      if(a===0){
        box(ctx,-14,-20,28,23,4,'#d0aa62','#27323d',2);
        box(ctx,-10,-17,20,16,3,'#344653');
        circle(ctx,0,-9,6,'#ed785e','#6f393b',1.5);
        box(ctx,-4,-13,6,2,1,'#ffb982');
      }else{
        box(ctx,a-10,b-5,13,8,2,'#d9bf84','#293b3c',1.4);
        box(ctx,a+7,b+4,7,5,1,'#a5cab9','#2b4047',1);
      }
    }
  }else if(prop==='helm'){
    polygon(ctx,[[-51,-25],[-32,-42],[37,-42],[58,-24],[52,-8],[31,-18],[-29,-18],[-47,-7]],'#506c7f','#283a4b',2.5);
    for(let i=0;i<5;i++){
      const x=-33+i*16;
      box(ctx,x,-36,12,12,2,'#253749','#203244',1);
      box(ctx,x+2,-33,7,i%2===0?3:6,1,'#95d2da');
    }
    seat(ctx,{x:5,y:7,w:26,h:28});
    box(ctx,-50,34,96,10,3,'#3d5366','#293b4d',2);
    for(let i=0;i<5;i++)box(ctx,-42+i*17,37,10,3,1,'#93a9a5');
  }else if(prop==='command'){
    for(const x of [-58,-18,22])consoleBox(ctx,x,-36,34,29,'#b6e5c5');
    polygon(ctx,[[-38,1],[36,1],[47,14],[36,35],[-37,35],[-47,21]],'#485458','#2d3d47',3);
    box(ctx,-32,6,64,23,6,'#305e5b','#193a43',2);
    for(const [x,y,w,h] of [[-27,11,15,9],[-9,9,22,6],[-5,17,18,7],[16,12,11,10]])box(ctx,x,y,w,h,1,null,'#9cd5ac',1);
    for(const x of [-43,37])box(ctx,x,14,5,7,1,'#e3b87c');
  }else if(prop==='screen'){
    polygon(ctx,[[-55,-30],[-37,-42],[38,-42],[57,-30],[52,-4],[42,5],[-42,5],[-52,-4]],'#486372','#263b4b',3);
    for(const x of [-43,-12,19])consoleBox(ctx,x,-32,25,29,'#a3d4ec');
    seat(ctx,{x:0,y:23,w:27,h:29});
    box(ctx,-45,33,18,7,2,'#708986','#334c56',1.4);
  }else if(prop==='core'){
    const coreLight=ctx.createRadialGradient(-13,-6,8,-13,-6,58);
    coreLight.addColorStop(0,'#88ebea7a');coreLight.addColorStop(1,'#8fd9ed00');
    circle(ctx,-13,-6,58,coreLight);
    polygon(ctx,[[-52,22],[-52,-26],[-33,-49],[9,-49],[32,-27],[32,24],[10,43],[-29,43]],'#435464','#233549',3);
    box(ctx,-45,-38,70,63,16,'#66758b','#28344f',3);
    for(let i=0;i<3;i++){
      const x=-36+i*20;
      box(ctx,x,-32,13,45,6,paint(ctx,x,-32,x+13,-32,'#4b87a5','#d3f9ee','#5eacd1'),'#213b57',2);
      box(ctx,x+3,-27,2,30,1,'#ecfff3');
    }
    box(ctx,-41,10,62,12,4,'#52617a','#334353',2);
    for(const y of [-29,27])box(ctx,27,y,25,4,2,'#80bccf','#334b64',1.4);
    consoleBox(ctx,35,-10,22,27,'#9fe2ce');
  }else if(prop==='atmos'){
    plate(-51,-25,102,35,'#4a6c6a');
    for(const x of [-35,0,35]){
      box(ctx,x-11,-32,22,54,9,paint(ctx,x-11,0,x+11,0,'#44696c','#96c4a9','#648f80'),'#304f54',2);
      box(ctx,x-10,-22,20,6,1,'#546e60','#31525a',1.1);
      box(ctx,x-9,10,18,5,2,'#c5bc8a');
    }
    consoleBox(ctx,-26,21,53,24,'#b8e7a9');
  }else if(prop==='power'){
    plate(-82,-63,164,26,'#555853');
    for(const [i,offset] of [-76,-50,-24,2,28,54].entries()){
      box(ctx,offset,-60,22,19,2,i===3?'#878660':'#6c7471','#292e30',1.2);
      box(ctx,offset+3,-55,16,6,1,i%2===0?'#b1a474':'#93a796');
      screws(ctx,[[offset+4,-44],[offset+18,-44]]);
    }
    for(let i=-1;i<=1;i++){
      const x=i*43;
      plate(x-13,-24,26,44,'#596369');
      for(let j=0;j<3;j++){
        box(ctx,x-8,-17+j*9,16,6,2,'#333f48');
        circle(ctx,x+4,-14+j*9,1.6,j===i+1?'#a8e6bb':'#d9ae75');
      }
    }
    for(let i=0;i<4;i++){
      ctx.beginPath();ctx.moveTo(-50+i*35,21);ctx.bezierCurveTo(-45+i*25,39,18-i*20,43,13+i*15,51);
      ctx.lineWidth=4;ctx.strokeStyle='#333944';ctx.stroke();ctx.lineWidth=2;
      ctx.strokeStyle=['#d28d6c','#829bbd','#dec37d','#96bfaa'][i];ctx.stroke();
    }
  }else if(prop==='engine'||prop==='guns'){
    if(prop==='guns'){
      circle(ctx,2,2,38,'#3f5259','#263542',3);
      circle(ctx,2,0,30,'#82948c','#3a5055',2);
      ctx.save();ctx.rotate(-.4);
      box(ctx,-20,-11,63,22,7,paint(ctx,0,-11,0,11,'#9baead','#536976'),'#2b414e',2.5);
      for(const y of [-13,6])box(ctx,24,y,29,7,2,'#657b88','#273744',2);
      box(ctx,-18,-7,18,14,4,'#546a77');
      box(ctx,-12,-5,8,2,1,'#e9b575');
      ctx.restore();
    }else{
      box(ctx,-57,-25,104,64,12,'#302f36','#29242b',3);
      box(ctx,-50,-31,91,62,18,paint(ctx,0,-29,0,29,'#a89883','#9d7059','#5f4c4e'),'#3a3035',3);
      for(let i=0;i<6;i++)box(ctx,-43+i*10,-26,5,51,2,'#584f55','#3c3540',1);
      box(ctx,17,-27,31,54,10,'#74838b','#343d45',2);
      for(let i=0;i<3;i++)box(ctx,24,-16+i*13,19,5,2,'#9be3e5','#385569',1.3);
      for(const y of [-36,34])box(ctx,-50,y,76,3,1,'#d6a464');
    }
  }else if(prop==='med'){
    for(const a of [-49,19]){
      plate(a,-20,30,42,'#d4d3be');box(ctx,a+4,-15,22,28,4,'#738fa3','#344357',1.4);
      box(ctx,a+7,-14,16,8,2,'#b9c9cb');
    }
    circle(ctx,0,12,19,'#3b5b66','#2e4951',2);
    circle(ctx,0,11,14,'#88b2a4','#2f726e',2);
    box(ctx,-2,5,4,12,1,'#dbf3d9');box(ctx,-6,9,12,4,1,'#dbf3d9');
  }else if(prop==='cargo'){
    for(const [a,b,w,h] of [[-40,-6,38,29],[-16,14,33,29],[29,-10,41,35]])crate(ctx,{x:a,y:b,w,h});
  }else if(prop==='shield'){
    circle(ctx,0,2,41,'#394955','#2c303d',3);
    circle(ctx,0,0,35,'#647e87','#43646a',2);
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3;circle(ctx,Math.sin(a)*23,Math.cos(a)*23,9,'#828eac','#343c58',2);
      circle(ctx,Math.sin(a)*23,Math.cos(a)*23,4,'#b4bbd1');
    }
    circle(ctx,0,0,7,'#e0caa1',inks.line,1.5);
  }else if(prop==='dish'){
    consoleBox(ctx,-61,-26,30,47,'#f2c789');
    consoleBox(ctx,30,-27,30,49,'#9cd9c9');
    box(ctx,-26,9,52,13,4,'#384a59','#293943',2);
    ctx.save();ctx.rotate(-.36);
    ctx.beginPath();ctx.ellipse(0,-10,27,17,0,0,Math.PI*2);
    ctx.fillStyle=paint(ctx,0,-27,0,7,'#abc5bd','#547f88');ctx.fill();
    ctx.lineWidth=2.5;ctx.strokeStyle='#273c4b';ctx.stroke();
    box(ctx,-2,-32,4,25,2,'#405c6b');circle(ctx,0,-32,4,'#ffd89e','#283a49',1.5);
    ctx.restore();
  }else{
    circle(ctx,0,0,28,'#67798a','#293849',3);
    circle(ctx,0,-3,20,'#333f5d','#a1a5ad',1.6);
    for(let i=0;i<6;i++)circle(ctx,Math.sin(i*16)*15,Math.cos(i*17)*14-3,1.2,'#d7dce4');
  }
  ctx.restore();
}
function passage(ctx,c){
  const {x,y,w,h,horizontal}=c;
  ctx.save();ctx.translate(x,y);if(!horizontal)ctx.rotate(Math.PI/2);
  const length=horizontal?w:h, a=-length/2, b=-corridorWidth/2;
  box(ctx,a-8,b-9,length+16,corridorWidth+18,3,'#1d2d38','#101b28',2);
  box(ctx,a-3,b-5,length+6,corridorWidth+10,2,'#627986','#293e4b',2);
  box(ctx,a,b,length,corridorWidth,0,paint(ctx,0,b,0,-b,'#435e69','#70878b','#476470'));
  for(let i=a+14;i<a+length-7;i+=19){
    box(ctx,i,b+6,1,corridorWidth-12,0,'#354e5b');
    box(ctx,i+1,b+6,2,corridorWidth-12,0,'#a3bab12b');
  }
  for(const y of [b+3,-b-7]){
    box(ctx,a,y,length,4,1,'#3e5258');
    for(let i=a+13;i<a+length-11;i+=41){
      box(ctx,i,y+1,8,2,1,'#a0c5b6');
      box(ctx,i+8,y+1,3,2,1,'#e7b97b');
    }
  }
  ctx.restore();
}
function gate(ctx,g,shutter=false){
  const half=corridorWidth/2;
  ctx.save();ctx.translate(g.x,g.y);if(!g.horizontal)ctx.rotate(Math.PI/2);
  box(ctx,-13,-half,26,corridorWidth,1,'#536b73','#304452',2);
  for(const x of [-10,-6,5,9])box(ctx,x,-half+4,1,corridorWidth-8,0,'#a9b2a86d');
  for(const side of [-1,1]){
    ctx.save();ctx.scale(1,side);
    polygon(ctx,[[-16,half-5],[-10,half-10],[10,half-10],[16,half-5],[16,half+10],[-16,half+10]],
      '#314654','#1b2935',2);
    box(ctx,-11,half-3,22,6,2,'#738e98','#243744',1);
    box(ctx,-6,half-6,12,2,1,shutter?'#f3c37c':'#9ed8c7');
    screws(ctx,[[-10,half+5],[10,half+5]]);
    ctx.restore();
  }
  ctx.restore();
}
function shutterLeaves(ctx,d,fraction){
  if(fraction<=0)return;
  const half=corridorWidth/2;
  ctx.save();ctx.translate(d.x,d.y);if(!d.horizontal)ctx.rotate(Math.PI/2);
  ctx.beginPath();ctx.rect(-10,-half+3,20,corridorWidth-6);ctx.clip();
  for(const side of [-1,1]){
    ctx.save();ctx.scale(1,side);
    ctx.translate(0,half*(1-fraction));
    polygon(ctx,[[-8,half],[8,half],[8,6],[4,0],[-5,0],[-8,5]],
      paint(ctx,-8,0,8,0,'#536473','#768d94','#354956'),'#243341',2);
    box(ctx,-5,5,10,3,1,'#e98973');
    for(let y=13;y<half;y+=8)box(ctx,-5,y,10,2,1,'#354551');
    ctx.restore();
  }
  ctx.restore();
}
function buildScene(inLobby){
  const cache=document.createElement('canvas');cache.width=inLobby?900:1365;cache.height=inLobby?610:900;
  const ctx=cache.getContext('2d');
  if(inLobby){
    // Full shuttle exterior, with the cabin cut away above a broad cargo floor.
    for(const side of [-1,1]){
      ctx.save();ctx.translate(450,0);ctx.scale(side,1);
      polygon(ctx,[[206,185],[284,210],[365,355],[345,420],[238,384]],'#394f5d','#121b29',5);
      polygon(ctx,[[269,318],[351,299],[377,328],[385,497],[352,546],[277,540],[248,507]],'#303b45','#101419',5);
      polygon(ctx,[[271,326],[346,310],[363,337],[369,446],[260,436]],paint(ctx,273,320,364,442,'#6d8594','#3c5564','#263747'),'#202831',3);
      polygon(ctx,[[262,445],[370,455],[371,496],[347,529],[280,521],[262,501]],'#263744','#151e25',3);
      for(const a of [287,337]){
        box(ctx,a-15,463,28,43,7,'#5e7f8f','#18272e',3);
        box(ctx,a-8,475,14,22,5,'#8de2e9','#2e5262',2);
        box(ctx,a-5,478,8,16,3,'#d2faf1');
      }
      box(ctx,287,344,44,5,2,'#82949c');
      box(ctx,282,376,60,32,4,'#46545f','#303941',2);
      screws(ctx,[[278,344],[351,353],[284,416],[354,420]]);
      ctx.restore();
    }
    const shell=[[254,105],[347,34],[530,34],[646,91],[718,157],[731,438],[695,511],[630,576],[269,576],[205,517],[169,451],[175,162]];
    polygon(ctx,shell,paint(ctx,0,35,0,576,'#627784','#354d5d','#1e2d3b'),'#111b25',6);
    polygon(ctx,[[258,114],[355,49],[523,49],[635,102],[703,166],[712,435],[679,502],[621,561],[276,561],[219,507],[187,449],[190,172]],
      paint(ctx,183,85,700,538,'#738d99','#496474','#314451'),'#253848',3);
    polygon(ctx,[[365,53],[513,53],[550,86],[338,86]],'#173543','#14242f',4);
    polygon(ctx,[[371,58],[410,58],[391,81],[351,81]],'#315d6d');
    polygon(ctx,[[427,58],[491,58],[475,81],[406,81]],'#3d7785');
    box(ctx,502,69,15,2,1,'#97e5ce');
    const r=lobby[0];
    polygon(ctx,hull(r,8),'#182831','#12212b',4);
    polygon(ctx,hull(r),paint(ctx,0,100,0,527,'#526572','#697b81','#52666b'),inks.line,3);
    ctx.save();ctx.clip();
    box(ctx,186,270,530,255,0,paint(ctx,0,270,0,525,'#768b90','#56686e','#425761'));
    for(let i=0;i<9;i++)for(let j=0;j<5;j++){
      const x=193+i*60,y=319+j*45;
      box(ctx,x+1,y+1,58,43,1,(i+j)%2?'#596c73':'#62777b','#394d57',1.5);
      box(ctx,x+5,y+3,49,2,1,'#b5c2ad33');
      screws(ctx,[[x+6,y+8],[x+54,y+36]]);
    }
    polygon(ctx,[[187,91],[709,91],[711,243],[591,188],[532,168],[369,168],[305,191],[186,252]],
      paint(ctx,0,91,0,247,'#304658','#566d7a','#293947'),'#172633',3);
    for(const side of [-1,1]){
      ctx.save();ctx.translate(450,0);ctx.scale(side,1);
      polygon(ctx,[[74,111],[190,135],[258,175],[258,226],[74,164]],'#4a6170','#243746',3);
      polygon(ctx,[[83,118],[197,148],[249,184],[249,195],[84,150]],'#72939c','#263c47',2);
      for(let i=0;i<4;i++){
        const x=99+i*37,y=121+i*13;
        polygon(ctx,[[x,y],[x+4,y+1],[x+4,y+45],[x,y+44]],'#263a47');
      }
      polygon(ctx,[[80,171],[183,202],[257,239],[257,247],[82,190]],'#243843','#17272f',2);
      polygon(ctx,[[89,174],[177,202],[177,207],[89,179]],'#96d4cf');
      polygon(ctx,[[179,215],[226,238],[226,241],[179,220]],'#ecb875');
      ctx.restore();
    }
    polygon(ctx,[[193,247],[362,170],[391,170],[389,315],[193,315]],'#546974','#354953',2);
    polygon(ctx,[[708,247],[538,170],[509,170],[510,315],[708,315]],'#546974','#354953',2);
    for(const x of [204,521])for(let i=0;i<5;i++){
      box(ctx,x,264+i*10,177,3,1,'#3e4a51');
      for(let j=0;j<17;j++)box(ctx,x+4+j*10,260+i*10,3,8,1,'#464f54');
    }
    polygon(ctx,[[396,172],[504,172],[527,317],[374,317]],paint(ctx,0,172,0,317,'#536a74','#799397'),'#3e5963',3);
    for(let y=200;y<310;y+=25){box(ctx,399,y,102,1,0,'#435963');box(ctx,418,y+4,64,2,1,'#b7c9bf40');}
    box(ctx,187,311,527,8,1,'#364b57');box(ctx,194,316,514,2,1,'#7c9d9d');
    for(const x of [203,688])for(let i=0;i<4;i++)polygon(ctx,[[x+i*4,358],[x+i*4+2,356],[x+i*4+2,462],[x+i*4,464]],'#dca95b91');
    ctx.restore();
    polygon(ctx,[[405,123],[424,107],[476,107],[495,123],[495,181],[405,181]],'#30393e','#202529',3);
    box(ctx,409,116,82,64,10,'#243b49','#142630',3);
    box(ctx,413,121,74,54,9,'#8b9fa5','#222b33',2);
    polygon(ctx,[[419,128],[443,130],[449,143],[445,168],[419,169]],'#525d68','#484f57');
    polygon(ctx,[[481,128],[457,130],[451,143],[455,168],[481,169]],'#525d68','#484f57');
    box(ctx,446,135,8,23,2,'#96dfc3','#313c42',2);
    for(const x of [407,486])box(ctx,x,132,7,32,3,'#344b57','#192b36',2);
    for(const q of lobbySeats){
      ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.angle);seat(ctx,{...q,x:0,y:0});ctx.restore();
    }
    for(const q of lobbyCrates){
      crate(ctx,q);
      if(!q.laptop)continue;
      const {x,y}=q;
      polygon(ctx,[[x-17,y-13],[x-22,y-32],[x+8,y-35],[x+13,y-15]],'#9ea398','#1c2326',2.5);
      polygon(ctx,[[x-14,y-17],[x-17,y-29],[x+4,y-31],[x+8,y-18]],'#82dbc0','#405645',1.3);
      for(let i=0;i<3;i++)box(ctx,x-12,y-27+i*3,10+i*2,1,0,'#316f61');
      polygon(ctx,[[x-17,y-13],[x+13,y-16],[x+20,y-8],[x-10,y-5]],'#a4a7a1','#242a2a',2);
      box(ctx,x-8,y-12,16,3,1,'#545b5b');
    }
    polygon(ctx,[[347,518],[553,518],[565,529],[558,561],[342,561],[335,529]],'#1b2c38','#17232e',4);
    for(let y=529;y<560;y+=5)box(ctx,345,y,210,2,0,'#6d8290');
    box(ctx,350,521,200,3,1,'#dfb372');
    screws(ctx,[[341,531],[558,531],[348,554],[551,554]]);
    return cache;
  }
  for(const c of corridors)passage(ctx,c);
  for(const r of rooms)wallRoom(ctx,r);
  for(const entry of entrances)gate(ctx,entry);
  for(const d of doors)gate(ctx,d,true);
  for(const r of rooms){
    roomProp(ctx,r);
    const caption=r.name.toUpperCase();
    box(ctx,r.x-(caption.length*3+5),r.y+r.h/2-22,caption.length*6+10,16,3,'#233845a8');
    text(ctx,caption,r.x,r.y+r.h/2-11,9,'#d7e7df','center');
  }
  for(const v of vents){
    box(ctx,v.x-15,v.y-8,30,16,4,'#828d93','#262e36',2);
    for(let i=0;i<4;i++)box(ctx,v.x-10+i*6,v.y-5,2,10,1,'#454d54');
  }
  const drawnStations=new Set();
  for(const task of tasks)for(const s of task.stops){
    const key=s.x+','+s.y;
    if(task.instrument==='clean'||drawnStations.has(key))continue;
    drawnStations.add(key);
    box(ctx,s.x-9,s.y-7,18,15,3,'#3b5461','#233540',1.8);
    const signal=['calibrate','reactor','sequence'].includes(task.instrument)?'#b4acd7':task.instrument==='wire'?'#eac075':'#a9bd9c';
    box(ctx,s.x-5,s.y-4,10,4,1,signal);circle(ctx,s.x-5,s.y+3,1.4,'#e7d391');
  }
  return cache;
}
const stars=Array.from({length:142},(_,i)=>[(i*137.825)%1,(i*273.901)%1,i%7]);
function orbit(ctx,w,h,t){
  const x=w*.5,y=h*1.63,r=h*.9;
  const glow=ctx.createRadialGradient(x,y,r*.85,x,y,r*1.1);
  glow.addColorStop(0,'#477c9a00');glow.addColorStop(.62,'#62c7c559');glow.addColorStop(1,'#06152200');
  ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  circle(ctx,x,y,r,paint(ctx,0,y-r,0,h,'#304e68','#132737','#101c30'),'#73b8b3',2);
  ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.clip();
  for(let i=0;i<9;i++){
    const shift=reducedMotion.matches?0:Math.sin(t/31000+i)*12;
    ctx.beginPath();ctx.moveTo(x-r,y-r*.86+i*9);
    ctx.bezierCurveTo(x-r*.4,y-r*(.76-i*.01),x+r*.05,y-r*(.94-i*.022)+shift,x+r,y-r*.73+i*14);
    ctx.strokeStyle=i%3===0?'#7bbbb837':'#102847a0';ctx.lineWidth=3+i*1.7;ctx.stroke();
  }
  ctx.restore();
}
const stride=4, columns=342, rows=226;
const mask=Uint8Array.from({length:columns*rows},(_,i)=>terrain.some(q=>contains(q,(i%columns)*stride,Math.floor(i/columns)*stride))?1:0);
const rays=Array.from({length:112},(_,i)=>[Math.cos(i*Math.PI*2/112),Math.sin(i*Math.PI*2/112)]);
function sight(s){
  const {x,y,alive}=s.self, shut=s.doors.map(i=>doors[i]);
  return rays.map(([dx,dy])=>{
    let d=0;
    for(;d<s.vision;d+=5){
      const px=x+dx*d,py=y+dy*d;
      const sx=Math.round(px/stride),sy=Math.round(py/stride);
      if(alive&&(sx<0||sx>=columns||sy<0||sy>=rows||!mask[sy*columns+sx]||shut.some(q=>contains(q,px,py))))break;
    }
    return [x+dx*(d+6),y+dy*(d+6)];
  });
}
export function renderer(canvas){
  const ctx=canvas.getContext('2d'), scenes=[deckArtwork(),buildScene(true)], tracks=new Map();
  const gateProgress=new Float32Array(doors.length);
  let phase='',visibleKey='',visibility=null,lastFrame=0,fogKey='',fog;
  return (s,t,predicted)=>{
    const elapsed=Math.min(50,t-lastFrame);
    lastFrame=t;
    const w=innerWidth,h=innerHeight,dpr=Math.min(1.75,devicePixelRatio||1);
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=s?.phase==='play'?'#0c0e13':'#050608';ctx.fillRect(0,0,w,h);
    const inLobby=['lobby','countdown'].includes(s?.phase);
    for(const [x,y,size] of stars){
      ctx.globalAlpha=.35+Math.sin(t/1700+x*38)*.19;
      circle(ctx,x*w,y*h,size===0?1.35:.65,size===0?'#c2d0d6':'#84949c');
    }
    ctx.globalAlpha=1;
    if(!s){
      orbit(ctx,w,h,t);
      const drifting=[[.12,.33,'coral',-.57,1.25],[.83,.23,'sky',.58,.9],[.84,.69,'gold',.51,1.55],[.2,.73,'iris',-.68,1.9],[.93,.46,'teal',.77,.76]];
      const driftTime=reducedMotion.matches?0:t;
      for(const [i,[x,y,color,tilt,size]] of drifting.entries()){
        ctx.save();ctx.translate(x*w+Math.sin(driftTime/2100+i)*17,y*h+Math.cos(driftTime/2400+i)*18);
        ctx.rotate(tilt+Math.sin(driftTime/3200+i)*.15);
        astronaut(ctx,{x:0,y:0,color,hat:i===1?2:0,alive:true,facing:i%2?-1:1},driftTime,size*Math.min(1.8,Math.max(.64,w/940)));
        ctx.restore();
      }
      return;
    }
    const zoom=inLobby?Math.max(.22,Math.min((w-22)/810,(h-150)/605,1.18)):Math.min(Math.max(w/1000,.79),1.43);
    const camera=inLobby?{x:450,y:309}:predicted||s.self;
    if(phase!==s.phase){
      tracks.clear();phase=s.phase;
      for(const d of doors)gateProgress[d.id]=Number(s.doors.includes(d.id));
    }
    const center={x:w/2,y:inLobby?h/2-36:h/2};
    ctx.save();ctx.translate(center.x,center.y);ctx.scale(zoom,zoom);ctx.translate(-camera.x,-camera.y);
    ctx.drawImage(scenes[inLobby?1:0],0,0);
    if(!inLobby){
      for(const d of doors){
        const target=Number(s.doors.includes(d.id)),current=gateProgress[d.id];
        const delta=Math.min(Math.abs(current-target),elapsed/180);
        gateProgress[d.id]=reducedMotion.matches?target:current+Math.sign(target-current)*delta;
        shutterLeaves(ctx,d,gateProgress[d.id]);
      }
      if(s.sabotage?.kind!=='comms')for(const a of s.self.assignments){
        if(a.done)continue;const q=tasks.find(v=>v.id===a.id).stops[a.stage];
        circle(ctx,q.x,q.y,7+Math.sin(t/230)*1.6,'#ffdc6575','#392e1d',1.3);
      }
      if(s.sabotage)for(const [i,q] of repairs[s.sabotage.kind].entries()){
        const fixed=s.sabotage.fixed.some(v=>v.index===i);
        circle(ctx,q.x,q.y,8+Math.sin(t/130)*1.7,fixed?'#89c798':'#e77769','#463335',1.5);
      }
      for(const b of s.bodies){
        ctx.save();ctx.globalAlpha=1-(b.decay||0)*.19;
        box(ctx,b.x-16+(b.decay||0)*3,b.y-7,32-(b.decay||0)*6,15,7,colors[b.color],'#292a2b',2.5);
        box(ctx,b.x+4,b.y-6,10,8,4,'#8ab2bb','#28384a',1.4);ctx.restore();
      }
      for(const a of s.alerts)circle(ctx,a.x,a.y,16+Math.sin(t/100)*3,'#e67e6470','#e5a796',2);
      for(const e of s.taskEffects){
        if(e.kind==='shield'){
          for(let i=0;i<6;i++)circle(ctx,e.x+Math.sin(i*Math.PI/3)*23,e.y+Math.cos(i*Math.PI/3)*23,4,'#e9f1b7','#627453',1.3);
        }else if(e.kind==='target'){
          const travel=Math.min(46,Math.max(0,(520-e.until+s.now)*.1));
          polygon(ctx,[[e.x+travel,e.y-10],[e.x+travel+20,e.y-7],[e.x+travel,e.y+3]],'#d8f7bb','#97b98e',1.5);
        }else{
          const fall=Math.min(27,Math.max(0,(1300-e.until+s.now)*.022));
          for(const [i,dx] of [-10,0,12].entries())circle(ctx,e.x+dx,e.y+fall+i*4,4,'#dcb775','#544638',1);
        }
      }
      if(s.tactical.track)circle(ctx,s.tactical.track.x,s.tactical.track.y,12,'#acd59b90','#38593b',2);
    }
    const positions=s.positions.map(p=>predicted&&p.id===s.self.id?{...p,x:predicted.x,y:predicted.y,moving:predicted.moving,direction:predicted.direction,facing:predicted.facing}:p);
    const mix=1-Math.exp(-elapsed/45);
    for(const p of positions.sort((a,b)=>a.y-b.y)){
      if(p.id===s.self.id){
        if(p.scanning)circle(ctx,p.x,p.y,16+Math.sin(t/95)*3,'#9ff1b268','#b7fbbf',2);
        astronaut(ctx,p,t,playerScale);
        continue;
      }
      let q=tracks.get(p.id);
      if(!q||Math.hypot(p.x-q.x,p.y-q.y)>155){q={x:p.x,y:p.y,seenAt:t};tracks.set(p.id,q);}
      q.x+=(p.x-q.x)*mix;q.y+=(p.y-q.y)*mix;
      const arrival=s.phase==='play'?Math.min(1,(t-q.seenAt)/170):1;
      ctx.save();ctx.globalAlpha=arrival;
      if(p.scanning)circle(ctx,q.x,q.y,16+Math.sin(t/95)*3,'#9ff1b268','#b7fbbf',2);
      astronaut(ctx,{...p,x:q.x,y:q.y-(1-arrival)*5},t,playerScale);
      ctx.restore();
    }
    if(!inLobby&&s.phase==='play'){
      const key=[s.self.x,s.self.y,s.self.alive,s.vision,s.doors.join(',')].join('/');
      if(key!==visibleKey){
        const points=sight(s);
        visibility=new Path2D();
        visibility.rect(-4000,-4000,9365,8900);
        visibility.moveTo(...points[0]);for(const v of points.slice(1))visibility.lineTo(...v);visibility.closePath();
        visibleKey=key;
      }
      ctx.fillStyle='#0a1422ac';ctx.fill(visibility,'evenodd');
    }
    ctx.restore();
    if(!inLobby&&s.phase==='play'){
      const radius=Math.max(44,s.vision*zoom);
      const key=[w,h,dpr,radius].join('/');
      if(key!==fogKey){
        fog=ctx.createRadialGradient(center.x,center.y,radius*.44,center.x,center.y,radius*1.25);
        fog.addColorStop(0,'#0c1c2a00');fog.addColorStop(1,'#0b162c9c');
        fogKey=key;
      }
      ctx.fillStyle=fog;ctx.fillRect(0,0,w,h);
    }
  };
}
export function drawMap(canvas,s,sabotage=false){
  const ctx=canvas.getContext('2d');
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.scale(canvas.width/1365,canvas.height/900);
  const border=sabotage?'#fac1b1':'#b1e7ec';
  for(const c of corridors)box(ctx,c.x-c.w/2-2,c.y-c.h/2-2,c.w+4,c.h+4,0,border);
  for(const r of rooms)polygon(ctx,hull(r,2),border);
  for(const c of corridors)box(ctx,c.x-c.w/2,c.y-c.h/2,c.w,c.h,0,sabotage?'#9b566a':'#3d758f');
  for(const r of rooms){
    const station=Object.values(repairs).flat().some(q=>q.room===r.id);
    polygon(ctx,hull(r),sabotage?(station?'#803849':'#60384f'):r.id==='cafe'||r.id==='storage'?'#275c79':'#28526f');
    text(ctx,r.name,r.x,r.y+7,19,'#f5f8ff','center');
  }
  if(sabotage){
    ctx.setLineDash([6,6]);
    for(const [a,b] of ventConnections){
      ctx.beginPath();ctx.moveTo(vents[a].x,vents[a].y);ctx.lineTo(vents[b].x,vents[b].y);ctx.strokeStyle='#ffd29b';ctx.lineWidth=2;ctx.stroke();
    }
    ctx.setLineDash([]);
    for(const v of vents)box(ctx,v.x-7,v.y-4,14,8,2,'#f0b77d','#3d2b36',2);
    for(const q of doors)box(ctx,q.x-5,q.y-5,10,10,2,s.doors.includes(q.id)?'#ffdf98':'#d7959e','#603d52',1);
    for(const [kind,points] of Object.entries(repairs))for(const q of points){
      circle(ctx,q.x,q.y,11,s.sabotage?.kind===kind?'#fff0a7':'#ef9c9b','#4f2d3b',2);
      text(ctx,kind[0].toUpperCase(),q.x,q.y+4,11,'#fff8e9','center');
    }
  }else{
    for(const id of s.doors){
      const d=doors[id];
      box(ctx,d.x-d.w/2,d.y-d.h/2,d.w,d.h,2,'#891d46','#ffb7b0',2);
    }
    circle(ctx,meetingPoint.x,meetingPoint.y+28,9,'#bc798a','#fff4e7',2);
    if(s.sabotage?.kind!=='comms')for(const a of s.self.assignments)if(!a.done){
      const q=tasks.find(task=>task.id===a.id).stops[a.stage];
      circle(ctx,q.x,q.y,9,'#f3cf62','#423827',2);text(ctx,'!',q.x,q.y+4,11,'#fff0b4','center');
    }
    if(s.sabotage)for(const q of repairs[s.sabotage.kind])circle(ctx,q.x,q.y,12,'#e47770','#4f2d2b',2);
  }
  if(s.tactical.track)circle(ctx,s.tactical.track.x,s.tactical.track.y,12,'#b593cc','#4b365c',2);
  circle(ctx,s.self.x,s.self.y,11,'#183348','#d9fff2',2);
  circle(ctx,s.self.x,s.self.y,5,'#8ff2cd');
}
export function drawDeckOverview(canvas){
  const ctx=canvas.getContext('2d');
  ctx.drawImage(deckArtwork(),0,0,canvas.width,canvas.height);
}
let deckImage;
const deckArtwork=()=>deckImage??=buildScene(false);
