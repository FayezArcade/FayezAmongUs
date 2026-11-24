import assert from 'node:assert/strict';
import {test} from 'node:test';
import {movement} from '../client/movement.js';
import {spawn,doors} from '../shared/deck.js';
import {advanceMovement} from '../shared/movement.js';

test('prediction starts and stops before delayed snapshots and acknowledges the stop',()=>{
  const packets=[],motion=movement((input,repeat)=>packets.push({...input,repeat}));
  const self={...spawn(2,true),id:'local',alive:true,ventIndex:null,moveSeq:null};
  const state={phase:'lobby',settings:{speed:175},positions:[self],self,doors:[]};
  motion.receive(state,0);
  motion.sync(1,0,0);
  assert.equal(motion.draw(16).x,self.x+2.8);
  const stopped=motion.draw(32).x;
  motion.sync(0,0,32);
  assert.equal(motion.draw(48).x,stopped);
  assert.equal(motion.position().moving,false);
  motion.receive({...state,self:{...self,x:stopped,moveSeq:2,moveAge:0}},150);
  assert.equal(motion.draw(166).x,stopped);
  assert.deepEqual(packets.map(({x,seq,repeat})=>[x,seq,repeat]),[[1,1,false],[0,2,false]]);
});

test('diagonal keepalives reuse the input sequence and closed shutters block prediction',()=>{
  const packets=[],motion=movement((input,repeat)=>packets.push({...input,repeat}));
  motion.sync(1,1,0);motion.sync(1,1,16);motion.sync(1,1,100);
  assert.deepEqual(packets.map(p=>[p.seq,p.repeat]),[[1,false],[1,true]]);
  assert.ok(Math.abs(Math.hypot(packets[0].x,packets[0].y)-1)<1e-9);
  const door=doors.find(d=>d.horizontal);
  const player={x:door.x-19,y:door.y,alive:true};
  advanceMovement(player,{x:1,y:0},.033,175,false,[door.id]);
  assert.equal(player.x,door.x-19);
  advanceMovement(player,{x:1,y:0},.033,175,false,[]);
  assert.ok(player.x>door.x-19);
});
