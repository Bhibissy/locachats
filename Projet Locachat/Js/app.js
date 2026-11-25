(function(){
var CITIES=['Brazzaville','Pointe-Noire','Dolisie','Nkayi','Oyo','Owando'];
var CATS=[['tech','Téléphones & high-tech'],['elec','Électroménager'],['mode','Mode'],['serv','Services'],['loc','Location de matériel']];
var SOON=['Terrains','Véhicules','Immobilier'];
var REASONS=['Arnaque ou faux article','Article interdit','Mauvaise catégorie','Photos trompeuses','Autre'];
var MAX_PHOTOS=4;
function load(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}
function digits(s){return String(s).replace(/\D/g,'')}
function fmtPhone(d){return d.replace(/(\d{2})(\d{3})(\d{2})(\d{2,})/,'$1 $2 $3 $4')}

var users=load('lc_users',[]);
var uid=load('lc_session',null);
(function migrate(){
 var old=load('lc_user',null);
 if(old&&old.id&&!users.some(function(u){return u.id===old.id})){users.push(old);save('lc_users',users);if(!uid){uid=old.id;save('lc_session',uid)}}
 try{localStorage.removeItem('lc_user')}catch(e){}
})();
var items=load('lc_items',[]);
var favs=load('lc_favs',{});
var reviews=load('lc_reviews',[]);
var user=null;
users.forEach(function(u){if(u.id===uid)user=u});
var st={q:'',city:'',cat:'',type:'',sort:'recent',chats:{},open:null,photos:[],imgIdx:0,auth:null,after:null,confirmDel:null,editId:null,tab:'mine',delAcc:false};

function $(s){return document.querySelector(s)}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function fmt(n){return new Intl.NumberFormat('fr-FR').format(n).replace(/[\u202f\u00a0]/g,'\u00a0')+'\u00a0FCFA'}
function ago(ts){var m=Math.max(0,Math.round((Date.now()-ts)/60000));if(m<2)return 'à l’instant';if(m<60)return 'il y a '+m+' min';if(m<1440)return 'il y a '+Math.round(m/60)+' h';return 'il y a '+Math.round(m/1440)+' j'}
function catLabel(id){for(var i=0;i<CATS.length;i++)if(CATS[i][0]===id)return CATS[i][1];return ''}
function find(id){for(var i=0;i<items.length;i++)if(items[i].id===id)return items[i]}
function stars(n){var r=Math.round(n);return '★★★★★'.slice(0,r)+'☆☆☆☆☆'.slice(0,5-r)}
function sellerStats(oid){var l=reviews.filter(function(r){return r.about===oid});var s=0;l.forEach(function(r){s+=r.rating});return {n:l.length,avg:l.length?s/l.length:0,list:l}}
var CHECK='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1l2 1.5 2.5-.2.8 2.4 2.1 1.4-.9 2.3.9 2.3-2.1 1.4-.8 2.4-2.5-.2L8 15l-2-1.5-2.5.2-.8-2.4L.6 9.9l.9-2.3-.9-2.3L2.7 3.9l.8-2.4L6 1.7z" fill="currentColor"/><path d="M5.2 8.2l2 2 3.6-3.8" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var HEART='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.4-9.3-8.6C1 9 2.8 5.5 6 5.5c2 0 3.2 1.1 4 2.2.8-1.1 2-2.2 4-2.2 3.2 0 5 3.5 3.3 6.9C19 16.6 12 21 12 21z" fill="currentColor"/></svg>';
var ICONS={
 tech:'<rect x="47" y="12" width="26" height="56" rx="6" fill="currentColor" opacity=".8"/><circle cx="60" cy="60" r="2.5" fill="var(--surface2)"/>',
 elec:'<rect x="44" y="10" width="32" height="60" rx="4" fill="currentColor" opacity=".8"/><rect x="44" y="30" width="32" height="2.5" fill="var(--surface2)"/><rect x="50" y="18" width="3" height="8" rx="1.5" fill="var(--surface2)"/><rect x="50" y="38" width="3" height="14" rx="1.5" fill="var(--surface2)"/>',
 mode:'<path d="M42 14L54 9Q60 16 66 9L78 14L92 27L82 33L78 29L78 70L42 70L42 29L38 33L28 27Z" fill="currentColor" opacity=".8"/>',
 serv:'<g transform="rotate(35 60 40)"><rect x="56" y="16" width="8" height="52" rx="3" fill="currentColor" opacity=".8"/><rect x="40" y="12" width="40" height="15" rx="3" fill="currentColor"/></g>',
 loc:'<rect x="40" y="9" width="40" height="62" rx="6" fill="currentColor" opacity=".8"/><circle cx="60" cy="26" r="8" fill="var(--surface2)"/><circle cx="60" cy="52" r="13" fill="var(--surface2)"/><circle cx="60" cy="52" r="6" fill="currentColor"/>'
};
function art(cat){
 return '<svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><polygon points="70,0 100,0 40,80 10,80" fill="#F2C200" opacity=".22"/><polygon points="100,0 120,0 120,16 56,80 40,80" fill="#CF2A22" opacity=".14"/><polygon points="0,0 70,0 10,80 0,80" fill="#00873E" opacity=".12"/>'+(ICONS[cat]||'')+'</svg>';
}
function pic(it,i){var im=it.imgs&&it.imgs[i||0];return im?'<img src="'+esc(im)+'" alt="'+esc(it.t)+'">':art(it.cat)}
function priceHtml(it){return '<span class="price num">'+fmt(it.price)+(it.per?' <small>'+esc(it.per)+'</small>':'')+'</span>'}
function myFavs(){return (user&&favs[user.id])||[]}
function isFav(id){return myFavs().indexOf(id)>=0}

/* thème */
function applyTheme(t){var r=document.documentElement;if(t==='light'||t==='dark')r.setAttribute('data-theme',t);else r.removeAttribute('data-theme')}
applyTheme(load('lc_theme','auto'));

/* en-tête */
function renderAcct(){
 $('#acct').innerHTML=user
  ?'<button type="button" class="btn ghost sm" data-a="account">Bonjour, '+esc(user.name.split(' ')[0])+'</button><button type="button" class="btn ghost sm" data-a="logout">Déconnexion</button><button type="button" class="btn" data-a="publish">Déposer une annonce</button>'
  :'<button type="button" class="btn ghost" data-a="login">Se connecter</button><button type="button" class="btn" data-a="publish">Déposer une annonce</button>';
}

/* liste */
function visible(){
 var q=st.q.trim().toLowerCase();
 var r=items.filter(function(it){
  if(st.cat&&it.cat!==st.cat)return false;
  if(st.city&&it.city!==st.city)return false;
  if(st.type&&it.type!==st.type)return false;
  if(q&&(it.t+' '+it.desc+' '+catLabel(it.cat)).toLowerCase().indexOf(q)<0)return false;
  return true;
 });
 r.sort(function(a,b){
  if(!!a.sold!==!!b.sold)return a.sold?1:-1;
  if(st.sort==='asc')return a.price-b.price;
  if(st.sort==='desc')return b.price-a.price;
  return b.ts-a.ts;
 });
 return r;
}
function cardHtml(it){
 return '<article class="card'+(it.sold?' sold':'')+'"><button type="button" class="cardbtn" data-a="open" data-id="'+it.id+'"><div class="tile">'+pic(it,0)+(it.sold?'<span class="badge sold">Vendu</span>':(it.type==='location'?'<span class="badge">Location</span>':''))+'</div><div class="cbody"><h3>'+esc(it.t)+'</h3>'+priceHtml(it)+'<div class="meta"><span>'+esc(it.city)+'</span><span>'+ago(it.ts)+'</span></div><div class="meta"><span class="tick">'+CHECK+'Numéro vérifié</span></div></div></button>'+
 '<button type="button" class="fav" data-a="fav" data-id="'+it.id+'" aria-pressed="'+(isFav(it.id)?'true':'false')+'" aria-label="Ajouter aux favoris">'+HEART+'</button></article>';
}
function renderGrid(){
 var r=visible();
 $('#count').textContent=r.length+(r.length>1?' annonces':' annonce');
 if(r.length){$('#grid').innerHTML=r.map(cardHtml).join('');return}
 $('#grid').innerHTML=!items.length
  ?'<div class="empty"><h3>Aucune annonce pour le moment</h3><p>Locachat vient d’ouvrir. Soyez le premier à publier un article ou un service, avec des photos.</p><button type="button" class="btn" data-a="publish">Déposer la première annonce</button></div>'
  :'<div class="empty"><h3>Aucun résultat</h3><p>Essayez une autre ville ou retirez un filtre.</p></div>';
}
function renderChips(){
 var h='<button type="button" class="chip" data-a="cat" data-c="" aria-pressed="'+(st.cat===''?'true':'false')+'">Tout</button>';
 CATS.forEach(function(c){h+='<button type="button" class="chip" data-a="cat" data-c="'+c[0]+'" aria-pressed="'+(st.cat===c[0]?'true':'false')+'">'+c[1]+'</button>'});
 SOON.forEach(function(s){h+='<span class="chip soon">'+s+'<small>Bientôt</small></span>'});
 $('#chips').innerHTML=h;
}

/* fenêtres */
function openOv(html){$('#ov-body').innerHTML=html;$('#ov').hidden=false;$('#sheet').scrollTop=0;try{$('#sheet').focus()}catch(e){}}
function closeOv(){$('#ov').hidden=true;st.open=null;st.photos=[];st.editId=null;st.delAcc=false}
function toast(m){var t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(function(){t.hidden=true},3000)}
function needLogin(after){st.after=after||null;showAuth('login')}

function showDetail(id,keepIdx){
 var it=find(id);if(!it)return;
 st.open=id;if(!keepIdx)st.imgIdx=0;
 var mine=user&&it.owner===user.id;
 var chat=st.chats[id]||[];
 var imgs=it.imgs||[];
 var ss=sellerStats(it.owner);
 var h='<h2>'+esc(it.t)+(it.sold?' <span class="tag" style="background:var(--red);color:#fff;vertical-align:middle">Vendu</span>':'')+'</h2><div class="dtile"><div class="tile">'+pic(it,st.imgIdx)+'</div></div>';
 if(imgs.length>1){h+='<div class="thumbs">'+imgs.map(function(s,i){return '<button type="button" data-a="img" data-i="'+i+'" aria-pressed="'+(i===st.imgIdx?'true':'false')+'" aria-label="Photo '+(i+1)+'"><img src="'+esc(s)+'" alt=""></button>'}).join('')+'</div>'}
 h+='<div class="row" style="margin-bottom:6px">'+priceHtml(it)+'<span>'+esc(it.city)+'</span><span>'+ago(it.ts)+'</span><span class="tag">'+esc(catLabel(it.cat))+'</span>'+(it.type==='location'?'<span class="tag">Location</span>':'')+'</div>';
 h+='<p style="margin:10px 0;overflow-wrap:anywhere">'+esc(it.desc)+'</p>';
 h+='<div class="row"><span><b style="color:var(--fg)">'+esc(it.seller)+'</b></span><span class="tag ok">'+CHECK.replace('<svg','<svg style="width:13px;height:13px"')+'Numéro vérifié</span>'+(ss.n?'<span><span class="stars">'+stars(ss.avg)+'</span> '+String(ss.avg.toFixed(1)).replace('.',',')+' · '+ss.n+(ss.n>1?' avis':' avis')+'</span>':'<span>Pas encore d’avis</span>')+'</div>';
 if(mine){
  h+='<div class="btns"><button type="button" class="btn sm" data-a="edit" data-id="'+id+'">Modifier</button><button type="button" class="btn ghost sm" data-a="sold" data-id="'+id+'">'+(it.sold?'Remettre en vente':'Marquer comme vendu')+'</button><button type="button" class="btn '+(st.confirmDel===id?'danger':'ghost')+' sm" data-a="del" data-id="'+id+'">'+(st.confirmDel===id?'Confirmer la suppression':'Supprimer')+'</button></div>';
 }else{
  h+='<div class="btns"><button type="button" class="btn ghost sm" data-a="fav" data-id="'+id+'" aria-pressed="'+(isFav(id)?'true':'false')+'">'+(isFav(id)?'Retirer des favoris':'Ajouter aux favoris')+'</button><a class="btn ghost sm" target="_blank" rel="noopener" href="https://wa.me/?text='+encodeURIComponent(it.t+' · '+fmt(it.price)+' sur Locachat')+'">Partager sur WhatsApp</a></div>';
  if(!user){h+='<div class="panel"><h3>Messagerie</h3><p class="note">Connectez-vous pour écrire au vendeur. Il saura ainsi qui lui écrit, et vous aussi.</p><div class="btns"><button type="button" class="btn sm" data-a="login">Se connecter</button><button type="button" class="btn ghost sm" data-a="signup">Créer un compte</button></div></div>'}else
  h+='<div class="panel"><h3>Messagerie</h3><div class="chat">'+chat.map(function(m){return '<div class="msg">'+esc(m)+'</div>'}).join('')+'</div><form class="send" data-f="send"><input id="msg" type="text" placeholder="Bonjour, est-ce toujours disponible ?" aria-label="Votre message"><button class="btn sm" type="submit">Envoyer</button></form><p class="note" style="margin-top:8px">Aperçu : les messages ne sont pas encore envoyés dans ce prototype.</p></div>';
  h+='<div class="panel safe"><h3>Payez en main propre</h3><p>Retrouvez le vendeur dans un lieu public, vérifiez l’article, puis payez en espèces ou par mobile money. Ne versez jamais d’argent à l’avance.</p></div>';
  h+='<div class="panel"><h3>Avis sur le vendeur</h3>'+ss.list.slice(-3).reverse().map(function(r){return '<div class="rv"><span class="stars">'+stars(r.rating)+'</span> <b>'+esc(r.byName)+'</b>'+(r.text?'<br>'+esc(r.text):'')+'</div>'}).join('')+
   '<form class="f" data-f="review" style="margin-top:10px"><div class="two"><label for="r-s">Note<select id="r-s"><option value="5">5 sur 5</option><option value="4">4 sur 5</option><option value="3">3 sur 5</option><option value="2">2 sur 5</option><option value="1">1 sur 5</option></select></label><label for="r-t">Commentaire<input id="r-t" maxlength="200" placeholder="Facultatif"></label></div><button class="btn ghost sm" type="submit" style="justify-self:start">Laisser un avis</button></form></div>';
  h+='<div class="panel"><h3>Signaler cette annonce</h3><form class="send" data-f="report"><select id="rp-r" aria-label="Motif" style="flex:1;min-width:0;border:1.5px solid var(--line);background:var(--bg);border-radius:999px;padding:9px 14px">'+REASONS.map(function(r){return '<option>'+r+'</option>'}).join('')+'</select><button class="btn ghost sm" type="submit">Signaler</button></form></div>';
 }
 openOv(h);
}

function thumbsHtml(){
 return st.photos.map(function(s,i){return '<div><img src="'+esc(s)+'" alt="Photo '+(i+1)+'"><button type="button" data-a="rmphoto" data-i="'+i+'" aria-label="Retirer la photo '+(i+1)+'">×</button></div>'}).join('');
}
function showPublish(editId){
 if(!user){needLogin('publish');return}
 var ed=editId?find(editId):null;
 st.editId=ed?ed.id:null;
 st.photos=ed&&ed.imgs?ed.imgs.slice():[];
 var v=function(x){return ed?esc(ed[x]):''};
 var h='<h2>'+(ed?'Modifier l’annonce':'Déposer une annonce')+'</h2><p class="note" style="margin-top:6px">Gratuit pendant le lancement.</p>'+
 '<form class="f" data-f="pub">'+
 '<div><label class="drop" for="f-img"><b>Ajouter des photos</b><span>Jusqu’à '+MAX_PHOTOS+' photos. Elles sont réduites automatiquement.</span><input id="f-img" type="file" accept="image/*" multiple></label><div class="pthumbs" id="pth" style="margin-top:10px">'+thumbsHtml()+'</div></div>'+
 '<label for="f-t">Titre<input id="f-t" required maxlength="80" placeholder="Ex. Télévision LG 43 pouces" value="'+v('t')+'"></label>'+
 '<div class="two"><label for="f-c">Catégorie<select id="f-c">'+CATS.map(function(c){return '<option value="'+c[0]+'"'+(ed&&ed.cat===c[0]?' selected':'')+'>'+c[1]+'</option>'}).join('')+'</select></label>'+
 '<label for="f-ty">Type<select id="f-ty"><option value="vente"'+(ed&&ed.type==='vente'?' selected':'')+'>Vente</option><option value="location"'+(ed&&ed.type==='location'?' selected':'')+'>Location</option></select></label></div>'+
 '<div class="two"><label for="f-v">Ville<select id="f-v">'+CITIES.map(function(c){return '<option'+((ed?ed.city:user.city)===c?' selected':'')+'>'+c+'</option>'}).join('')+'</select></label>'+
 '<label for="f-p">Prix (FCFA)<input id="f-p" type="number" min="0" step="500" required inputmode="numeric" placeholder="25000" value="'+(ed?ed.price:'')+'"></label></div>'+
 '<label for="f-d">Description<textarea id="f-d" required maxlength="500" placeholder="État, accessoires, lieu de remise…">'+v('desc')+'</textarea></label>'+
 '<p class="err" id="pub-err" role="alert" hidden></p>'+
 '<button class="btn" type="submit">'+(ed?'Enregistrer les modifications':'Publier l’annonce')+'</button></form>';
 openOv(h);
}

/* connexion et inscription */
function showAuth(mode,err){
 st.auth={mode:mode};
 var login=mode==='login';
 openOv('<h2>'+(login?'Se connecter':'Créer un compte')+'</h2><p class="note" style="margin-top:6px">'+(login?'Entrez le numéro de votre compte pour retrouver vos annonces.':'Pour publier des annonces et contacter les vendeurs.')+'</p>'+
 '<form class="f" data-f="'+(login?'li1':'su1')+'">'+
 (login?'':'<label for="s-n">Nom complet<input id="s-n" required maxlength="60" autocomplete="name" placeholder="Ex. Aïcha Moukala"></label>')+
 '<label for="s-p">Numéro de téléphone<input id="s-p" type="tel" required inputmode="tel" autocomplete="tel" placeholder="Ex. 06 123 45 67"></label>'+
 (login?'':'<label for="s-c">Ville<select id="s-c">'+CITIES.map(function(c){return '<option>'+c+'</option>'}).join('')+'</select></label><label class="chk" for="s-t"><input id="s-t" type="checkbox" required><span>J’accepte les <button type="button" class="linkbtn" data-a="legal" data-k="cgu">conditions d’utilisation</button> et la <button type="button" class="linkbtn" data-a="legal" data-k="priv">politique de confidentialité</button>.</span></label>')+
 '<p class="err" id="su-err" role="alert"'+(err?'':' hidden')+'>'+(err?esc(err):'')+'</p>'+
 '<button class="btn" type="submit">Recevoir mon code</button></form>'+
 '<p class="note" style="margin-top:14px">'+(login?'Pas encore de compte ? <button type="button" class="linkbtn" data-a="signup">Créer un compte</button>':'Déjà inscrit ? <button type="button" class="linkbtn" data-a="login">Se connecter</button>')+'</p>');
}
function showCode(){
 openOv('<h2>Vérifiez votre numéro</h2><p style="margin-top:8px;color:var(--muted)">Un code à 4 chiffres est envoyé par SMS au '+esc(st.auth.phone)+'.</p>'+
 '<div class="panel safe"><p>Simulation : dans la vraie version le code arrive par SMS. Ici, saisissez <b>1234</b>.</p></div>'+
 '<form class="f" data-f="code"><label for="s-k">Code de vérification<input id="s-k" required inputmode="numeric" maxlength="4" autocomplete="one-time-code" placeholder="0000"></label>'+
 '<p class="err" id="su-err" role="alert" hidden></p>'+
 '<button class="btn" type="submit">Valider</button></form>');
}

/* compte */
function showAccount(tab){
 if(!user)return;
 st.open=null;
 st.tab=tab||st.tab||'mine';
 var t=st.tab;
 var tabs=[['mine','Mes annonces'],['favs','Favoris'],['settings','Paramètres'],['help','Aide et avis']];
 var h='<h2>'+esc(user.name)+'</h2><p class="note" style="margin-top:6px">'+esc(user.city)+' · '+esc(user.phone)+'</p>'+
 '<div class="tabs" role="group" aria-label="Sections du compte">'+tabs.map(function(x){return '<button type="button" data-a="tab" data-t="'+x[0]+'" aria-pressed="'+(t===x[0]?'true':'false')+'">'+x[1]+'</button>'}).join('')+'</div>';
 if(t==='mine'){
  var mine=items.filter(function(i){return i.owner===user.id});
  h+=mine.length?'<div class="list">'+mine.map(function(i){return '<div><span class="t">'+esc(i.t)+(i.sold?' · Vendu':'')+'</span><span class="note">'+fmt(i.price)+' · '+esc(i.city)+' · '+ago(i.ts)+'</span><span class="a"><button type="button" class="btn ghost sm" data-a="open" data-id="'+i.id+'">Voir</button><button type="button" class="btn ghost sm" data-a="edit" data-id="'+i.id+'">Modifier</button><button type="button" class="btn ghost sm" data-a="sold" data-id="'+i.id+'">'+(i.sold?'Remettre en vente':'Vendu')+'</button><button type="button" class="btn '+(st.confirmDel===i.id?'danger':'ghost')+' sm" data-a="del" data-id="'+i.id+'">'+(st.confirmDel===i.id?'Confirmer':'Supprimer')+'</button></span></div>'}).join('')+'</div>':'<div class="panel"><p class="note">Vous n’avez pas encore d’annonce.</p></div>';
  h+='<div class="btns"><button type="button" class="btn" data-a="publish">Déposer une annonce</button></div>';
 }else if(t==='favs'){
  var fl=myFavs().map(find).filter(Boolean);
  h+=fl.length?'<div class="list">'+fl.map(function(i){return '<div><span class="t">'+esc(i.t)+'</span><span class="note">'+fmt(i.price)+' · '+esc(i.city)+'</span><span class="a"><button type="button" class="btn ghost sm" data-a="open" data-id="'+i.id+'">Voir</button><button type="button" class="btn ghost sm" data-a="fav" data-id="'+i.id+'">Retirer</button></span></div>'}).join('')+'</div>':'<div class="panel"><p class="note">Touchez le cœur sur une annonce pour la retrouver ici.</p></div>';
 }else if(t==='settings'){
  var th=load('lc_theme','auto');var nt=user.notif||{sms:true,wa:false,msg:true};
  h+='<form class="f" data-f="settings"><label for="p-n">Nom complet<input id="p-n" required maxlength="60" value="'+esc(user.name)+'"></label>'+
  '<div class="two"><label for="p-c">Ville<select id="p-c">'+CITIES.map(function(c){return '<option'+(user.city===c?' selected':'')+'>'+c+'</option>'}).join('')+'</select></label>'+
  '<label for="p-p">Téléphone<input id="p-p" readonly value="'+esc(user.phone)+'"></label></div>'+
  '<p class="note">Changer de numéro demandera un nouveau code SMS (bientôt).</p>'+
  '<div class="panel" style="margin-top:0"><h3>Notifications</h3>'+
  '<label class="tog" for="n-m"><span>Nouveaux messages</span><input id="n-m" type="checkbox"'+(nt.msg?' checked':'')+'></label>'+
  '<label class="tog" for="n-s"><span>Alertes par SMS</span><input id="n-s" type="checkbox"'+(nt.sms?' checked':'')+'></label>'+
  '<label class="tog" for="n-w"><span>Alertes par WhatsApp</span><input id="n-w" type="checkbox"'+(nt.wa?' checked':'')+'></label></div>'+
  '<div class="panel" style="margin-top:0"><h3>Apparence</h3><div class="opts" role="radiogroup" aria-label="Thème">'+[['auto','Automatique'],['light','Clair'],['dark','Sombre']].map(function(x){return '<label><input type="radio" name="theme" value="'+x[0]+'"'+(th===x[0]?' checked':'')+'> '+x[1]+'</label>'}).join('')+'</div></div>'+
  '<button class="btn" type="submit" style="justify-self:start">Enregistrer</button></form>'+
  '<div class="panel dng"><h3>Supprimer mon compte</h3><p class="note">Votre compte, vos annonces, vos photos et vos favoris seront effacés définitivement.</p>'+
  (st.delAcc?'<form class="f" data-f="delacc"><label for="d-c">Tapez SUPPRIMER pour confirmer<input id="d-c" autocomplete="off"></label><p class="err" id="d-err" role="alert" hidden></p><button class="btn danger sm" type="submit" style="justify-self:start">Supprimer définitivement</button></form>':'<div class="btns"><button type="button" class="btn ghost sm" data-a="delacc">Supprimer mon compte</button></div>')+'</div>'+
  '<div class="btns"><button type="button" class="btn ghost sm" data-a="logout">Se déconnecter</button></div>';
 }else{
  h+=helpHtml()+'<div class="btns"><button type="button" class="btn ghost sm" data-a="logout">Se déconnecter</button></div>';
 }
 openOv(h);
}
function helpHtml(){
 return '<div class="panel"><h3>Donner votre avis</h3><form class="f" data-f="feedback" style="margin-top:0"><div class="two"><label for="fb-t">Sujet<select id="fb-t"><option>Idée d’amélioration</option><option>Problème rencontré</option><option>Question</option><option>Autre</option></select></label><label for="fb-r">Satisfaction<select id="fb-r"><option value="5">5 sur 5</option><option value="4">4 sur 5</option><option value="3">3 sur 5</option><option value="2">2 sur 5</option><option value="1">1 sur 5</option></select></label></div><label for="fb-m">Votre message<textarea id="fb-m" required maxlength="600" placeholder="Dites-nous ce qui manque ou ce qui ne marche pas"></textarea></label><button class="btn sm" type="submit" style="justify-self:start">Envoyer mon avis</button></form></div>'+
 '<div class="panel"><h3>Questions fréquentes</h3>'+
 '<details><summary>Comment publier une annonce ?</summary><p>Connectez-vous, touchez « Déposer une annonce », ajoutez des photos, un titre, un prix et une description.</p></details>'+
 '<details><summary>Comment éviter les arnaques ?</summary><p>Rencontrez le vendeur dans un lieu public, vérifiez l’article avant de payer et ne versez jamais d’argent à l’avance. Signalez toute annonce suspecte.</p></details>'+
 '<details><summary>Puis-je modifier ou supprimer mon annonce ?</summary><p>Oui, depuis « Mes annonces » ou depuis la fiche de l’annonce. Vous pouvez aussi la marquer comme vendue.</p></details>'+
 '<details><summary>Comment supprimer mon compte ?</summary><p>Ouvrez « Paramètres », puis « Supprimer mon compte ». Vos données sont effacées.</p></details>'+
 '<details><summary>Combien coûte Locachat ?</summary><p>Le service est gratuit pendant le lancement.</p></details></div>'+
 '<div class="panel"><h3>Informations légales</h3><div class="btns" style="margin-top:0"><button type="button" class="btn ghost sm" data-a="legal" data-k="cgu">Conditions d’utilisation</button><button type="button" class="btn ghost sm" data-a="legal" data-k="priv">Confidentialité</button></div><p class="note" style="margin-top:8px">Contact du support : à définir.</p></div>';
}
function showLegal(k){
 var cgu=k==='cgu';
 openOv('<h2>'+(cgu?'Conditions d’utilisation':'Confidentialité')+'</h2><div class="panel safe"><p>Texte provisoire de la maquette. À faire rédiger et valider par un juriste avant le lancement.</p></div>'+
 '<div class="panel">'+(cgu
  ?'<p>Ce que le texte final devra couvrir :</p><ul style="margin:8px 0 0;padding-left:18px;color:var(--muted)"><li>Rôle de Locachat : mise en relation, sans être partie à la vente</li><li>Articles et services interdits</li><li>Responsabilité des utilisateurs et des annonces</li><li>Modération, suspension de compte et signalements</li><li>Gratuité du lancement et évolution des tarifs</li></ul>'
  :'<p>Ce que le texte final devra couvrir :</p><ul style="margin:8px 0 0;padding-left:18px;color:var(--muted)"><li>Données collectées : nom, numéro de téléphone, ville, annonces, photos</li><li>Finalités : compte, vérification du numéro, mise en relation, modération</li><li>Durée de conservation et suppression du compte</li><li>Droits d’accès, de rectification et de suppression</li><li>Prestataires utilisés (hébergement, SMS)</li></ul>')+'</div>'+
 '<div class="btns"><button type="button" class="btn ghost sm" data-a="close">Fermer</button></div>');
}

/* photos */
function shrink(file){
 return new Promise(function(res,rej){
  var r=new FileReader();r.onerror=rej;
  r.onload=function(){
   var im=new Image();im.onerror=rej;
   im.onload=function(){
    var s=Math.min(1,900/Math.max(im.width,im.height));
    var c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);
    c.getContext('2d').drawImage(im,0,0,c.width,c.height);
    res(c.toDataURL('image/jpeg',.75));
   };
   im.src=r.result;
  };
  r.readAsDataURL(file);
 });
}
function addPhotos(files){
 var room=MAX_PHOTOS-st.photos.length;
 var list=Array.prototype.slice.call(files).filter(function(f){return /^image\//.test(f.type)}).slice(0,room);
 if(!list.length){if(room<=0)toast('4 photos au maximum');return}
 Promise.all(list.map(shrink)).then(function(arr){
  st.photos=st.photos.concat(arr);
  var p=$('#pth');if(p)p.innerHTML=thumbsHtml();
 }).catch(function(){toast('Cette image n’a pas pu être lue')});
}

function afterLogin(){
 renderAcct();renderGrid();closeOv();
 var a=st.after;st.after=null;
 if(a==='publish')showPublish();
 else if(a&&a.indexOf('fav:')===0){toggleFav(+a.slice(4))}
}
function toggleFav(id){
 if(!user){needLogin('fav:'+id);return}
 var l=(favs[user.id]||[]).slice();var i=l.indexOf(id);
 if(i>=0){l.splice(i,1);toast('Retiré des favoris')}else{l.push(id);toast('Ajouté aux favoris')}
 favs[user.id]=l;save('lc_favs',favs);renderGrid();
 if(!$('#ov').hidden){if(st.open!==null)showDetail(st.open,true);else showAccount(st.tab)}
}

/* évènements */
document.addEventListener('click',function(e){
 var a=e.target.closest('[data-a]');if(!a)return;
 var act=a.getAttribute('data-a'),id=+a.getAttribute('data-id');
 if(act==='cat'){st.cat=a.getAttribute('data-c');renderChips();renderGrid()}
 else if(act==='open'){st.confirmDel=null;showDetail(id)}
 else if(act==='close'){closeOv()}
 else if(act==='publish'){showPublish()}
 else if(act==='edit'){showPublish(id)}
 else if(act==='login'){st.after=null;showAuth('login')}
 else if(act==='signup'){showAuth('signup')}
 else if(act==='account'){st.delAcc=false;showAccount('mine')}
 else if(act==='tab'){st.delAcc=false;showAccount(a.getAttribute('data-t'))}
 else if(act==='help'){openOv('<h2>Aide et avis</h2>'+helpHtml())}
 else if(act==='legal'){showLegal(a.getAttribute('data-k'))}
 else if(act==='fav'){toggleFav(id)}
 else if(act==='logout'){user=null;uid=null;try{localStorage.removeItem('lc_session')}catch(er){}renderAcct();renderGrid();closeOv();toast('Vous êtes déconnecté. Vos annonces sont conservées.')}
 else if(act==='img'){st.imgIdx=+a.getAttribute('data-i');showDetail(st.open,true)}
 else if(act==='rmphoto'){st.photos.splice(+a.getAttribute('data-i'),1);$('#pth').innerHTML=thumbsHtml()}
 else if(act==='sold'){var it=find(id);if(it&&user&&it.owner===user.id){it.sold=!it.sold;save('lc_items',items);renderGrid();toast(it.sold?'Marquée comme vendue':'Remise en vente');if(st.open!==null)showDetail(st.open,true);else showAccount('mine')}}
 else if(act==='del'){
  if(st.confirmDel!==id){st.confirmDel=id;if(st.open!==null)showDetail(id,true);else showAccount('mine');return}
  items=items.filter(function(i){return i.id!==id});save('lc_items',items);st.confirmDel=null;renderGrid();toast('Annonce supprimée');
  if(st.open!==null){closeOv()}else showAccount('mine');
 }
 else if(act==='delacc'){st.delAcc=true;showAccount('settings')}
});
$('#ov').addEventListener('click',function(e){if(e.target===$('#ov'))closeOv()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('#ov').hidden)closeOv()});
document.addEventListener('change',function(e){
 var t=e.target;if(!t)return;
 if(t.id==='f-img'){addPhotos(t.files);t.value=''}
 else if(t.name==='theme'){applyTheme(t.value);save('lc_theme',t.value)}
});
function authErr(m){var er=$('#su-err');if(er){er.textContent=m;er.hidden=false}}
document.addEventListener('submit',function(e){
 var f=e.target.getAttribute&&e.target.getAttribute('data-f');if(!f)return;
 e.preventDefault();
 if(f==='send'){
  if(!user){needLogin();return}
  var inp=$('#msg');var m=inp.value.trim()||inp.placeholder;
  (st.chats[st.open]=st.chats[st.open]||[]).push(m);showDetail(st.open,true);
 }else if(f==='su1'||f==='li1'){
  var d=digits($('#s-p').value);
  if(d.length<9){authErr('Entrez un numéro à 9 chiffres, par exemple 06 123 45 67.');return}
  var ex=users.filter(function(u){return digits(u.phone)===d})[0];
  if(f==='su1'){
   if(ex){authErr('Ce numéro a déjà un compte. Connectez-vous.');return}
   st.auth={mode:'signup',name:$('#s-n').value.trim(),phone:fmtPhone(d),city:$('#s-c').value};
  }else{
   if(!ex){authErr('Aucun compte avec ce numéro. Créez un compte.');return}
   st.auth={mode:'login',phone:ex.phone,userId:ex.id};
  }
  showCode();
 }else if(f==='code'){
  if($('#s-k').value.trim()!=='1234'){authErr('Code incorrect. Saisissez 1234 pour cette simulation.');return}
  if(st.auth.mode==='signup'){
   user={id:'u'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name:st.auth.name,phone:st.auth.phone,city:st.auth.city,notif:{msg:true,sms:true,wa:false}};
   users.push(user);save('lc_users',users);toast('Compte créé. Bienvenue '+user.name.split(' ')[0]);
  }else{
   user=users.filter(function(u){return u.id===st.auth.userId})[0];toast('Bon retour '+user.name.split(' ')[0]);
  }
  uid=user.id;save('lc_session',uid);afterLogin();
 }else if(f==='pub'){
  var rec={t:$('#f-t').value.trim(),cat:$('#f-c').value,city:$('#f-v').value,price:Math.max(0,+$('#f-p').value||0),type:$('#f-ty').value,desc:$('#f-d').value.trim(),imgs:st.photos.slice()};
  rec.per=rec.type==='location'?'/ jour':'';
  var next,ed=st.editId?find(st.editId):null;
  if(ed){next=items.map(function(i){return i.id===ed.id?Object.assign({},i,rec):i})}
  else{next=[Object.assign({id:Date.now(),owner:user.id,seller:user.name,ts:Date.now()},rec)].concat(items)}
  if(!save('lc_items',next)){var pe=$('#pub-err');pe.textContent='Espace de stockage plein. Retirez une photo ou supprimez une ancienne annonce.';pe.hidden=false;return}
  items=next;var wasEdit=!!ed;closeOv();st.cat='';st.q='';$('#q').value='';renderChips();renderGrid();toast(wasEdit?'Annonce modifiée':'Annonce publiée');
  if(!wasEdit){try{$('#grid').scrollIntoView({behavior:'smooth',block:'start'})}catch(er){}}
 }else if(f==='review'){
  if(!user){needLogin();return}
  var it=find(st.open);if(!it)return;
  reviews=reviews.filter(function(r){return !(r.about===it.owner&&r.by===user.id)});
  reviews.push({about:it.owner,by:user.id,byName:user.name,rating:+$('#r-s').value,text:$('#r-t').value.trim(),ts:Date.now()});
  save('lc_reviews',reviews);showDetail(st.open,true);toast('Merci pour votre avis');
 }else if(f==='report'){
  if(!user){needLogin();return}
  var rp=load('lc_reports',[]);rp.push({item:st.open,by:user.id,reason:$('#rp-r').value,ts:Date.now()});save('lc_reports',rp);
  toast('Annonce signalée. Merci');
 }else if(f==='feedback'){
  var fb=load('lc_feedback',[]);fb.push({by:user?user.id:null,subject:$('#fb-t').value,rating:+$('#fb-r').value,msg:$('#fb-m').value.trim(),ts:Date.now()});save('lc_feedback',fb);
  $('#fb-m').value='';toast('Merci pour votre avis');
 }else if(f==='settings'){
  user.name=$('#p-n').value.trim()||user.name;user.city=$('#p-c').value;
  user.notif={msg:$('#n-m').checked,sms:$('#n-s').checked,wa:$('#n-w').checked};
  items=items.map(function(i){return i.owner===user.id?Object.assign({},i,{seller:user.name}):i});
  save('lc_users',users);save('lc_items',items);renderAcct();renderGrid();toast('Paramètres enregistrés');showAccount('settings');
 }else if(f==='delacc'){
  if($('#d-c').value.trim().toUpperCase()!=='SUPPRIMER'){var de=$('#d-err');de.textContent='Tapez le mot SUPPRIMER pour confirmer.';de.hidden=false;return}
  var gone=user.id;
  items=items.filter(function(i){return i.owner!==gone});delete favs[gone];
  reviews=reviews.filter(function(r){return r.by!==gone&&r.about!==gone});
  users=users.filter(function(u){return u.id!==gone});
  save('lc_items',items);save('lc_favs',favs);save('lc_reviews',reviews);save('lc_users',users);
  try{localStorage.removeItem('lc_session')}catch(er){}
  user=null;uid=null;closeOv();renderAcct();renderGrid();toast('Votre compte a été supprimé');
 }
});
$('#q').addEventListener('input',function(e){st.q=e.target.value;renderGrid()});
$('#city').addEventListener('change',function(e){st.city=e.target.value;renderGrid()});
$('#type').addEventListener('change',function(e){st.type=e.target.value;renderGrid()});
$('#sort').addEventListener('change',function(e){st.sort=e.target.value;renderGrid()});

CITIES.forEach(function(c){var o=document.createElement('option');o.value=c;o.textContent=c;$('#city').appendChild(o)});
renderAcct();renderChips();renderGrid();
})();