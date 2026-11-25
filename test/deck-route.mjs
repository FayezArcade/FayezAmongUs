import {walkable,dist,deckBounds} from '../shared/deck.js';

const step=12,cols=Math.ceil(deckBounds.width/step),rows=Math.ceil(deckBounds.height/step);
const point=index=>({x:(index%cols)*step,y:Math.floor(index/cols)*step});
const open=Uint8Array.from({length:cols*rows},(_,i)=>{const p=point(i);return walkable(p.x,p.y,false,[],22)?1:0;});
const cells=[...open.keys()].filter(i=>open[i]);
function nearest(target){
  return cells.reduce((a,b)=>dist(point(b),target)<dist(point(a),target)?b:a);
}
export function deckWaypoints(from,to){
  const initial=nearest(from),goal=nearest(to),prev=new Int32Array(open.length).fill(-1),queue=[initial];
  prev[initial]=initial;
  for(let i=0;i<queue.length&&prev[goal]<0;i++){
    const q=queue[i];
    const adjacent=[q-cols,q+cols];
    if(q%cols)adjacent.push(q-1);
    if(q%cols<cols-1)adjacent.push(q+1);
    const start=point(q);
    for(const n of adjacent)if(open[n]&&prev[n]<0){
      const end=point(n);
      if(!walkable((start.x+end.x)/2,(start.y+end.y)/2,false,[],22))continue;
      prev[n]=q;queue.push(n);
    }
  }
  if(prev[goal]<0)throw Error('No walkable route to '+JSON.stringify(to));
  const path=[];
  for(let q=goal;q!==initial;q=prev[q])path.push(q);
  path.push(initial);
  path.reverse();
  const turns=path.filter((q,i)=>!i||i===path.length-1||q-path[i-1]!==path[i+1]-q).map(point);
  return [...turns,to];
}
