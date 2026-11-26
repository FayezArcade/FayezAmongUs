export const gameTitle='Fayez Among Us';
export const range=(start,end,step=1)=>Array.from({length:Math.floor((end-start)/step)+1},(_,i)=>start+i*step);
const counts=(min,max)=>range(min,max).map(value=>[value,String(value)]);
const seconds=(min,max,step)=>range(min,max,step).map(value=>[value,`${value} s`]);
const multipliers=(min,max,base)=>range(min,max,.25).map(value=>[Math.round(value*base),`${Number.isInteger(value)?value.toFixed(1):value}x`]);

// Each choice maps a displayed preset to the relay's simulation value.
export const gameNumbers={
  impostors:['Impostors',1,counts(1,3),'Players on the Impostor team. Larger teams need more players.'],
  speed:['Player Speed',175,multipliers(.75,2,140),'How fast players move around the ship.'],
  crewVision:['Crewmate Vision',290,multipliers(.25,2,290),'How far Crewmates can see in normal lighting.'],
  impostorVision:['Impostor Vision',435,multipliers(.25,2,290),'How far Impostors can see, including during Lights sabotage.'],
  killCooldown:['Kill Cooldown',20,seconds(10,60,2.5),'Wait after a kill or meeting. Viper has its own cooldown.'],
  killDistance:['Kill Distance',58,[[32,'Short'],[58,'Normal'],[88,'Long']],'Reach of the Kill button. Walls and closed doors block it.'],
  commonTasks:['Common Tasks',1,counts(0,2),'Assignments shared by all Crewmates.'],
  longTasks:['Long Tasks',1,counts(0,5),'Long assignments per Crewmate. Each assignment counts once.'],
  shortTasks:['Short Tasks',3,counts(0,10),'Short assignments per Crewmate.'],
  emergencies:['Emergency Meetings',1,counts(0,5),'Button presses available to each player. Reports do not use them.'],
  meetingCooldown:['Emergency Cooldown',15,seconds(0,60,5),'Wait after launch or a meeting before the emergency button is available.'],
  discussion:['Discussion Time',30,seconds(0,120,15),'Time before voting opens.'],
  voting:['Voting Time',60,seconds(15,300,15),'Maximum time to submit a vote.']
};
export const gameChecks={
  anonymous:['Anonymous Votes',false,'Hide who cast each vote. The totals stay visible.'],
  confirm:['Confirm Ejects',true,'Reveal the ejected player’s faction.'],
  early:['End Voting Early',true,'Close voting when every eligible connected player has voted.'],
  visualTasks:['Visual Tasks',true,'Show scan, shields, weapons, and garbage effects to other players.']
};
export const taskBars={always:'Always',meetings:'Meetings',never:'Never'};
export const gameDefaults=()=>({
  ...Object.fromEntries(Object.entries(gameNumbers).map(([key,[,value]])=>[key,value])),
  ...Object.fromEntries(Object.entries(gameChecks).map(([key,[,value]])=>[key,value])),
  taskBar:'always'
});
export const requiredPlayers=impostors=>Math.max(4,impostors*2+2);
