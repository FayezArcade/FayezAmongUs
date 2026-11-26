import {range} from './settings.js';

export const signals=['⚠','◉','⌁','◈','✦','⊕','⧖','⤴','⟡','⊗'];
export const special = {
  engineer:{name:'Engineer',team:'crew',ability:'Vent',cooldown:20,duration:8,description:'Travel through connected vents for a limited time.'},
  scientist:{name:'Scientist',team:'crew',ability:'Remote vitals',cooldown:25,duration:10,description:'Use a battery to read live crew vitals. Complete assignments to recharge it.'},
  tracker:{name:'Tracker',team:'crew',ability:'Tag crew member',cooldown:25,duration:18,description:'Tag a nearby crew member to follow their delayed position.'},
  noisemaker:{name:'Noisemaker',team:'crew',ability:'Distress beacon',cooldown:0,duration:7,description:'Broadcast your position when eliminated.'},
  detective:{name:'Detective',team:'crew',ability:'Investigate',cooldown:15,duration:8,description:'Record an incident and question nearby witnesses for recent room sightings.'},
  judge:{name:'Judge',team:'crew',ability:'Override vote',cooldown:0,duration:0,description:'Once per round, override the vote. A wrong verdict ejects you.'},
  angel:{name:'Guardian Angel',team:'ghost',ability:'Protect',cooldown:25,duration:12,description:'Protect a nearby living crewmate from one attempt.'},
  influencer:{name:'Influencer',team:'ghost',ability:'Broadcast',cooldown:35,duration:10,description:'Send up to three randomly dealt symbols to a living crewmate.'},
  shapeshifter:{name:'Shapeshifter',team:'impostor',ability:'Mimic',cooldown:28,duration:16,description:'Temporarily assume the suit and name of another living player.'},
  phantom:{name:'Phantom',team:'impostor',ability:'Cloak',cooldown:28,duration:12,description:'Hide from living opponents until the cloak ends or you strike.'},
  viper:{name:'Viper',team:'impostor',ability:'Corrosive strike',cooldown:16,duration:13,description:'Evidence fades after an elimination.'},
  jester:{name:'Jester',team:'neutral',description:'Convince the other players to vote you out. You win when a regular ballot ejects you.'},
  vulture:{name:'Vulture',team:'neutral',ability:'Collect remains',cooldown:8,goal:1,description:'After a body is reported, return to the marked site and collect the remains. Reach your goal to win independently.'}
};
export function roleFields(id){
  if(id==='judge'||id==='jester')return [];
  if(id==='noisemaker')return ['duration'];
  if(id==='vulture')return ['cooldown','goal'];
  return ['cooldown','duration'];
}
export const roleNumbers={
  max:['Maximum',range(0,4),'Candidate slots for this role.'],
  chance:['Spawn Chance',range(0,100,10),'Chance rolled independently for each slot.'],
  cooldown:['Ability Cooldown',range(0,100,5),'Wait before the role can use its ability again.'],
  duration:['Ability Duration',range(5,55,5),'How long the role’s effect lasts.'],
  goal:['Required Collections',range(1,5),'Reported sites needed for a Vulture win.']
};
export function roleChoices(id,field){
  const values=[...new Set([...roleNumbers[field][1],...(special[id][field]===undefined?[]:[special[id][field]])])].sort((a,b)=>a-b);
  return values.map(value=>[value,field==='chance'?`${value}%`:field==='cooldown'||field==='duration'?`${value} s`:String(value)]);
}
export const remainsRange=57;
export const defaultRoles = () => Object.fromEntries(Object.entries(special).map(([id,r])=>[
  id,{enabled:false,max:1,chance:50,...Object.fromEntries(roleFields(id).map(key=>[key,r[key]]))}
]));
