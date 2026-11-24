export const colors = {
  coral:'#ed5256', teal:'#27b68d', gold:'#f9cf4e', iris:'#9567e5', sky:'#58c4e8',
  lime:'#92ce44', rose:'#ef86b2', ice:'#dfe7ed', ember:'#f38838', cobalt:'#4871db',
  mint:'#68deba', mauve:'#bb6dc4', charcoal:'#555f71', bark:'#af7552', cream:'#f8e2a2', crimson:'#aa475c'
};
export const hats = ['Standard','Beacon','Antenna','Captain'];
// Positions are in world units. Corridors are derived from links so artwork and collision share a layout.
export const rooms = [
  ['Navigation',940,105,'#79c6ff','helm'], ['Observatory',660,105,'#ba9af7','dome'],
  ['Weapons',1230,105,'#f8a36d','guns'], ['Med Bay',390,335,'#70dfc4','med'],
  ['Admin',660,335,'#ffd982','command'], ['Cafeteria',940,335,'#80edd2','table'],
  ['O2',1230,335,'#aadc73','atmos'], ['Upper Engine',120,335,'#ffb575','engine'],
  ['Security',390,570,'#7db0ff','screen'], ['Storage',660,570,'#f2bc79','cargo'],
  ['Electrical',940,570,'#ffe17d','power'], ['Shields',1230,570,'#93baff','shield'],
  ['Reactor',120,570,'#ee8b9e','core'], ['Communications',390,800,'#c39af7','dish'],
  ['Lower Engine',660,800,'#f4a778','engine']
].map(([name,x,y,accent,prop]) => ({name,x,y,accent,prop,w:name==='Cafeteria'?238:200,h:name==='Cafeteria'?172:150,chamfer:prop==='table'?29:prop==='core'||prop==='helm'||prop==='shield'?24:14}));
export const links = [[0,1],[0,2],[0,5],[1,4],[2,6],[3,4],[3,7],[3,8],[4,5],[4,9],[5,6],[5,10],[6,11],[7,12],[8,9],[8,12],[8,13],[9,10],[9,14],[10,11],[13,14]];
export const lobby = [{name:'Docking Shuttle',x:450,y:300,w:820,h:500,accent:'#67f5dd',prop:'shuttle',chamfer:43}];
export const corridors = links.map(([a,b]) => {
  const p=rooms[a],q=rooms[b], horizontal=p.y===q.y;
  return {x:(p.x+q.x)/2,y:(p.y+q.y)/2,w:horizontal?Math.abs(p.x-q.x):66,h:horizontal?66:Math.abs(p.y-q.y),a,b,horizontal};
});
export const doors = corridors.map(({x,y,horizontal},id)=>({x,y,w:horizontal?18:66,h:horizontal?66:18,id}));
export const ventRooms = [0,3,6,8,10,12,14];
export const vents = ventRooms.map(i=>({x:rooms[i].x+65,y:rooms[i].y+43}));
export const lobbySeats=[76,746].flatMap(x=>Array.from({length:5},(_,i)=>({x:x+34,y:165+i*58,w:68,h:41})));
export const lobbyCrates=[{x:223,y:219,w:62,h:48},{x:254,y:252,w:54,h:43},{x:667,y:418,w:69,h:53},{x:637,y:448,w:48,h:43}];
export const terminal = {x:560,y:232};
export const meetingPoint = {x:940,y:335};
export const spawn = (i,inLobby) => {
  if(inLobby)return {x:450+((i%5)-2)*63,y:315+Math.floor(i/5)*72};
  const angle=((i*3)%10)*Math.PI*2/10;
  return {x:meetingPoint.x+Math.sin(angle)*57,y:meetingPoint.y+Math.cos(angle)*52};
};
export function contains(rect,x,y,margin=0){
  const dx=Math.abs(rect.x-x),dy=Math.abs(rect.y-y);
  const halfW=rect.w/2-margin,halfH=rect.h/2-margin;
  return dx<=halfW&&dy<=halfH&&(!rect.chamfer||dx+dy<=halfW+halfH-rect.chamfer);
}
export const walkable = (x,y,inLobby,blocked=[],radius=12) => [[-radius,0],[radius,0],[0,-radius],[0,radius]].every(([dx,dy]) =>
  (inLobby?lobby:[...rooms,...corridors]).some(r=>contains(r,x+dx,y+dy)) &&
  (!inLobby||![...lobbySeats,...lobbyCrates].some(r=>contains(r,x+dx,y+dy))) &&
  !blocked.some(id=>doors[id] && contains(doors[id],x+dx,y+dy)));
export const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
export const tasks = [
  ['wire','Patch the cable harness','common',[10]],
  ['card','Read the access badge','common',[4]],
  ['data','Transfer the flight record','long',[13,0]],
  ['route','Route the auxiliary current','long',[10,11]],
  ['align','Trim the engine gimbal','long',[7,14]],
  ['scan','Scan the pressure kit','short',[3]],
  ['target','Track debris signatures','short',[2]],
  ['shield','Prime the shield array','short',[11]],
  ['waste','Purge the waste lock','long',[5,9]],
  ['fuel','Refuel the drive','long',[9,14,9,7]],
  ['calibrate','Calibrate the oscilloscope','short',[8]],
  ['filter','Clear the intake screen','short',[6]],
  ['sample','Incubate the samples','short',[3]],
  ['sequence','Unlock the valve manifold','short',[12]],
  ['nav','Stabilize the guidance','short',[0]],
  ['reactor','Restart the core relays','short',[12]],
  ['chart','Plot the course','short',[0]],
  ['clean','Clear the service hatch','short',[8]]
].map(([id,label,kind,stops],i)=>({id,label,kind,stops:stops.map((room,j)=>({
  room,x:rooms[room].x+(id==='clean'?65:i%2===0?-65:65),y:rooms[room].y+(id==='clean'?43:-40+(j%2)*12)
}))}));
export const repairs = {
  lights:[{x:940,y:607}], comms:[{x:390,y:836}],
  oxygen:[{x:1230,y:372},{x:660,y:372}], reactor:[{x:120,y:600},{x:120,y:537}]
};
