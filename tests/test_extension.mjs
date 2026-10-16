import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createEngine,dispatch,siteContext,verifySigned} from '../extension/makutawallet/engine.mjs';
import {createWallet,unlockWallet,signTransfer} from '../extension/makutawallet/wallet.mjs';
const password='Mot-de-passe-test-2026';
const alice=await createWallet('Alice',password),bob=await createWallet('Bob',password),key=await unlockWallet(alice,password);
const origin='http://127.0.0.1:5000';
const sender={id:'wallet-id',url:origin+'/',frameId:0,tab:{id:1}};
const popup={id:'wallet-id',url:'chrome-extension://wallet-id/popup.html'};
function memory(){const values=new Map();return {get:async k=>structuredClone(values.get(k)),set:async(k,v)=>{values.set(k,structuredClone(v));}};}
function fixture(){
  const local=memory(),session=memory();let time=1000,nonce=1,funds=10,next=0,opened=0;
  const options={local,session,now:()=>time,randomId:()=>`ticket-${++next}`,openApproval:async()=>++opened,network:async(o,address)=>{assert.equal(o,origin);return {address,available:funds,next_nonce:nonce};}};
  const engine=createEngine(options);
  const site=(method,params,who=sender)=>dispatch(engine,{channel:'site',method,...params},who,'wallet-id');
  const ui=(method,params)=>dispatch(engine,{channel:'ui',method,...params},popup,'wallet-id');
  async function start(){await ui('add',{vault:alice});}
  async function connect(){const {ticket}=await site('makuta_requestAccounts');await ui('approve',{id:ticket});await site('status',{id:ticket});}
  async function transfer(){return site('makuta_signTransaction',{params:{sender:alice.address,recipient:bob.address,amount:4}});}
  return {local,session,options,engine,site,ui,start,connect,transfer,opened:()=>opened,expire:()=>{time+=121000;},nonce:()=>{nonce++;},funds:v=>{funds=v;}};
}
test('les copies de cryptographie site/extension restent identiques',async()=>{
  assert.equal(await readFile('web/wallet.mjs','utf8'),await readFile('extension/makutawallet/wallet.mjs','utf8'));
});
test('manifest local sans accès à tous les sites ni code distant',async()=>{
  const m=JSON.parse(await readFile('extension/makutawallet/manifest.json','utf8'));
  assert.equal(m.manifest_version,3);assert.deepEqual(m.permissions,['storage']);
  assert.deepEqual(m.host_permissions,['http://127.0.0.1/*','http://localhost/*']);
  assert.equal(m.background.type,'module');assert.equal(m.content_scripts[0].world,'MAIN');
});
test('connexion explicite et lecture silencieuse après approbation',async()=>{
  const f=fixture();await f.start();assert.deepEqual(await f.site('makuta_accounts'),[]);
  const {ticket}=await f.site('makuta_requestAccounts');assert.equal(f.opened(),1);
  assert.deepEqual(await f.site('status',{id:ticket}),{pending:true});
  assert.deepEqual(await f.site('makuta_accounts'),[]);
  await f.ui('approve',{id:ticket});assert.deepEqual(await f.site('status',{id:ticket}),{result:[alice.address]});
  assert.deepEqual(await f.site('makuta_accounts'),[alice.address]);
});
test('sites externes, ports arbitraires et cadres sont refusés',()=>{
  for(const who of [{...sender,url:'https://evil.invalid/'},{...sender,url:'http://127.0.0.1:8000/'},{...sender,frameId:1},{...sender,tab:undefined}])assert.throws(()=>siteContext(who));
});
test('un content script ne peut ni lire le coffre ni approuver une demande',async()=>{
  const f=fixture();await f.start();
  for(const method of ['state','add','approve','select','revoke'])await assert.rejects(dispatch(f.engine,{channel:'ui',method,vault:bob},sender,'wallet-id'),/confiance/);
  await assert.rejects(dispatch(f.engine,{channel:'ui',method:'state'},{...popup,id:'other'},'wallet-id'),/refusé/);
});
test('une signature sans connexion est refusée',async()=>{const f=fixture();await f.start();await assert.rejects(f.transfer(),/connecté/);});
test('méthodes de signature arbitraire et coffre privées non exposées au site',async()=>{
  const f=fixture();await f.start();for(const method of ['eth_sign','personal_sign','exportKey','state','add'])await assert.rejects(f.site(method));
});
test('un transfert attend une approbation, puis fournit seulement une transaction signée',async()=>{
  const f=fixture();await f.start();await f.connect();const {ticket}=await f.transfer();
  assert.deepEqual(await f.site('status',{id:ticket}),{pending:true});
  const tx=await signTransfer(alice,key,bob.address,4,1);await f.ui('approve',{id:ticket,tx});
  assert.deepEqual(await f.site('status',{id:ticket}),{result:tx});
  console.log('# extension-fixture '+JSON.stringify({tx,bob:bob.address}));
  await assert.rejects(f.site('status',{id:ticket}));
  const stored=JSON.stringify(await f.ui('state'));assert.equal(stored.includes('privateKey'),false);assert.equal(stored.includes(password),false);
});
test('approbation invalide si le montant ou la signature ont été remplacés',async()=>{
  const f=fixture();await f.start();await f.connect();const {ticket}=await f.transfer();
  await assert.rejects(f.ui('approve',{id:ticket,tx:await signTransfer(alice,key,bob.address,5,1)}),/différente/);
  const tx=await signTransfer(alice,key,bob.address,4,1);tx.signature='00'.repeat(64);
  await assert.rejects(f.ui('approve',{id:ticket,tx}),/invalide/);
  assert.deepEqual(await f.site('status',{id:ticket}),{pending:true});
});
test('les montants invalides et champs supplémentaires sont refusés',async()=>{
  const f=fixture();await f.start();await f.connect();
  for(const amount of [0,-1,1.5,true,10001])await assert.rejects(f.site('makuta_signTransaction',{params:{sender:alice.address,recipient:bob.address,amount}}));
  await assert.rejects(f.site('makuta_signTransaction',{params:{sender:alice.address,recipient:bob.address,amount:1,private_key:'bad'}}));
});
test('insuffisance de solde refuse la demande avant ouverture',async()=>{
  const f=fixture();await f.start();await f.connect();f.funds(1);await assert.rejects(f.transfer(),/insuffisant/);assert.equal(f.opened(),1);
});
test('changement de nonce entre proposition et approbation refuse la signature',async()=>{
  const f=fixture();await f.start();await f.connect();const {ticket}=await f.transfer();f.nonce();
  await assert.rejects(f.ui('approve',{id:ticket,tx:await signTransfer(alice,key,bob.address,4,1)}),/modifié/);
});
test('le résultat est lié à l’onglet et à l’origine',async()=>{
  const f=fixture();await f.start();const {ticket}=await f.site('makuta_requestAccounts');
  await assert.rejects(f.site('status',{id:ticket},{...sender,tab:{id:2}}),/inaccessible/);
  await assert.rejects(f.site('status',{id:ticket},{...sender,url:'http://localhost:5000/'}),/inaccessible/);
});
test('refus et fermeture de fenêtre annulent la demande',async()=>{
  const f=fixture();await f.start();let {ticket}=await f.site('makuta_requestAccounts');await f.ui('reject',{id:ticket});await assert.rejects(f.site('status',{id:ticket}),/refusée/);
  ({ticket}=await f.site('makuta_requestAccounts'));await f.engine.cancelMatching(t=>t.windowId===2);await assert.rejects(f.site('status',{id:ticket}),/annulée/);
});
test('une demande expire après deux minutes',async()=>{const f=fixture();await f.start();const {ticket}=await f.site('makuta_requestAccounts');f.expire();await assert.rejects(f.ui('approve',{id:ticket}),/expirée/);await assert.rejects(f.site('status',{id:ticket}),/expirée/);});
test('une seule fenêtre d’autorisation peut être en attente',async()=>{const f=fixture();await f.start();await f.site('makuta_requestAccounts');await assert.rejects(f.site('makuta_requestAccounts'),/déjà ouverte/);});
test('déconnexion et changement de compte révoquent les autorisations',async()=>{
  const f=fixture();await f.start();await f.ui('add',{vault:bob});await f.ui('select',{address:alice.address});await f.connect();
  await f.site('makuta_disconnect');assert.deepEqual(await f.site('makuta_accounts'),[]);await f.connect();await f.ui('select',{address:bob.address});assert.deepEqual(await f.site('makuta_accounts'),[]);
});
test('révocation invalide aussi un résultat signé non encore récupéré',async()=>{
  const f=fixture();await f.start();await f.connect();const {ticket}=await f.transfer();await f.ui('approve',{id:ticket,tx:await signTransfer(alice,key,bob.address,4,1)});
  await f.ui('revoke');await assert.rejects(f.site('status',{id:ticket}),/révoquée/);
});
test('les demandes survivent à la recréation du moteur du service worker',async()=>{
  const f=fixture();await f.start();const {ticket}=await f.site('makuta_requestAccounts');const restarted=createEngine(f.options);
  await restarted.ui({method:'approve',id:ticket});const result=await restarted.site({channel:'site',method:'status',id:ticket},sender);assert.deepEqual(result.result,[alice.address]);
});

