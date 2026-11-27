/* Efeitos do painel comercial: pó dourado subindo no fundo e explosão de partículas quando uma meta é batida. */
(function(){
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dpr=Math.min(2,window.devicePixelRatio||1);
  function mkCanvas(z){var c=document.createElement('canvas');c.setAttribute('aria-hidden','true');c.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:'+z;document.body.appendChild(c);return c}
  function fit(c){c.width=Math.round(innerWidth*dpr);c.height=Math.round(innerHeight*dpr)}

  /* ---- pó dourado (fundo) ---- */
  var dust=null,dc,dx,P=[];
  function startDust(){if(dust||reduce)return;dust=true;dc=mkCanvas(0);dx=dc.getContext('2d');fit(dc);
    var n=Math.round(Math.min(90,innerWidth*innerHeight/16000));
    for(var i=0;i<n;i++)P.push(spawn(true));
    addEventListener('resize',function(){fit(dc)});
    (function loop(){dx.clearRect(0,0,dc.width,dc.height);
      for(var i=0;i<P.length;i++){var p=P[i];p.y-=p.v;p.x+=Math.sin((p.y+p.ph)/60)*.25;p.t+=.012;
        if(p.y<-10)P[i]=spawn(false);
        var a=p.a*(.55+.45*Math.sin(p.t));dx.globalAlpha=a;dx.fillStyle=p.c;dx.beginPath();dx.arc(p.x*dpr,p.y*dpr,p.r*dpr,0,6.283);dx.fill()}
      dx.globalAlpha=1;requestAnimationFrame(loop)})()}
  function spawn(any){return{x:Math.random()*innerWidth,y:any?Math.random()*innerHeight:innerHeight+10,r:.6+Math.random()*1.6,v:.15+Math.random()*.45,a:.08+Math.random()*.16,ph:Math.random()*400,t:Math.random()*6,c:Math.random()<.7?'#d4a64a':'#f3d58a'}}

  /* ---- explosão de partículas (meta batida) ---- */
  var bc=null,bx,B=[],running=false;
  function burst(el,opts){if(reduce||!el)return;opts=opts||{};
    if(!bc){bc=mkCanvas(80);bx=bc.getContext('2d');fit(bc);addEventListener('resize',function(){fit(bc)})}
    var r=el.getBoundingClientRect();if(!r.width)return;
    var cx=r.left+r.width/2,cy=r.top+r.height/2,n=opts.n||Math.round(Math.min(520,(r.width+r.height)*1.6));
    var cols=opts.colors||['#fff3c4','#f3d58a','#d4a64a','#ffe08a','#ffffff'];
    for(var i=0;i<n;i++){var side=Math.random()*4|0,sx,sy;
      if(side===0){sx=r.left+Math.random()*r.width;sy=r.top}else if(side===1){sx=r.right;sy=r.top+Math.random()*r.height}else if(side===2){sx=r.left+Math.random()*r.width;sy=r.bottom}else{sx=r.left;sy=r.top+Math.random()*r.height}
      var ang=Math.atan2(sy-cy,sx-cx)+(Math.random()-.5)*.9,sp=1.5+Math.random()*7;
      B.push({x:sx,y:sy,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-1.2,r:.5+Math.random()*1.8,life:1,dec:.008+Math.random()*.014,c:cols[Math.random()*cols.length|0]})}
    if(!running){running=true;tick()}}
  function tick(){bx.clearRect(0,0,bc.width,bc.height);bx.globalCompositeOperation='lighter';
    for(var i=B.length-1;i>=0;i--){var p=B[i];p.x+=p.vx;p.y+=p.vy;p.vx*=.965;p.vy=p.vy*.965+.035;p.life-=p.dec;
      if(p.life<=0){B.splice(i,1);continue}
      bx.globalAlpha=Math.max(0,p.life);bx.fillStyle=p.c;bx.beginPath();bx.arc(p.x*dpr,p.y*dpr,p.r*dpr*(0.6+p.life*.6),0,6.283);bx.fill()}
    bx.globalAlpha=1;bx.globalCompositeOperation='source-over';
    if(B.length)requestAnimationFrame(tick);else{running=false;bx.clearRect(0,0,bc.width,bc.height)}}

  window.FX={dust:startDust,burst:burst};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startDust);else startDust();
})();
