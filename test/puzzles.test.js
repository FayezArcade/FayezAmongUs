import assert from 'node:assert/strict';
import {test} from 'node:test';
import {deckWaypoints} from './deck-route.mjs';
import {puzzle,publicPuzzle,stepPuzzle} from '../server/puzzles.js';
import {rooms,routes,doors,entrances,tasks,repairs,vents,deck,walkable,clearDeckLine} from '../shared/deck.js';

test('all deck rooms are connected, stations are reachable and doors block transit',()=>{
  for(const room of rooms)assert.ok(deckWaypoints(deck.cafe,room).length>1,room.name);
  for(const route of routes)for(const point of route.points)assert.ok(walkable(point.x,point.y,false));
  for(const point of [...vents,...Object.values(repairs).flat()])assert.ok(walkable(point.x,point.y,false));
  for(const {x,y} of entrances)assert.ok(walkable(x,y,false));
  assert.equal(walkable(470,440,false),false,'Space between MedBay and Electrical');
  assert.equal(clearDeckLine(deck.admin,deck.oxygen),false,'Admin and O2 are separated by the hull');
  for(const v of tasks)for(const q of v.stops)assert.ok(walkable(q.x,q.y,false),v.id);
  for(const d of doors){
    const dx=d.horizontal?20:0,dy=d.horizontal?0:20;
    const a={x:d.x-dx,y:d.y-dy},b={x:d.x+dx,y:d.y+dy};
    assert.ok(clearDeckLine(a,b),d.label);
    assert.equal(clearDeckLine(a,b,[d.id]),false,d.label);
    assert.equal(walkable(d.x,d.y,false,[d.id]),false);
  }
});

for(const t of tasks)test('server validates '+t.id,()=>{
  for(let stage=0;stage<t.stops.length;stage++){
    const start=10000,p=puzzle(t.id,stage,start,t.instrument);
    const step=(type,a,b,time=start)=>stepPuzzle(p,{type,a,b},time);
    assert.ok(step('unknown').error);
    let done;
    switch(t.instrument){
      case 'wire':
        assert.ok(step('pair',p.left[0],p.left[1]).error);
        for(const c of p.left)done=step('pair',c,c);break;
      case 'card':
        step('begin');assert.ok(step('swipe',null,null,start+50).error);
        step('begin');done=step('swipe',null,null,start+620);break;
      case 'sequence':
        for(const a of p.sequence)done=step('key',a);break;
      case 'reactor':
        assert.ok(step('key',p.sequence[0]).error);
        assert.equal(publicPuzzle(p,start).cue,p.sequence[0]);
        assert.equal(publicPuzzle(p,p.reveal).sequence,undefined);
        for(let level=1;level<=5;level++){
          const ready=p.reveal;
          for(const value of p.sequence.slice(0,level))done=step('key',value,null,ready);
          if(level<5)assert.equal(done.done,undefined);
        }
        break;
      case 'sample':
        assert.equal(publicPuzzle(p,start).odd,undefined);
        assert.ok(step('sample',p.odd).error);
        assert.deepEqual(step('beginSample'),{});
        assert.equal(publicPuzzle(p,p.ready-1).odd,undefined);
        assert.ok(step('sample',p.odd,null,p.ready-1).error);
        done=step('sample',p.odd,null,p.ready);break;
      case 'target':
        for(let i=0;i<3;i++){
          const a=(p.lane+i*2)%5;done=step('target',a,null,start+i*p.period);
          assert.ok(step('target',a,null,start+i*p.period).error);
        }break;
      case 'calibrate':
        for(let i=0;i<3;i++)done=step('capture',null,null,start+Math.round(.48*p.period)-p.offset+p.period*(i+1));break;
      case 'shield':
        for(const [i,on] of p.active.entries())if(!on)done=step('toggle',i);break;
      case 'route':
        if(stage===1){done=step('accept');break;}
      case 'align':case 'nav':
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
