export const deckRevision='meridian-2';
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
// Each corridor route is defined by door-to-door waypoints; rooms and routes share world units.
export const rooms = [
  ['nav','Navigation',1262,405,158,148,29,'helm'],
  ['weapons','Weapons',1035,150,164,152,27,'guns'],
  ['med','MedBay',465,314,146,142,18,'med'],
  ['admin','Admin',908,405,192,143,24,'command'],
  ['cafe','Cafeteria',650,160,320,220,54,'table'],
  ['oxygen','O2',1088,376,150,136,22,'atmos'],
  ['upper','Upper Engine',250,126,174,140,29,'engine'],
  ['security','Security',318,382,142,134,25,'screen'],
  ['storage','Storage',693,704,243,220,34,'cargo'],
  ['electrical','Electrical',472,565,210,166,26,'power'],
  ['shields','Shields',1160,648,164,156,33,'shield'],
  ['reactor','Reactor',107,365,152,172,31,'core'],
  ['comms','Communications',943,762,169,133,25,'dish'],
  ['lower','Lower Engine',240,683,192,152,28,'engine']
].map(([id,name,x,y,w,h,chamfer,prop])=>({id,name,x,y,w,h,chamfer,prop}));
export const deck=Object.fromEntries(rooms.map(room=>[room.id,room]));
const width=74;
export const routes=[
  ['upper','cafe',[321,126],[505,126]],
  ['upper','security',[250,183],[250,382],[261,382]],
  ['reactor','security',[170,365],[270,365]],
  ['reactor','lower',[107,437],[107,652],[162,652]],
  ['security','lower',[318,434],[318,622]],
  ['security','med',[375,365],[465,365]],
  ['med','cafe',[525,314],[550,314],[550,256]],
  ['lower','electrical',[320,683],[383,683],[383,565],[402,565]],
  ['electrical','storage',[545,565],[643,565],[643,610]],
  ['cafe','storage',[650,256],[650,610]],
  ['cafe','admin',[755,249],[755,405],[827,405]],
  ['admin','storage',[908,462],[908,538],[776,538],[776,611]],
  ['cafe','weapons',[795,150],[968,150]],
  ['weapons','oxygen',[1035,210],[1035,376]],
  ['oxygen','nav',[1150,383],[1197,383]],
  ['weapons','nav',[1102,150],[1262,150],[1262,345]],
  ['nav','shields',[1262,463],[1262,610],[1225,610]],
  ['shields','comms',[1090,672],[943,672],[943,704]],
  ['comms','storage',[873,762],[798,762]]
].map(([a,b,...points])=>({a,b,points:points.map(([x,y])=>({x,y}))}));
export const corridors=routes.flatMap(({a,b,points},route)=>points.slice(1).map((q,i)=>{
  const p=points[i],horizontal=p.y===q.y;
  return {a,b,route,x:(p.x+q.x)/2,y:(p.y+q.y)/2,horizontal,
    w:Math.abs(p.x-q.x)+width,h:Math.abs(p.y-q.y)+width,length:Math.abs(p.x-q.x)+Math.abs(p.y-q.y)};
}));
export const doors=routes.map(({a,b},id)=>{
  const route=corridors.filter(c=>c.route===id).sort((c,d)=>d.length-c.length)[0];
  return {a,b,id,x:route.x,y:route.y,w:route.horizontal?16:width,h:route.horizontal?width:16};
});
export const lobby = [{name:'Docking Shuttle',x:450,y:310,w:520,h:438,accent:'#a8b5bc',prop:'shuttle',chamfer:58}];
const at=(room,x,y)=>({room,x:deck[room].x+x,y:deck[room].y+y});
export const vents=[
  at('nav',46,28),at('med',15,36),at('admin',43,34),at('security',-27,24),
  at('electrical',-50,32),at('reactor',-45,35),at('lower',-45,35),
  at('upper',-43,-23),at('cafe',118,32),at('weapons',34,-37),at('shields',27,42)
];
export const ventConnections=[[0,9],[0,10],[1,3],[1,4],[2,8],[2,10],[3,4],[5,6],[5,7]];
export const ventDestinations=index=>ventConnections.flatMap(([a,b])=>a===index?[b]:b===index?[a]:[]);
export const lobbySeats=[-1,1].flatMap(side=>Array.from({length:5},(_,i)=>({
  x:450+side*(205-i*28),y:225-i*15,w:29,h:35,angle:side*(.65-i*.05)
})));
export const lobbyCrates=[{x:365,y:248,w:51,h:42,laptop:true},{x:273,y:403,w:67,h:55},{x:592,y:361,w:76,h:58},{x:629,y:439,w:40,h:33}];
export const terminal = {x:365,y:286};
export const meetingPoint = {x:deck.cafe.x,y:deck.cafe.y};
export const spawn = (i,inLobby) => {
  if(inLobby)return {x:450+((i%5)-2)*44,y:373+Math.floor(i/5)*87};
  const angle=((i*3)%10)*Math.PI*2/10;
  return {x:meetingPoint.x+Math.sin(angle)*73,y:meetingPoint.y+Math.cos(angle)*68};
};
export function contains(rect,x,y,margin=0){
  const dx=Math.abs(rect.x-x),dy=Math.abs(rect.y-y);
  const halfW=rect.w/2-margin,halfH=rect.h/2-margin;
  return dx<=halfW&&dy<=halfH&&(!rect.chamfer||dx+dy<=halfW+halfH-rect.chamfer);
}
export const terrain=[...rooms,...corridors];
const footprint=[[0,0],[-1,0],[1,0],[0,-1],[0,1],[-.7,-.7],[.7,-.7],[-.7,.7],[.7,.7]];
const lobbyObstacles=[...lobbySeats,...lobbyCrates];
export const walkable = (x,y,inLobby,blocked=[],radius=playerRadius) => footprint.every(([dx,dy])=>{
  const px=x+dx*radius,py=y+dy*radius;
  return (inLobby?lobby:terrain).some(r=>contains(r,px,py))&&
    (!inLobby||(py>=178+Math.max(0,Math.abs(px-450)-72)*.32&&!lobbyObstacles.some(r=>contains(r,px,py))))&&
    !blocked.some(id=>doors[id]&&contains(doors[id],px,py));
});
export const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const upload=at('admin',-51,-33), power=at('electrical',40,-42);
const disposal=at('storage',78,55), pump=at('storage',-68,57);
const buildTask=(id,label,kind,stops,instrument=id)=>({id,label,kind,stops,instrument});
export const tasks = [
  buildTask('wire','Fix Wiring','common',[at('electrical',-45,-41),at('storage',-55,-51),at('cafe',-114,-51)]),
  buildTask('card','Swipe Card','common',[at('admin',53,-31)]),
  buildTask('data','Transfer Data · Weapons','long',[at('weapons',-44,-32),upload]),
  buildTask('dataNav','Transfer Data · Navigation','long',[at('nav',-42,-33),upload],'data'),
  buildTask('dataCafe','Transfer Data · Cafeteria','long',[at('cafe',111,-52),upload],'data'),
  buildTask('dataComms','Transfer Data · Communications','long',[at('comms',39,-32),upload],'data'),
  buildTask('dataElectrical','Transfer Data · Electrical','long',[at('electrical',48,37),upload],'data'),
  buildTask('route','Divert Power · Shields','short',[power,at('shields',-46,-33)]),
  ...[['oxygen','O2'],['upper','Upper Engine'],['lower','Lower Engine'],['comms','Communications'],['nav','Navigation'],['weapons','Weapons'],['security','Security']].map(([room,label])=>
    buildTask('route-'+room,'Divert Power · '+label,'short',[power,at(room,-37,29)],'route')),
  buildTask('align','Align Engine Output','long',[at('upper',-42,27),at('lower',44,-33)]),
  buildTask('scan','Submit Scan','long',[at('med',-38,-26)]),
  buildTask('target','Clear Asteroids','short',[at('weapons',42,29)]),
  buildTask('shield','Prime Shields','short',[at('shields',44,-33)]),
  buildTask('waste','Empty Garbage','long',[at('cafe',102,62),disposal]),
  buildTask('chute','Empty Chute','long',[at('oxygen',38,29),disposal],'waste'),
  buildTask('fuel','Fuel Engines','long',[pump,at('lower',-45,-31),pump,at('upper',43,26)]),
  buildTask('calibrate','Calibrate Distributor','short',[at('electrical',-46,34)]),
  buildTask('filter','Clean O2 Filter','short',[at('oxygen',35,-29)]),
  buildTask('sample','Inspect Sample','long',[at('med',38,-27)]),
  buildTask('sequence','Unlock Manifolds','short',[at('reactor',36,-39)]),
  buildTask('nav','Stabilize Steering','short',[at('nav',42,-33)]),
  buildTask('reactor','Start Reactor','long',[at('reactor',-37,-40)]),
  buildTask('chart','Chart Course','short',[at('nav',-43,27)]),
  buildTask('clean','Clean Vent','short',[vents[3]])
];
export const repairs = {
  lights:[at('electrical',0,51)], comms:[at('comms',-41,-33)],
  oxygen:[at('oxygen',-35,-27),at('admin',44,32)], reactor:[at('reactor',15,-58),at('reactor',15,58)]
};
