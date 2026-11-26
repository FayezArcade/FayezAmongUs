import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdir} from 'node:fs/promises';
import {setTimeout as wait} from 'node:timers/promises';
import {chromium} from 'playwright-core';
import {createGameServer} from '../server/index.js';
import {joinTestGuests} from './room-guests.mjs';
import {walkable,deck,doors,dist} from '../shared/deck.js';
import {deckWaypoints} from './deck-route.mjs';

let offset=0;
const {server,close}=createGameServer({now:()=>Date.now()+offset,serve:true});
server.listen(0,'127.0.0.1');await once(server,'listening');
const directory=process.env.FAYEZ_SCREENSHOTS||'test-results/scale';
await mkdir(directory,{recursive:true});
let browser, guests=[];
try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
  const page=await browser.newPage({viewport:{width:1365,height:835}});
  let state;
  page.on('websocket',ws=>ws.on('framereceived',({payload})=>{
    if(typeof payload==='string'&&payload.startsWith('42')){
      const [type,s]=JSON.parse(payload.slice(2));if(type==='state')state=s;
    }
  }));
  const button=name=>page.getByRole('button',{name,exact:true}).first();
  async function until(predicate,message){
    const end=Date.now()+6500;
    while(Date.now()<end){if(state&&predicate(state))return;await wait(26);}
    assert.fail(message+' at '+JSON.stringify(state?.self));
  }
  const address='http://127.0.0.1:'+server.address().port;
  await page.goto(address);
  await button('CREATE ROOM').click();
  await page.getByLabel('Nickname').fill('Nova');
  await button('Create room').click();
  await until(s=>s.code,'Create lobby');
  guests=await joinTestGuests(address,state.code);
  await button('START').click();
  await until(s=>s.phase==='countdown','Launch');
  offset+=3100;await until(s=>s.phase==='reveal','Role card');
  offset+=3500;await until(s=>s.phase==='play','Enter Cafeteria');
  const room=deck.cafe, door=doors.find(d=>d.label==='Cafeteria · east hall');
  async function walk(point){
    for(const target of deckWaypoints(state.self,point)){
      const keys=new Set();
      try{
        await until(s=>{
          if(dist(s.self,target)<9)return true;
          const wanted=new Set();
          if(Math.abs(target.x-s.self.x)>5)wanted.add(target.x>s.self.x?'d':'a');
          if(Math.abs(target.y-s.self.y)>5)wanted.add(target.y>s.self.y?'s':'w');
          for(const key of keys)if(!wanted.has(key)){void page.keyboard.up(key);keys.delete(key);}
          for(const key of wanted)if(!keys.has(key)){void page.keyboard.down(key);keys.add(key);}
          return false;
        },`Walk to ${target.x},${target.y}`);
      }finally{await Promise.all([...keys].map(key=>page.keyboard.up(key)));}
      await until(s=>!s.positions.find(q=>q.id===s.self.id)?.moving,'Release movement');
    }
    assert.ok(walkable(state.self.x,state.self.y,false));
  }
  await walk({x:room.x,y:room.y+12});
  await wait(250);
  await page.screenshot({path:directory+'/beside-table.png'});
  await walk({x:door.x+61,y:door.y});
  await wait(250);
  await page.screenshot({path:directory+'/corridor.png'});
  console.log('Standing poses captured beside the table and inside the Weapons corridor.');
}finally{for(const {socket} of guests)socket.disconnect();await browser?.close();await close();}
