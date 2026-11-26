export const deckRevision='meridian-7';
export const playerScale=.67;
export const playerRadius=9;
export const emergencyRange=79;
// Palette order is the order of the three six-suit rows in the locker.
export const suitPalette = [
  ['red','Red','#e63e45'], ['cobalt','Blue','#3f62df'], ['teal','Green','#2ea85f'],
  ['pink','Pink','#db58ad'], ['ember','Orange','#ef842c'], ['gold','Yellow','#f4d549'],
  ['charcoal','Black','#464b57'], ['ice','White','#e9eef9'], ['iris','Purple','#8a59d8'],
  ['bark','Brown','#a16a3e'], ['sky','Cyan','#54d6e2'], ['lime','Lime','#83d542'],
  ['crimson','Maroon','#9e374b'], ['rose','Rose','#ee9bb9'], ['cream','Banana','#f2e1a6'],
  ['gray','Gray','#788895'], ['tan','Tan','#bea989'], ['coral','Coral','#f47c78']
];
export const colors = Object.fromEntries(suitPalette.map(([id,,color])=>[id,color]));
export const wireColors = {coral:'#ed5256',teal:'#27b68d',gold:'#f9cf4e',iris:'#9567e5'};
export const hats = ['Standard','Beacon','Antenna','Captain'];
export const deckBounds={width:1920,height:1180};
export const rooms = [
  ['nav','Navigation',1770,506,218,190,32,'helm'],
  ['weapons','Weapons',1365,213,216,196,36,'guns'],
  ['med','MedBay',553,351,192,184,24,'med'],
  ['admin','Admin',1170,582,222,182,26,'command'],
  ['cafe','Cafeteria',872,214,424,282,64,'table'],
  ['oxygen','O2',1401,525,190,174,28,'atmos'],
  ['upper','Upper Engine',308,191,226,184,34,'engine'],
  ['security','Security',446,550,184,174,29,'screen'],
  ['storage','Storage',921,927,310,278,42,'cargo'],
  ['electrical','Electrical',598,752,272,214,34,'power'],
  ['shields','Shields',1570,838,218,200,33,'shield'],
  ['reactor','Reactor',124,541,192,222,39,'core'],
  ['comms','Communications',1276,1051,220,170,32,'dish'],
  ['lower','Lower Engine',299,916,248,200,38,'engine']
].map(([id,name,x,y,w,h,chamfer,prop])=>({id,name,x,y,w,h,chamfer,prop}));
export const deck=Object.fromEntries(rooms.map(room=>[room.id,room]));

