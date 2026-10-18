import {createWindowController} from './window-controller.mjs';
import {createEngine,dispatch,originAllowed} from './engine.mjs';
import {NETWORK} from './wallet.mjs';
const storage=area=>({get:async key=>(await area.get(key))[key],set:async(key,value)=>area.set({[key]:value})});
const ready=Promise.all([chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}),chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'})]);
async function network(origin,address){
  if(!originAllowed(origin))throw new Error('Réseau refusé.');
  const get=async path=>{
    const response=await fetch(origin+path,{headers:{Accept:'application/json'},credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error('Réseau indisponible (HTTP '+response.status+'). Vérifiez le serveur et l’accès au tunnel.');
    if(!response.headers.get('Content-Type')?.includes('application/json'))throw new Error('Le réseau ne renvoie pas l’API Makutachain. Vérifiez l’accès au tunnel.');
    return response.json();
  };
  const stats=await get('/api/stats');if(stats.chain_id!==NETWORK)throw new Error('Identité de réseau incorrecte.');
  const balance=await get('/api/balance/'+address);
  if(balance.address!==address||!Number.isSafeInteger(balance.available)||balance.available<0||!Number.isSafeInteger(balance.next_nonce)||balance.next_nonce<1)throw new Error('Réponse de réseau invalide.');
  if(balance.chain_id&&balance.chain_id!==NETWORK)throw new Error('Identité de réseau incorrecte.');
  return {...balance,chain_id:NETWORK,height:balance.height??stats.height,latest_hash:balance.latest_hash??stats.latest_hash};
}
const walletWindow=createWindowController({windows:chrome.windows,tabs:chrome.tabs,session:storage(chrome.storage.session),popupURL:chrome.runtime.getURL('popup.html')});
const engine=createEngine({local:storage(chrome.storage.local),session:storage(chrome.storage.session),network,
  openApproval:id=>walletWindow.open(id)});
let queue=Promise.resolve();
function serial(work){const result=queue.then(()=>ready).then(work);queue=result.catch(()=>{});return result;}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  serial(()=>dispatch(engine,message,sender,chrome.runtime.id)).then(result=>reply({ok:true,result})).catch(error=>reply({ok:false,error:error.message||'Opération impossible.'}));
  return true;
});
chrome.action.onClicked.addListener(()=>{
  serial(()=>walletWindow.open()).then(()=>chrome.action.setBadgeText({text:''})).catch(()=>chrome.action.setBadgeText({text:'!'}));
});
chrome.windows.onRemoved.addListener(windowId=>{serial(async()=>{await engine.cancelMatching(t=>t.windowId===windowId);await walletWindow.closed(windowId);}).catch(()=>{});});
chrome.tabs.onRemoved.addListener(tabId=>{serial(()=>engine.cancelMatching(t=>t.tabId===tabId)).catch(()=>{});});
chrome.tabs.onUpdated.addListener((tabId,change)=>{if(change.status==='loading')serial(()=>engine.cancelMatching(t=>t.tabId===tabId)).catch(()=>{});});
