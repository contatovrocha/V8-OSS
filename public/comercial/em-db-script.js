/* Script SDR público: sem login. Só registra ligações e agendamentos (inserção); não lê dados de leads do banco. */
(function(){
  var sb=window.supabase.createClient('https://hmnhcinkmfwtutkbxejb.supabase.co','sb_publishable_U-B2cBm468M1lHoGZIzSnA_lmBsWe1S',{auth:{persistSession:false,autoRefreshToken:false}});
  var mine={},subs={};
  function mkDoc(id,data){return{id:id,exists:!!data,data:function(){return data||undefined}}}
  function emit(c){(subs[c]||[]).forEach(function(fn){var docs=(mine[c]||[]).map(function(r){return mkDoc(r.id,r.dados)});fn({docs:docs,size:docs.length,empty:!docs.length,metadata:{fromCache:false,hasPendingWrites:false},docChanges:function(){return[]}})})}
  function coll(c){return{
    add:async function(d){var id=Date.now().toString(36)+Math.random().toString(36).slice(2,8);
      var r=await sb.from('em_docs').insert({colecao:c,id:id,dados:d,atualizado_por:null});if(r.error)throw {code:'unavailable',message:r.error.message};
      (mine[c]=mine[c]||[]).push({id:id,dados:d});emit(c);return{id:id}},
    onSnapshot:function(next){(subs[c]=subs[c]||[]).push(next);emit(c);return function(){}}}}
  var DB={collection:coll,doc:function(){return{onSnapshot:function(){return function(){}}}}};
  window.claude={use:async function(n){return n==='db'?DB:null}};
})();
