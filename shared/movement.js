import {deckBounds,walkable} from './deck.js';

export function advanceMovement(player,input,dt,speed,lobby,doors){
  const x=player.x+input.x*speed*dt,y=player.y+input.y*speed*dt;
  const allowed=(x,y)=>player.alive||lobby?walkable(x,y,lobby,doors):x>18&&x<deckBounds.width-18&&y>18&&y<deckBounds.height-18;
  const movedX=Boolean(input.x)&&allowed(x,player.y);
  if(movedX){player.x=x;player.facing=Math.sign(input.x);}
  const movedY=Boolean(input.y)&&allowed(player.x,y);
  if(movedY)player.y=y;
  player.moving=movedX||movedY;
  if(movedX&&(!movedY||Math.abs(input.x)>=Math.abs(input.y)))player.direction=input.x<0?'left':'right';
  else if(movedY)player.direction=input.y<0?'up':'down';
}