const outlets=[];
function port(room,side,shift=0){
  const r=deck[room],horizontal=side==='west'||side==='east';
  const sign=side==='west'||side==='north'?-1:1;
  const gate={room,side,horizontal,x:r.x+(horizontal?sign*r.w/2:shift),y:r.y+(horizontal?shift:sign*r.h/2)};
  outlets.push(gate);
  return gate;
}
const transit=[
  ['upper','cafe',100,port('upper','east'),port('cafe','west',-23)],
  ['upper','lower',98,port('upper','south',-13),port('lower','north',-4)],
  ['reactor','security',90,port('reactor','east',5),port('security','west',-4)],
  ['upper','med',88,[554,191],port('med','north',1)],
  ['lower','storage',98,port('lower','east'),[527,916],[527,966],port('storage','west',39)],
  ['storage','electrical',92,[607,966],port('electrical','south',9)],
  ['cafe','storage',104,port('cafe','south'),port('storage','north',-49)],
  ['storage','admin',90,[872,597],port('admin','west',15)],
  ['cafe','weapons',100,port('cafe','east',-1),port('weapons','west')],
  ['weapons','nav',96,port('weapons','south'),[1365,365],[1590,365],[1590,506],port('nav','west')],
  ['weapons','oxygen',88,[1402,365],port('oxygen','north',1)],
  ['nav','shields',96,[1590,506],port('shields','north',20)],
  ['shields','storage',98,port('shields','west',12),[1370,850],[1370,895],port('storage','east',-32)],
  ['storage','comms',90,[1276,895],port('comms','north')]
];
// Ports place the terminal run inside the room by 16 units. Bends get square joints
// while crossings share the adjoining run, leaving walls everywhere else.
export const routes=transit.map(([a,b,width,...nodes])=>({
  a,b,width,points:nodes.map(node=>{
    if(Array.isArray(node))return {x:node[0],y:node[1]};
    node.width=width;
    const inset=node.side==='north'||node.side==='west'?16:-16;
    return {x:node.x+(node.horizontal?inset:0),y:node.y+(node.horizontal?0:inset)};
  })
}));
export const corridors=routes.flatMap(({a,b,width,points})=>points.slice(1).map((q,i)=>{
  const p=points[i],horizontal=p.y===q.y;
  const axis=horizontal?'x':'y',sign=Math.sign(q[axis]-p[axis]);
  const start=p[axis]-(i?sign*width/2:0),end=q[axis]+(i<points.length-2?sign*width/2:0);
  return {a,b,width,horizontal,x:horizontal?(start+end)/2:p.x,y:horizontal?p.y:(start+end)/2,
    w:horizontal?Math.abs(end-start):width,h:horizontal?width:Math.abs(end-start)};
}));
export const entrances=outlets;
const doorSites=[
  ['upper','east','Upper Engine · west hall'],
  ['upper','south','Upper Engine · engine spine'],
  ['lower','north','Lower Engine · engine spine'],
  ['lower','east','Lower Engine · cargo hall'],
  ['security','west','Security'],
  ['med','north','MedBay'],
  ['electrical','south','Electrical'],
  ['storage','west','Storage · cargo hall'],
  ['storage','north','Storage · central hall'],
  ['storage','east','Storage · east hall'],
  ['cafe','west','Cafeteria · west hall'],
  ['cafe','east','Cafeteria · east hall'],
  ['cafe','south','Cafeteria · central hall']
];
export const doors=doorSites.map(([room,side,label],id)=>{
  const gate=entrances.find(p=>p.room===room&&p.side===side);
  return {...gate,id,label,w:gate.horizontal?16:gate.width,h:gate.horizontal?gate.width:16};
});

export const lobby = [{name:'Docking Shuttle',x:450,y:310,w:520,h:438,accent:'#a8b5bc',prop:'shuttle',chamfer:58}];
const at=(room,x,y)=>({room,x:deck[room].x+x,y:deck[room].y+y});
export const diningTables=[
  [0,-57,58],[-128,58,43],[128,-58,43],[-128,-58,42],[128,58,44]
].map(([x,y,radius])=>({...at('cafe',x,y),radius}));

