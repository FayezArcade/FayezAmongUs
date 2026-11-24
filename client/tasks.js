import {colors} from '../shared/deck.js';

const legends={
  wire:'Select a lead on the left, then connect it to a matching socket.',
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
  sequence:'Enter the digits in the order shown.',
  nav:'Match both guidance axes to their highlighted bands.',
  reactor:'Memorize the firing order before the relay display goes dark.'
};
const key=(label,type,a='',attr='')=>`<button type="button" data-key="${type}" data-value="${a}" ${attr}>${label}</button>`;
const range=(id,title,target)=>`<label>${title}<div class="slider"><span style="left:${target}%"></span><input id="${id}" type="range" min="0" max="100" value="50"><output>50</output></div></label>`;

export function taskPanel(el,initial,now,send) {
  let p=initial, selected=null, dragging=null, held=false, holdAt=0, last='';
  const id=initial.id;
  const status=document.createElement('p');status.className='feedback';status.setAttribute('role','status');
  el.innerHTML=`<p class="instrument-help">${legends[id]}</p><div class="hardware"></div>`;
  const hardware=el.querySelector('.hardware');el.append(status);
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
      case 'align':case 'route':case 'nav':
        html=range('axis','Horizontal setting',p.target)+(id==='nav'?range('axis-y','Vertical setting',p.targetY):'')+key('Confirm reading','axes','','class="primary"');break;
      case 'shield':
        html='<div class="keygrid">'+p.active.map((on,i)=>key((i+1)+' · '+(on?'ON':'OFF'),'toggle',i,'class="'+(on?'active':'')+'"')).join('')+'</div>';break;
      case 'filter':
        html='<div class="strainer">'+[0,1,2,3,4].map(i=>p.debris.includes(i)?key(['◆','✦','●','◒','◈'][i],'clear',i,'aria-label="Remove particle '+(i+1)+'"'):'<span>·</span>').join('')+'</div>';break;
      case 'sequence':case 'reactor': {
        const reading=p.sequence?.join(' · ')||'•••••';
        html='<div class="digits">'+reading+'</div><p class="muted">Accepted: '+p.progress+'</p><div class="keygrid">'+Array.from({length:id==='reactor'?9:6},(_,i)=>key(i+1,'key',i+1)).join('')+'</div>';break;
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
        html='<div class="hold-stage"><progress value="0" max="1"></progress><button type="button" id="hold-control" class="primary">Engage control</button></div>';
    }
    if(html!==last){hardware.innerHTML=html;last=html;}
    if(id==='calibrate')hardware.querySelector('.scope b').style.left=((rate(t)+p.offset)%p.period)/p.period*100+'%';
    if(hardware.querySelector('progress'))hardware.querySelector('progress').value=held?Math.min(1,(t-holdAt)/(id==='data'?2700:1450)):0;
  }
  async function submit(type,a,b){
    const reply=await send({type,a,b});
    if(reply.ok){
      status.textContent=reply.error||'';
      if(reply.puzzle)update(reply.puzzle,now());
    }
    return reply;
  }
  el.addEventListener('input',e=>{if(e.target.type==='range')e.target.nextElementSibling.value=e.target.value;});
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
    if(dragging)dragging.node.style.transform='translateX('+Math.max(0,Math.min(dragging.span,e.clientX-dragging.x))+'px)';
  });
  el.addEventListener('pointerup',async e=>{
    if(held){held=false;await submit('finish');}
    if(dragging){
      const swipe=dragging;dragging=null;swipe.node.style.transform='';
      if(e.clientX-swipe.x>=swipe.span*.78)await submit('swipe');else status.textContent='Drag the badge to the far edge.';
    }
  });
  el.addEventListener('pointercancel',()=>{held=false;if(dragging)dragging.node.style.transform='';dragging=null;});
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
