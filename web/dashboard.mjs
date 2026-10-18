const el=id=>document.getElementById(id);
const number=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1});
const fmt=value=>number.format(value);
const money=value=>fmt(value)+' MTC';
const put=(id,value)=>{el(id).textContent=value;};
function duration(seconds){
  if(seconds===null)return 'Données insuffisantes';
  if(seconds<60)return fmt(seconds)+' s';
  if(seconds<3600)return fmt(seconds/60)+' min';
  if(seconds<86400)return fmt(seconds/3600)+' h';
  return fmt(seconds/86400)+' j';
}
function node(name,attrs={},text){
  const item=document.createElementNS('http://www.w3.org/2000/svg',name);
  for(const [key,value] of Object.entries(attrs))item.setAttribute(key,String(value));
  if(text!==undefined)item.textContent=text;
  return item;
}
function activity(history){
  const container=el('dash-activity');container.replaceChildren();
  if(!history.length){const empty=document.createElement('p');empty.className='dash-chart-empty';empty.textContent='Le graphique apparaîtra après le premier bloc miné.';container.append(empty);return;}
  const width=760,height=245,left=60,right=16,top=24,bottom=36;
  const plotWidth=width-left-right,plotHeight=height-top-bottom;
  const max=Math.max(1,...history.map(item=>item.volume));
  const svg=node('svg',{viewBox:'0 0 '+width+' '+height,role:'img','aria-label':history.map(item=>'Bloc '+item.height+' : '+money(item.volume)+', '+item.transfers+' transfert(s)').join(' ; ')});
  for(let i=0;i<=4;i++){
    const y=top+plotHeight*i/4;
    svg.append(node('line',{x1:left,y1:y,x2:width-right,y2:y,class:'dash-grid-line'}));
    svg.append(node('text',{x:left-12,y:y+4,'text-anchor':'end',class:'dash-axis'},fmt(max*(4-i)/4)));
  }
  const step=plotWidth/history.length,barWidth=Math.min(36,step*.62);
  history.forEach((item,i)=>{
    const x=left+step*i+step/2,barHeight=item.volume/max*plotHeight;
    const bar=node('rect',{x:x-barWidth/2,y:top+plotHeight-barHeight,width:barWidth,height:barHeight,rx:4,class:'dash-bar'});
    bar.append(node('title',{},'Bloc '+item.height+' · '+money(item.volume)+' · '+item.transfers+' transfert(s)'));svg.append(bar);
    if(history.length<=7||i===0||i===history.length-1||i%4===0)svg.append(node('text',{x,y:height-10,'text-anchor':'middle',class:'dash-axis'},'#'+item.height));
  });
  container.append(svg);
  if(!history.some(item=>item.volume)){const caption=document.createElement('p');caption.className='dash-zero';caption.textContent='Aucun transfert dans ces blocs : les récompenses de minage sont exclues du volume.';container.append(caption);}
}
export function dashboardUnavailable(error){
  el('dash-error').hidden=false;el('dash-error').textContent='Actualisation indisponible. '+(error||'')+' Les chiffres éventuellement affichés correspondent au dernier relevé réussi.';
  put('dash-state','Données non actualisées');el('dash-state').classList.add('stale');
}
export function renderDashboard(data){
  el('dash-error').hidden=true;el('dash-state').classList.toggle('stale',!data.valid);
  put('dash-state',data.valid?'Chaîne vérifiée':'Anomalie de validation');
  put('dash-updated','Relevé à '+new Date(data.as_of*1000).toLocaleTimeString('fr-FR')+' · bloc '+data.height);
  put('dash-supply',money(data.supply));put('dash-supply-note',fmt(data.emission_percent)+' % du plafond de '+money(data.max_supply));
  el('dash-emission-fill').style.width=Math.min(100,data.emission_percent)+'%';
  put('dash-volume',money(data.volume_24h));put('dash-volume-note',fmt(data.transfers_24h)+' transfert(s) confirmé(s) sur 24 h');
  put('dash-active',fmt(data.active_addresses_24h));put('dash-active-note',fmt(data.funded_addresses)+' adresse(s) au solde positif dans le réseau');
  put('dash-pending',fmt(data.pending));put('dash-pending-note',money(data.pending_volume)+' en attente de confirmation');
  const occupancy=data.pending/data.pending_capacity*100;
  el('dash-pending-fill').style.width=Math.min(100,occupancy)+'%';
  put('dash-total-volume',money(data.volume));put('dash-total-transfers',fmt(data.transfers));put('dash-average',data.average_transfer===null?'—':money(data.average_transfer));
  put('dash-percent',fmt(data.emission_percent)+' %');
  el('dash-ring').style.setProperty('--emission',Math.min(100,data.emission_percent)+'%');
  el('dash-ring').setAttribute('aria-label',fmt(data.emission_percent)+' % émis, '+money(data.remaining)+' encore à émettre');
  put('dash-issued',money(data.supply));put('dash-remaining',money(data.remaining));
  put('dash-funded',fmt(data.funded_addresses)+' adresse(s) créditée(s)');put('dash-top5',data.top5_percent===null?'—':fmt(data.top5_percent)+' %');
  const holders=el('dash-holders');holders.replaceChildren();
  if(!data.holders.length){const empty=document.createElement('p');empty.className='dash-caption';empty.textContent='Aucune adresse créditée : l’offre est encore nulle.';holders.append(empty);}
  data.holders.forEach((holder,i)=>{
    const row=document.createElement('div');row.className='dash-holder';
    const rank=document.createElement('span');rank.className='dash-rank';rank.textContent=String(i+1).padStart(2,'0');
    const address=document.createElement('span');address.className='dash-holder-address';address.textContent=holder.address.slice(0,11)+'…'+holder.address.slice(-7);address.title=holder.address;
    const amount=document.createElement('strong');amount.textContent=money(holder.balance);
    const percent=document.createElement('span');percent.className='dash-holder-percent';percent.textContent=fmt(holder.percent)+' %';
    const track=document.createElement('div');track.className='dash-holder-track';const fill=document.createElement('span');fill.style.width=Math.min(100,holder.percent)+'%';track.append(fill);
    row.append(rank,address,amount,percent,track);holders.append(row);
  });
  put('dash-valid',data.valid?'Conforme':'Non conforme');el('dash-valid').classList.toggle('invalid',!data.valid);
  put('dash-height',fmt(data.height)+' blocs · hors Genesis');
  put('dash-last-block',data.latest_timestamp===null?'Genesis uniquement':data.latest_timestamp>data.as_of?'Horodatage futur':duration(data.as_of-data.latest_timestamp)+' avant le relevé');
  put('dash-cadence',duration(data.median_block_seconds));
  put('dash-occupancy',fmt(occupancy)+' % · '+data.pending+'/'+data.pending_capacity);
  put('dash-reserved',money(data.pending_volume));
  put('dash-health-note',data.future_blocks?fmt(data.future_blocks)+' bloc(s) ont un horodatage futur ; ils sont exclus des indicateurs sur 24 h.':data.pending?'Des transferts attendent un prochain bloc pour être confirmés.':'Aucun transfert en attente au moment du relevé. Le rythme de minage dépend des utilisateurs.');
  activity(data.history);
}
