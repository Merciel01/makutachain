(()=>{
  if(window.top!==window||window.makutawallet||!['http://127.0.0.1:5000','http://localhost:5000','http://127.0.0.1:5001','http://localhost:5001'].includes(location.origin))return;
  const methods=new Set(['makuta_requestAccounts','makuta_accounts','makuta_signTransaction','makuta_disconnect']);
  const pending=new Map();
  window.addEventListener('message',event=>{
    const data=event.data;
    if(event.source!==window||event.origin!==location.origin||data?.channel!=='makutawallet:response')return;
    const item=pending.get(data.id);if(!item)return;
    clearTimeout(item.timer);pending.delete(data.id);
    if(data.ok)item.resolve(data.result);else item.reject(new Error(data.error||'Demande refusée.'));
  });
  const provider=Object.freeze({isMakutaWallet:true,request({method,params}={}){
    if(!methods.has(method))return Promise.reject(new Error('Méthode non autorisée.'));
    if(pending.size>=2)return Promise.reject(new Error('Une demande est déjà en cours.'));
    return new Promise((resolve,reject)=>{
      const id=crypto.randomUUID(),timer=setTimeout(()=>{pending.delete(id);reject(new Error('Demande expirée. Consultez MakutaWallet puis réessayez.'));},125000);
      pending.set(id,{resolve,reject,timer});window.postMessage({channel:'makutawallet:request',id,method,params},location.origin);
    });
  }});
  Object.defineProperty(window,'makutawallet',{value:provider,writable:false,configurable:false});
  window.dispatchEvent(new Event('makutawallet:ready'));
})();