test('le clic sur le logo ouvre une fenêtre durable et réutilise la même',async()=>{
  const {createWindowController}=await import('../extension/makutawallet/window-controller.mjs');
  const session=memory(),url='chrome-extension://wallet-id/popup.html';let creates=0,focus=0;
  const windows={create:async opts=>{creates++;assert.equal(opts.type,'popup');assert.equal(opts.height,760);return {id:7};},get:async()=>({tabs:[{id:4,url}]}),update:async(id,opts)=>{assert.equal(id,7);assert.equal(opts.focused,true);focus++;}};
  const controller=createWindowController({windows,tabs:{update:async()=>{}},session,popupURL:url});
  assert.equal(await controller.open(),7);assert.equal(await controller.open(),7);assert.equal(creates,1);assert.equal(focus,1);
});
test('une demande charge la confirmation dans la fenêtre existante',async()=>{
  const {createWindowController}=await import('../extension/makutawallet/window-controller.mjs');
  const session=memory(),url='chrome-extension://wallet-id/popup.html';await session.set('walletWindow',8);let destination='';
  const controller=createWindowController({session,popupURL:url,windows:{get:async()=>({tabs:[{id:9,url}]}),update:async()=>{}},tabs:{update:async(id,opts)=>{assert.equal(id,9);destination=opts.url;}}});
  assert.equal(await controller.open('request-1'),8);assert.equal(destination,url+'?request=request-1');
});
test('une fenêtre fermée est remplacée et son identifiant oublié à la fermeture',async()=>{
  const {createWindowController}=await import('../extension/makutawallet/window-controller.mjs');
  const session=memory();await session.set('walletWindow',8);
  const controller=createWindowController({session,popupURL:'chrome-extension://wallet-id/popup.html',windows:{get:async()=>{throw new Error('closed');},create:async()=>({id:12})},tabs:{}});
  assert.equal(await controller.open(),12);await controller.closed(8);assert.equal(await session.get('walletWindow'),12);await controller.closed(12);assert.equal(await session.get('walletWindow'),null);
});

test('le réseau de consultation est conservé et suit le site autorisé',async()=>{
  const f=fixture();await f.start();await f.ui('setNetwork',{origin:'http://localhost:5001'});
  assert.equal((await f.ui('state')).displayNetwork,'http://localhost:5001');
  await f.connect();assert.equal((await f.ui('state')).displayNetwork,origin);
  await assert.rejects(f.ui('setNetwork',{origin:'https://evil.invalid'}));
});
test('le solde est demandé pour une adresse explicite et refuse un compte périmé',async()=>{
  const f=fixture();await f.start();
  assert.equal((await f.ui('balance',{origin,address:alice.address})).address,alice.address);
  await f.ui('add',{vault:bob});
  await assert.rejects(f.ui('balance',{origin,address:alice.address}),/modifié/);
  assert.equal((await f.ui('balance',{origin,address:bob.address})).address,bob.address);
});
test('la synchronisation du site et celle de l’extension partagent le même coordinateur',async()=>{
  assert.equal(await readFile('web/sync.mjs','utf8'),await readFile('extension/makutawallet/sync.mjs','utf8'));
});
