import {createWallet,unlockWallet,signTransfer,validateVault} from './wallet.mjs';
const el=id=>document.getElementById(id);
const STORAGE='mithimbochain.wallets.v1';
let storageHealthy=true,storageChanged=false;
let wallets=[],active='',unlocked=null,unlockedAddress='',draft=null,busy=false,sessionReady=false;
let stats=null,transactions={pending:[],confirmed:[]},blocks=[],balances=new Map(),lockTimer;
function message(text,error=false){el('status').textContent=text;el('status').classList.toggle('error',error);}
function selected(){return wallets.find(w=>w.address===active);}
function requireWallet(){const wallet=selected();if(!wallet)throw new Error('Créez ou restaurez un portefeuille dans le menu « Portefeuilles ».');return wallet;}
function locked(){return !unlocked || unlockedAddress!==active;}
function lock(){unlocked=null;unlockedAddress='';clearTimeout(lockTimer);draft=null;el('send-review').hidden=true;el('unlock-password').value='';renderWalletState();}
function armLock(){clearTimeout(lockTimer);lockTimer=setTimeout(()=>{lock();message('Le portefeuille a été verrouillé après 5 minutes.');},5*60*1000);}
async function rawApi(path,data){
  const options={credentials:'same-origin'};
  if(data!==undefined)Object.assign(options,{method:'POST',headers:{'Content-Type':'application/json','X-Mithimbo-Client':'web'},body:JSON.stringify(data)});
  let response;
  const controller=new AbortController();options.signal=controller.signal;
  const timeout=setTimeout(()=>controller.abort(),10000);
  try{response=await fetch(path,options);}catch{throw new Error('Le serveur ne répond pas. Vérifiez qu’il est démarré, puis actualisez la page.');}finally{clearTimeout(timeout);}
  const result=await response.json();
  if(!response.ok){const error=new Error(result.error?.message||'Le réseau a refusé cette opération.');error.status=response.status;throw error;}
  return result;
}
async function api(path,data){
  if(data!==undefined&&!sessionReady){await rawApi('/api/session',{});sessionReady=true;}
  try{return await rawApi(path,data);}catch(error){if(error.status===401){sessionReady=false;throw new Error('La session locale a expiré. Réessayez l’opération ; pour un transfert, vérifiez d’abord l’activité.');}throw error;}
}
function saveWallet(vault){
  if(!storageHealthy||storageChanged)throw new Error('Le stockage des portefeuilles doit être vérifié avant toute modification. Rechargez la page ; ne supprimez pas vos sauvegardes.');
  validateVault(vault);
  if(wallets.some(w=>w.address===vault.address))throw new Error('Ce portefeuille est déjà présent dans ce navigateur.');
  if(wallets.length>=20)throw new Error('Ce navigateur contient déjà 20 portefeuilles.');
  const candidate=[...wallets,vault];
  try{localStorage.setItem(STORAGE,JSON.stringify(candidate));}catch{throw new Error('Le navigateur ne permet pas de sauvegarder ce portefeuille. Vérifiez ses paramètres de stockage.');}
  wallets=candidate;lock();active=vault.address;renderWalletState();
}
function knownName(address){const wallet=wallets.find(w=>w.address===address);return wallet?wallet.name:(address?address.slice(0,12)+'…'+address.slice(-6):'—');}
function definitions(container,items){container.replaceChildren();for(const [label,value] of items){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=String(value);container.append(dt,dd);}}
function displayBalance(container,balance){definitions(container,[['Confirmé',balance.confirmed+' MTC'],['En attente de départ',balance.reserved+' MTC'],['Disponible',balance.available+' MTC']]);}
function download(vault){const url=URL.createObjectURL(new Blob([JSON.stringify(vault,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='makutachain-'+vault.address.slice(-8)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Sauvegarde chiffrée téléchargée. Conservez le fichier et votre mot de passe.');}
function renderWalletState(){
  const select=el('active-wallet');select.replaceChildren();
  if(!wallets.length){select.add(new Option('Aucun portefeuille',''));active='';}
  for(const wallet of wallets)select.add(new Option(wallet.name,wallet.address));
  select.value=active;
  const wallet=selected(),balance=balances.get(active);
  el('lock-status').textContent=wallet?(locked()?'Verrouillé · réception et minage disponibles':'Déverrouillé · signature disponible pendant 5 minutes'):'Créez votre premier portefeuille';
  el('home-balance').textContent=balance?balance.available+' MTC':'—';
  el('send-balance').textContent=balance?balance.available+' MTC':'Choisissez un portefeuille';
  el('receive-name').textContent=wallet?wallet.name:'MON PORTEFEUILLE';
  el('receive-address').value=wallet?wallet.address:'Créez un portefeuille pour obtenir votre adresse.';
  el('mine-wallet').textContent=wallet?wallet.name:'Créez un portefeuille pour recevoir la récompense';
  el('mine-address').textContent=wallet?wallet.address:'';
  el('copy-address').disabled=busy||!wallet;
  if(balance)displayBalance(el('receive-balance'),balance);else el('receive-balance').replaceChildren();
  const contacts=el('send-contact');const previous=contacts.value;contacts.replaceChildren(new Option('Ou saisir une adresse ci-dessous',''));
  for(const other of wallets.filter(w=>w.address!==active))contacts.add(new Option(other.name,other.address));
  contacts.value=previous;
  const list=el('wallet-list');list.replaceChildren();
  for(const item of wallets){const card=document.createElement('article');card.className='card wallet-card'+(item.address===active?' active':'');const title=document.createElement('h3'),amount=document.createElement('strong'),address=document.createElement('p'),use=document.createElement('button'),backup=document.createElement('button');title.textContent=item.name;amount.textContent=(balances.get(item.address)?.confirmed??0)+' MTC';address.className='address';address.textContent=item.address;use.textContent=item.address===active?'Portefeuille actif':'Utiliser ce portefeuille';use.className='secondary';use.disabled=busy||item.address===active;use.addEventListener('click',()=>{lock();active=item.address;el('send-recipient').value='';renderWalletState();message('Portefeuille actif : '+item.name);});backup.textContent='Sauvegarder';backup.className='secondary';backup.disabled=busy;backup.addEventListener('click',()=>download(item));card.append(title,amount,address,use,backup);list.append(card);}
  if(!wallets.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='Aucun portefeuille pour le moment. Créez votre premier portefeuille ci-dessous, ou restaurez une sauvegarde.';list.append(empty);}
}
function activity(container,items,pending=false){
  container.replaceChildren();
  if(!items.length){const empty=document.createElement('p');empty.className='empty';empty.textContent=pending?'Aucun transfert en attente.':'Aucune transaction pour le moment.';container.append(empty);return;}
  for(const tx of items){const row=document.createElement('div'),badge=document.createElement('span'),label=document.createElement('strong'),detail=document.createElement('p');row.className='activity-item';badge.className='badge'+(pending?' pending':'');badge.textContent=pending?'En attente':'Confirmée';label.textContent=tx.amount+' MTC · '+(tx.kind==='reward'?'Récompense de minage':'Transfert');detail.textContent=tx.kind==='reward'?'Vers '+knownName(tx.recipient):knownName(tx.sender)+' → '+knownName(tx.recipient);row.append(badge,label,detail);const expanded=document.createElement('details'),summary=document.createElement('summary'),fields=document.createElement('dl');summary.textContent='Voir les détails';definitions(fields,[['Identifiant',tx.id],['Destinataire',tx.recipient],...(tx.kind==='transfer'?[['Expéditeur',tx.sender]]:[])]);expanded.append(summary,fields);row.append(expanded);container.append(row);}
}
function renderNetwork(){
  el('circulation').textContent=stats.circulating+' MTC';el('height').textContent=stats.height;el('validation').textContent='Chaîne vérifiée depuis Genesis';el('pending-count').textContent=stats.pending;
  const remaining=Math.min(10,stats.max_supply-stats.circulating);el('mine-reward').textContent=remaining?remaining+' MTC par bloc':'Plafond atteint';el('mine-button').textContent=remaining?'Miner un bloc':'Miner pour confirmer les transferts';
  activity(el('home-activity'),[...transactions.pending.slice().reverse(),...transactions.confirmed.slice().reverse()].slice(0,5),false);
  // L'accueil distingue explicitement chaque transaction encore en attente.
  const pendingIds=new Set(transactions.pending.map(tx=>tx.id));
  [...el('home-activity').children].forEach((row,index)=>{const tx=[...transactions.pending.slice().reverse(),...transactions.confirmed.slice().reverse()].slice(0,5)[index];if(tx&&pendingIds.has(tx.id)){const badge=row.querySelector('.badge');badge.textContent='En attente';badge.classList.add('pending');}});
  activity(el('pending-transactions'),transactions.pending.slice().reverse(),true);activity(el('confirmed-transactions'),transactions.confirmed.slice(-100).reverse());
  el('blocks').replaceChildren();
  for(const block of blocks.slice().reverse()){const detail=document.createElement('details'),summary=document.createElement('summary'),fields=document.createElement('dl');summary.textContent='Bloc '+block.index+' · '+block.transactions.length+' transaction(s)'+(block.index===0?' · Genesis':'');definitions(fields,[['Hash',block.hash],['Bloc précédent',block.previous_hash],['Date',block.index?new Date(block.timestamp*1000).toLocaleString('fr-FR'):'Genesis déterministe'],['Preuve de travail',block.index?'Nonce '+block.nonce:'Bloc initial'],['Transactions',block.transactions.length]]);detail.append(summary,fields);el('blocks').append(detail);}
}
async function refresh(){
  const [network,validation,txs,chain]=await Promise.all(['/api/stats','/api/validate','/api/transactions','/api/blocks'].map(path=>api(path)));
  if(!validation.valid)throw new Error('La chaîne n’est pas valide.');
  stats=network;transactions=txs;blocks=chain.blocks;
  const values=await Promise.all(wallets.map(async wallet=>[wallet.address,await api('/api/balance/'+wallet.address)]));balances=new Map(values);renderWalletState();renderNetwork();
}
async function action(event,work){
  event?.preventDefault();if(storageChanged){message('Les portefeuilles ont changé dans un autre onglet. Rechargez cette page.',true);return;}if(busy)return;busy=true;document.querySelectorAll('button,input,select').forEach(item=>item.disabled=true);
  try{await work();}catch(error){message(error.message||'Opération impossible.',true);}finally{busy=false;document.querySelectorAll('button,input,select').forEach(item=>item.disabled=false);renderWalletState();}
}
el('active-wallet').addEventListener('change',()=>{const next=el('active-wallet').value;lock();active=next;el('send-recipient').value='';renderWalletState();message('Portefeuille actif : '+requireWallet().name);});
el('create-form').addEventListener('submit',event=>action(event,async()=>{
  const name=el('wallet-name').value,password=el('create-password').value,confirmation=el('confirm-password').value;
  try{if(password!==confirmation)throw new Error('Les deux mots de passe doivent être identiques.');const vault=await createWallet(name,password);saveWallet(vault);unlocked=await unlockWallet(vault,password);unlockedAddress=vault.address;armLock();await refresh();el('create-form').reset();message('Portefeuille « '+vault.name+' » créé. Cliquez sur « Sauvegarder » avant de commencer.');}
  finally{el('create-password').value='';el('confirm-password').value='';}
}));
el('unlock-form').addEventListener('submit',event=>action(event,async()=>{const wallet=requireWallet();try{unlocked=await unlockWallet(wallet,el('unlock-password').value);unlockedAddress=wallet.address;armLock();message('Portefeuille « '+wallet.name+' » déverrouillé. Vous pouvez envoyer des MTC.');}finally{el('unlock-password').value='';}}));
el('lock-wallet').addEventListener('click',()=>{lock();message('Portefeuille verrouillé.');});
el('import-form').addEventListener('submit',event=>action(event,async()=>{try{const file=el('backup-file').files[0];if(!file||file.size>16384)throw new Error('Choisissez une sauvegarde Makutachain de moins de 16 Ko.');let vault;try{vault=validateVault(JSON.parse(await file.text()));}catch{throw new Error('Ce fichier n’est pas une sauvegarde chiffrée Makutachain compatible.');}const key=await unlockWallet(vault,el('import-password').value);saveWallet(vault);unlocked=key;unlockedAddress=vault.address;armLock();await refresh();el('import-form').reset();message('Portefeuille restauré. Son solde provient de la blockchain.');}finally{el('import-password').value='';}}));
el('copy-address').addEventListener('click',event=>action(event,async()=>{const wallet=requireWallet();try{await navigator.clipboard.writeText(wallet.address);message('Adresse copiée. Vous pouvez la partager avec l’expéditeur.');}catch{el('receive-address').focus();el('receive-address').select();message('Copie automatique indisponible : sélectionnez l’adresse et copiez-la.');}}));
el('send-contact').addEventListener('change',()=>{if(el('send-contact').value)el('send-recipient').value=el('send-contact').value;draft=null;el('send-review').hidden=true;});
for(const id of ['send-recipient','send-amount'])el(id).addEventListener('input',()=>{draft=null;el('send-review').hidden=true;});
el('send-form').addEventListener('submit',event=>action(event,async()=>{
  const wallet=requireWallet();if(locked())throw new Error('Déverrouillez le portefeuille actif dans le menu « Portefeuilles ».');
  const recipient=el('send-recipient').value.trim(),amount=Number(el('send-amount').value);
  if(!/^mtc_[0-9a-f]{64}$/.test(recipient)||recipient===wallet.address)throw new Error('Choisissez une autre adresse MTC valide.');
  if(!Number.isSafeInteger(amount)||amount<1||amount>10000)throw new Error('Le montant doit être un nombre entier de MTC entre 1 et 10 000.');
  const balance=await api('/api/balance/'+wallet.address);if(amount>balance.available)throw new Error('Solde disponible insuffisant. Minez un bloc ou attendez de recevoir des MTC confirmés.');
  draft={sender:wallet.address,recipient,amount};definitions(el('review-details'),[['Depuis',wallet.name],['Destinataire',recipient],['Montant',amount+' MTC'],['Frais','0 MTC']]);el('send-review').hidden=false;message('Vérifiez le destinataire et confirmez pour signer le transfert.');
}));
el('cancel-send').addEventListener('click',()=>{draft=null;el('send-review').hidden=true;});
el('confirm-send').addEventListener('click',event=>action(event,async()=>{
  const wallet=requireWallet();if(!draft||draft.sender!==wallet.address||locked())throw new Error('Vérifiez à nouveau le transfert et déverrouillez son portefeuille.');
  const transfer={...draft};draft=null;el('send-review').hidden=true;
  const balance=await api('/api/balance/'+wallet.address);if(transfer.amount>balance.available)throw new Error('Le solde disponible a changé. Vérifiez à nouveau le transfert.');
  const tx=await signTransfer(wallet,unlocked,transfer.recipient,transfer.amount,balance.next_nonce);
  try{await api('/api/transactions',tx);}catch(error){if(!error.status||error.status>=500)throw new Error('La réception du transfert ne peut pas être confirmée. Consultez l’explorateur et le solde avant de réessayer.');throw error;}armLock();el('send-form').reset();
  message('Transfert accepté : '+transfer.amount+' MTC réservés. Minez un bloc pour le confirmer.');
  try{await refresh();}catch{message('Transfert accepté. Actualisez l’explorateur pour vérifier son état avant toute nouvelle tentative.',true);}
}));
el('mine-button').addEventListener('click',event=>action(event,async()=>{const wallet=requireWallet();message('Calcul de la preuve de travail et vérification des transactions…');const result=await api('/api/mine',{recipient:wallet.address});const minted=result.block.transactions.find(tx=>tx.kind==='reward')?.amount||0;try{await refresh();message('Bloc '+result.block.index+' confirmé. '+(minted?minted+' MTC attribués à '+wallet.name+'.':'Les transferts du bloc sont confirmés ; aucune récompense au plafond.'));}catch{message('Bloc miné. Actualisez l’explorateur pour vérifier le résultat.',true);}}));
el('refresh').addEventListener('click',event=>action(event,async()=>{await refresh();message('Chaîne vérifiée et données actualisées.');}));
el('balance-form').addEventListener('submit',event=>action(event,async()=>{displayBalance(el('balance'),await api('/api/balance/'+encodeURIComponent(el('address').value.trim())));message('Solde de l’adresse consulté.');}));
window.addEventListener('pagehide',lock);
window.addEventListener('storage',event=>{if(event.key===STORAGE){storageChanged=true;lock();message('Les portefeuilles ont changé dans un autre onglet. Rechargez la page avant de continuer.',true);document.querySelectorAll('button').forEach(button=>button.disabled=true);}});
try{const stored=localStorage.getItem(STORAGE);if(stored){const parsed=JSON.parse(stored);if(!Array.isArray(parsed)||parsed.length>20)throw new Error();const validated=parsed.map(validateVault);if(new Set(validated.map(w=>w.address)).size!==validated.length)throw new Error();wallets=validated;}}
catch{storageHealthy=false;message('Stockage des portefeuilles inaccessible ou endommagé. Les données existantes sont conservées ; restaurez vos sauvegardes dans un autre profil de navigateur.',true);}
active=wallets[0]?.address||'';renderWalletState();
try{await refresh();if(storageHealthy)message(wallets.length?'Réseau connecté. Choisissez une opération dans le menu.':'Bienvenue ! Commencez par créer votre portefeuille dans le menu « Portefeuilles ».');}
catch(error){message(error.message||'Le serveur est indisponible.',true);}
