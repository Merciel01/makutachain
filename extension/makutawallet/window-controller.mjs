// Une seule fenêtre durable : la réutiliser sans faire clignoter la popup d'action.
export function createWindowController({windows,tabs,session,popupURL}){
  async function open(requestId){
    const target=requestId?popupURL+'?request='+encodeURIComponent(requestId):popupURL;
    const saved=await session.get('walletWindow');
    if(saved){
      try{
        const existing=await windows.get(saved,{populate:true});
        const tab=existing.tabs?.find(t=>t.url?.split('?')[0]===popupURL);
        if(tab){
          if(requestId&&tab.url!==target)await tabs.update(tab.id,{url:target});
          await windows.update(saved,{focused:true,state:'normal'});
          return saved;
        }
      }catch{/* Fenêtre fermée entre deux clics : en créer une nouvelle. */}
    }
    const created=await windows.create({url:target,type:'popup',width:440,height:760,focused:true});
    await session.set('walletWindow',created.id);
    return created.id;
  }
  async function closed(windowId){
    if(await session.get('walletWindow')===windowId)await session.set('walletWindow',null);
  }
  return {open,closed};
}
