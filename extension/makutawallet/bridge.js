(()=>{
  if(window.top!==window||!['http://127.0.0.1:5000','http://localhost:5000','http://127.0.0.1:5001','http://localhost:5001'].includes(location.origin))return;
  const methods=new Set(['makuta_requestAccounts','makuta_accounts','makuta_signTransaction','makuta_disconnect']);
  const active=new Set();
  window.addEventListener('message',async event=>{
    const data=event.data;
    if(event.source!==window||event.origin!==location.origin||data?.channel!=='makutawallet:request'||typeof data.id!=='string'||data.id.length>80||!methods.has(data.method)||active.has(data.id))return;
    const reply=result=>window.postMessage({channel:'makutawallet:response',id:data.id,...result},location.origin);
    if(active.size>=2){reply({ok:false,error:'Une demande est déjà en cours.'});return;}
    active.add(data.id);
    try{
      let response=await chrome.runtime.sendMessage({channel:'site',method:data.method,params:data.params});
      if(!response?.ok)throw new Error(response?.error||'Extension indisponible.');
      if(response.result?.ticket){
        const ticket=response.result.ticket,end=Date.now()+122000;
        while(Date.now()<end){
          await new Promise(resolve=>setTimeout(resolve,700));
          response=await chrome.runtime.sendMessage({channel:'site',method:'status',id:ticket});
          if(!response?.ok)throw new Error(response?.error||'Demande interrompue.');
          if(!response.result.pending){reply({ok:true,result:response.result.result});return;}
        }
        throw new Error('Demande expirée.');
      }
      reply({ok:true,result:response.result});
    }catch(error){reply({ok:false,error:error.message||'Extension indisponible.'});}finally{active.delete(data.id);}
  });
})();
