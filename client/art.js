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
function text(ctx,label,x,y,size=12,color='#e8edef',align='left'){
  ctx.font='800 '+size+'px system-ui,sans-serif';ctx.textAlign=align;
  ctx.lineWidth=2.3;ctx.strokeStyle='#191b1be6';ctx.lineJoin='round';ctx.strokeText(label,x,y);
  ctx.fillStyle=color;ctx.fillText(label,x,y);
}
const toneCache=new Map();
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
  const color=colors[p.color]||colors.teal, {bright,dark,deep}=suitTones(color), ink='#151923';
  const direction=p.direction||(p.facing<0?'left':'right');
  const front=direction==='down', back=direction==='up', side=!front&&!back;
  const ghost=p.alive===false;
  const step=p.moving&&!ghost?Math.sin(t/70)*3.4:0;
  const bob=ghost?Math.sin(t/310)*2.5:p.moving?Math.abs(step)*.66:Math.sin(t/660)*.36;
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

  if(side){
    box(ctx,-18,-18,11,25,5,dark,ink,3);
    box(ctx,-16,-14,3,13,1,bright);
  }else if(front){
    box(ctx,-17,-16,9,20,4,dark,ink,2.6);
  }
  if(!ghost){
    box(ctx,-11,1+step,10,12,4,dark,ink,2.8);
    box(ctx,2,1-step,10,12,4,dark,ink,2.8);
    box(ctx,-9,8+step,6,2.8,1,deep);
    box(ctx,4,8-step,6,2.8,1,deep);
  }

  const body=ctx.createLinearGradient(0,-36,0,11);
  body.addColorStop(0,bright);body.addColorStop(.51,color);body.addColorStop(1,dark);
  ctx.beginPath();
  ctx.moveTo(-13,-21);ctx.bezierCurveTo(-13,-31,-8,-36,1,-36);
  ctx.bezierCurveTo(10,-36,16,-30,16,-20);
  ctx.lineTo(16,-5);
  if(ghost){
    ctx.bezierCurveTo(12,9,3,13,-13,15);
    ctx.bezierCurveTo(-9,9,-13,4,-13,-5);
  }else{
    ctx.quadraticCurveTo(16,4,8,6);ctx.lineTo(-7,6);ctx.quadraticCurveTo(-14,5,-14,-3);
  }
  ctx.closePath();
  ctx.fillStyle=body;ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=3.4;ctx.lineJoin='round';ctx.stroke();

  if(back){
    box(ctx,-9,-19,19,22,7,dark,ink,2.6);
    box(ctx,-6,-16,5,13,2,bright);
  }else{
    const offset=front?0:3;
    const glass=ctx.createLinearGradient(0,-29,0,-12);
    glass.addColorStop(0,'#bdebf4');glass.addColorStop(.43,'#86c9e1');glass.addColorStop(1,'#457387');
    polygon(ctx,[[-12+offset,-25],[-7+offset,-30],[9+offset,-30],[14+offset,-26],[14+offset,-17],[9+offset,-14],[-8+offset,-14],[-12+offset,-18]],glass,ink,2.9);
    box(ctx,-6+offset,-27,12,3,1.5,'#edfaff');
    circle(ctx,9+offset,-25,.95,'#edfaff');
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
function wallRoom(ctx,r,lobby=false){
  const edge=hull(r), [base,alt,style]=floors[r.prop];
  polygon(ctx,hull(r,11),'#272b32','#101218',3);
  polygon(ctx,hull(r,5),'#4c5158','#171a20',3);
  polygon(ctx,edge,base,inks.line,2.8);
  ctx.save();ctx.clip();
  const left=r.x-r.w/2, right=r.x+r.w/2, top=r.y-r.h/2,bottom=r.y+r.h/2;
  const spacing=style==='cargo'?42:style==='rib'?19:25;
  for(let x=left,i=0;x<right;x+=spacing,i++){
    for(let y=top,j=0;y<bottom;y+=style==='rib'?42:spacing,j++){
      if((i+j)%2===0)box(ctx,x,y,spacing,style==='rib'?42:spacing,0,alt);
      if(style==='cargo'&&((i%2===0)||(j%2===0)))box(ctx,x,y,spacing,spacing,1,null,lobby?'#b6a27665':'#a7ad7660',1);
      if(style==='stripe')box(ctx,x+spacing-2,y,2,spacing,0,'#222b3330');
      if(style==='rib')box(ctx,x+2,y+4,1,34,0,'#1521283c');
    }
  }
  box(ctx,left,top,r.w,lobby?33:14,1,'#45494e',inks.line,2);
  for(let x=left+10;x<right;x+=36){
    box(ctx,x,top+3,27,lobby?24:8,2,'#818791',inks.shadow,1.3);
    screws(ctx,[[x+4,top+7],[x+22,top+7]]);
  }
  box(ctx,left,bottom-6,r.w,6,0,'#30343a');
  ctx.restore();
}
function consoleBox(ctx,x,y,w,h,accent='#a7d5ae'){
  box(ctx,x,y,w,h,4,'#626d72',inks.line,2.4);
  box(ctx,x+5,y+4,w-10,h*.49,3,'#28414a',inks.line,1.7);
  box(ctx,x+8,y+7,w-16,Math.max(3,h*.28),2,accent+'aa');
  for(let i=0;i<3;i++)circle(ctx,x+8+i*7,y+h-6,1.5,i===0?'#e9c268':'#383d3e');
}
function crate(ctx,r){
  const {x,y,w,h}=r,left=x-w/2,top=y-h/2;
  box(ctx,left+3,top+7,w,h,4,'#262d27a6');
  polygon(ctx,[[left,top+10],[left+8,top],[left+w-5,top],[left+w,top+8],[left+w,top+h-4],[left+w-8,top+h],[left,top+h-2]],'#557353','#212820',2.8);
  polygon(ctx,[[left+2,top+11],[left+9,top+2],[left+w-6,top+2],[left+w-2,top+8],[left+w-10,top+18],[left+2,top+18]],'#8b9c6f','#3b4c36',1.5);
  box(ctx,left+7,top+23,w-17,h-28,2,'#3e5e48','#293c31');
  box(ctx,left+w*.39,top+20,w*.27,4,1,'#bda765','#665b37');
  screws(ctx,[[left+7,top+16],[left+w-11,top+16]]);
}
function seat(ctx,{x,y,w,h}){
  box(ctx,x-w/2+2,y-h/2+5,w,h,8,'#232b30a0');
  box(ctx,x-w/2,y-h/2,w,h,9,'#3d5f83','#202b39',2.5);
  box(ctx,x-w/2+6,y-h/2+5,w-12,h-17,7,'#6288a6','#2c4561',1.7);
  box(ctx,x-w/2+9,y+h/2-11,w-18,6,3,'#507497','#273e52',1.3);
}
function roomProp(ctx,r){
  const {x,y,prop}=r;
  ctx.save();ctx.translate(x,y);
  const plate=(x,y,w,h,c='#718184')=>box(ctx,x,y,w,h,6,c,inks.line,2.5);
  if(prop==='table'){
    for(const [a,b,rad] of [[0,-8,56],[-99,52,42],[94,-52,41],[-92,-54,39],[99,52,42]]){
      circle(ctx,a+3,b+5,rad+2,'#484d48a0');
      circle(ctx,a,b,rad,'#587d96','#253f53',2.7);
      circle(ctx,a,b-3,rad-4,'#7897ad','#3e5f75',1.7);
      if(a!==0)for(const side of [-1,1])seat(ctx,{x:a+side*(rad+5),y:b+2,w:12,h:14});
      if(a===0){
        box(ctx,-13,-20,26,22,4,'#b9a86e','#382c23',1.8);
        circle(ctx,0,-9,6,'#e67c65','#613b35',1.5);
      }else{box(ctx,a-5,b-5,8,6,1,'#dcd8b3','#575644');}
    }
  }else if(['helm','command','screen'].includes(prop)){
    for(const [i,[offset,size]] of [[-54,32],[-16,36],[25,35]].entries())consoleBox(ctx,offset,-29,size,37,prop==='screen'?'#bac6e5':i===1?'#addcc1':'#8fc9be');
    if(prop==='command'){plate(-30,17,60,26,'#403e43');box(ctx,-24,21,48,17,3,'#527c65','#2a4e40');}
    if(prop==='helm'){plate(-18,14,36,16,'#7f7173');circle(ctx,0,22,6,'#ae9889','#3e3436');}
  }else if(prop==='core'){
    circle(ctx,0,0,39,'#4d4c66',inks.line,3);
    circle(ctx,0,-4,30,'#8e86a5','#2d2d52',2);
    circle(ctx,0,-4,17,'#6775a9','#303352',2);
    circle(ctx,0,-4,11,'#e2a5cc','#505681',2);
    for(const k of [-1,1]){plate(k*47-7,-22,13,48,'#9890ae');box(ctx,k*47-4,-16,7,31,2,'#c1b8c4');}
  }else if(prop==='atmos'||prop==='power'){
    if(prop==='power'){
      plate(-82,-63,164,26,'#555853');
      for(const [i,offset] of [-76,-50,-24,2,28,54].entries()){
        box(ctx,offset,-60,22,19,2,i===3?'#878660':'#6c7471','#292e30',1.2);
        box(ctx,offset+3,-55,16,6,1,i%2===0?'#b1a474':'#93a796');
        screws(ctx,[[offset+4,-44],[offset+18,-44]]);
      }
    }
    for(let i=-1;i<=1;i++){
      plate(i*28-11,-23,22,49,prop==='atmos'?'#6f8e79':'#867a64');
      box(ctx,i*28-7,-17,14,29,6,prop==='atmos'?'#98bc9a':'#b8aa78','#373b34');
      circle(ctx,i*28,18,3,'#cf9d6c',inks.line,1);
    }
    if(prop==='power')for(let i=0;i<3;i++){
      ctx.beginPath();ctx.moveTo(-29+i*24,25);ctx.bezierCurveTo(-22+i*24,36,-16+i*22,20,-5+i*24,44);
      ctx.lineWidth=2.5;ctx.strokeStyle=['#c77559','#636ca0','#c6aa60'][i];ctx.stroke();
    }
  }else if(prop==='engine'||prop==='guns'){
    plate(-40,-25,79,51,prop==='guns'?'#687f81':'#806a5b');
    for(const y of [-12,6]){
      box(ctx,-53,y,79,11,5,'#564b4d',inks.line,2);
      box(ctx,-57,y+2,23,6,3,prop==='guns'?'#b89065':'#cd936a');
    }
    circle(ctx,35,-2,15,'#929699',inks.line,2);
    circle(ctx,35,-2,8,'#545f6c',inks.line,2);
  }else if(prop==='med'){
    for(const a of [-49,19]){
      plate(a,-20,30,42,'#d4d3be');box(ctx,a+4,-15,22,28,4,'#738fa3','#344357',1.4);
      box(ctx,a+7,-14,16,8,2,'#b9c9cb');
    }
    circle(ctx,0,11,13,'#9ebba8','#3a544e',2);box(ctx,-5,6,10,10,2,'#d4dfc0');
  }else if(prop==='cargo'){
    for(const [a,b,w,h] of [[-40,-6,38,29],[-16,14,33,29],[29,-10,41,35]])crate(ctx,{x:a,y:b,w,h});
  }else if(prop==='shield'){
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3;circle(ctx,Math.sin(a)*23,Math.cos(a)*23,9,'#828eac','#343c58',2);
      circle(ctx,Math.sin(a)*23,Math.cos(a)*23,4,'#b4bbd1');
    }
    circle(ctx,0,0,7,'#e0caa1',inks.line,1.5);
  }else if(prop==='dish'){
    plate(-41,-15,82,28,'#596b75');circle(ctx,0,-9,19,'#909ea2','#39454d',2);
    box(ctx,-3,-23,6,24,2,'#465967',inks.line);circle(ctx,0,-6,4,'#afc7b5');
  }else{
    circle(ctx,0,0,28,'#67798a','#293849',3);
    circle(ctx,0,-3,20,'#333f5d','#a1a5ad',1.6);
    for(let i=0;i<6;i++)circle(ctx,Math.sin(i*16)*15,Math.cos(i*17)*14-3,1.2,'#d7dce4');
  }
  ctx.restore();
}
function passage(ctx,c){
  const {x,y,w,h,horizontal}=c;
  const left=x-w/2,right=x+w/2,top=y-h/2,bottom=y+h/2;
  box(ctx,left-3,top-3,right-left+6,bottom-top+6,3,'#393d46','#17191d',2);
  box(ctx,left,top,right-left,bottom-top,3,'#636e75');
  if(horizontal){
    for(let i=left+9;i<right-6;i+=13)box(ctx,i,top+7,1,bottom-top-14,0,'#424e57');
    for(const k of [top+4,bottom-6]){box(ctx,left,k,right-left,3,1,'#9aa0a0');screws(ctx,[[left+6,k+1],[right-7,k+1]]);}
    for(const k of [left+2,right-5])box(ctx,k,top+7,4,bottom-top-14,1,'#8c8373');
  }else{
    for(let i=top+9;i<bottom-6;i+=13)box(ctx,left+7,i,right-left-14,1,0,'#424e57');
    for(const k of [left+4,right-6]){box(ctx,k,top,3,bottom-top,1,'#9aa0a0');screws(ctx,[[k+1,top+6],[k+1,bottom-7]]);}
    for(const k of [top+2,bottom-5])box(ctx,left+7,k,right-left-14,4,1,'#8c8373');
  }
}
function buildScene(inLobby){
  const cache=document.createElement('canvas');cache.width=inLobby?900:1365;cache.height=inLobby?610:900;
  const ctx=cache.getContext('2d');
  if(inLobby){
    // Full shuttle exterior, with the cabin cut away above a broad cargo floor.
    for(const side of [-1,1]){
      ctx.save();ctx.translate(450,0);ctx.scale(side,1);
      polygon(ctx,[[217,204],[294,237],[365,355],[345,420],[242,384]],'#363f46','#12161b',5);
      polygon(ctx,[[269,318],[351,299],[377,328],[385,497],[352,546],[277,540],[248,507]],'#303b45','#101419',5);
      polygon(ctx,[[271,326],[346,310],[363,337],[369,446],[260,436]],'#55616a','#202831',3);
      polygon(ctx,[[262,445],[370,455],[371,496],[347,529],[280,521],[262,501]],'#263744','#151e25',3);
      for(const a of [287,337]){
        box(ctx,a-15,463,28,43,7,'#5e7f8f','#18272e',3);
        box(ctx,a-8,475,14,22,5,'#b1d4dc','#2e5262',2);
      }
      box(ctx,287,344,44,5,2,'#82949c');
      box(ctx,282,376,60,32,4,'#46545f','#303941',2);
      screws(ctx,[[278,344],[351,353],[284,416],[354,420]]);
      ctx.restore();
    }
    const shell=[[250,105],[352,39],[536,39],[646,90],[724,159],[739,465],[672,544],[643,586],[252,586],[216,542],[161,477],[163,168]];
    polygon(ctx,shell,'#39434a','#11161b',6);
    polygon(ctx,[[258,114],[359,51],[526,51],[635,102],[706,165],[721,458],[660,530],[627,573],[266,573],[234,527],[180,470],[182,174]],'#565e62','#252c33',3);
    polygon(ctx,[[367,58],[519,58],[550,85],[340,85]],'#29485d','#172732',3);
    polygon(ctx,[[408,60],[453,60],[430,82],[388,82]],'#558298');
    wallRoom(ctx,lobby[0],true);
    const r=lobby[0];
    polygon(ctx,hull(r),'#65717a',inks.line,3);
    ctx.save();ctx.clip();
    box(ctx,186,270,530,255,0,'#737a7e');
    for(let x=193;x<717;x+=54)for(let y=320;y<530;y+=49){
      box(ctx,x+2,y+2,51,46,2,((x+y)%2?'#747b80':'#6e767c'),'#95906d',1.4);
      screws(ctx,[[x+7,y+7],[x+47,y+41]]);
    }
    polygon(ctx,[[187,91],[709,91],[711,243],[591,188],[532,168],[369,168],[305,191],[186,252]],'#505961','#252b31',3);
    for(let i=0;i<6;i++)for(const side of [-1,1]){
      const x=450+side*(104+i*25),y=112+i*8;
      box(ctx,x-12,y,24,46,2,'#68747c','#384148',1.7);
      screws(ctx,[[x-7,y+5],[x+7,y+39]]);
    }
    polygon(ctx,[[193,247],[362,170],[391,170],[389,315],[193,315]],'#626d74','#41494e',2);
    polygon(ctx,[[708,247],[538,170],[509,170],[510,315],[708,315]],'#626d74','#41494e',2);
    for(const x of [204,521])for(let i=0;i<5;i++){
      box(ctx,x,264+i*10,177,3,1,'#3e4a51');
      for(let j=0;j<17;j++)box(ctx,x+4+j*10,260+i*10,3,8,1,'#464f54');
    }
    box(ctx,391,177,118,145,2,'#758186','#4d565c',3);
    for(let y=200;y<310;y+=25)box(ctx,393,y,114,1,0,'#515d63');
    box(ctx,187,311,527,6,0,'#41494c');
    ctx.restore();
    polygon(ctx,[[405,123],[424,107],[476,107],[495,123],[495,181],[405,181]],'#30393e','#202529',3);
    box(ctx,413,121,74,54,9,'#737d85','#222b33',2);
    polygon(ctx,[[419,128],[443,130],[449,143],[445,168],[419,169]],'#525d68','#484f57');
    polygon(ctx,[[481,128],[457,130],[451,143],[455,168],[481,169]],'#525d68','#484f57');
    box(ctx,446,135,8,23,2,'#9ea7a7','#313c42',2);
    for(const q of lobbySeats){
      ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.angle);seat(ctx,{...q,x:0,y:0});ctx.restore();
    }
    for(const q of lobbyCrates){
      crate(ctx,q);
      if(!q.laptop)continue;
      const {x,y}=q;
      polygon(ctx,[[x-17,y-13],[x-22,y-32],[x+8,y-35],[x+13,y-15]],'#9ea398','#1c2326',2.5);
      polygon(ctx,[[x-14,y-17],[x-17,y-29],[x+4,y-31],[x+8,y-18]],'#a6c58f','#405645',1.3);
      polygon(ctx,[[x-17,y-13],[x+13,y-16],[x+20,y-8],[x-10,y-5]],'#a4a7a1','#242a2a',2);
      box(ctx,x-8,y-12,16,3,1,'#545b5b');
    }
    text(ctx,'LAPTOP',terminal.x,terminal.y+12,10,'#e5e8d6','center');
    polygon(ctx,[[347,538],[553,538],[575,552],[575,581],[325,581],[325,552]],'#464f55','#222b30',3);
    for(let y=549;y<580;y+=5)box(ctx,335,y,230,2,0,'#748186');
    screws(ctx,[[335,549],[565,549],[337,576],[564,576]]);
    return cache;
  }
  for(const c of corridors)passage(ctx,c);
  for(const r of rooms)wallRoom(ctx,r);
  for(const entry of entrances){
    const {x,y,horizontal}=entry;
    const span=corridorWidth-4;
    box(ctx,x-(horizontal?11:span/2),y-(horizontal?span/2:11),
      horizontal?22:span,horizontal?span:22,2,'#777e7e','#414d56',1.5);
    for(const side of [-1,1]){
      const dx=horizontal?x:x+side*span/2,dy=horizontal?y+side*span/2:y;
      box(ctx,dx-3,dy-3,6,6,1,'#c2c9c1','#394347');
    }
  }
  for(const d of doors){
    ctx.save();ctx.translate(d.x,d.y);if(!d.horizontal)ctx.rotate(Math.PI/2);
    box(ctx,-6,-corridorWidth/2,12,corridorWidth,0,'#4c5659');
    for(const side of [-1,1]){
      box(ctx,-10,side*(corridorWidth/2-5)-5,20,10,2,'#383e40','#1b2429',2);
      circle(ctx,0,side*(corridorWidth/2-5),2.2,'#e6bc74');
    }
    ctx.restore();
  }
  for(const r of rooms){
    roomProp(ctx,r);
    text(ctx,r.name,r.x,r.y+r.h/2-13,11,'#eeede3','center');
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
    box(ctx,s.x-9,s.y-6,18,12,2,'#575e62','#282b2c',1.5);
    const signal=['calibrate','reactor','sequence'].includes(task.instrument)?'#b4acd7':task.instrument==='wire'?'#eac075':'#a9bd9c';
    box(ctx,s.x-5,s.y-4,10,4,1,signal);circle(ctx,s.x-5,s.y+3,1.4,'#e7d391');
  }
  return cache;
}
const stars=Array.from({length:142},(_,i)=>[(i*137.825)%1,(i*273.901)%1,i%7]);
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
  let camera=null,phase='',visibleKey='',visibility=null;
  return (s,t)=>{
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
      const drifting=[[.17,.3,'coral',-.48],[.82,.22,'sky',.57],[.77,.74,'gold',.44],[.23,.78,'iris',-.65],[.91,.51,'teal',.82]];
      for(const [i,[x,y,color,tilt]] of drifting.entries()){
        ctx.save();ctx.translate(x*w+Math.sin(t/2100+i)*17,y*h+Math.cos(t/2400+i)*18);
        ctx.rotate(tilt+Math.sin(t/3200+i)*.15);
        astronaut(ctx,{x:0,y:0,color,hat:i===1?2:0,alive:true,facing:i%2?-1:1},t,w<600?.8:1.28);
        ctx.restore();
      }
      return;
    }
    const zoom=inLobby?Math.max(.22,Math.min((w-22)/810,(h-136)/605,1.26)):Math.min(Math.max(w/920,.79),1.52);
    const target=inLobby?{x:450,y:309}:s.self;
    if(phase!==s.phase||!camera){camera={x:target.x,y:target.y};tracks.clear();phase=s.phase;}
    camera.x+=(target.x-camera.x)*.19;camera.y+=(target.y-camera.y)*.19;
    const center={x:w/2,y:inLobby?h/2-36:h/2};
    ctx.save();ctx.translate(center.x,center.y);ctx.scale(zoom,zoom);ctx.translate(-camera.x,-camera.y);
    ctx.drawImage(scenes[inLobby?1:0],0,0);
    if(!inLobby){
      for(const id of s.doors){
        const d=doors[id];box(ctx,d.x-d.w/2,d.y-d.h/2,d.w,d.h,3,'#5e4a4e','#33272b',3);circle(ctx,d.x,d.y,4,'#e88779','#533f3f',1.5);
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
    for(const p of [...s.positions].sort((a,b)=>a.y-b.y)){
      let q=tracks.get(p.id);
      if(!q||Math.hypot(p.x-q.x,p.y-q.y)>155){q={x:p.x,y:p.y,seenAt:t};tracks.set(p.id,q);}
      q.x+=(p.x-q.x)*.31;q.y+=(p.y-q.y)*.31;
      const arrival=s.phase==='play'?Math.min(1,(t-q.seenAt)/170):1;
      ctx.save();ctx.globalAlpha=arrival;
      if(p.scanning)circle(ctx,q.x,q.y,16+Math.sin(t/95)*3,'#9ff1b268','#b7fbbf',2);
      astronaut(ctx,{...p,x:q.x,y:q.y-(1-arrival)*5},t,playerScale);
      ctx.restore();
    }
    if(!inLobby&&s.phase==='play'){
      const key=[s.self.x,s.self.y,s.self.alive,s.vision,s.doors.join(',')].join('/');
      if(key!==visibleKey){visibility=sight(s);visibleKey=key;}
      ctx.beginPath();ctx.rect(camera.x-w/zoom,camera.y-h/zoom,w/zoom*2,h/zoom*2);
      ctx.moveTo(...visibility[0]);for(const v of visibility.slice(1))ctx.lineTo(...v);ctx.closePath();
      ctx.fillStyle='#0b0b10b2';ctx.fill('evenodd');
    }
    ctx.restore();
    if(!inLobby&&s.phase==='play'){
      const px=(s.self.x-camera.x)*zoom+center.x,py=(s.self.y-camera.y)*zoom+center.y;
      const radius=Math.max(44,s.vision*zoom);
      const fog=ctx.createRadialGradient(px,py,radius*.44,px,py,radius*1.25);
      fog.addColorStop(0,'#0b0c1100');fog.addColorStop(1,'#0b0c11ae');
      ctx.fillStyle=fog;ctx.fillRect(0,0,w,h);
    }
  };
}
export function drawMap(canvas,s,sabotage=false){
  const ctx=canvas.getContext('2d');
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.scale(canvas.width/1365,canvas.height/900);
  for(const c of corridors)box(ctx,c.x-c.w/2,c.y-c.h/2,c.w,c.h,3,sabotage?'#b77f86b0':'#9ebcf2ad',sabotage?'#ffd3cd':'#ebf4ff',2);
  for(const r of rooms){
    const station=Object.values(repairs).flat().some(q=>q.room===r.id);
    polygon(ctx,hull(r),sabotage?(station?'#8a384d':'#563249'):'#2354cfe6',sabotage?'#ffd3cd':'#f4f8ff',3);
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
  circle(ctx,s.self.x,s.self.y,10,'#b2f5cf','#162c32',3);
}
export function drawDeckOverview(canvas){
  const ctx=canvas.getContext('2d');
  ctx.drawImage(deckArtwork(),0,0,canvas.width,canvas.height);
}
let deckImage;
const deckArtwork=()=>deckImage??=buildScene(false);
