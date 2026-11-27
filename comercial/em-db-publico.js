/* Placar ao vivo público: só leitura do placar (em_docs, coleção placar), sem login. */
(function(){
  var sb=window.supabase.createClient('https://hmnhcinkmfwtutkbxejb.supabase.co','sb_publishable_U-B2cBm468M1lHoGZIzSnA_lmBsWe1S',{auth:{persistSession:false,autoRefreshToken:false}});
  function mkDoc(id,data){return{id:id,exists:!!data,data:function(){return data||undefined},metadata:{fromCache:false,hasPendingWrites:false}}}
  function docRef(c,id){return{onSnapshot:function(next){var stop=false,t;var run=async function(){if(stop)return;try{var r=await sb.from('em_docs').select('dados').eq('colecao',c).eq('id',id);if(!r.error)next(mkDoc(id,r.data[0]&&r.data[0].dados))}catch(e){}t=setTimeout(run,15000)};run();return function(){stop=true;clearTimeout(t)}},
    set:function(){return Promise.reject({code:'invalid_argument'})}}}
  var DB={doc:function(p){var a=p.split('/');return docRef(a[0],a[1])}};
  var USER={can:async function(){return false},canEdit:async function(){return false},isOwner:async function(){return false}};
  window.claude={use:async function(n){return n==='db'?DB:n==='user'?USER:null}};
})();
