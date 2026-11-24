import {colors} from '../shared/deck.js';

const legends={
  wire:'Drag a lead to its matching socket, or select both ends.',
  card:'Drag the access badge all the way through the reader at a steady speed.',
  data:'Keep the transfer engaged until the flight record is accepted.',
  route:'Move the selector into the highlighted current band.',
  align:'Center the gimbal within the illuminated tolerance.',
  scan:'Hold the scanner engaged until its reading stabilizes.',
  target:'Tap each illuminated debris target before it moves.',
  shield:'Switch every shield cell online.',
  waste:'Hold the purge control down to cycle the waste lock.',
  fuel:'Hold the pump to complete the fuel transfer.',
  calibrate:'Capture three readings when the needle enters the bright band.',
  filter:'Remove each particle from the intake screen.',
  sample:'Wait for the test, then select the anomalous sample.',
  sequence:'Open the valves in ascending numerical order.',
  chart:'Follow the flight path in order, from the starting point to the destination.',
  clean:'Remove all debris from the maintenance grate.',
  nav:'Move the crosshair into the marked circle, then lock the course.',
  reactor:'Memorize the firing order before the relay display goes dark.'
};
const key=(label,type,a='',attr='')=>`<button type="button" data-key="${type}" data-value="${a}" ${attr}>${label}</button>`;
const range=(id,title,target)=>`<label>${title}<div class="slider"><span style="left:${target}%"></span><input id="${id}" type="range" min="0" max="100" value="50"><output>50</output></div></label>`;

