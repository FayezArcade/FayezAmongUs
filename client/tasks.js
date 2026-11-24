import {wireColors} from '../shared/deck.js';

const legends={
  wire:'Drag a lead to its matching socket, or select both ends.',
  card:'Drag the access badge all the way through the reader at a steady speed.',
  data:'Start the transfer and keep this terminal open until it finishes.',
  route:'Move the selector into the highlighted current band.',
  align:'Center the gimbal within the illuminated tolerance.',
  scan:'Hold the scanner engaged until its reading stabilizes.',
  target:'Tap each illuminated debris target before it moves.',
  shield:'Switch every shield cell online.',
  waste:'Hold the purge control down to cycle the waste lock.',
  fuel:'Hold the pump to complete the fuel transfer.',
  calibrate:'Capture three readings when the needle enters the bright band.',
  filter:'Drag each particle into the exhaust, or select it to clear it.',
  sample:'Start the analysis. Return after the countdown and select the anomalous sample.',
  sequence:'Open the valves in ascending numerical order.',
  chart:'Drag along the flight path from start to finish, or select waypoints in order.',
  clean:'Remove all debris from the maintenance grate.',
  nav:'Move the crosshair into the marked circle, then lock the course.',
  reactor:'Memorize the firing order before the relay display goes dark.'
};
const key=(label,type,a='',attr='')=>`<button type="button" data-key="${type}" data-value="${a}" ${attr}>${label}</button>`;
const range=(id,title,target)=>`<label>${title}<div class="slider"><span style="left:${target}%"></span><input id="${id}" type="range" min="0" max="100" value="50"><output>50</output></div></label>`;
const fileIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2h11l5 5v15H4z M14 3v6h5 M8 13h8 M8 17h6"/></svg>';
const taskAccent={wire:'amber',card:'amber',data:'ice',route:'amber',align:'amber',scan:'mint',target:'ice',shield:'ice',waste:'amber',fuel:'amber',calibrate:'amber',filter:'mint',sample:'mint',sequence:'ice',chart:'ice',clean:'mint',nav:'ice',reactor:'ice'};

