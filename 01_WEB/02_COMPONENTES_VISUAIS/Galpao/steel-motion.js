/* Local assembly lifecycle, exterior inspection and interior navigation. */
(() => {
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  window.startMetalloSteel=function(root){

    const canvas=root.querySelector('canvas');
    if(!canvas||!window.createMetalloStructure)return;
    const model=window.createMetalloStructure(),stage=root.querySelector('.steel-stage');
    const gpu=window.createMetalloRenderer?.(canvas,model),ctx=gpu?null:canvas.getContext('2d');
    if(!gpu&&!ctx)return;
    const interior=window.createMetalloInteriorCamera(model),freeCamera=window.createMetalloInteriorCamera(model,{free:true});
    const reduced=matchMedia('(prefers-reduced-motion: reduce)'),mobile=matchMedia('(max-width: 760px)');
    let paused=window.metalloMotionPaused??reduced.matches,assembly=paused?model.duration:0,time=0,focused=false,dead=false;
    let w=0,h=0,raf=0,last=0,lastPaint=0,yaw=model.views.perspective[0],pitch=model.views.perspective[1],zoom=1,expanded=false,drag=null,pan=0;
    let inside=false,free=false,insideZoom=1,freeZoom=1,exteriorView='perspective',detail=null;
    const fullBounds={x:[-6.3,6.5],y:[-.15,4.25],z:[-12.5,12.3]};
    const navigating=()=>inside||free,activeCamera=()=>free?freeCamera:interior;
    const keys=new Set();let navigationRaf=0,navigationLast=0;
    const cleanup=[];
    const listen=(el,event,fn,options)=>{el.addEventListener(event,fn,options);cleanup.push(()=>el.removeEventListener(event,fn,options))};
    const controls=document.createElement('div');controls.className='steel-controls';
    controls.innerHTML=`<div class="steel-progress-title"><span>PLASTAMP <i>·</i> OBRA METALLO</span><span class="steel-count"></span></div>
      <div class="steel-phase" role="status" aria-live="off"></div>
      <input class="steel-timeline" type="range" min="0" max="31" step=".1" value="0" aria-label="Etapa da montagem">
      <div class="steel-actions"><button type="button" data-steel="replay" title="Rever montagem">↻ <span>Rever montagem</span></button><button type="button" data-steel="structure">Ver estrutura</button><button type="button" data-steel="complete">Obra completa</button><button type="button" data-steel="inside" aria-pressed="false">Entrar no galpão</button><button type="button" data-steel="free" aria-pressed="false">Câmera livre</button><button type="button" data-steel="expand" aria-expanded="false">Ampliar ↗</button></div>
      <div class="steel-inspect"><label class="steel-stage-label">Etapa<select aria-label="Selecionar etapa">${model.phases.map((p,i)=>`<option value="${i}">${String(i+1).padStart(2,'0')} · ${p.label}</option>`).join('')}</select></label><label class="steel-view-label">Vista<select aria-label="Selecionar vista"><optgroup label="Exterior"><option value="perspective">Perspectiva</option><option value="side">Lateral</option><option value="end">Frente</option><option value="back">Fundo</option><option value="roof">Cobertura</option><option value="marked">Fachada revisada</option>${model.accesses.filter(o=>o.type==='portao').map(o=>`<option value="${o.id}">${o.label}</option>`).join('')}</optgroup><optgroup label="Detalhes da obra">${Object.entries(model.details).map(([id,p])=>`<option value="${id}">${p.label}</option>`).join('')}</optgroup><optgroup label="Interior">${Object.entries(interior.presets).map(([id,p])=>`<option value="${id}">${p.label}</option>`).join('')}</optgroup></select></label><label>Zoom <output class="steel-zoom-value">1,0×</output><input type="range" min=".75" max="3.5" step=".01" value="1" aria-label="Aproximar a obra"></label><button type="button" data-steel="left" aria-label="Girar para a esquerda">↶</button><button type="button" data-steel="right" aria-label="Girar para a direita">↷</button></div>
      <div class="steel-walk" hidden><div class="steel-walk-buttons" role="group" aria-label="Caminhar pelo galpão"><button type="button" data-walk="left" aria-label="Andar para a esquerda">←</button><button type="button" data-walk="forward" aria-label="Avançar no galpão">↑ Avançar</button><button type="button" data-walk="back" aria-label="Recuar no galpão">↓ Recuar</button><button type="button" data-walk="right" aria-label="Andar para a direita">→</button></div><label>Altura do olhar <output class="steel-eye-value">1,8 m</output><input type="range" min="1.05" max="12.3" step=".05" value="1.8" aria-label="Altura do olhar em metros"></label></div>
      <div class="steel-free-tools" hidden><label>Velocidade<select aria-label="Velocidade da câmera"><option value=".24">Precisão</option><option value="1.2" selected>Normal</option><option value="4.8">Rápida</option></select></label><button type="button" data-walk="up">↑ Subir</button><button type="button" data-walk="down">↓ Descer</button><button type="button" data-steel="frame">Reenquadrar obra</button></div>
      <p class="steel-help">Arraste para girar · roda do mouse para aproximar · setas para olhar.</p>
      <p class="steel-reference">Reconstrução visual da obra · proporções aproximadas de 100 × 50 × 14 m · 12 módulos longitudinais. Portas: 4 m · 3,5 m · 3 m. Posições conforme suas marcações; larguras aproximadas.</p>`;
    root.querySelector('.steel-visual').append(controls);
    const timeline=controls.querySelector('.steel-timeline'),phase=controls.querySelector('.steel-phase'),count=controls.querySelector('.steel-count');
    const phaseSelect=controls.querySelector('[aria-label="Selecionar etapa"]'),viewSelect=controls.querySelector('[aria-label="Selecionar vista"]');
    const zoomInput=controls.querySelector('[aria-label="Aproximar a obra"]'),eyeInput=controls.querySelector('[aria-label="Altura do olhar em metros"]');
    const toggle=root.querySelector('.motion-toggle'),expandButton=controls.querySelector('[data-steel="expand"]'),insideButton=controls.querySelector('[data-steel="inside"]');
    const freeButton=controls.querySelector('[data-steel="free"]'),speedSelect=controls.querySelector('[aria-label="Velocidade da câmera"]');
    const freeOption=document.createElement('option');freeOption.value='free';freeOption.textContent='Câmera livre';viewSelect.prepend(freeOption);
    stage.removeAttribute('aria-hidden');canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Reconstrução do galpão Plastamp, com 12 módulos longitudinais, bases soldadas em três passes, pilares centrais, mãos francesas, contraventamentos, calhas, três portões, saídas de emergência, escada amarela com patamar e linhas de vida na cobertura.');canvas.tabIndex=0;
    // Precompute materials once, including the softer light under the roof sheets.
    for(const p of model.parts)for(const f of p.faces){
      const n=f.normal,light=.66+Math.abs(n[0]*-.45+n[1]*.8+n[2]*-.35)*.32;
      f.fill=`rgb(${f.color.map(c=>Math.round(c*(f.style==='line'?1:light))).join(',')})`;
      f.insideFill=`rgb(${window.metalloInteriorColor(p,f).map(c=>Math.round(c*255)).join(',')})`;
    }
    let cy,sy,cp,sp,scale,ox,oy;
    function raw(v){const x=v[0]*cy+v[2]*sy,z=-v[0]*sy+v[2]*cy,y=v[1]-1.65;return [x,y*cp+z*sp,-y*sp+z*cp]}
    function projected(v){const p=raw(v),f=60/(60+p[2]);return [ox+p[0]*f*scale,oy-p[1]*f*scale,p[2]]}
    function camera(){
      cy=Math.cos(yaw+pan);sy=Math.sin(yaw+pan);cp=Math.cos(pitch);sp=Math.sin(pitch);
      const limits=detail?.bounds||fullBounds;
      const corners=[];for(const x of limits.x)for(const y of limits.y)for(const z of limits.z){let p=raw([x,y,z]),f=60/(60+p[2]);corners.push([p[0]*f,p[1]*f])}
      const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
      scale=Math.min(w*.91/(xmax-xmin),h*.9/(ymax-ymin))*zoom;ox=w*.5-(xmin+xmax)*scale/2;oy=h*.49+(ymin+ymax)*scale/2;
    }
    function poly(pts){ctx.beginPath();for(let i=0;i<pts.length;i++){if(i)ctx.lineTo(pts[i][0],pts[i][1]);else ctx.moveTo(pts[i][0],pts[i][1]);}if(pts.length>2)ctx.closePath()}
    let shownPhase=-1;
    function syncProgress(){
      const idx=model.phases.reduce((a,p,i)=>assembly>=p.time?i:a,0),p=model.phases[idx];
      timeline.value=String(assembly);timeline.style.setProperty('--progress',(assembly/model.duration*100)+'%');
      timeline.setAttribute('aria-valuetext',p.label);count.textContent=free?'CÂMERA LIVRE':inside?'VISTA INTERNA':String(idx+1).padStart(2,'0')+' / 09';
      if(shownPhase!==idx){phase.textContent=p.label;phaseSelect.value=String(idx);shownPhase=idx}
      controls.querySelector('[data-steel="structure"]').setAttribute('aria-pressed',String(Math.abs(assembly-16.9)<.01));
      controls.querySelector('[data-steel="complete"]').setAttribute('aria-pressed',String(assembly===model.duration));
      canvas.dataset.assembly=assembly.toFixed(2);canvas.dataset.motionTime=time.toFixed(3);canvas.dataset.phase=String(idx+1);canvas.dataset.view=free?'free':inside?'interior':'exterior';
    }
    function draw(){
      if(!w||!h||dead)return;camera();
      if(gpu){gpu.draw({cy,sy,cp,sp,scale,ox,oy,interiorLighting:inside,interiorMatrix:navigating()?activeCamera().matrix(w,h,free?freeZoom:insideZoom):null},assembly);syncProgress();return}
      ctx.clearRect(0,0,w,h);
      if(!navigating()){
        ctx.lineWidth=.5;ctx.strokeStyle='rgba(105,160,196,.08)';
        for(let i=-14;i<=14;i+=2){poly([projected([-9,-.06,i]),projected([9,-.06,i])]);ctx.stroke()}
        for(let i=-8;i<=8;i+=2){poly([projected([i,-.06,-14]),projected([i,-.06,14])]);ctx.stroke()}
        const foot=projected([0,0,0]),glow=ctx.createRadialGradient(foot[0],foot[1],0,foot[0],foot[1],w*.4);
        glow.addColorStop(0,'rgba(45,121,172,.14)');glow.addColorStop(1,'rgba(6,17,26,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
      }
      const faces=[];
      for(const part of model.parts){
        const t=clamp((assembly-part.delay)/part.duration,0,1);if(t===0)continue;
        const off=Math.pow(1-t,3),alpha=Math.min(1,t*3);
        for(const f of part.faces){
          const vertices=off?f.pts.map(v=>v.map((c,i)=>c+part.offset[i]*off)):f.pts;
          const points=navigating()?activeCamera().project(vertices,w,h,free?freeZoom:insideZoom):vertices.map(projected);
          if(points.length<2)continue;
          const depth=points.reduce((s,p)=>s+p[2],0)/points.length;
          faces.push({f,points,depth:depth+(f.style==='line'?-.008:0),alpha});
        }
      }
      faces.sort((a,b)=>b.depth-a.depth);
      for(const {f,points,alpha} of faces){
        const fill=inside?f.insideFill:f.fill;ctx.globalAlpha=alpha;poly(points);
        if(f.style==='line'){ctx.strokeStyle=fill;ctx.lineWidth=expanded?.65:.45;ctx.stroke();continue}
        ctx.fillStyle=fill;ctx.fill();
        if(f.style==='metal'){ctx.lineWidth=.3;ctx.strokeStyle='rgba(218,233,246,.32)';ctx.stroke()}
        else if(f.style==='panel'){ctx.lineWidth=.45;ctx.strokeStyle=fill;ctx.stroke()}
      }
      ctx.globalAlpha=1;syncProgress();
    }
    function resize(){syncHelp();const r=stage.getBoundingClientRect();w=r.width;h=r.height;const dpr=Math.min(devicePixelRatio||1,mobile.matches?1.5:2);if(gpu)gpu.resize(w,h,dpr);else{canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}canvas.style.width=w+'px';canvas.style.height=h+'px';draw()}
    const canAnimate=()=>!dead&&!paused&&!document.hidden&&!focused&&assembly<model.duration;
    function tick(now){raf=0;if(!canAnimate())return;const dt=last?Math.min((now-last)/1000,.1):0;last=now;assembly=Math.min(model.duration,assembly+dt);time+=dt;
      if(now-lastPaint>1000/(mobile.matches?20:30)){draw();lastPaint=now}
      if(assembly===model.duration){draw();syncToggle()}else raf=requestAnimationFrame(tick);
    }
    function schedule(){if(canAnimate()&&!raf){last=0;raf=requestAnimationFrame(tick)}else if(!canAnimate()&&raf){cancelAnimationFrame(raf);raf=0;last=0}}
    function syncToggle(){const done=assembly===model.duration;
      toggle.setAttribute('aria-pressed',String(paused));toggle.setAttribute('aria-label',done?'Rever montagem':paused?'Continuar montagem':'Pausar animação');
      toggle.title=toggle.getAttribute('aria-label');toggle.innerHTML=`<svg viewBox="0 0 20 20" aria-hidden="true">${paused||done?'<path d="m7 4 9 6-9 6Z"/>':'<path d="M7 4v12M13 4v12"/>'}</svg><span>${done?'Rever montagem':paused?'Continuar':'Pausar movimento'}</span>`;
      root.classList.toggle('motion-paused',paused||done);
    }
    function syncZoom(){
      const value=free?freeZoom:inside?insideZoom:zoom;zoomInput.value=String(value);
      controls.querySelector('.steel-zoom-value').textContent=value.toFixed(1).replace('.',',')+'×';
      canvas.dataset.zoom=value.toFixed(3);
    }
    function syncEye(){
      const value=interior.snapshot().position[1]/.24;eyeInput.value=String(value);
      controls.querySelector('.steel-eye-value').textContent=value.toFixed(1).replace('.',',')+' m';
    }
    function navigationUI(){
      stopNavigation();drag=null;root.classList.toggle('steel-interior',inside);root.classList.toggle('steel-free',free);
      controls.querySelector('.steel-walk').hidden=!navigating();eyeInput.closest('label').hidden=free;
      controls.querySelector('.steel-free-tools').hidden=!free;
      insideButton.textContent=inside?'Sair do galpão':'Entrar no galpão';insideButton.setAttribute('aria-pressed',String(inside));
      freeButton.textContent=free?'Sair da câmera livre':'Câmera livre';freeButton.setAttribute('aria-pressed',String(free));
      syncHelp();
      syncZoom();syncEye();
    }
    function syncHelp(){
      controls.querySelector('.steel-help').textContent=free?(mobile.matches?'Arraste para olhar · use os botões para mover, subir ou descer · ajuste a velocidade para ver os detalhes.':'Arraste: olhar · Shift + arraste ou botão direito: deslocar · roda: avançar/recuar · W A S D: mover · Q/E: descer/subir · Shift: acelerar · Esc: sair'):inside?'Roda: zoom · arraste: olhar · W A S D: caminhar · setas: olhar · Esc: sair':'Arraste para girar · roda do mouse para aproximar · setas para olhar.';
    }
    function leaveInterior(){if(!inside)return;inside=false;navigationUI();viewSelect.value=exteriorView;resize()}
    function leaveNavigation(){if(!navigating())return;inside=false;free=false;navigationUI();viewSelect.value=exteriorView;resize()}
    function enterInterior(preset='inside'){
      if(!expanded)expand();
      free=false;inside=true;interior.reset(preset);insideZoom=1;navigationUI();viewSelect.value=preset;seek(model.duration);resize();canvas.focus({preventScroll:true});
    }
    function enterFree(){
      const previousZoom=zoom,previousPose=inside?interior.snapshot():null;
      if(!expanded)expand();
      inside=false;free=true;freeZoom=previousPose?insideZoom:1;navigationUI();viewSelect.value='free';resize();
      if(previousPose)freeCamera.setPose(previousPose);
      else freeCamera.frame(detail?.bounds||fullBounds,yaw+pan,pitch,w/h,previousZoom);
      seek(assembly);canvas.focus({preventScroll:true});
    }
    function reframe(){
      freeCamera.frame(fullBounds,...model.views.perspective,w/h);freeZoom=1;syncZoom();draw();canvas.focus({preventScroll:true});
    }
    function seek(value){assembly=clamp(value,0,model.duration);paused=true;schedule();syncToggle();draw()}
    function replay(){leaveNavigation();assembly=0;time=0;paused=false;focused=false;window.metalloMotionPaused=false;syncToggle();draw();schedule()}
    function expand(){
      if(expanded)leaveNavigation();
      expanded=!expanded;root.classList.toggle('steel-expanded',expanded);expandButton.textContent=expanded?'Voltar ao login ↙':'Ampliar ↗';expandButton.setAttribute('aria-expanded',String(expanded));
      root.querySelector('.steel-form-section').inert=expanded;canvas.tabIndex=expanded?0:-1;zoom=1;syncZoom();resize();
      if(expanded){seek(assembly);canvas.focus({preventScroll:true})}else expandButton.focus({preventScroll:true});
    }
    function turn(horizontal,vertical=0){if(navigating())activeCamera().look(horizontal,vertical);else{pan+=horizontal;pitch=clamp(pitch+vertical,.05,1.4)}draw()}
    function walk(forward,sideways=0,vertical=0){if(!navigating())return;activeCamera().move(forward,sideways,vertical);syncEye();draw()}
    function setZoom(value){if(free)freeZoom=clamp(value,.75,3.5);else if(inside)insideZoom=clamp(value,.75,3.5);else zoom=clamp(value,.75,3.5);syncZoom();draw()}
    function stopNavigation(){keys.clear();cancelAnimationFrame(navigationRaf);navigationRaf=0;navigationLast=0}
    function moveKeys(dt){
      const forward=Number(keys.has('w'))-Number(keys.has('s')),sideways=Number(keys.has('d'))-Number(keys.has('a')),vertical=Number(keys.has('e'))-Number(keys.has('q'));
      const length=Math.hypot(forward,sideways,vertical);if(!length)return;
      const step=Number(speedSelect.value)*(keys.has('shift')?3:1)*dt/length;
      walk(forward*step,sideways*step,vertical*step);
    }
    function navigateTick(now){
      navigationRaf=0;if(!free||dead||document.hidden||!keys.size)return;
      moveKeys(navigationLast?Math.min((now-navigationLast)/1000,.05):0);navigationLast=now;
      navigationRaf=requestAnimationFrame(navigateTick);
    }
    listen(toggle,'click',()=>{if(assembly===model.duration)replay();else{paused=!paused;window.metalloMotionPaused=paused;syncToggle();schedule()}});
    listen(timeline,'input',()=>{leaveInterior();seek(Number(timeline.value))});
    listen(phaseSelect,'change',()=>{leaveInterior();seek(model.phases[Number(phaseSelect.value)].end)});
    listen(viewSelect,'change',()=>{
      const selected=viewSelect.value;if(selected==='free'){enterFree();return}if(interior.presets[selected]){enterInterior(selected);return}leaveNavigation();
      const views=model.views;
      const access=model.accesses.find(o=>o.id===selected);detail=model.details[selected]||null;[yaw,pitch]=detail?[detail.yaw,detail.pitch]:access?[access.yaw,.1]:views[selected];pan=0;zoom=1;syncZoom();exteriorView=selected;viewSelect.value=selected;
      if(access||detail)seek(model.duration);else draw();
    });
    listen(zoomInput,'input',e=>setZoom(Number(e.target.value)));
    listen(eyeInput,'input',e=>{interior.height(Number(e.target.value));syncEye();draw()});
    listen(controls,'click',e=>{
      const walking=e.target.closest('[data-walk]')?.dataset.walk;
      if(walking){const step=free?Number(speedSelect.value)*.3:.32;walk(walking==='forward'?step:walking==='back'?-step:0,walking==='left'?-step:walking==='right'?step:0,walking==='up'?step:walking==='down'?-step:0);return}
      const action=e.target.closest('[data-steel]')?.dataset.steel;if(!action)return;
      if(action==='replay')replay();if(action==='structure'){leaveInterior();seek(16.9)}if(action==='complete')seek(model.duration);if(action==='expand')expand();
      if(action==='inside'){if(inside)leaveInterior();else enterInterior()}if(action==='left'||action==='right')turn(action==='left'?-.18:.18);
      if(action==='free'){if(free)leaveNavigation();else enterFree()}if(action==='frame'&&free)reframe();
    });
    listen(canvas,'wheel',e=>{
      if(!expanded||e.ctrlKey||e.metaKey)return;e.preventDefault();
      const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?h:1);
      if(free)walk(-clamp(delta,-500,500)*Number(speedSelect.value)*.003);
      else setZoom((inside?insideZoom:zoom)*Math.exp(-clamp(delta,-500,500)*.0015));
    },{passive:false});
    listen(canvas,'pointerdown',e=>{if(!expanded||(e.button!==0&&!(free&&e.button===2)))return;canvas.focus({preventScroll:true});drag={x:e.clientX,y:e.clientY,pan:free&&(e.shiftKey||e.button===2)};canvas.setPointerCapture(e.pointerId)});
    listen(canvas,'pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;if(free&&(drag.pan||e.shiftKey)){const step=Number(speedSelect.value)*.008;freeCamera.pan(-dx*step,dy*step);draw()}else turn(dx*.006,dy*(navigating()?-.003:.003))});
    listen(canvas,'contextmenu',e=>{if(free&&expanded)e.preventDefault()});
    listen(canvas,'pointerup',()=>{drag=null});listen(canvas,'pointercancel',()=>{drag=null});listen(canvas,'lostpointercapture',()=>{drag=null});
    listen(canvas,'keydown',e=>{
      if(!expanded||e.ctrlKey||e.metaKey||e.altKey)return;
      const key=e.key.toLowerCase(),step=e.shiftKey?.48:.20;
      if(free&&['w','a','s','d','q','e','shift'].includes(key)){
        e.preventDefault();keys.add(key);if(e.shiftKey)keys.add('shift');
        if(!e.repeat)moveKeys(.04);if(!navigationRaf)navigationRaf=requestAnimationFrame(navigateTick);return;
      }
      if(inside&&['w','a','s','d'].includes(key)){e.preventDefault();walk(key==='w'?step:key==='s'?-step:0,key==='a'?-step:key==='d'?step:0);return}
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();turn(e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0,e.key==='ArrowUp'?.06:e.key==='ArrowDown'?-.06:0)}
    });
    listen(window,'keyup',e=>{keys.delete(e.key.toLowerCase());if(!e.shiftKey)keys.delete('shift');if(!keys.size)stopNavigation()});
    listen(canvas,'blur',stopNavigation);listen(window,'blur',stopNavigation);
    listen(root,'keydown',e=>{if(e.key==='Escape'&&expanded){e.preventDefault();if(navigating())leaveNavigation();else expand()}});
    listen(root,'focusin',e=>{if(e.target.closest('.steel-form-section')&&e.target.matches('input,select,textarea')){focused=true;schedule()}});
    listen(root,'focusout',()=>{focused=false;schedule()});listen(document,'visibilitychange',()=>{stopNavigation();schedule()});
    listen(reduced,'change',()=>{paused=reduced.matches;window.metalloMotionPaused=paused;if(paused)assembly=model.duration;syncToggle();draw();schedule()});
    const ro=new ResizeObserver(resize);ro.observe(stage);canvas.tabIndex=-1;syncZoom();syncToggle();resize();schedule();
    return {destroy(){dead=true;stopNavigation();cancelAnimationFrame(raf);ro.disconnect();cleanup.forEach(fn=>fn());gpu?.destroy();controls.remove()}};
  };
})();