export const furnishings=[
  ['cafe','service',-103,-110,44,22],['cafe','service',103,-110,44,22],
  ['upper','maintenance',-75,-51,39,27],['lower','maintenance',-74,61,45,27],
  ['reactor','capacitors',-63,58,24,41],
  ['security','screens',-1,-61,108,26],['security','server',63,41,25,41],
  ['med','bed',-60,-45,42,29],['med','bed',-60,2,42,29],['med','bed',-60,49,42,29],
  ['med','service',60,-41,36,25],
  ['electrical','server',-98,-54,30,47],['electrical','capacitors',101,42,32,46],
  ['storage','crate',-87,-84,56,44],['storage','crate',86,-78,58,48],
  ['storage','crate',94,75,55,45],['storage','crate',-103,9,50,38],['storage','cargo-rack',-66,96,78,26],
  ['admin','service',64,-53,46,29],['admin','server',62,54,40,28],
  ['weapons','maintenance',59,-58,46,34],['weapons','service',-59,54,41,26],
  ['oxygen','capacitors',52,45,49,32],['oxygen','service',-52,-50,41,22],
  ['nav','screens',34,-65,101,25],['nav','server',66,46,30,39],
  ['shields','capacitors',73,38,30,56],['shields','maintenance',-63,-50,41,26],
  ['comms','server',-65,-41,41,37],['comms','screens',56,38,61,27]
].map(([room,kind,x,y,w,h])=>({...at(room,x,y),kind,w,h}));
export const vents=[
  at('nav',36,67),at('med',15,36),at('admin',-67,53),at('security',-27,24),
  at('electrical',-77,48),at('reactor',-32,57),at('lower',-45,35),
  at('upper',-43,-23),at('cafe',132,10),at('weapons',25,-57),at('shields',27,42),
  {x:851,y:553,room:'cafe',name:'Central hall'}
];
export const ventConnections=[[0,9],[0,10],[1,3],[1,4],[2,8],[2,11],[3,4],[5,6],[5,7],[8,11]];
export const ventDestinations=index=>ventConnections.flatMap(([a,b])=>a===index?[b]:b===index?[a]:[]);
export const lobbySeats=[-1,1].flatMap(side=>Array.from({length:5},(_,i)=>({
  x:450+side*(205-i*28),y:225-i*15,w:29,h:35,angle:side*(.65-i*.05)
})));
export const lobbyCrates=[{x:365,y:248,w:51,h:42,laptop:true},{x:273,y:403,w:67,h:55},{x:592,y:361,w:76,h:58},{x:629,y:439,w:40,h:33}];
export const terminal = {x:365,y:286};
export const meetingPoint = {x:deck.cafe.x,y:deck.cafe.y};
export const meetingConsole={x:diningTables[0].x,y:diningTables[0].y+22};
const cafeSpawns=[[0,77],[52,72],[-52,72],[48,34],[-48,34],[0,25],[77,8],[-77,8],[26,105],[-26,105]];
export const spawn = (i,inLobby) => {
  if(inLobby)return {x:450+((i%5)-2)*44,y:373+Math.floor(i/5)*87};
  const [x,y]=cafeSpawns[i%10];
  return {x:meetingPoint.x+x,y:meetingPoint.y+y};
};
export function contains(rect,x,y,margin=0){
  const dx=Math.abs(rect.x-x),dy=Math.abs(rect.y-y);
  const halfW=rect.w/2-margin,halfH=rect.h/2-margin;
  return dx<=halfW&&dy<=halfH&&(!rect.chamfer||dx+dy<=halfW+halfH-rect.chamfer);
}
export const terrain=[...rooms,...corridors];
const footprint=[[0,0],[-1,0],[1,0],[0,-1],[0,1],[-.7,-.7],[.7,-.7],[-.7,.7],[.7,.7]];
const lobbyObstacles=[...lobbySeats,...lobbyCrates];
const onFloor=(x,y,blocked)=>terrain.some(r=>contains(r,x,y))&&
  !blocked.some(id=>doors[id]&&contains(doors[id],x,y));
