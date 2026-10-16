// Empêche une réponse ancienne de remplacer un état plus récent.
export function createLatestRequest({read,apply,onError}){
  let revision=0,running=0;
  return {
    invalidate(){revision++;},
    get pending(){return running>0;},
    async run(){
      const current=++revision;running++;
      try{
        const result=await read();
        if(current!==revision)return false;
        return await apply(result)!==false;
      }catch(error){
        if(current!==revision)return false;
        if(onError){await onError(error);return false;}
        throw error;
      }finally{running--;}
    }
  };
}
export function createPoller({refresh,canRun=()=>true,interval=5000,schedule=setInterval,cancel=clearInterval,onError=()=>{}}){
  let timer=null,running=false;
  async function tick(){
    if(running||!canRun())return false;
    running=true;
    try{await refresh();return true;}catch(error){onError(error);return false;}finally{running=false;}
  }
  return {tick,start(){if(timer===null)timer=schedule(tick,interval);},stop(){if(timer!==null){cancel(timer);timer=null;}}};
}
