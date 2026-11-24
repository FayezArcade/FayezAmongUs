import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdir} from 'node:fs/promises';
import {setTimeout as wait} from 'node:timers/promises';
import {chromium} from 'playwright-core';
import {createGameServer} from '../server/index.js';
import {walkable} from '../shared/deck.js';

let offset=0;
const {server,close}=createGameServer({now:()=>Date.now()+offset,serve:true});
server.listen(0,'127.0.0.1');await once(server,'listening');
const directory=process.env.FAYEZ_SCREENSHOTS||'test-results/scale';
await mkdir(directory,{recursive:true});
let browser;
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
  async function move(key,predicate){
    await page.keyboard.down(key);
    try{await until(s=>predicate(s.self),'Walk '+key);}finally{await page.keyboard.up(key);}
    await until(s=>!s.positions.find(q=>q.id===s.self.id)?.moving,'Release '+key);
    assert.ok(walkable(state.self.x,state.self.y,false));
  }
  await page.goto('http://127.0.0.1:'+server.address().port);
  await button('CREATE ROOM').click();
  await page.getByLabel('Nickname').fill('Nova');
  await button('Create room').click();
  await button('START').click();
  await until(s=>s.phase==='countdown','Launch');
  offset+=3100;await until(s=>s.phase==='reveal','Role card');
  offset+=3500;await until(s=>s.phase==='play','Enter Cafeteria');
  if(state.self.y>225)await move('w',p=>p.y<=226);
  if(state.self.y<215)await move('s',p=>p.y>=216);
  await move('d',p=>p.x>=675);
  await wait(250);
  await page.screenshot({path:directory+'/beside-table.png'});
  await move('w',p=>p.y<=153);
  await move('d',p=>p.x>=885);
  await wait(250);
  await page.screenshot({path:directory+'/corridor.png'});
  console.log('Standing poses captured beside the table and inside the Weapons corridor.');
}finally{await browser?.close();await close();}
