/* Sons do painel comercial (sintetizados com Web Audio, sem arquivos) e pop-up gigante de meta batida.
   SFX.whoosh(ms)  velocímetros carregando: "vuuuuUU" crescente e rasante
   SFX.sale(fora)  venda nova (fora do horário = mais energético)
   SFX.meta()      meta batida
   SFX.celebrate({time,sub,meta,valor,fora}, done)  pop-up gigante + som
   O navegador só libera som depois de um clique/toque na página: o botão de som no canto faz isso. */
(function(){
  var AC=window.AudioContext||window.webkitAudioContext,ctx=null,master=null,verb=null,unlocked=false,cbs=[];
  var KEY='em_som';function pref(){try{return localStorage.getItem(KEY)!=='off'}catch(e){return true}}
  function setPref(on){try{localStorage.setItem(KEY,on?'on':'off')}catch(e){}}
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init(){if(ctx||!AC)return ctx;ctx=new AC();
    var comp=ctx.createDynamicsCompressor();comp.threshold.value=-14;comp.knee.value=12;comp.ratio.value=4;comp.attack.value=.004;comp.release.value=.25;
    master=ctx.createGain();master.gain.value=.9;master.connect(comp);comp.connect(ctx.destination);
    verb=ctx.createConvolver();var len=Math.floor(ctx.sampleRate*2.8),ir=ctx.createBuffer(2,len,ctx.sampleRate);
    for(var c=0;c<2;c++){var d=ir.getChannelData(c);for(var i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6)}
    verb.buffer=ir;var vg=ctx.createGain();vg.gain.value=.38;verb.connect(vg);vg.connect(master);return ctx}
  function ok(){return pref()&&ctx&&ctx.state==='running'}
  function noiseBuf(sec){var n=Math.floor(ctx.sampleRate*sec),b=ctx.createBuffer(1,n,ctx.sampleRate),d=b.getChannelData(0);for(var i=0;i<n;i++)d[i]=Math.random()*2-1;return b}
  function out(node,wet){node.connect(master);if(wet){var s=ctx.createGain();s.gain.value=wet;node.connect(s);s.connect(verb)}}
  function env(g,t,a,peak,hold,rel){g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+a);g.gain.setValueAtTime(peak,t+a+hold);g.gain.exponentialRampToValueAtTime(0.0001,t+a+hold+rel)}
  function tone(type,f,t,a,peak,hold,rel,wet,f2){var o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+a+hold+rel);env(g,t,a,peak,hold,rel);o.connect(g);out(g,wet);o.start(t);o.stop(t+a+hold+rel+.05);return o}
  function boom(t,peak){var o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(140,t);o.frequency.exponentialRampToValueAtTime(34,t+.9);
    g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+.012);g.gain.exponentialRampToValueAtTime(0.0001,t+1.4);o.connect(g);out(g,.25);o.start(t);o.stop(t+1.5);
    var n=ctx.createBufferSource(),lp=ctx.createBiquadFilter(),ng=ctx.createGain();n.buffer=noiseBuf(.5);lp.type='lowpass';lp.frequency.setValueAtTime(2200,t);lp.frequency.exponentialRampToValueAtTime(200,t+.4);
    ng.gain.setValueAtTime(peak*.6,t);ng.gain.exponentialRampToValueAtTime(0.0001,t+.45);n.connect(lp);lp.connect(ng);out(ng,.3);n.start(t)}
  function crash(t,peak,dur){var n=ctx.createBufferSource(),hp=ctx.createBiquadFilter(),g=ctx.createGain();n.buffer=noiseBuf(dur);hp.type='highpass';hp.frequency.value=2800;
    g.gain.setValueAtTime(peak,t);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);n.connect(hp);hp.connect(g);out(g,.5);n.start(t)}
  /* vuuuuUU: ruído com filtro subindo + motor grave acelerando, pouso rasante no fim */
  function riser(t,d,peak){var n=ctx.createBufferSource(),bp=ctx.createBiquadFilter(),g=ctx.createGain();n.buffer=noiseBuf(d+.4);bp.type='bandpass';bp.Q.value=1.4;
    bp.frequency.setValueAtTime(180,t);bp.frequency.exponentialRampToValueAtTime(4200,t+d*.9);bp.frequency.exponentialRampToValueAtTime(900,t+d+.3);
    g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(peak*.25,t+d*.4);g.gain.exponentialRampToValueAtTime(peak,t+d*.9);g.gain.exponentialRampToValueAtTime(0.0001,t+d+.32);
    n.connect(bp);bp.connect(g);out(g,.35);n.start(t);n.stop(t+d+.4);
    [0,7,-5].forEach(function(cents,k){var o=ctx.createOscillator(),lp=ctx.createBiquadFilter(),og=ctx.createGain();o.type='sawtooth';o.detune.value=cents;
      o.frequency.setValueAtTime(48*(k===2?.5:1),t);o.frequency.exponentialRampToValueAtTime(520*(k===2?.5:1),t+d*.92);o.frequency.exponentialRampToValueAtTime(260*(k===2?.5:1),t+d+.3);
      lp.type='lowpass';lp.frequency.setValueAtTime(300,t);lp.frequency.exponentialRampToValueAtTime(5000,t+d*.9);lp.Q.value=4;
      og.gain.setValueAtTime(0.0001,t);og.gain.exponentialRampToValueAtTime(peak*.11,t+d*.5);og.gain.exponentialRampToValueAtTime(peak*.2,t+d*.9);og.gain.exponentialRampToValueAtTime(0.0001,t+d+.3);
      o.connect(lp);lp.connect(og);out(og,.25);o.start(t);o.stop(t+d+.35)})}

  var SFX={
    whoosh:function(ms){if(!ok())return;var t=ctx.currentTime+.02,d=Math.max(.6,(ms||1800)/1000);riser(t,d*.92,.8);boom(t+d*.92,.55)},
    sale:function(fora){if(!ok())return;var t=ctx.currentTime+.02;boom(t,.9);
      var notes=fora?[1318.5,1568,2093,2637,3136]:[1046.5,1318.5,1568,2093];
      notes.forEach(function(f,i){var s=t+.08+i*(fora?.055:.075);tone('triangle',f,s,.005,.32,.04,.55,.55);tone('sine',f*2,s,.005,.08,.02,.35,.6)});
      if(fora){tone('sawtooth',260,t+.02,.01,.16,.05,.22,.3,2600);tone('square',2093,t+.4,.005,.06,.02,.25,.5,4186)}
      crash(t+.05,.12,1.2)},
    meta:function(){if(!ok())return;var t=ctx.currentTime+.02,h=1.15;riser(t,h,.75);boom(t+h,1);crash(t+h,.3,2.8);
      [130.81,196,261.63,329.63,392,523.25].forEach(function(f){var o=ctx.createOscillator(),lp=ctx.createBiquadFilter(),g=ctx.createGain();o.type='sawtooth';o.frequency.value=f;
        var vib=ctx.createOscillator(),vg=ctx.createGain();vib.frequency.value=5.2;vg.gain.value=f*.006;vib.connect(vg);vg.connect(o.frequency);
        lp.type='lowpass';lp.frequency.setValueAtTime(300,t+h);lp.frequency.exponentialRampToValueAtTime(3200,t+h+.2);lp.frequency.exponentialRampToValueAtTime(1400,t+h+2.6);
        env(g,t+h,.08,.09,1.7,1.3);o.connect(lp);lp.connect(g);out(g,.5);o.start(t+h);vib.start(t+h);o.stop(t+h+3.2);vib.stop(t+h+3.2)});
      [523.25,659.25,783.99,1046.5].forEach(function(f,i){var s=t+h+.12+i*.14;tone('triangle',f,s,.01,.28,i===3?1.2:.08,i===3?1.2:.3,.55);tone('sawtooth',f,s,.01,.05,i===3?1.2:.08,i===3?1.1:.25,.4)})},
    celebrate:function(o,done){o=o||{};var el=popup();el.className='em-meta'+(o.fora?' fora':'');
      el.querySelector('.em-mt').textContent=o.time||'';el.querySelector('.em-ms').textContent=o.sub||'';el.querySelector('.em-mn').textContent=o.meta||'';el.querySelector('.em-mv').textContent=o.valor||'';
      el.hidden=false;void el.offsetWidth;el.classList.add('on');SFX.meta();
      var card=el.querySelector('.em-mc'),cols=['#fff3c4','#f3d58a','#d4a64a','#ffe08a','#ffffff','#8dff9a'];
      if(window.FX&&!reduce)[1250,1600,2100,2900,3800].forEach(function(ms,i){setTimeout(function(){FX.burst(card,{n:i<2?700:420,colors:cols})},ms)});
      var fin=function(){if(!el.classList.contains('on'))return;el.classList.remove('on');setTimeout(function(){el.hidden=true;if(done)done()},500)};
      el.onclick=fin;setTimeout(fin,7600)},
    on:function(){return pref()},
    onUnlock:function(fn){cbs.push(fn);if(unlocked)fn()}
  };

  var POP=null;
  function popup(){if(POP)return POP;var st=document.createElement('style');st.textContent=
    '.em-meta{position:fixed;inset:0;z-index:110;display:grid;place-items:center;background:radial-gradient(circle at 50% 50%,rgba(34,24,5,.93),rgba(0,0,0,.98) 70%);opacity:0;transition:opacity .45s;cursor:pointer;overflow:hidden;font-family:Inter,sans-serif}'+
    '.em-meta[hidden]{display:none!important}.em-meta.on{opacity:1}'+
    '.em-rays{position:absolute;left:50%;top:50%;width:260vmax;height:260vmax;margin:-130vmax 0 0 -130vmax;background:repeating-conic-gradient(from 0deg,rgba(243,213,138,.09) 0deg 6deg,transparent 6deg 18deg);animation:emspin 18s linear infinite;opacity:0;transition:opacity 1s .9s;-webkit-mask:radial-gradient(circle,#000 0,transparent 55%);mask:radial-gradient(circle,#000 0,transparent 55%)}'+
    '.em-meta.on .em-rays{opacity:1}@keyframes emspin{to{transform:rotate(360deg)}}'+
    '.em-mc{position:relative;text-align:center;padding:4vmin 7vmin;transform:scale(.2);opacity:0}'+
    '.em-meta.on .em-mc{animation:empop .9s cubic-bezier(.2,1.6,.4,1) 1.1s forwards,emshake .5s ease-in-out 1.15s 1}'+
    '@keyframes empop{0%{transform:scale(.2);opacity:0}60%{opacity:1}100%{transform:scale(1);opacity:1}}'+
    '@keyframes emshake{0%,100%{translate:0 0}20%{translate:-14px 6px}40%{translate:12px -8px}60%{translate:-8px 4px}80%{translate:6px -3px}}'+
    '.em-k{font:800 clamp(14px,2.2vmin,30px) Inter,sans-serif;letter-spacing:.42em;text-transform:uppercase;color:#8dff9a;text-shadow:0 0 18px rgba(84,240,74,.7)}'+
    '.em-mt{font:800 clamp(28px,7vmin,96px) Sora,sans-serif;color:#fff;margin-top:1vmin;letter-spacing:-.01em}'+
    '.em-ms{font:600 clamp(11px,1.7vmin,22px) Inter,sans-serif;letter-spacing:.3em;text-transform:uppercase;color:#a39d91}'+
    '.em-mn{font:800 clamp(52px,17vmin,260px) Sora,sans-serif;line-height:1;margin-top:2vmin;letter-spacing:-.03em;background:linear-gradient(180deg,#fff7d6 0%,#f3d58a 38%,#d4a64a 62%,#8a6420 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 30px rgba(243,213,138,.55)) drop-shadow(0 6px 0 rgba(90,60,10,.6))}'+
    '.em-mv{font:800 clamp(24px,6vmin,84px) Sora,sans-serif;color:#f3d58a;margin-top:1.5vmin;font-variant-numeric:tabular-nums;text-shadow:0 0 24px rgba(243,213,138,.5)}'+
    '.em-meta.fora .em-k{color:#e8ff3a}.em-meta.fora .em-mn{background:linear-gradient(180deg,#f4ffd6,#7dff5a 45%,#00ffd0);-webkit-background-clip:text;background-clip:text}'+
    '@media (prefers-reduced-motion:reduce){.em-rays{animation:none}.em-meta.on .em-mc{animation:none;transform:none;opacity:1}}';
    document.head.appendChild(st);
    POP=document.createElement('div');POP.className='em-meta';POP.hidden=true;POP.setAttribute('role','alert');
    POP.innerHTML='<div class="em-rays" aria-hidden="true"></div><div class="em-mc"><div class="em-k">🏆 Meta batida</div><div class="em-mt"></div><div class="em-ms"></div><div class="em-mn"></div><div class="em-mv"></div></div>';
    document.body.appendChild(POP);return POP}

  /* botão de som */
  var btn=null;
  function paintBtn(){if(!btn)return;var on=pref(),run=ctx&&ctx.state==='running';btn.textContent=!on?'🔇 som':run?'🔊 som':'🔊 Ativar som';btn.classList.toggle('need',on&&!run);btn.setAttribute('aria-pressed',String(on&&run))}
  function unlock(){if(!AC)return;init();if(ctx.state!=='running')ctx.resume().then(after,function(){});else after()}
  function after(){paintBtn();if(ctx.state==='running'&&!unlocked){unlocked=true;cbs.forEach(function(f){try{f()}catch(e){}})}}
  function mkBtn(){var st=document.createElement('style');st.textContent='.em-snd{position:fixed;left:88px;bottom:8px;z-index:60;font:600 10px Inter,sans-serif;color:#a39d91;background:rgba(14,13,11,.75);border:1px solid #2a251c;border-radius:99px;padding:3px 9px;cursor:pointer;opacity:.6}.em-snd:hover,.em-snd:focus-visible{opacity:1;color:#f3d58a}.em-snd.need{opacity:1;color:#1a1205;background:#d4a64a;border-color:#d4a64a;animation:emsnd 1.6s ease-in-out infinite}@keyframes emsnd{50%{box-shadow:0 0 0 6px rgba(212,166,74,0)}0%{box-shadow:0 0 0 0 rgba(212,166,74,.6)}}';document.head.appendChild(st);
    btn=document.createElement('button');btn.type='button';btn.className='em-snd';btn.title='Ligar ou desligar os sons do painel';document.body.appendChild(btn);
    btn.addEventListener('click',function(e){e.stopPropagation();var run=ctx&&ctx.state==='running';if(pref()&&run){setPref(false)}else{setPref(true);unlock()}paintBtn()});paintBtn()}
  ['pointerdown','keydown','touchstart'].forEach(function(ev){addEventListener(ev,function(e){if(e.target!==btn&&pref())unlock()},{capture:true,passive:true})});
  function boot(){mkBtn();if(AC&&pref()){init();ctx.resume().then(after,function(){});setTimeout(paintBtn,300)}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.SFX=SFX;
})();
