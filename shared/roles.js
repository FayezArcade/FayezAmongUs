export const special = {
  engineer:{name:'Engineer',team:'crew',ability:'Service hatch',cooldown:20,duration:8,description:'Travel through service hatches during a short window.'},
  scientist:{name:'Scientist',team:'crew',ability:'Remote vitals',cooldown:25,duration:10,description:'Temporarily read live crew vitals from anywhere.'},
  tracker:{name:'Tracker',team:'crew',ability:'Tag crew member',cooldown:25,duration:18,description:'Tag a nearby crew member to follow their delayed position.'},
  noisemaker:{name:'Noisemaker',team:'crew',ability:'Distress beacon',cooldown:0,duration:7,description:'Broadcast your position when eliminated.'},
  detective:{name:'Detective',team:'crew',ability:'Investigate',cooldown:15,duration:8,description:'Record an incident and question nearby witnesses for recent room sightings.'},
  judge:{name:'Judge',team:'crew',ability:'Override ballot',cooldown:0,duration:0,description:'Once per round, override a ballot. A wrong verdict ejects you.'},
  angel:{name:'Guardian Angel',team:'ghost',ability:'Protect',cooldown:25,duration:12,description:'Protect a nearby living crewmate from one attempt.'},
  influencer:{name:'Influencer',team:'ghost',ability:'Broadcast',cooldown:35,duration:10,description:'Send an approved signal to the living crew.'},
  shapeshifter:{name:'Shapeshifter',team:'impostor',ability:'Mimic',cooldown:28,duration:16,description:'Temporarily assume the suit and name of another living player.'},
  phantom:{name:'Phantom',team:'impostor',ability:'Cloak',cooldown:28,duration:12,description:'Hide from living opponents until the cloak ends or you strike.'},
  viper:{name:'Viper',team:'impostor',ability:'Corrosive strike',cooldown:16,duration:13,description:'Evidence fades after an elimination.'}
};
export const defaultRoles = () => Object.fromEntries(Object.entries(special).map(([id,r])=>[
  id,{enabled:false,max:1,chance:50,cooldown:r.cooldown,duration:r.duration}
]));
