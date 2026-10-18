import {NETWORK,canonical,validateVault} from './wallet.mjs';
export const ORIGINS=['http://127.0.0.1:5000','http://localhost:5000','http://127.0.0.1:5001','http://localhost:5001','https://30l3n0cw-5000.uks1.devtunnels.ms'];
const TTL=120000;
const fail=text=>{throw new Error(text);};
export function originAllowed(value){return ORIGINS.includes(value);}
export function siteContext(sender){
  let url;try{url=new URL(sender.url);}catch{fail('Site refusé.');}
  if(!originAllowed(url.origin)||sender.frameId!==0||!Number.isInteger(sender.tab?.id))fail('Site ou cadre refusé.');
  return {origin:url.origin,tabId:sender.tab.id};
}
export function trustedUI(sender,extensionId){
  try{return sender.id===extensionId&&new URL(sender.url).href.split('?')[0]===`chrome-extension://${extensionId}/popup.html`;}
  catch{return false;}
}
export async function verifySigned(tx,ticket,vault){
  const fields=['chain_id','kind','sender','recipient','amount','nonce','public_key','signature','id'];
  if(!tx||typeof tx!=='object'||Object.keys(tx).sort().join()!==fields.sort().join()
    ||tx.chain_id!==NETWORK||tx.kind!=='transfer'||tx.sender!==ticket.address||tx.public_key!==vault.publicKey
    ||tx.recipient!==ticket.recipient||tx.amount!==ticket.amount||tx.nonce!==ticket.nonce
    ||typeof tx.signature!=='string'||!/^[0-9a-f]{128}$/.test(tx.signature))fail('Signature différente du transfert approuvé.');
  const raw=s=>Uint8Array.from(s.match(/../g),b=>parseInt(b,16));
  const {signature,id,...payload}=tx;
  const publicKey=await crypto.subtle.importKey('raw',raw(vault.publicKey),'Ed25519',false,['verify']);
  if(!await crypto.subtle.verify('Ed25519',publicKey,raw(signature),new TextEncoder().encode(canonical(payload))))fail('Signature invalide.');
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical({...payload,signature}))));
  if(Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('')!==id)fail('Identifiant invalide.');
}
export function createEngine({local,session,network,openApproval,now=Date.now,randomId=()=>crypto.randomUUID()}){
  async function state(){return await local.get('state')||{vaults:[],active:'',grants:{}};}
  async function tickets(){const data=await session.get('tickets')||{};for(const [id,item] of Object.entries(data))if(now()-item.created>TTL)delete data[id];return data;}
  async function saveTickets(data){await session.set('tickets',data);}
  function account(s){return s.vaults.find(v=>v.address===s.active)||fail('Ouvrez MakutaWallet et créez ou restaurez un portefeuille.');}
  function connected(s,origin){const vault=account(s);if(s.grants[origin]!==vault.address)fail('Ce site doit être connecté à MakutaWallet.');return vault;}
  async function publicState(){const s=await state();return {...s,tickets:await tickets()};}
  async function cancelMatching(predicate){const data=await tickets();for(const item of Object.values(data))if(item.status==='pending'&&predicate(item)){item.status='error';item.error='Demande annulée.';}await saveTickets(data);}
  async function site(message,sender){
    const context=siteContext(sender);
    if(!message||message.channel!=='site'||typeof message.method!=='string')fail('Message invalide.');
    const s=await state();
    if(message.method==='makuta_accounts')return s.active&&s.grants[context.origin]===s.active?[s.active]:[];
    if(message.method==='makuta_disconnect'){
      delete s.grants[context.origin];await local.set('state',s);await cancelMatching(t=>t.origin===context.origin);return true;
    }
    if(message.method==='status'){
      const all=await tickets(),item=all[message.id];
      if(!item||item.origin!==context.origin||item.tabId!==context.tabId)fail('Demande absente, expirée ou inaccessible.');
      if(item.status==='pending')return {pending:true};
      delete all[message.id];await saveTickets(all);
      if(item.status==='error')fail(item.error);
      if(s.grants[context.origin]!==item.address||s.active!==item.address)fail('Connexion révoquée.');
      return {result:item.result};
    }
    if(!['makuta_requestAccounts','makuta_signTransaction'].includes(message.method))fail('Méthode non autorisée.');
    const vault=message.method==='makuta_requestAccounts'?account(s):connected(s,context.origin);
    const all=await tickets();
    if(Object.values(all).some(t=>t.status==='pending'))fail('Une demande est déjà ouverte dans MakutaWallet.');
    if(Object.keys(all).length>=20)fail('Trop de demandes récentes. Attendez deux minutes.');
    const item={...context,address:vault.address,method:message.method,created:now(),status:'pending'};
    if(message.method==='makuta_signTransaction'){
      const p=message.params;
      if(!p||typeof p!=='object'||Object.keys(p).sort().join()!=='amount,recipient,sender'
        ||p.sender!==vault.address||!/^mtc_[0-9a-f]{64}$/.test(p.recipient)||p.recipient===vault.address
        ||!Number.isSafeInteger(p.amount)||p.amount<1||p.amount>10000)fail('Transfert invalide.');
      const balance=await network(context.origin,vault.address);
      if(p.amount>balance.available)fail('Solde disponible insuffisant.');
      Object.assign(item,{recipient:p.recipient,amount:p.amount,nonce:balance.next_nonce});
    }
    const id=randomId();all[id]=item;await saveTickets(all);
    try{item.windowId=await openApproval(id);await saveTickets(all);}catch{delete all[id];await saveTickets(all);fail('Impossible d’ouvrir MakutaWallet. Ouvrez l’extension puis réessayez.');}
    return {ticket:id};
  }
  async function ui(message){
    const s=await state();
    if(message.method==='state')return publicState();
    if(message.method==='add'){
      const vault=validateVault(message.vault);
      if(s.vaults.length>=20||s.vaults.some(v=>v.address===vault.address))fail('Portefeuille déjà présent ou limite atteinte.');
      s.vaults.push(vault);s.active=vault.address;s.grants={};await local.set('state',s);await cancelMatching(()=>true);return true;
    }
    if(message.method==='select'){
      if(!s.vaults.some(v=>v.address===message.address))fail('Portefeuille absent.');
      s.active=message.address;s.grants={};await local.set('state',s);await cancelMatching(()=>true);return true;
    }
    if(message.method==='revoke'){
      s.grants={};await local.set('state',s);await cancelMatching(()=>true);return true;
    }
    if(message.method==='setNetwork'){
      if(!originAllowed(message.origin))fail('Réseau refusé.');
      s.displayNetwork=message.origin;await local.set('state',s);return true;
    }
    if(message.method==='balance'){
      if(!originAllowed(message.origin))fail('Réseau refusé.');
      const vault=account(s);
      if(message.address&&message.address!==vault.address)fail('Portefeuille modifié. Actualisez le solde.');
      return network(message.origin,vault.address);
    }
    if(message.method==='reject'){
      const all=await tickets(),item=all[message.id];if(!item||item.status!=='pending')fail('Demande expirée.');
      item.status='error';item.error='Demande refusée dans MakutaWallet.';await saveTickets(all);return true;
    }
    if(message.method==='approve'){
      const all=await tickets(),item=all[message.id];
      if(!item||item.status!=='pending'||item.address!==s.active)fail('Demande expirée ou portefeuille changé.');
      const vault=account(s);
      if(item.method==='makuta_requestAccounts'){
        s.grants[item.origin]=vault.address;s.displayNetwork=item.origin;await local.set('state',s);item.result=[vault.address];
      }else{
        connected(s,item.origin);
        await verifySigned(message.tx,item,vault);
        const balance=await network(item.origin,item.address);
        if(now()-item.created>TTL||balance.available<item.amount||balance.next_nonce!==item.nonce)fail('Demande expirée ou solde/nonce modifié. Refusez puis recommencez le transfert.');
        item.result=message.tx;
      }
      item.status='done';await saveTickets(all);return true;
    }
    fail('Commande non autorisée.');
  }
  return {site,ui,cancelMatching};
}
export async function dispatch(engine,message,sender,extensionId){
  if(!message||sender.id!==extensionId)fail('Émetteur refusé.');
  if(message.channel==='ui'){
    if(!trustedUI(sender,extensionId))fail('Interface de confiance requise.');
    return engine.ui(message);
  }
  return engine.site(message,sender);
}