export const walkable = (x,y,inLobby,blocked=[],radius=playerRadius) => footprint.every(([dx,dy])=>{
  const px=x+dx*radius,py=y+dy*radius;
  if(inLobby)return lobby.some(r=>contains(r,px,py))&&py>=178+Math.max(0,Math.abs(px-450)-72)*.32&&
    !lobbyObstacles.some(r=>contains(r,px,py));
  return onFloor(px,py,blocked)&&!furnishings.some(r=>contains(r,px,py))&&
    !diningTables.some(table=>{
      const radius=table.radius-4;
      return ((px-table.x)/radius)**2+((py-table.y)/(radius*.78))**2<1;
    });
});
export function clearDeckLine(a,b,blocked=[]){
  const steps=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/6));
  for(let i=0;i<=steps;i++){
    const t=i/steps;
    if(!onFloor(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,blocked))return false;
  }
  return true;
}
export const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
export const taskRange = id => id==='calibrate'||id==='clean-electrical'?38:57;
const upload=at('admin',-51,-33), power=at('electrical',56,-47);
const disposal=at('storage',106,38), pump=at('storage',-68,50);
const buildTask=(id,label,kind,stops,instrument=id)=>({id,label,kind,stops,instrument});
export function taskStageName(task,stage){
  if(task.instrument==='data')return stage===0?'Download Data':'Upload Data';
  if(task.instrument==='route')return stage===0?'Divert Power':'Accept Diverted Power';
  return task.label;
}
export const tasks = [
  buildTask('wire','Fix Wiring','common',[at('electrical',-45,-41),at('storage',-55,-51),at('cafe',-163,0)]),
  buildTask('wire-east','Fix Wiring','common',[at('storage',-55,-51),at('admin',-28,48),at('nav',-56,14)],'wire'),
  buildTask('wire-west','Fix Wiring','common',[at('electrical',-45,-41),at('admin',-28,48),at('security',-35,-35)],'wire'),
  buildTask('card','Swipe Card','common',[at('admin',53,-22)]),
  buildTask('data','Transfer Data · Weapons','short',[at('weapons',-44,-32),upload]),
  buildTask('dataNav','Transfer Data · Navigation','short',[at('nav',-42,-33),upload],'data'),
  buildTask('dataCafe','Transfer Data · Cafeteria','short',[at('cafe',164,-3),upload],'data'),
  buildTask('dataComms','Transfer Data · Communications','short',[at('comms',39,-32),upload],'data'),
  buildTask('dataElectrical','Transfer Data · Electrical','short',[at('electrical',48,37),upload],'data'),
  buildTask('route','Divert Power · Shields','short',[power,at('shields',-43,-18)]),
  ...[['oxygen','O2'],['upper','Upper Engine'],['lower','Lower Engine'],['comms','Communications'],['nav','Navigation'],['weapons','Weapons'],['security','Security']].map(([room,label])=>
    buildTask('route-'+room,'Divert Power · '+label,'short',[power,at(room,-37,29)],'route')),
  buildTask('align','Align Engine Output','long',[at('upper',-42,27),at('lower',44,-33)]),
  buildTask('scan','Submit Scan','long',[at('med',33,42)]),
  buildTask('target','Clear Asteroids','short',[at('weapons',42,29)]),
  buildTask('shield','Prime Shields','short',[at('shields',44,-33)]),
  buildTask('waste','Empty Garbage','long',[at('cafe',170,94),disposal]),
  buildTask('chute','Empty Chute','long',[at('oxygen',33,14),disposal],'waste'),
  buildTask('fuel','Fuel Engines','long',[pump,at('upper',43,26),pump,at('lower',-45,-31)]),
  buildTask('calibrate','Calibrate Distributor','short',[at('electrical',7,-32)]),
  buildTask('filter','Clean O2 Filter','short',[at('oxygen',35,-29)]),
  buildTask('sample','Inspect Sample','long',[at('med',31,-41)]),
  buildTask('sequence','Unlock Manifolds','short',[at('reactor',36,-39)]),
  buildTask('nav','Stabilize Steering','short',[at('nav',42,-33)]),
  buildTask('reactor','Start Reactor','long',[at('reactor',-37,-40)]),
  buildTask('chart','Chart Course','short',[at('nav',-43,27)]),
  ...vents.map((vent,i)=>buildTask(i===3?'clean':'clean-'+(vent.name?'central':vent.room),'Clean Vent','short',[vent],'clean'))
];
export const repairs = {
  lights:[at('electrical',3,72)], comms:[at('comms',-37,-9)],
  oxygen:[at('oxygen',-35,-27),at('admin',44,24)], reactor:[at('reactor',25,-79),at('reactor',25,74)]
};

export const securityConsole=at('security',0,-27);
export const securityRange=52;
export const cameraSites=[
  ['West passage',554,191,290,164],
  ['Engineering junction',295,546,268,168],
  ['Admin junction',872,597,256,156],
  ['Navigation approach',1590,506,270,168]
].map(([name,x,y,w,h])=>({name,x,y,w,h}));
