import {createLatestRequest,createPoller} from './sync.mjs';
import {createWallet,unlockWallet,signTransfer,validateVault} from './wallet.mjs';
const el=id=>document.getElementById(id);
let state,requestId='',request=null,busy=false,sync;
const DEFAULT_NETWORK='http://127.0.0.1:5000';
const queryId=new URLSearchParams(location.search).get('request');
function message(text,error=false){el('status').textContent=text;el('status').classList.toggle('error',error);}
async function call(method,data={}){
  const response=await chrome.runtime.sendMessage({channel:'ui',method,...data});
  if(!response?.ok)throw new Error(response?.error||'MakutaWallet est indisponible.');return response.result;
}
function wallet(){const v=state.vaults.find(v=>v.address===state.active);if(!v)throw new Error('Créez ou restaurez un portefeuille.');return v;}
function details(values){el('request-details').replaceChildren();for(const [label,value] of values){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=String(value);el('request-details').append(dt,dd);}}
function renderState(next){
  const previousAddress=state?.active,previousRequest=requestId;state=next;
  const choices=state.vaults.length?state.vaults.map(v=>[v.address,v.name]):[['','Aucun portefeuille']];
  const select=el('account');
  if(JSON.stringify([...select.options].map(o=>[o.value,o.text]))!==JSON.stringify(choices)){select.replaceChildren();for(const [value,label] of choices)select.add(new Option(label,value));}
  if(select.value!==state.active)select.value=state.active;el('address').textContent=state.active||'Créez un portefeuille ou restaurez une sauvegarde du site.';
  el('grants').replaceChildren();for(const origin of Object.keys(state.grants)){const p=document.createElement('p');p.textContent=origin;el('grants').append(p);}
  if(!Object.keys(state.grants).length)el('grants').textContent='Aucun site autorisé.';
  const pending=Object.entries(state.tickets).find(([id,t])=>t.status==='pending'&&(!queryId||id===queryId));
  requestId=pending?.[0]||'';request=pending?.[1]||null;el('approval').hidden=!request;
  el('account').disabled=busy||!!request;el('create').closest('details').hidden=!!request;el('restore').closest('details').hidden=!!request;
  el('network').value=request?.origin||state.displayNetwork||DEFAULT_NETWORK;
  el('network').disabled=busy||!!request;
  if(previousAddress!==state.active||previousRequest!==requestId)el('sign-password').value='';
  if(previousAddress!==state.active)clearBalance();
  if(request){
    const signing=request.method==='makuta_signTransaction';
    el('request-title').textContent=signing?'Signer ce transfert ?':'Connecter ce site ?';
    details([['Site demandeur',request.origin],['Portefeuille',wallet().name],['Adresse',request.address],...(signing?[['Destinataire',request.recipient],['Montant',request.amount+' MTC'],['Frais','0 MTC'],['Nonce',request.nonce]]:[])]);
    el('request-help').textContent=signing?'Vérifiez le montant et l’adresse complète. Votre signature autorise ce transfert ; le site le transmettra au réseau.':'Le site pourra voir cette adresse et proposer des transferts. Chaque signature nécessitera une nouvelle confirmation.';
    el('sign-label').hidden=!signing;el('sign-password').hidden=!signing;el('approve').textContent=signing?'Signer le transfert':'Autoriser la connexion';
    el('network').value=request.origin;
  }
}
async function load(){renderState(await call('state'));}
function clearBalance(text='Synchronisation en cours…'){el('balance').textContent='— MTC';el('reserved').textContent='';el('balance-sync').textContent=text;}
sync=createLatestRequest({
  async read(){
    const next=await call('state');
    const pending=Object.entries(next.tickets).find(([id,t])=>t.status==='pending'&&(!queryId||id===queryId));
    const origin=pending?.[1].origin||next.displayNetwork||DEFAULT_NETWORK;
    if(!next.active)return {next,origin};
    try{
      const value=await call('balance',{origin,address:next.active});
      if(value.address!==next.active||!Number.isSafeInteger(value.available)||!Number.isSafeInteger(value.confirmed)||!Number.isSafeInteger(value.reserved)||value.available<0||value.confirmed-value.reserved!==value.available)throw new Error('Réponse de solde incohérente.');
      return {next,origin,value};
    }catch(error){return {next,origin,error};}
  },
  apply({next,origin,value,error}){
    renderState(next);
    if(error){clearBalance('Solde indisponible : '+error.message);return;}
    if(!value){clearBalance('Choisissez un portefeuille pour consulter son solde.');return;}
    if(state.active!==value.address||el('network').value!==origin)return false;
    el('balance').textContent=value.available+' MTC';el('reserved').textContent=value.confirmed+' confirmés · '+value.reserved+' réservés';
    el('balance-sync').textContent='Mis à jour à '+new Date().toLocaleTimeString('fr-FR')+(Number.isInteger(value.height)?' · bloc '+value.height:'')+' · actualisation automatique';
  },
  onError(error){clearBalance('Connexion indisponible : '+error.message);}
});
async function balance(){return sync.run();}
const autoPoll=createPoller({refresh:balance,canRun:()=>!busy&&document.visibilityState!=='hidden'&&!sync.pending});
window.addEventListener('focus',()=>void autoPoll.tick());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='hidden')void autoPoll.tick();});
async function action(event,work){event?.preventDefault();if(busy)return;sync.invalidate();busy=true;document.querySelectorAll('button,input,select').forEach(n=>n.disabled=true);try{await work();}catch(error){message(error.message||'Opération impossible.',true);}finally{document.querySelectorAll('input[type=password]').forEach(n=>n.value='');busy=false;document.querySelectorAll('button,input,select').forEach(n=>n.disabled=false);el('account').disabled=!!request;el('network').disabled=!!request;void autoPoll.tick();}}
el('create').addEventListener('submit',event=>action(event,async()=>{
  if(el('password').value!==el('confirmation').value)throw new Error('Les mots de passe ne correspondent pas.');
  const vault=await createWallet(el('name').value,el('password').value);await call('add',{vault});el('create').reset();await load();message('Portefeuille créé. Cliquez sur Sauvegarder avant de continuer.');
}));
el('restore').addEventListener('submit',event=>action(event,async()=>{
  const file=el('file').files[0];if(!file||file.size>16384)throw new Error('Choisissez une sauvegarde chiffrée de moins de 16 Ko.');
  let vault;try{vault=validateVault(JSON.parse(await file.text()));}catch{throw new Error('Format de sauvegarde invalide.');}
  await unlockWallet(vault,el('restore-password').value);await call('add',{vault});el('restore').reset();await load();message('Portefeuille restauré. Le coffre est verrouillé.');
}));
el('account').addEventListener('change',event=>action(event,async()=>{await call('select',{address:el('account').value});await load();clearBalance();message('Portefeuille changé. Reconnectez les sites pour utiliser cette adresse.');}));
el('backup').addEventListener('click',event=>action(event,async()=>{const vault=wallet(),url=URL.createObjectURL(new Blob([JSON.stringify(vault,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='makutawallet-'+vault.address.slice(-8)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Sauvegarde chiffrée téléchargée.');}));
el('copy').addEventListener('click',event=>action(event,async()=>{await navigator.clipboard.writeText(wallet().address);message('Adresse publique copiée.');}));
el('refresh').addEventListener('click',event=>action(event,async()=>{await balance();message('Solde actualisé.');}));
el('network').addEventListener('change',event=>action(event,async()=>{clearBalance();await call('setNetwork',{origin:el('network').value});await balance();}));
el('open-site').addEventListener('click',event=>action(event,async()=>{await chrome.tabs.create({url:el('network').value+'/#envoyer'});}));
el('revoke').addEventListener('click',event=>action(event,async()=>{await call('revoke');await load();message('Toutes les autorisations de sites ont été révoquées.');}));
el('approve').addEventListener('click',event=>action(event,async()=>{
  await load();if(!request)throw new Error('La demande est expirée.');
  let tx;
  if(request.method==='makuta_signTransaction'){
    const vault=wallet(),key=await unlockWallet(vault,el('sign-password').value);
    tx=await signTransfer(vault,key,request.recipient,request.amount,request.nonce);
  }
  await call('approve',{id:requestId,...(tx?{tx}:{})});await load();message('Demande approuvée. Le coffre est verrouillé.');
}));
el('reject').addEventListener('click',event=>action(event,async()=>{await call('reject',{id:requestId});await load();message('Demande refusée.');}));
window.addEventListener('pagehide',()=>{autoPoll.stop();sync.invalidate();document.querySelectorAll('input[type=password]').forEach(n=>n.value='');});
window.addEventListener('pageshow',()=>{autoPoll.start();void autoPoll.tick();});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.state&&!busy){sync.invalidate();void autoPoll.tick();}});
try{await load();message(request?'Vérifiez la demande avant de confirmer.':'Coffre verrouillé. Chaque signature demandera votre mot de passe.');try{await balance();}catch{message('Coffre prêt. Démarrez Makutachain pour consulter le solde.');}}catch(error){message(error.message,true);}

autoPoll.start();