export function taskPanel(el,initial,now,send) {
  let transferEnding=false;
  let p=initial, selected=null, dragging=null, cable=null, held=false, holdAt=0, last='';
  let plotting=false, plottingStep=false, particle=null;
  const id=initial.instrument||initial.id;
  const status=document.createElement('p');status.className='feedback';status.setAttribute('role','status');
  el.innerHTML=`<p class="instrument-help">${legends[id]}</p><div class="hardware" data-accent="${taskAccent[id]}"></div>`;
  const hardware=el.querySelector('.hardware');hardware.dataset.instrument=id;el.append(status);
  const rate=(t)=>Math.max(0,t-p.start);
  function update(next,t) {
    p=next;
    let html='';
    switch(id){
      case 'wire': {
        const wire=(c,side)=>key('<i></i><span>'+c+'</span>',side,c,`style="--lead:${wireColors[c]}" class="${p.matched?.includes(c)?'matched':''} ${selected===c&&side==='left'?'selected':''}"`);
        const links=(p.matched||[]).map(c=>{const y=24+48*p.left.indexOf(c),to=24+48*p.right.indexOf(c);return '<path d="M0 '+y+' C30 '+y+',70 '+to+',100 '+to+'" fill="none" stroke="'+wireColors[c]+'" stroke-width="3" vector-effect="non-scaling-stroke"/>';}).join('');
        html='<div class="wires"><div>'+p.left.map(c=>wire(c,'left')).join('')+'</div><svg viewBox="0 0 100 192" preserveAspectRatio="none" aria-hidden="true">'+links+'</svg><div>'+p.right.map(c=>wire(c,'right')).join('')+'</div></div>';break;
      }
      case 'card':
        html='<div class="reader"><div class="reader-line"></div><span class="reader-direction" aria-hidden="true">› › ›</span><button type="button" id="badge" aria-label="Swipe access badge"><i></i> CREW ACCESS</button></div><p class="muted key-hint">Keyboard: press the badge button twice at swipe speed.</p>';break;
      case 'nav':
        html='<div class="steering" aria-label="Guidance crosshair"><i style="left:'+p.target+'%;top:'+p.targetY+'%"></i><b></b></div><div class="steering-sliders">'+range('axis','Horizontal setting',p.target)+range('axis-y','Vertical setting',p.targetY)+'</div>'+key('Lock course','axes','','class="primary"');
        break;
      case 'route':
        if(p.stage===1){html='<div class="relay-meter" aria-hidden="true"><span></span><i></i><span></span></div>'+key('Accept power','accept','','class="primary"');break;}
        // The first stage uses the same trim control as engine alignment.
      case 'align':
        html=(id==='route'?'<div class="current-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>':'<div class="gimbal" aria-hidden="true" style="--target:'+p.target+'%"><i></i><b></b></div>')+range('axis',id==='align'?'Engine trim':'Auxiliary current',p.target)+key('Confirm reading','axes','','class="primary"');break;
      case 'shield':
        html='<div class="keygrid shield-grid">'+p.active.map((on,i)=>key('<i aria-hidden="true"></i>'+(i+1)+' · '+(on?'ON':'OFF'),'toggle',i,'class="'+(on?'active':'')+'" aria-pressed="'+on+'"')).join('')+'</div>';break;
      case 'filter':case 'clean':
        html='<div class="strainer">'+[0,1,2,3,4].map(i=>p.debris.includes(i)?key(['◆','✦','●','◒','◈'][i],'clear',i,'aria-label="Remove particle '+(i+1)+'"'):'<span>·</span>').join('')+(id==='filter'?'<div class="filter-exhaust">Exhaust</div>':'')+'</div>';break;
      case 'chart':{
        const xs=[10,30,50,70,90];
        html='<div class="chart-board"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="'+p.waypoints.map((y,i)=>xs[i]+','+y).join(' ')+'" fill="none" stroke="#9aaf8e" stroke-width="1" stroke-dasharray="3 3"/></svg>'+p.waypoints.map((y,i)=>key(i<p.progress?'●':i+1,'waypoint',i,'style="left:'+xs[i]+'%;top:'+y+'%" class="'+(i<=p.progress?'active':'')+'"')).join('')+'</div>';break;
      }
      case 'sequence':case 'reactor': {
        const showing=id==='reactor'&&t<p.reveal;
        const reading=id==='sequence'?'VALVES '+p.progress+' / 10':showing?'WATCH THE RELAYS':'REPEAT THE PATTERN';
        const pads=Array.from({length:9},(_,i)=>i+1);
        const display=id==='reactor'?'<div class="relay-display" aria-hidden="true">'+pads.map(n=>'<i class="'+(p.cue===n?'live':'')+'"></i>').join('')+'</div>':'';
        html='<div class="digits">'+reading+'</div>'+(id==='reactor'?'<p class="muted key-hint">Sequence '+p.level+' / 5</p>':'')+'<div class="relay-controls">'+display+'<div class="keygrid">'+(p.keys||pads).map(value=>key(value,'key',value,
          showing?'disabled class="'+(p.cue===value?'relay-lit':'')+'"':id==='sequence'&&value<=p.progress?'disabled class="active"':'')).join('')+'</div></div>';break;
      }
      case 'sample': {
        if(p.ready===null){html='<div class="digits">SAMPLE ANALYZER</div>'+key('Start analysis','beginSample','','class="primary"');break;}
        const remaining=Math.max(0,Math.ceil((p.ready-t)/1000));
        html='<div class="digits">'+(remaining?'Analyzing · '+remaining+'s':'Analysis ready')+'</div><div class="keygrid samples">'+[0,1,2,3,4].map(i=>key('<i aria-hidden="true"></i><span>'+(i+1)+'</span>','sample',i,'aria-label="Sample '+(i+1)+'" '+(i===p.odd?'class="anomaly"':p.odd===undefined?'disabled':'class="active"'))).join('')+'</div>';break;
      }
      case 'target': {
        const lit=(p.lane+Math.floor(rate(t)/p.period)*2)%5;
        const lanes=[[16,35],[37,64],[53,32],[71,62],[85,35]];
        const [x,y]=lanes[lit];
        html='<div class="asteroid-field" data-frame="'+Math.floor(rate(t)/p.period)+'">'+key('◈','target',lit,'class="asteroid" style="--x:'+x+'%;--y:'+y+'%" aria-label="Target debris"')+'</div><p class="muted">Tracks acquired: '+p.progress+' / 3</p>';break;
      }
      case 'calibrate':
        html='<div class="calibration-dial"><i></i><b></b></div>'+key('Capture reading','capture','','class="primary"')+'<p class="muted key-hint">Stable readings: '+p.progress+' / 3</p>';break;
      default:
        const controls={
          data:[p.stage===0?'DOWNLOAD TERMINAL':'UPLOAD TERMINAL',p.stage===0?'Download':'Upload','<div class="packet-rail"><span>'+fileIcon+'</span><i></i><span>'+fileIcon+'</span></div>'],
          scan:['SUIT SCANNER','Start scan','<i class="scanner"><b></b></i>'],
          waste:['WASTE LOCK','Hold purge lever','<i class="purge-lever"><b></b></i>'],
          fuel:[p.stage%2===0?'FILL FUEL CANISTER':'REFUEL ENGINE','Hold pump','<i class="fuel-cell"><b></b></i><i class="fuel-hose"></i>']
        }[id];
        const leverButton='<button type="button" id="hold-control" class="lever-button" aria-label="Hold purge lever">'+controls[2]+'</button>';
        const control=id==='waste'?'':'<button type="button" '+(id==='data'?'data-key="begin" '+(p.hold!==null?'disabled':''):'id="hold-control"')+' class="primary">'+controls[1]+'</button>';
        html='<div class="hold-stage"><div class="tool-face"><span>'+controls[0]+'</span><div>'+(id==='waste'?leverButton:controls[2])+'</div></div><progress value="0" max="1"></progress>'+control+'</div>';
    }
    if(html!==last){
      const focused=document.activeElement;
      const focusKey=hardware.contains(focused)&&focused.dataset.key?focused.dataset:{};
      hardware.innerHTML=html;last=html;
      if(focusKey.key){
        const choices=[...hardware.querySelectorAll('button:not(:disabled)[data-key]')];
        const replacement=choices.find(b=>b.dataset.key===focusKey.key&&b.dataset.value===focusKey.value)||
          choices.find(b=>b.dataset.key===focusKey.key);
        replacement?.focus({preventScroll:true});
      }
    }
    if(id==='calibrate')hardware.querySelector('.calibration-dial b').style.rotate=((rate(t)+p.offset)%p.period)/p.period*360+'deg';
    const meter=hardware.querySelector('progress');
    if(meter){
      const running=id==='data'?p.hold!==null:held;
      const fraction=running?Math.max(0,Math.min(1,(t-(id==='data'?p.hold:holdAt))/(id==='data'?2700:1450))):0;
      if(id==='data'&&fraction>=1&&!transferEnding){
        transferEnding=true;
        queueMicrotask(async()=>{const reply=await submit('finish');if(!reply.ok||reply.error)transferEnding=false;});
      }
      meter.value=fraction;
      hardware.style.setProperty('--fraction',fraction);
      hardware.classList.toggle('engaged',running);
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
  async function plot(button){
    const waypoint=Number(button?.dataset.value);
    if(plottingStep||waypoint!==p.progress)return;
    plottingStep=true;
    try{await submit('waypoint',waypoint);}finally{plottingStep=false;}
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
    if(e.target.type==='range'){
      e.target.nextElementSibling.value=e.target.value;
      hardware.style.setProperty('--trim',e.target.value);
      mirrorSteering();
    }
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
    const waypoint=e.target.closest('[data-key="waypoint"]');
    if(waypoint&&e.button===0){
      e.preventDefault();el.setPointerCapture(e.pointerId);plotting=true;
      await plot(waypoint);return;
    }
    const debris=e.target.closest('[data-key="clear"]');
    if(id==='filter'&&debris&&e.button===0){
      e.preventDefault();el.setPointerCapture(e.pointerId);
      particle={index:Number(debris.dataset.value),glyph:debris.textContent,x:e.clientX,y:e.clientY};return;
    }
    const lead=e.target.closest('[data-key="left"]');
    if(lead&&!p.matched?.includes(lead.dataset.value)){
      const anchor=lead.querySelector('i').getBoundingClientRect();
      cable={lead:lead.dataset.value,x:anchor.x+anchor.width/2,y:anchor.y+anchor.height/2,downX:e.clientX,downY:e.clientY};
    }
    const steering=e.target.closest('.steering');
    if(steering){e.preventDefault();steering.setPointerCapture(e.pointerId);setSteering(e);}
    if(e.target.closest('#hold-control')){
      e.preventDefault();e.target.closest('#hold-control').setPointerCapture(e.pointerId);held=true;holdAt=now();
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
    if(plotting)void plot(document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-key="waypoint"]'));
    if(particle&&Math.hypot(e.clientX-particle.x,e.clientY-particle.y)>5){
      if(!particle.ghost){
        particle.ghost=document.createElement('span');particle.ghost.className='drag-particle';
        particle.ghost.textContent=particle.glyph;el.append(particle.ghost);
      }
      Object.assign(particle.ghost.style,{left:e.clientX+'px',top:e.clientY+'px'});
    }
    if(e.target.closest('.steering')&&e.buttons&1)setSteering(e);
    if(cable&&Math.hypot(e.clientX-cable.downX,e.clientY-cable.downY)>5){
      if(!cable.ghost){
        cable.ghost=document.createElement('span');
        cable.ghost.className='drag-cable';
        cable.ghost.style.background=wireColors[cable.lead];
        el.append(cable.ghost);
      }
      Object.assign(cable.ghost.style,{left:cable.x+'px',top:cable.y+'px',width:Math.hypot(e.clientX-cable.x,e.clientY-cable.y)+'px',
        transform:'rotate('+Math.atan2(e.clientY-cable.y,e.clientX-cable.x)+'rad)'});
    }
    if(dragging)dragging.node.style.transform='translateX('+Math.max(0,Math.min(dragging.span,e.clientX-dragging.x))+'px)';
  });
  el.addEventListener('pointerup',async e=>{
    plotting=false;
    if(particle){
      const released=particle;particle=null;released.ghost?.remove();
      if(!released.ghost||document.elementFromPoint(e.clientX,e.clientY)?.closest('.filter-exhaust'))await submit('clear',released.index);
    }
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
  el.addEventListener('pointercancel',()=>{plotting=false;particle?.ghost?.remove();particle=null;cable?.ghost?.remove();cable=null;held=false;if(dragging)dragging.node.style.transform='';dragging=null;});
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
