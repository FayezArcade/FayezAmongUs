import assert from 'node:assert/strict';
import {test} from 'node:test';
import {puzzle,publicPuzzle,stepPuzzle} from '../server/puzzles.js';
import {rooms,corridors,doors,tasks,walkable} from '../shared/deck.js';

test('all deck rooms are connected, stations are reachable and doors block transit',()=>{
  const seen=new Set([0]);
  for(const _ of rooms)for(const {a,b} of corridors)if(seen.has(a)||seen.has(b)){seen.add(a);seen.add(b);}
  assert.equal(seen.size,rooms.length);
  for(const v of tasks)for(const q of v.stops)assert.ok(walkable(q.x,q.y,false),v.id);
  for(const d of doors){
    assert.ok(walkable(d.x,d.y,false));
    assert.equal(walkable(d.x,d.y,false,[d.id]),false);
  }
});

for(const t of tasks)test('server validates '+t.id,()=>{
  for(let stage=0;stage<t.stops.length;stage++){
    const start=10000,p=puzzle(t.id,stage,start);
    const step=(type,a,b,time=start)=>stepPuzzle(p,{type,a,b},time);
    assert.ok(step('unknown').error);
    let done;
    switch(t.id){
      case 'wire':
        assert.ok(step('pair',p.left[0],p.left[1]).error);
        for(const c of p.left)done=step('pair',c,c);break;
      case 'card':
        step('begin');assert.ok(step('swipe',null,null,start+50).error);
        step('begin');done=step('swipe',null,null,start+620);break;
      case 'sequence':case 'reactor':
        if(p.reveal){
          assert.ok(step('key',p.sequence[0]).error);
          assert.equal(publicPuzzle(p,p.reveal).sequence,undefined);
        }
        for(const a of p.sequence)done=step('key',a,null,p.reveal||start);break;
      case 'sample':
        assert.equal(publicPuzzle(p,start).odd,undefined);
        assert.ok(step('sample',p.odd).error);done=step('sample',p.odd,null,p.ready);break;
      case 'target':
        for(let i=0;i<3;i++){
          const a=(p.lane+i*2)%5;done=step('target',a,null,start+i*p.period);
          assert.ok(step('target',a,null,start+i*p.period).error);
        }break;
      case 'calibrate':
        for(let i=0;i<3;i++)done=step('capture',null,null,start+Math.round(.48*p.period)-p.offset+p.period*(i+1));break;
      case 'shield':
        for(const [i,on] of p.active.entries())if(!on)done=step('toggle',i);break;
      case 'align':case 'nav':case 'route':
        assert.ok(step('set',null,null).error);done=step('set',p.target,p.targetY);break;
      case 'chart':
        for(let i=0;i<p.waypoints.length;i++)done=step('waypoint',i);break;
      case 'filter': case 'clean':
        for(const a of p.debris)done=step('clear',a);break;
      default:
        step('begin');assert.ok(step('finish').error);
        done=step('finish',null,null,start+3000);
    }
    assert.equal(done.done,true);
  }
});
