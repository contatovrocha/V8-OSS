/* Painel adm E-commerce Million: login (Supabase Auth) + armazenamento compartilhado (tabela em_docs). */
(function(){
  var SB_URL='https://hmnhcinkmfwtutkbxejb.supabase.co', SB_KEY='sb_publishable_U-B2cBm468M1lHoGZIzSnA_lmBsWe1S';
  var sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
  window.EMSB=sb;
  var resolveReady, ready=new Promise(function(r){resolveReady=r}), allowed=false, listeners=[];
  function esc(t){var d=document.createElement('div');d.textContent=t;return d.innerHTML}
  var css=document.createElement('style');css.textContent='.em-gate{position:fixed;inset:0;z-index:999;display:grid;place-items:center;background:radial-gradient(900px 500px at 50% 0%,rgba(212,166,74,.12),transparent 60%),#050505;font-family:Inter,system-ui,sans-serif;color:#f5f2ea;padding:16px}.em-card{width:100%;max-width:400px;background:#0e0d0b;border:1px solid #2a251c;border-radius:22px;padding:30px}.em-card .e{font:600 12px Inter,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#d4a64a}.em-card h1{font:800 28px Sora,Inter,sans-serif;margin:6px 0 4px}.em-card p{color:#a39d91;font-size:14px;margin:0 0 18px}.em-card label{display:block;font-size:12.5px;color:#a39d91;margin:12px 0 6px}.em-card input{width:100%;box-sizing:border-box;background:#090807;border:1px solid #2a251c;border-radius:12px;color:#f5f2ea;font:500 15px Inter,sans-serif;padding:12px 14px;outline:0}.em-card input:focus{border-color:#d4a64a}.em-card button.p{width:100%;margin-top:18px;background:linear-gradient(180deg,#f6dc95,#d4a64a 55%,#b88a33);color:#1a1205;border:0;border-radius:12px;padding:13px;font:700 15px Inter,sans-serif;cursor:pointer}.em-card button.p:disabled{opacity:.6}.em-msg{min-height:20px;margin-top:12px;font-size:13px;color:#e8a33c}.em-alt{margin-top:14px;background:none;border:0;color:#a39d91;font:500 13px Inter,sans-serif;cursor:pointer;text-decoration:underline}.em-user{position:fixed;right:14px;bottom:14px;z-index:90;display:flex;gap:8px;align-items:center;background:rgba(14,13,11,.9);border:1px solid #2a251c;border-radius:99px;padding:6px 8px 6px 14px;font:500 12px Inter,sans-serif;color:#a39d91}.em-user button{background:none;border:1px solid #2a251c;color:#f5f2ea;border-radius:99px;padding:4px 10px;font:600 12px Inter,sans-serif;cursor:pointer}';(document.head||document.documentElement).appendChild(css);
  var gate=null,mode='login';
  function showGate(msg){
    if(!gate){gate=document.createElement('div');gate.className='em-gate';document.body.appendChild(gate)}
    gate.innerHTML='<form class="em-card" id="emForm"><div class="e">E-commerce Million · Adm</div><h1>'+(mode==='login'?'Entrar':'Criar senha')+'</h1><p>'+(mode==='login'?'Acesso restrito ao time comercial.':'Primeiro acesso: use o e-mail liberado pelo gestor.')+'</p><label for="emE">E-mail</label><input id="emE" type="email" autocomplete="email" required><label for="emP">Senha</label><input id="emP" type="password" autocomplete="'+(mode==='login'?'current-password':'new-password')+'" minlength="6" required><button class="p" type="submit" id="emB">'+(mode==='login'?'Entrar':'Criar senha')+'</button><div class="em-msg" id="emM">'+(msg?esc(msg):'')+'</div><button type="button" class="em-alt" id="emAlt">'+(mode==='login'?'Primeiro acesso? Criar senha':'Já tenho senha: entrar')+'</button></form>';
    document.getElementById('emAlt').onclick=function(){mode=mode==='login'?'signup':'login';showGate('')};
    document.getElementById('emForm').onsubmit=async function(e){e.preventDefault();var b=document.getElementById('emB'),m=document.getElementById('emM'),em=document.getElementById('emE').value.trim().toLowerCase(),pw=document.getElementById('emP').value;b.disabled=true;m.textContent='';
      try{var r=mode==='login'?await sb.auth.signInWithPassword({email:em,password:pw}):await sb.auth.signUp({email:em,password:pw});
        if(r.error){m.textContent=r.error.message.indexOf('Invalid login')>=0?'E-mail ou senha incorretos.':r.error.message.indexOf('already registered')>=0?'Este e-mail já tem senha. Use "Entrar".':'Não foi possível: '+r.error.message}
        else if(mode==='signup'&&!r.data.session){m.textContent='Enviamos um e-mail de confirmação. Confirme e depois entre.';mode='login'}
        else await afterLogin(r.data.session)}catch(err){m.textContent='Sem conexão. Tente de novo.'}
      b.disabled=false};
    var pe=new URLSearchParams(location.search).get('email');if(pe&&mode==='login'){document.getElementById('emE').value=pe}
    setTimeout(function(){var i=document.getElementById(pe?'emP':'emE');if(i)i.focus()},50);
  }
  async function afterLogin(session){
    var r=await sb.rpc(window.EM_ACESSO||'em_pode');allowed=!r.error&&r.data===true;
    if(!allowed){await sb.auth.signOut();showGate('Seu e-mail ainda não tem acesso a este painel. Peça ao gestor para liberar.');return}
    if(gate){gate.remove();gate=null}
    if(window.self!==window.top){resolveReady();return}
    var u=document.createElement('div');u.className='em-user';u.innerHTML='<span>'+esc(session.user.email)+'</span><button type="button">Sair</button>';u.querySelector('button').onclick=async function(){await sb.auth.signOut();location.reload()};document.body.appendChild(u);
    resolveReady();
  }
  function parse(path){var p=path.split('/');return{c:p[0],id:p[1]}}
  function mkDoc(id,data){return{id:id,exists:!!data,data:function(){return data||undefined},metadata:{fromCache:false,hasPendingWrites:false}}}
  function refresh(){listeners.forEach(function(l){l()})}
  async function q(c,id){var r=sb.from('em_docs').select('id,dados').eq('colecao',c);if(id)r=r.eq('id',id);var res=await r;if(res.error)throw res.error;return res.data}
  function poll(fn){var stop=false,t;var run=async function(){if(stop)return;try{await fn()}catch(e){}t=setTimeout(run,5000)};listeners.push(function(){clearTimeout(t);run()});run();return function(){stop=true;clearTimeout(t)}}
  async function upsert(c,id,d){var r=await sb.from('em_docs').upsert({colecao:c,id:id,dados:d,atualizado_em:new Date().toISOString()});if(r.error)throw {code:r.error.code==='42501'?'invalid_argument':'unavailable',message:r.error.message};refresh()}
  function docRef(c,id){return{id:id,path:c+'/'+id,
    get:async function(){var d=await q(c,id);return mkDoc(id,d[0]&&d[0].dados)},
    set:function(d){return upsert(c,id,d)},
    update:async function(d){var cur=await q(c,id);return upsert(c,id,Object.assign({},cur[0]&&cur[0].dados,d))},
    delete:async function(){var r=await sb.from('em_docs').delete().eq('colecao',c).eq('id',id);if(r.error)throw {code:'unavailable',message:r.error.message};refresh()},
    onSnapshot:function(next,err){return poll(async function(){var d=await q(c,id);next(mkDoc(id,d[0]&&d[0].dados))})}}}
  var DB={doc:function(path){var p=parse(path);return docRef(p.c,p.id)},
    collection:function(c){return{path:c,doc:function(id){return docRef(c,id||(Date.now().toString(36)+Math.random().toString(36).slice(2,8)))},
      add:async function(d){var id=Date.now().toString(36)+Math.random().toString(36).slice(2,8);await upsert(c,id,d);return docRef(c,id)},
      onSnapshot:function(next,err){return poll(async function(){var rows=await q(c);var docs=rows.map(function(r){return mkDoc(r.id,r.dados)});next({docs:docs,size:docs.length,empty:!docs.length,metadata:{fromCache:false,hasPendingWrites:false},docChanges:function(){return[]}})})}}}};
  var USER={can:async function(){return allowed},isOwner:async function(){return false},canEdit:async function(){return allowed}};
  window.claude={use:async function(name){await ready;return name==='db'?DB:name==='user'?USER:null}};
  function boot(){sb.auth.getSession().then(function(r){var s=r.data&&r.data.session;if(s)afterLogin(s);else showGate('')})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
