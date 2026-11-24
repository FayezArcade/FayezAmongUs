import {advanceMovement} from '../shared/movement.js';

export function movement(emit){
  let input={x:0,y:0,seq:0},sentAt=0,history=[],snapshot,player,correction,lastFrame;
  const step=(p,v,ms,s)=>advanceMovement(p,v,ms/1000,s.settings.speed*(p.alive?1:1.28),s.phase==='lobby',s.doors);
  function sync(x,y,at){
    const length=Math.max(1,Math.hypot(x,y));
    x/=length;y/=length;
    if(history.length&&input.x===x&&input.y===y){
      if((x||y)&&at-sentAt>=100){sentAt=at;emit(input,true);}
      return;
    }
    input={x,y,seq:input.seq+1};
    history.push({...input,at});
    if(history.length>128)history.shift();
    sentAt=at;
    emit(input,false);
  }
  function receive(s,at){
    const previous=snapshot;
    const self=s.self;
    const pose=s.positions.find(p=>p.id===self.id);
    const target={...pose,...self};
    const reset=!player||!previous||previous.phase!==s.phase||previous.round!==s.round||
      previous.self.id!==self.id||previous.self.alive!==self.alive||previous.self.ventIndex!==self.ventIndex||
      Math.hypot(player.x-self.x,player.y-self.y)>90;
    if(reset){snapshot=s;player=target;correction=null;lastFrame=at;return;}
    draw(at);
    snapshot=s;
    // Acknowledged input age maps this server sample onto the client's input timeline.
    const index=history.findIndex(v=>v.seq===self.moveSeq);
    if(index<0){
      if(self.moveSeq===undefined)step(target,input,33,s);
      else if(input.x||input.y)return;
    }else{
      history=history.slice(index);
      let start=Math.min(at,Math.max(at-250,history[0].at+self.moveAge));
      for(const [i,change] of history.entries()){
        const end=Math.min(at,Math.max(start,history[i+1]?.at??at));
        for(;start<end;){
          const dt=Math.min(end-start,1000/120);
          step(target,change,dt,s);start+=dt;
        }
      }
    }
    const dx=target.x-player.x,dy=target.y-player.y;
    correction=Math.hypot(dx,dy)<1.6?null:{x:dx,y:dy};
    if(!input.x&&!input.y)player.moving=false;
  }
  function draw(at){
    if(!player)return;
    const ms=Math.min(33,Math.max(0,at-lastFrame));
    lastFrame=at;
    step(player,input,ms,snapshot);
    if(correction){
      const factor=1-Math.exp(-ms/52);
      const dx=correction.x*factor,dy=correction.y*factor;
      // Apply reconciliation through the same wall and bulkhead checks as ordinary input.
      const corrected={...player};
      advanceMovement(corrected,{x:dx,y:dy},1,1,snapshot.phase==='lobby',snapshot.doors);
      player.x=corrected.x;player.y=corrected.y;
      correction.x-=dx;correction.y-=dy;
      if(Math.hypot(correction.x,correction.y)<.3)correction=null;
    }
    player.moving=Boolean(input.x||input.y)&&player.moving;
    return player;
  }
  return {sync,receive,draw,position:()=>player,reset(){history=[];snapshot=null;player=null;correction=null;}};
}
