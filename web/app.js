// Ce démarrage reste disponible même si le serveur n'a pas encore été redémarré.
const pages={accueil:'Accueil','tableau-de-bord':'Tableau de bord',portefeuilles:'Portefeuilles',envoyer:'Envoyer des MTC',recevoir:'Recevoir des MTC',minage:'Minage',explorateur:'Explorateur'};
function navigate(){
  const name=location.hash.slice(1)||'accueil';const page=pages[name]?name:'accueil';
  for(const key of Object.keys(pages))document.getElementById('page-'+key).hidden=key!==page;
  document.querySelectorAll('[data-page]').forEach(link=>{if(link.dataset.page===page)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
  document.getElementById('page-title').textContent=pages[page];
  document.body.classList.toggle('dashboard-view',page==='tableau-de-bord');
}
function startupFailure(){
  const status=document.getElementById('status');status.classList.add('error');
  status.textContent='Les fonctions du site n’ont pas pu démarrer. Si le serveur était ouvert pendant la mise à jour, arrêtez-le avec Ctrl+C, relancez ./scripts/run.sh puis actualisez cette page. Vos données restent conservées.';
}
const menuToggle=document.getElementById('menu-toggle');
const menu=document.getElementById('main-navigation');
function setMenu(open){
  menu.hidden=!open;
  menuToggle.setAttribute('aria-expanded',String(open));
  menuToggle.setAttribute('aria-label',open?'Fermer le menu':'Ouvrir le menu');
}
menuToggle.addEventListener('click',()=>setMenu(menu.hidden));
menu.addEventListener('click',event=>{
  if(event.target.closest('[data-page]')){
    setMenu(false);
    document.getElementById('page-title').focus({preventScroll:true});
  }
});
document.addEventListener('click',event=>{
  if(!menu.hidden&&!menu.contains(event.target)&&!menuToggle.contains(event.target))setMenu(false);
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!menu.hidden){setMenu(false);menuToggle.focus();}
});
window.addEventListener('hashchange',()=>{navigate();setMenu(false);});
navigate();
import('./interface.mjs').catch(startupFailure);
