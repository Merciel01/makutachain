import test from 'node:test';
import assert from 'node:assert/strict';
import {createLatestRequest,createPoller} from '../web/sync.mjs';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('une réponse de solde ancienne ne remplace pas la plus récente',async()=>{
  const first=deferred(),second=deferred(),applied=[];let calls=0;
  const sync=createLatestRequest({read:()=>++calls===1?first.promise:second.promise,apply:v=>applied.push(v)});
  const old=sync.run(),fresh=sync.run();second.resolve(600);await fresh;first.resolve(0);assert.equal(await old,false);assert.deepEqual(applied,[600]);assert.equal(sync.pending,false);
});
test('changer de compte invalide une lecture encore en cours',async()=>{
  const pending=deferred(),applied=[];
  const sync=createLatestRequest({read:()=>pending.promise,apply:v=>applied.push(v)});
  const old=sync.run();sync.invalidate();pending.resolve({address:'old',available:0});await old;assert.deepEqual(applied,[]);
});
test('un échec ancien ne remplace pas un résultat récent par une erreur',async()=>{
  const first=deferred(),second=deferred(),errors=[],values=[];let calls=0;
  const sync=createLatestRequest({read:()=>++calls===1?first.promise:second.promise,apply:v=>values.push(v),onError:e=>errors.push(e.message)});
  const old=sync.run(),fresh=sync.run();second.resolve(600);await fresh;first.reject(new Error('ancienne panne'));await old;assert.deepEqual(values,[600]);assert.deepEqual(errors,[]);
});
test('une erreur courante est signalée et n’est pas convertie en solde nul',async()=>{
  const values=[],errors=[];const sync=createLatestRequest({read:async()=>{throw new Error('hors ligne');},apply:v=>values.push(v),onError:e=>errors.push(e.message)});
  assert.equal(await sync.run(),false);assert.deepEqual(values,[]);assert.deepEqual(errors,['hors ligne']);
});
test('un nouveau solde remplace la valeur après une modification de la chaîne',async()=>{
  let current=0;const values=[];const sync=createLatestRequest({read:async()=>current,apply:v=>values.push(v)});
  await sync.run();current=600;await sync.run();assert.deepEqual(values,[0,600]);
});
test('le rafraîchissement automatique ne lance pas de requêtes simultanées',async()=>{
  const pending=deferred();let count=0;const poll=createPoller({refresh:async()=>{count++;await pending.promise;}});
  const one=poll.tick();assert.equal(await poll.tick(),false);assert.equal(count,1);pending.resolve();await one;
});
test('un formulaire occupé ou une page masquée suspend les lectures automatiques',async()=>{
  let visible=false,count=0;const poll=createPoller({refresh:async()=>{count++;},canRun:()=>visible});
  assert.equal(await poll.tick(),false);visible=true;assert.equal(await poll.tick(),true);assert.equal(count,1);
});
test('la minuterie est démarrée une fois, stoppée, puis relancée au retour',()=>{
  let starts=0,stops=0;const poll=createPoller({refresh:async()=>{},schedule:(callback,ms)=>{assert.equal(ms,5000);return ++starts;},cancel:()=>{stops++;}});
  poll.start();poll.start();assert.equal(starts,1);poll.stop();poll.stop();assert.equal(stops,1);poll.start();assert.equal(starts,2);poll.stop();
});
