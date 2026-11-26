import assert from 'node:assert/strict';
import {once} from 'node:events';
import {io} from 'socket.io-client';
import {deckRevision} from '../shared/deck.js';

export async function joinTestGuests(address,code){
  const guests=Array.from({length:3},()=>io(address,{transports:['websocket'],forceNew:true}));
  try{
    return await Promise.all(guests.map(async(socket,index)=>{
      await once(socket,'connect');
      const guest={socket,state:null};
      socket.on('state',snapshot=>{guest.state=snapshot;});
      const reply=await socket.timeout(2500).emitWithAck('enter',{kind:'join',code,deck:deckRevision,name:`Guest ${index+1}`});
      assert.ok(reply.ok,reply.error);
      return guest;
    }));
  }catch(error){
    for(const socket of guests)socket.disconnect();
    throw error;
  }
}
