import {randomInt} from 'node:crypto';

const wires = ['coral','teal','gold','iris'];
const shuffle = values => {
  const result = [...values];
  for (let i=result.length-1;i>0;i--) {
    const j=randomInt(i+1);
    [result[i],result[j]]=[result[j],result[i]];
  }
  return result;
};
export const randomOrder=shuffle;
export function puzzle(id,stage,now) {
  const p = {id,stage,start:now,progress:0};
  switch(id) {
    case 'wire': return {...p,left:wires,right:shuffle(wires)};
    case 'sequence': return {...p,sequence:shuffle([1,2,3,4,5,6])};
    case 'reactor': return {...p,sequence:Array.from({length:5},()=>randomInt(1,10)),reveal:now+3500};
    case 'sample': return {...p,odd:randomInt(4),ready:now+4800};
    case 'target': return {...p,lane:randomInt(5),period:850};
    case 'card': return {...p,from:null};
    case 'shield': return {...p,active:[false,true,false,true,false,false]};
    case 'align': case 'nav': case 'route': return {...p,target:randomInt(18,84),targetY:randomInt(18,84)};
    case 'filter': return {...p,debris:shuffle([0,1,2,3,4])};
    case 'calibrate': return {...p,period:1550,offset:randomInt(300,900)};
    default: return {...p,hold:null};
  }
}
export function stepPuzzle(p,action,now) {
  if (!action || typeof action!=='object') return {error:'Invalid input'};
  const {type,a,b}=action;
  const wrong=(error)=>({error});
  switch(p.id) {
    case 'wire':
      if (type!=='pair'||!p.left.includes(a)||a!==b||p.matched?.includes(a)) return wrong('Match the cable colors.');
      p.matched=[...(p.matched||[]),a];
      return {done:p.matched.length===4};
    case 'sequence': case 'reactor':
      if (type!=='key'||now<(p.reveal||0)||!Number.isInteger(a)||a<1||a>9) return wrong('Wait for the relay display.');
      if(a!==p.sequence[p.progress]) {p.progress=0;if(p.id==='reactor') p.reveal=now+3500;return wrong('Sequence reset.');}
      return {done:++p.progress===p.sequence.length};
    case 'sample':
      if(type!=='sample'||now<p.ready) return wrong('Samples are processing.');
      if(a!==p.odd) {p.ready=now+3000;p.odd=randomInt(4);return wrong('Retesting the samples.');}
      return {done:true};
    case 'target': {
      const frame=Math.floor((now-p.start)/p.period);
      if(type!=='target'||a!==(p.lane+frame*2)%5||frame===p.lastFrame) return wrong('Wait for another debris signature.');
      p.lastFrame=frame;
      return {done:++p.progress===3};
    }
    case 'card':
      if(type==='begin') {p.from=now;return {};}
      if(type!=='swipe'||p.from===null) return wrong('Start at the left edge.');
      {const elapsed=now-p.from;p.from=null;return elapsed>=280&&elapsed<=1450?{done:true}:wrong('Swipe at a steady speed.');}
    case 'align': case 'nav': case 'route':
      if(type!=='set'||!Number.isFinite(a)||Math.abs(a-p.target)>5||(p.id==='nav'&&(!Number.isFinite(b)||Math.abs(b-p.targetY)>5))) return wrong('Match the highlighted position.');
      return {done:true};
    case 'shield':
      if(type!=='toggle'||!Number.isInteger(a)||a<0||a>=p.active.length) return wrong('Select a shield cell.');
      p.active[a]=!p.active[a];
      return {done:p.active.every(Boolean)};
    case 'calibrate': {
      const sweep=((now-p.start+p.offset)%p.period)/p.period;
      if(type!=='capture'||sweep<.33||sweep>.63||now-(p.last||0)<730) return wrong('Capture when the needle is on the bright band.');
      p.last=now;
      return {done:++p.progress===3};
    }
    case 'filter':
      if(type!=='clear'||!p.debris.includes(a)) return wrong('Move a particle out of the intake.');
      p.debris=p.debris.filter(x=>x!==a);
      return {done:p.debris.length===0};
    default:
      if(type==='begin') {p.hold=now;return {};}
      if(type!=='finish'||p.hold===null||now-p.hold<(p.id==='data'?2700:1450)) return wrong('Keep the control engaged.');
      return {done:true};
  }
}
export function publicPuzzle(p,now) {
  if(!p) return null;
  const copy={...p};
  if(p.id==='sample'&&now<p.ready) delete copy.odd;
  if(p.id==='reactor'&&now>=p.reveal) delete copy.sequence;
  return copy;
}