export function taskPanel(el,initial,now,send) {
  let p=initial, selected=null, dragging=null, cable=null, held=false, holdAt=0, last='';
  const id=initial.id;
  const status=document.createElement('p');status.className='feedback';status.setAttribute('role','status');
  el.innerHTML=`<p class="instrument-help">${legends[id]}</p><div class="hardware"></div>`;
  const hardware=el.querySelector('.hardware');hardware.dataset.instrument=id;el.append(status);
  const rate=(t)=>Math.max(0,t-p.start);
  function update(next,t) {
    p=next;
    let html='';
    switch(id){
      case 'wire': {
        const wire=(c,side)=>key('<i></i><span>'+c+'</span>',side,c,`style="--lead:${colors[c]}" class="${p.matched?.includes(c)?'matched':''} ${selected===c&&side==='left'?'selected':''}"`);
        const links=(p.matched||[]).map(c=>{const y=24+48*p.left.indexOf(c),to=24+48*p.right.indexOf(c);return '<path d="M0 '+y+' C30 '+y+',70 '+to+',100 '+to+'" fill="none" stroke="'+colors[c]+'" stroke-width="3" vector-effect="non-scaling-stroke"/>';}).join('');
        html='<div class="wires"><div>'+p.left.map(c=>wire(c,'left')).join('')+'</div><svg viewBox="0 0 100 192" preserveAspectRatio="none" aria-hidden="true">'+links+'</svg><div>'+p.right.map(c=>wire(c,'right')).join('')+'</div></div>';break;
      }
      case 'card':
        html='<div class="reader"><div class="reader-line"></div><button type="button" id="badge" aria-label="Swipe access badge"><i></i> FC / BADGE</button></div><p class="muted">Keyboard: press the badge button twice at swipe speed.</p>';break;
      case 'nav':
        html='<div class="steering" aria-label="Guidance crosshair"><i style="left:'+p.target+'%;top:'+p.targetY+'%"></i><b></b></div><div class="steering-sliders">'+range('axis','Horizontal setting',p.target)+range('axis-y','Vertical setting',p.targetY)+'</div>'+key('Lock course','axes','','class="primary"');
        break;
      case 'align':case 'route':
        html=(id==='route'?'<div class="current-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>':'')+range('axis',id==='align'?'Engine trim':id==='route'?'Auxiliary current':'Horizontal setting',p.target)+key('Confirm reading','axes','','class="primary"');break;
      case 'shield':
        html='<div class="keygrid">'+p.active.map((on,i)=>key((i+1)+' · '+(on?'ON':'OFF'),'toggle',i,'class="'+(on?'active':'')+'"')).join('')+'</div>';break;
      case 'filter':case 'clean':
        html='<div class="strainer">'+[0,1,2,3,4].map(i=>p.debris.includes(i)?key(['◆','✦','●','◒','◈'][i],'clear',i,'aria-label="Remove particle '+(i+1)+'"'):'<span>·</span>').join('')+'</div>';break;
      case 'chart':{
        const xs=[10,30,50,70,90];
        html='<div class="chart-board"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="'+p.waypoints.map((y,i)=>xs[i]+','+y).join(' ')+'" fill="none" stroke="#9aaf8e" stroke-width="1" stroke-dasharray="3 3"/></svg>'+p.waypoints.map((y,i)=>key(i<p.progress?'●':i+1,'waypoint',i,'style="left:'+xs[i]+'%;top:'+y+'%" class="'+(i<=p.progress?'active':'')+'"')).join('')+'</div>';break;
      }
      case 'sequence':case 'reactor': {
        const reading=id==='sequence'?'VALVES '+p.progress+' / 10':p.sequence?.join(' · ')||'•••••';
        html='<div class="digits">'+reading+'</div><p class="muted">Accepted: '+p.progress+'</p><div class="keygrid">'+(p.keys||Array.from({length:9},(_,i)=>i+1)).map(value=>key(value,'key',value,id==='sequence'&&value<=p.progress?'disabled class="active"':'')).join('')+'</div>';break;
      }
      case 'sample': {
        const remaining=Math.max(0,Math.ceil((p.ready-t)/1000));
        html='<div class="digits">'+(remaining?'Analyzing · '+remaining+'s':'Analysis ready')+'</div><div class="keygrid samples">'+[0,1,2,3].map(i=>key('Sample '+(i+1),'sample',i,remaining?'disabled':i===p.odd?'class="anomaly"':'class="active"')).join('')+'</div>';break;
      }
      case 'target': {
        const lit=(p.lane+Math.floor(rate(t)/p.period)*2)%5;
        html='<div class="radar">'+Array.from({length:5},(_,i)=>key(i===lit?'◉':'·','target',i,'class="'+(i===lit?'active':'')+'" aria-label="Target lane '+(i+1)+'"')).join('')+'</div><p class="muted">Tracks acquired: '+p.progress+' / 3</p>';break;
      }
      case 'calibrate':
        html='<div class="scope"><i></i><b></b></div>'+key('Capture reading','capture','','class="primary"')+'<p class="muted">Stable readings: '+p.progress+' / 3</p>';break;
      default:
        const controls={
          data:[p.stage===0?'DOWNLOAD TERMINAL':'UPLOAD TERMINAL',p.stage===0?'Hold to download':'Hold to upload','<i class="packet">▤</i><i class="packet">▣</i>'],
          scan:['SUIT SCANNER','Start scan','<i class="scanner"><b></b></i>'],
          waste:['WASTE LOCK','Hold purge lever','<i class="purge-lever"><b></b></i>'],
          fuel:[p.stage%2===0?'FILL FUEL CANISTER':'REFUEL ENGINE','Hold pump','<i class="fuel-cell"><b></b></i><i class="fuel-hose"></i>']
        }[id];
        html='<div class="hold-stage"><div class="tool-face"><span>'+controls[0]+'</span><div>'+controls[2]+'</div></div><progress value="0" max="1"></progress><button type="button" id="hold-control" class="primary">'+controls[1]+'</button></div>';
    }
    if(html!==last){hardware.innerHTML=html;last=html;}
    if(id==='calibrate')hardware.querySelector('.scope b').style.left=((rate(t)+p.offset)%p.period)/p.period*100+'%';
    const meter=hardware.querySelector('progress');
    if(meter){
      const fraction=held?Math.min(1,(t-holdAt)/(id==='data'?2700:1450)):0;
      meter.value=fraction;
      hardware.style.setProperty('--fraction',fraction);
      hardware.classList.toggle('engaged',held);
    }
  }
  async function submit(type,a,b){
    const reply=await send({type,a,b});
    if(reply.ok){
      status.textContent=reply.error||'';
      if(reply.puzzle)update(reply.puzzle,now());
    }
    return reply;
  }
  function setSteering(e){
    const pad=el.querySelector('.steering'), box=pad.getBoundingClientRect();
    for(const [axis,ratio] of [['axis',(e.clientX-box.left)/box.width],['axis-y',(e.clientY-box.top)/box.height]]){
      const slider=el.querySelector('#'+axis);
      slider.value=String(Math.round(Math.max(0,Math.min(1,ratio))*100));
      slider.nextElementSibling.value=slider.value;
    }
    mirrorSteering();
  }
  function mirrorSteering(){
    const marker=el.querySelector('.steering b');
    if(marker){marker.style.left=el.querySelector('#axis').value+'%';marker.style.top=el.querySelector('#axis-y').value+'%';}
  }
  el.addEventListener('input',e=>{
    if(e.target.type==='range'){e.target.nextElementSibling.value=e.target.value;mirrorSteering();}
  });
  el.addEventListener('click',async e=>{
    const b=e.target.closest('[data-key]');
    if(!b)return;
    const type=b.dataset.key,value=b.dataset.value;
    if(type==='left'){selected=value;update(p,now());return;}
    if(type==='right'){if(selected){await submit('pair',selected,value);selected=null;update(p,now());}return;}
    if(type==='axes'){await submit('set',Number(el.querySelector('#axis').value),Number(el.querySelector('#axis-y')?.value));return;}
    await submit(type,Number(value));
  });
  el.addEventListener('pointerdown',async e=>{
    const lead=e.target.closest('[data-key="left"]');
    if(lead&&!p.matched?.includes(lead.dataset.value)){
      const anchor=lead.querySelector('i').getBoundingClientRect();
      cable={lead:lead.dataset.value,x:anchor.x+anchor.width/2,y:anchor.y+anchor.height/2,downX:e.clientX,downY:e.clientY};
    }
    const steering=e.target.closest('.steering');
    if(steering){e.preventDefault();steering.setPointerCapture(e.pointerId);setSteering(e);}
    if(e.target.closest('#hold-control')){
      e.preventDefault();e.target.setPointerCapture(e.pointerId);held=true;holdAt=now();
      const reply=await submit('begin');if(!reply.ok)held=false;
    }
    const badge=e.target.closest('#badge');
    if(badge){
      e.preventDefault();badge.setPointerCapture(e.pointerId);
      dragging={x:e.clientX,node:badge,span:badge.parentElement.clientWidth-badge.offsetWidth-18};
      await submit('begin');
    }
  });
  el.addEventListener('pointermove',e=>{
    if(e.target.closest('.steering')&&e.buttons&1)setSteering(e);
    if(cable&&Math.hypot(e.clientX-cable.downX,e.clientY-cable.downY)>5){
      if(!cable.ghost){
        cable.ghost=document.createElement('span');
        cable.ghost.className='drag-cable';
        cable.ghost.style.background=colors[cable.lead];
        el.append(cable.ghost);
      }
      Object.assign(cable.ghost.style,{left:cable.x+'px',top:cable.y+'px',width:Math.hypot(e.clientX-cable.x,e.clientY-cable.y)+'px',
        transform:'rotate('+Math.atan2(e.clientY-cable.y,e.clientX-cable.x)+'rad)'});
    }
    if(dragging)dragging.node.style.transform='translateX('+Math.max(0,Math.min(dragging.span,e.clientX-dragging.x))+'px)';
  });
  el.addEventListener('pointerup',async e=>{
    if(cable){
      const pending=cable;cable=null;
      pending.ghost?.remove();
      const socket=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-key="right"]');
      if(pending.ghost&&socket){
        await submit('pair',pending.lead,socket.dataset.value);
        selected=null;update(p,now());
      }
    }
    if(held){held=false;await submit('finish');}
    if(dragging){
      const swipe=dragging;dragging=null;swipe.node.style.transform='';
      if(e.clientX-swipe.x>=swipe.span*.78)await submit('swipe');else status.textContent='Drag the badge to the far edge.';
    }
  });
  el.addEventListener('pointercancel',()=>{cable?.ghost?.remove();cable=null;held=false;if(dragging)dragging.node.style.transform='';dragging=null;});
  el.addEventListener('keydown',async e=>{
    if(e.repeat||!['Enter',' '].includes(e.key))return;
    if(e.target.matches('#badge')){
      e.preventDefault();
      if(held){held=false;await submit('swipe');}else{held=true;await submit('begin');}
    }
    if(e.target.matches('#hold-control')){
      e.preventDefault();
      if(held){held=false;await submit('finish');}else{held=true;holdAt=now();await submit('begin');}
    }
  });
  update(p,now());
  return {update};
}
