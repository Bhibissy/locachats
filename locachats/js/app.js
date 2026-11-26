import * as api from './api.js';
import { prepareImage } from './images.js';

/* =====================================================================
   LOCACHAT : le site. Ce fichier gère l'affichage et les clics.
   Tout ce qui touche à la base de données est dans api.js.
   ===================================================================== */

const CITIES = ['Brazzaville', 'Pointe-Noire', 'Dolisie', 'Nkayi', 'Oyo', 'Owando'];
// [identifiant dans la base, nom affiché, exemples]. Ne change JAMAIS l'identifiant (1er mot), seulement le nom.
const CATS = [
  ['tech', 'Téléphones & électronique', 'téléphones, ordinateurs, écouteurs…'],
  ['elec', 'Maison & électroménager', 'frigo, cuisinière, ventilateur, meubles…'],
  ['mode', 'Vêtements & chaussures', 'habits, pagnes, chaussures, sacs…'],
  ['serv', 'Services', 'réparation, coiffure, livraison, cours…'],
  ['loc', 'Location de matériel', 'sono, bâche, groupe électrogène, outils…']
];
const SOON = ['Terrains', 'Véhicules', 'Immobilier'];
const REASONS = ['Arnaque ou faux article', 'Article interdit', 'Mauvaise catégorie', 'Photos trompeuses', 'Autre'];
const MAX_PHOTOS = 4;

/* ---------- Petits outils ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => new Intl.NumberFormat('fr-FR').format(n).replace(/[  ]/g, ' ') + ' FCFA';
const catLabel = id => (CATS.find(c => c[0] === id) || ['', ''])[1];
const timeOf = ts => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
function ago(ts) {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 2) return 'à l’instant';
  if (m < 60) return 'il y a ' + m + ' min';
  if (m < 1440) return 'il y a ' + Math.round(m / 60) + ' h';
  return 'il y a ' + Math.round(m / 1440) + ' j';
}
// "Aïcha Moukala" devient "Aïcha M." (on n'affiche pas les noms complets)
function shortName(n) {
  const p = String(n || '').trim().split(/\s+/);
  return p.length > 1 ? p[0] + ' ' + p[p.length - 1][0].toUpperCase() + '.' : (p[0] || 'Utilisateur');
}
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* tant pis */ } }
};

const ICONS = {
  tech: '<rect x="47" y="12" width="26" height="56" rx="6" fill="currentColor" opacity=".8"/><circle cx="60" cy="60" r="2.5" fill="var(--surface2)"/>',
  elec: '<rect x="44" y="10" width="32" height="60" rx="4" fill="currentColor" opacity=".8"/><rect x="44" y="30" width="32" height="2.5" fill="var(--surface2)"/><rect x="50" y="18" width="3" height="8" rx="1.5" fill="var(--surface2)"/><rect x="50" y="38" width="3" height="14" rx="1.5" fill="var(--surface2)"/>',
  mode: '<path d="M42 14L54 9Q60 16 66 9L78 14L92 27L82 33L78 29L78 70L42 70L42 29L38 33L28 27Z" fill="currentColor" opacity=".8"/>',
  serv: '<g transform="rotate(35 60 40)"><rect x="56" y="16" width="8" height="52" rx="3" fill="currentColor" opacity=".8"/><rect x="40" y="12" width="40" height="15" rx="3" fill="currentColor"/></g>',
  loc: '<rect x="40" y="9" width="40" height="62" rx="6" fill="currentColor" opacity=".8"/><circle cx="60" cy="26" r="8" fill="var(--surface2)"/><circle cx="60" cy="52" r="13" fill="var(--surface2)"/><circle cx="60" cy="52" r="6" fill="currentColor"/>'
};
function art(cat) {
  return '<svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><polygon points="70,0 100,0 40,80 10,80" fill="#F2C200" opacity=".22"/><polygon points="100,0 120,0 120,16 56,80 40,80" fill="#CF2A22" opacity=".14"/><polygon points="0,0 70,0 10,80 0,80" fill="#00873E" opacity=".12"/>' + (ICONS[cat] || '') + '</svg>';
}
const priceHtml = l => `<span class="price num">${fmt(l.price)}${l.type === 'location' ? ' <small>/ ' + esc(l.rent ? l.rent.unit : 'jour') + '</small>' : ''}</span>`;
const dayFr = d => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
// Lien direct vers une annonce (c'est ce qu'on envoie sur WhatsApp)
const shareUrl = l => location.origin + location.pathname + '?a=' + encodeURIComponent(l.id);
const shareBtns = l => `<a class="btn ghost sm" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(l.t + ' · ' + fmt(l.price) + '\n' + shareUrl(l))}">Partager sur WhatsApp</a><button type="button" class="btn ghost sm" data-a="copylink">Copier le lien</button>`;
function rentHtml(l) {
  const r = l.rent;
  if (!r) return '';
  const rows = [];
  if (r.from && r.to) rows.push(['Disponible', 'du ' + dayFr(r.from) + ' au ' + dayFr(r.to)]);
  else if (r.from) rows.push(['Disponible', 'à partir du ' + dayFr(r.from)]);
  else if (r.to) rows.push(['Disponible', 'jusqu’au ' + dayFr(r.to)]);
  if (r.hours) rows.push(['Heures de remise', r.hours]);
  if (r.min) rows.push(['Durée minimum', r.min]);
  if (r.deposit) rows.push(['Caution', fmt(r.deposit)]);
  if (r.delivery) rows.push(['Livraison', 'possible']);
  if (!rows.length) return '';
  return '<div class="panel"><h3>Conditions de location</h3>' + rows.map(x => `<div class="rrow"><span>${x[0]}</span><b>${esc(x[1])}</b></div>`).join('') + '</div>';
}

/* ---------- État du site (ce que le site "retient" pendant qu'il est ouvert) ---------- */
const st = {
  q: '', city: '', cat: '', type: '', sort: 'recent',
  items: [], total: 0, page: 0, loading: false, err: null, tok: 0,
  user: null, profile: null, unread: 0, after: null,
  ov: null, ovTok: 0, listing: null, imgIdx: 0, form: null, conv: null, convs: [], mine: [],
  tab: 'mine', delAcc: false, confirmDel: null
};

/* ---------- Thème clair / sombre ---------- */
function applyTheme(t) {
  const r = document.documentElement;
  if (t === 'light' || t === 'dark') r.setAttribute('data-theme', t); else r.removeAttribute('data-theme');
}
applyTheme(store.get('lc_theme', 'auto'));

/* ---------- Fenêtre (popup) et message rapide ---------- */
function openOv(html, kind) {
  st.ov = kind || null;
  $('#ov-body').innerHTML = html;
  $('#ov').hidden = false;
  $('#sheet').scrollTop = 0;
  try { $('#sheet').focus(); } catch (e) { /* rien */ }
  return ++st.ovTok;
}
function closeOv() {
  $('#ov').hidden = true;
  st.ov = null; st.ovTok++; st.listing = null; st.form = null; st.conv = null; st.delAcc = false; st.confirmDel = null;
}
function toast(m) {
  const t = $('#toast');
  t.textContent = m; t.hidden = false;
  clearTimeout(toast.h);
  toast.h = setTimeout(() => { t.hidden = true; }, 3500);
}
const fail = e => toast(api.friendlyError(e));

/* ---------- En-tête ---------- */
function renderAcct() {
  const first = st.profile ? shortName(st.profile.display_name).split(' ')[0] : 'Mon compte';
  $('#acct').innerHTML = st.user
    ? `<button type="button" class="btn ghost sm" data-a="inbox">Messages${st.unread ? ` <span class="dot">${st.unread > 9 ? '9+' : st.unread}</span>` : ''}</button>
       <button type="button" class="btn ghost sm" data-a="account">${esc(first)}</button>
       <button type="button" class="btn ghost sm" data-a="logout">Déconnexion</button>
       <button type="button" class="btn" data-a="publish">Déposer une annonce</button>`
    : `<button type="button" class="btn ghost" data-a="login">Se connecter</button>
       <button type="button" class="btn" data-a="publish">Déposer une annonce</button>`;
}

/* ---------- Liste des annonces ---------- */
function cardHtml(l) {
  const img = l.thumbs[0] ? `<img src="${esc(l.thumbs[0])}" alt="${esc(l.t)}" loading="lazy" decoding="async">` : art(l.cat);
  const badge = l.sold ? '<span class="badge sold">Vendu</span>' : (l.type === 'location' ? '<span class="badge">Location</span>' : '');
  return `<article class="card${l.sold ? ' sold' : ''}"><button type="button" class="cardbtn" data-a="open" data-id="${esc(l.id)}"><div class="tile">${img}${badge}</div><div class="cbody"><h3>${esc(l.t)}</h3>${priceHtml(l)}<div class="meta"><span>${esc(l.city)}</span><span>${ago(l.ts)}</span></div><div class="meta"><span>${esc(shortName(l.seller))}</span></div></div></button></article>`;
}
function renderGrid() {
  const noFilter = !st.q.trim() && !st.city && !st.cat && !st.type;
  $('#count').textContent = st.loading && !st.items.length ? '' : st.total + (st.total > 1 ? ' annonces' : ' annonce');
  let h;
  if (st.err && !st.items.length) h = `<div class="empty"><h3>Chargement impossible</h3><p>${esc(st.err)}</p><button type="button" class="btn" data-a="retry">Réessayer</button></div>`;
  else if (st.loading && !st.items.length) h = '<p class="loading">Chargement des annonces…</p>';
  else if (st.items.length) h = st.items.map(cardHtml).join('');
  else if (noFilter) h = '<div class="empty"><h3>Aucune annonce pour le moment</h3><p>Locachat vient d’ouvrir. Soyez le premier à publier un article ou un service, avec des photos.</p><button type="button" class="btn" data-a="publish">Déposer la première annonce</button></div>';
  else h = '<div class="empty"><h3>Aucun résultat</h3><p>Essayez une autre ville ou retirez un filtre.</p></div>';
  $('#grid').innerHTML = h;
  $('#more').innerHTML = st.items.length && st.items.length < st.total
    ? `<button type="button" class="btn ghost" data-a="more"${st.loading ? ' disabled' : ''}>${st.loading ? 'Chargement…' : 'Voir plus d’annonces'}</button>`
    : (st.err && st.items.length ? '<button type="button" class="btn ghost" data-a="more">Réessayer</button>' : '');
}
function renderChips() {
  let h = `<button type="button" class="chip" data-a="cat" data-c="" aria-pressed="${st.cat === ''}">Tout</button>`;
  CATS.forEach(c => { h += `<button type="button" class="chip" data-a="cat" data-c="${c[0]}" aria-pressed="${st.cat === c[0]}">${c[1]}</button>`; });
  SOON.forEach(s => { h += `<span class="chip soon">${s}<small>Bientôt</small></span>`; });
  $('#chips').innerHTML = h;
}
// Charge les annonces depuis Supabase (20 par 20)
async function loadListings(reset) {
  if (!reset && st.loading) return;
  const tok = ++st.tok;
  if (reset) { st.items = []; st.total = 0; st.page = 0; }
  st.loading = true; st.err = null;
  renderGrid();
  try {
    const { rows, total } = await api.fetchListings({ q: st.q, city: st.city, cat: st.cat, type: st.type, sort: st.sort, page: st.page });
    if (tok !== st.tok) return; // une recherche plus récente a pris la place
    st.items = st.items.concat(rows); st.total = total; st.page++;
  } catch (e) {
    if (tok !== st.tok) return;
    st.err = api.friendlyError(e);
  }
  st.loading = false;
  renderGrid();
}
async function getListing(id) {
  return st.items.find(x => x.id === id) || st.mine.find(x => x.id === id) || await api.fetchListing(id);
}

/* ---------- Fiche d'une annonce ---------- */
function showListing(l, keepIdx) {
  st.listing = l;
  if (!keepIdx) st.imgIdx = 0;
  const mine = st.user && l.owner === st.user.id;
  const big = l.imgs[st.imgIdx] ? `<img src="${esc(l.imgs[st.imgIdx])}" alt="${esc(l.t)}">` : art(l.cat);
  const n = l.imgs.length;
  const gal = `<div class="dtile gal" id="gal"><div class="tile">${big}</div>${n > 1 ? `<button type="button" class="gnav prev" data-a="gprev" aria-label="Photo précédente">‹</button><button type="button" class="gnav next" data-a="gnext" aria-label="Photo suivante">›</button><span class="gcount">${st.imgIdx + 1} / ${n}</span>` : ''}</div>`;
  let h = `<h2>${esc(l.t)}${l.sold ? ' <span class="tag" style="background:var(--red);color:#fff;vertical-align:middle">Vendu</span>' : ''}</h2>${gal}`;
  if (l.imgs.length > 1) h += `<div class="thumbs">${l.thumbs.map((s, i) => `<button type="button" data-a="img" data-i="${i}" aria-pressed="${i === st.imgIdx}" aria-label="Photo ${i + 1}"><img src="${esc(s)}" alt=""></button>`).join('')}</div>`;
  h += `<div class="row" style="margin-bottom:6px">${priceHtml(l)}<span>${esc(l.city)}</span><span>${ago(l.ts)}</span><span class="tag">${esc(catLabel(l.cat))}</span>${l.type === 'location' ? '<span class="tag">Location</span>' : ''}</div>`;
  h += `<p style="margin:10px 0;overflow-wrap:anywhere">${esc(l.desc)}</p>`;
  h += rentHtml(l);
  h += `<div class="row"><span>Vendeur : <b style="color:var(--fg)">${esc(shortName(l.seller))}</b></span></div>`;
  if (mine) {
    h += `<div class="btns"><button type="button" class="btn sm" data-a="edit" data-id="${esc(l.id)}">Modifier</button><button type="button" class="btn ghost sm" data-a="sold" data-id="${esc(l.id)}">${l.sold ? 'Remettre en vente' : 'Marquer comme vendu'}</button><button type="button" class="btn ${st.confirmDel === l.id ? 'danger' : 'ghost'} sm" data-a="del" data-id="${esc(l.id)}">${st.confirmDel === l.id ? 'Confirmer la suppression' : 'Supprimer'}</button></div><div class="btns" style="margin-top:8px">${shareBtns(l)}</div>`;
  } else {
    h += `<div class="btns"><button type="button" class="btn" data-a="contact" data-id="${esc(l.id)}">Écrire au vendeur</button>${shareBtns(l)}</div>`;
    h += '<div class="panel safe"><h3>Payez en main propre</h3><p>Retrouvez le vendeur dans un lieu public, vérifiez l’article, puis payez en espèces ou par mobile money. Ne versez jamais d’argent à l’avance.</p></div>';
    h += `<div class="panel"><h3>Signaler cette annonce</h3><form class="send" data-f="report"><select id="rp-r" aria-label="Motif" style="flex:1;min-width:0;border:1.5px solid var(--line);background:var(--bg);border-radius:999px;padding:9px 14px">${REASONS.map(r => `<option>${r}</option>`).join('')}</select><button class="btn ghost sm" type="submit">Signaler</button></form></div>`;
  }
  openOv(h, 'listing');
  st.listing = l;
}
async function openListing(id) {
  const l = await getListing(id);
  if (l) showListing(l); else toast('Cette annonce n’existe plus.');
}
async function toggleSold(id) {
  const l = (st.listing && st.listing.id === id) ? st.listing : st.mine.find(x => x.id === id);
  if (!l) return;
  await api.setSold(id, !l.sold);
  toast(l.sold ? 'Remise en vente' : 'Marquée comme vendue');
  loadListings(true);
  if (st.ov === 'listing') { const nl = await api.fetchListing(id); if (nl) showListing(nl, true); } else if (st.ov === 'account') showAccount('mine');
}
async function removeListing(id) {
  if (st.confirmDel !== id) {
    st.confirmDel = id;
    if (st.ov === 'listing' && st.listing) showListing(st.listing, true); else showAccount('mine', false);
    return;
  }
  const l = (st.listing && st.listing.id === id) ? st.listing : st.mine.find(x => x.id === id);
  await api.deleteListing(id, l ? l.photos : []);
  st.confirmDel = null;
  toast('Annonce supprimée');
  loadListings(true);
  if (st.ov === 'listing') closeOv(); else showAccount('mine');
}

/* ---------- Publier / modifier une annonce ---------- */
function renderPhotoThumbs() {
  const box = $('#pth');
  if (!box || !st.form) return;
  box.innerHTML = st.form.photos.map((p, i) => `<div><img src="${esc(p.preview)}" alt="Photo ${i + 1}"><button type="button" data-a="rmphoto" data-i="${i}" aria-label="Retirer la photo ${i + 1}">×</button></div>`).join('');
}
function showPublish(edit) {
  if (!st.user) { needLogin({ k: 'publish' }); return; }
  const e = edit || null;
  const v = x => (e ? esc(e[x]) : '');
  const defaultCity = e ? e.city : ((st.profile && st.profile.city) || '');
  openOv(`<h2>${e ? 'Modifier l’annonce' : 'Déposer une annonce'}</h2><p class="note" style="margin-top:6px">Gratuit pendant le lancement.</p>
  <form class="f" data-f="pub">
   <div><label class="drop" for="f-img"><b>Ajouter des photos</b><span>Jusqu’à ${MAX_PHOTOS} photos. Elles sont réduites automatiquement.</span><input id="f-img" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><div class="pthumbs" id="pth" style="margin-top:10px"></div></div>
   <label for="f-t">Titre<input id="f-t" required minlength="3" maxlength="80" placeholder="Ex. Télévision LG 43 pouces" value="${v('t')}"></label>
   <div class="two"><label for="f-c">Catégorie<select id="f-c">${CATS.map(c => `<option value="${c[0]}"${e && e.cat === c[0] ? ' selected' : ''}>${c[1]} (${c[2]})</option>`).join('')}</select></label>
   <label for="f-ty">Type<select id="f-ty"><option value="vente"${e && e.type === 'vente' ? ' selected' : ''}>Vente</option><option value="location"${e && e.type === 'location' ? ' selected' : ''}>Location (prix par jour)</option></select></label></div>
   <div class="two"><label for="f-v">Ville<select id="f-v">${CITIES.map(c => `<option${defaultCity === c ? ' selected' : ''}>${c}</option>`).join('')}</select></label>
   <label for="f-p">Prix (FCFA)<input id="f-p" type="number" min="0" max="1000000000" step="500" required inputmode="numeric" placeholder="25000" value="${e ? e.price : ''}"></label></div>
   <div class="panel" id="rent-box" style="margin-top:0"${e && e.type === 'location' ? '' : ' hidden'}>
    <h3>Infos de location <span class="note">(facultatif)</span></h3>
    <div class="two"><label for="r-u">Le prix est par<select id="r-u">${[['heure', 'heure'], ['jour', 'jour'], ['semaine', 'semaine'], ['mois', 'mois']].map(x => `<option value="${x[0]}"${(e && e.rent ? e.rent.unit : 'jour') === x[0] ? ' selected' : ''}>${x[1]}</option>`).join('')}</select></label>
    <label for="r-dep">Caution (FCFA)<input id="r-dep" type="number" min="0" max="1000000000" step="500" inputmode="numeric" placeholder="Ex. 20000" value="${e && e.rent && e.rent.deposit != null ? e.rent.deposit : ''}"></label></div>
    <div class="two"><label for="r-from">Disponible à partir du<input id="r-from" type="date" value="${e && e.rent && e.rent.from ? esc(e.rent.from) : ''}"></label>
    <label for="r-to">Jusqu’au<input id="r-to" type="date" value="${e && e.rent && e.rent.to ? esc(e.rent.to) : ''}"></label></div>
    <div class="two"><label for="r-h">Heures de remise<input id="r-h" maxlength="40" placeholder="Ex. 8h à 18h" value="${e && e.rent && e.rent.hours ? esc(e.rent.hours) : ''}"></label>
    <label for="r-min">Durée minimum<input id="r-min" maxlength="40" placeholder="Ex. 1 jour" value="${e && e.rent && e.rent.min ? esc(e.rent.min) : ''}"></label></div>
    <label class="chk" for="r-del"><input id="r-del" type="checkbox"${e && e.rent && e.rent.delivery ? ' checked' : ''}><span>Livraison possible</span></label>
   </div>
   <label for="f-d">Description<textarea id="f-d" required maxlength="500" placeholder="État, accessoires, lieu de remise…">${v('desc')}</textarea></label>
   <p class="err" id="pub-err" role="alert" hidden></p>
   <button class="btn" type="submit">${e ? 'Enregistrer les modifications' : 'Publier l’annonce'}</button>
  </form>`, 'publish');
  st.form = { edit: e, removed: [], photos: e ? e.photos.map(p => ({ id: p.id, path: p.path, position: p.position, preview: p.thumb })) : [] };
  renderPhotoThumbs();
}
async function addFormPhotos(files) {
  if (!st.form) return;
  const list = Array.from(files).slice(0, MAX_PHOTOS - st.form.photos.length);
  if (!list.length) { if (files.length) toast(MAX_PHOTOS + ' photos au maximum'); return; }
  for (const f of list) {
    try {
      const p = await prepareImage(f);
      if (!st.form) return;
      st.form.photos.push(p);
      renderPhotoThumbs();
    } catch (e) { toast(e.message || 'Cette photo n’a pas pu être lue.'); }
  }
}
async function submitListing(form) {
  const pubErr = m => { const el = $('#pub-err'); el.textContent = m; el.hidden = false; };
  const f = { t: $('#f-t').value.trim(), cat: $('#f-c').value, type: $('#f-ty').value, city: $('#f-v').value, price: Math.round(Number($('#f-p').value)), desc: $('#f-d').value.trim() };
  if (f.type === 'location') {
    const dep = $('#r-dep').value.trim();
    f.rent = { unit: $('#r-u').value, from: $('#r-from').value, to: $('#r-to').value, hours: $('#r-h').value.trim(), min: $('#r-min').value.trim(), deposit: dep === '' ? null : Math.round(Number(dep)), delivery: $('#r-del').checked };
    if (f.rent.from && f.rent.to && f.rent.to < f.rent.from) return pubErr('La date de fin ne peut pas être avant la date de début.');
    if (f.rent.deposit !== null && (!Number.isFinite(f.rent.deposit) || f.rent.deposit < 0 || f.rent.deposit > 1000000000)) return pubErr('Caution invalide.');
  }
  if (f.t.length < 3) return pubErr('Le titre doit avoir au moins 3 caractères.');
  if (!Number.isFinite(f.price) || f.price < 0 || f.price > 1000000000) return pubErr('Prix invalide.');
  if (!f.desc) return pubErr('Ajoutez une description.');
  const btn = form.querySelector('[type=submit]');
  btn.disabled = true; btn.textContent = 'Envoi en cours…';
  try {
    const fresh = st.form.photos.filter(p => !p.id);
    if (st.form.edit) {
      const keep = st.form.photos.filter(p => p.id);
      const start = keep.reduce((m, p) => Math.max(m, p.position), -1) + 1;
      await api.updateListing(st.user.id, st.form.edit.id, f, st.form.removed, fresh, start);
    } else {
      await api.createListing(st.user.id, f, fresh);
    }
    const wasEdit = !!st.form.edit;
    closeOv();
    st.q = ''; st.cat = ''; st.city = ''; st.type = ''; $('#q').value = ''; $('#city').value = ''; $('#type').value = '';
    renderChips();
    loadListings(true);
    toast(wasEdit ? 'Annonce modifiée' : 'Annonce publiée');
  } catch (e) {
    pubErr(api.friendlyError(e));
    btn.disabled = false; btn.textContent = st.form && st.form.edit ? 'Enregistrer les modifications' : 'Publier l’annonce';
  }
}

/* ---------- Connexion, inscription ---------- */
function needLogin(after) { st.after = after || null; showAuth('login'); }
function authErr(m) { const el = $('#a-err'); if (el) { el.textContent = m; el.hidden = false; } }
function showAuth(mode, msg) {
  const err = `<p class="err" id="a-err" role="alert"${mode === 'checkmail' ? ' hidden' : (msg ? '' : ' hidden')}>${mode === 'checkmail' ? '' : esc(msg || '')}</p>`;
  const emailField = '<label for="a-e">Email<input id="a-e" type="email" required autocomplete="email" inputmode="email" maxlength="120"></label>';
  let h = '';
  if (mode === 'login') {
    h = `<h2>Se connecter</h2>
    <div style="margin-top:14px"><button type="button" class="btn ghost block" data-a="google">Continuer avec Google</button></div>
    <div class="sep" style="margin-top:12px">ou avec votre email</div>
    <form class="f" data-f="login" style="margin-top:8px">${emailField}
     <label for="a-p">Mot de passe<input id="a-p" type="password" required autocomplete="current-password"></label>${err}
     <button class="btn" type="submit">Se connecter</button></form>
    <p class="note" style="margin-top:12px"><button type="button" class="linkbtn" data-a="forgot">Mot de passe oublié ?</button></p>
    <p class="note" style="margin-top:8px">Pas encore de compte ? <button type="button" class="linkbtn" data-a="signup">Créer un compte</button></p>`;
  } else if (mode === 'signup') {
    h = `<h2>Créer un compte</h2><p class="note" style="margin-top:6px">Pour publier des annonces et écrire aux vendeurs.</p>
    <div style="margin-top:14px"><button type="button" class="btn ghost block" data-a="google">Continuer avec Google</button></div>
    <div class="sep" style="margin-top:12px">ou avec votre email</div>
    <form class="f" data-f="signup" style="margin-top:8px">
     <label for="a-n">Nom complet<input id="a-n" required maxlength="60" autocomplete="name" placeholder="Ex. Aïcha Moukala"></label>
     <label for="a-c">Ville<select id="a-c">${CITIES.map(c => `<option>${c}</option>`).join('')}</select></label>${emailField}
     <label for="a-p">Mot de passe (8 caractères minimum)<input id="a-p" type="password" required minlength="8" autocomplete="new-password"></label>
     <label class="chk" for="a-t"><input id="a-t" type="checkbox" required><span>J’accepte les <button type="button" class="linkbtn" data-a="legal" data-k="cgu">conditions d’utilisation</button> et la <button type="button" class="linkbtn" data-a="legal" data-k="priv">politique de confidentialité</button>.</span></label>${err}
     <button class="btn" type="submit">Créer mon compte</button></form>
    <p class="note" style="margin-top:12px">Déjà inscrit ? <button type="button" class="linkbtn" data-a="login">Se connecter</button></p>`;
  } else if (mode === 'forgot') {
    h = `<h2>Mot de passe oublié</h2><p class="note" style="margin-top:6px">Entrez votre email, nous vous envoyons un lien pour choisir un nouveau mot de passe.</p>
    <form class="f" data-f="forgot">${emailField}${err}<button class="btn" type="submit">Envoyer le lien</button></form>
    <p class="note" style="margin-top:12px"><button type="button" class="linkbtn" data-a="login">Retour à la connexion</button></p>`;
  } else if (mode === 'checkmail') {
    h = `<h2>Vérifiez votre email</h2><p style="margin-top:10px">Nous avons envoyé un lien de confirmation à <b>${esc(msg)}</b>. Ouvrez-le, puis revenez vous connecter.</p><p class="note" style="margin-top:10px">Rien reçu ? Regardez dans les courriers indésirables.</p>
    <div class="btns"><button type="button" class="btn" data-a="login">Se connecter</button></div>`;
  } else if (mode === 'sentreset') {
    h = `<h2>Lien envoyé</h2><p style="margin-top:10px">Si un compte existe pour <b>${esc(msg)}</b>, un email vient de partir. Ouvrez le lien qu’il contient.</p><div class="btns"><button type="button" class="btn ghost" data-a="close">Fermer</button></div>`;
  } else if (mode === 'newpw') {
    h = `<h2>Nouveau mot de passe</h2><form class="f" data-f="newpw"><label for="a-p">Nouveau mot de passe (8 caractères minimum)<input id="a-p" type="password" required minlength="8" autocomplete="new-password"></label>${err}<button class="btn" type="submit">Enregistrer</button></form>`;
  }
  openOv(h, 'auth');
  addEyes();
}
// Petit œil pour afficher ou cacher le mot de passe
const EYE = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.9 17.9A10.9 10.9 0 0 1 12 19C5 19 1 12 1 12a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A10.9 10.9 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M1 1l22 22"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/></svg>';
function addEyes() {
  document.querySelectorAll('#ov-body input[type=password]').forEach(inp => {
    const box = document.createElement('span');
    box.className = 'pw';
    inp.parentNode.insertBefore(box, inp);
    box.appendChild(inp);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'eye';
    b.dataset.a = 'eye';
    b.setAttribute('aria-label', 'Afficher le mot de passe');
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = EYE;
    box.appendChild(b);
  });
}

// Appelé à chaque changement de connexion (ouverture du site, connexion, déconnexion)
async function applySession(session) {
  if (session && session.user) {
    const same = st.user && st.user.id === session.user.id;
    st.user = session.user;
    if (same) return;
    try { st.profile = await api.getProfile(session.user.id); } catch (e) { st.profile = null; }
    renderAcct();
    startRealtime();
    refreshUnread();
    if (st.ov === 'auth') closeOv();
    const a = st.after; st.after = null;
    if (a) await runAfter(a).catch(fail);
  } else if (st.user) {
    st.user = null; st.profile = null; st.unread = 0; st.mine = [];
    stopRealtime();
    renderAcct();
  }
}
// Ce qu'on faisait avant d'être obligé de se connecter
async function runAfter(a) {
  if (a.k === 'publish') showPublish();
  else if (a.k === 'contact') { const l = await getListing(a.id); if (l) await contact(l); }
}

/* ---------- Messagerie ---------- */
let unsub = null;
function startRealtime() { stopRealtime(); unsub = api.subscribeMessages(onNewMessage); }
function stopRealtime() { if (unsub) { unsub(); unsub = null; } }
async function refreshUnread() {
  if (!st.user) return;
  try { st.unread = await api.unreadCount(st.user.id); renderAcct(); } catch (e) { /* pas grave */ }
}
function onNewMessage(m) {
  if (!st.user || m.sender_id === st.user.id) return;
  if (st.ov === 'conv' && st.conv && st.conv.id === m.conversation_id) {
    if (!st.conv.messages.some(x => x.id === m.id)) { st.conv.messages.push(m); renderChat(); }
    api.markRead(m.conversation_id).then(refreshUnread).catch(() => {});
  } else {
    refreshUnread();
    toast('Nouveau message');
    if (st.ov === 'inbox') showInbox();
  }
}
function renderChat() {
  const box = $('#chat');
  if (!box || !st.conv) return;
  const me = st.user.id;
  box.innerHTML = st.conv.messages.length
    ? st.conv.messages.map(m => {
        const mine = m.sender_id === me;
        return `<div class="msg${mine ? '' : ' in'}"><span class="who">${mine ? 'Vous' : esc(shortName(st.conv.otherName))}</span>${esc(m.body)}<span class="when">${timeOf(m.created_at)}</span></div>`;
      }).join('')
    : '<p class="note">Écrivez votre premier message.</p>';
  box.scrollTop = box.scrollHeight;
}
async function showConversation(cid, meta) {
  const tok = openOv('<p class="loading">Chargement…</p>', 'conv');
  try {
    const messages = await api.fetchMessages(cid);
    if (tok !== st.ovTok) return;
    openOv(`<h2>${esc(shortName(meta.otherName))}</h2>
      <p class="note" style="margin-top:6px">À propos de : <button type="button" class="linkbtn" data-a="openlisting" data-id="${esc(meta.listingId)}">${esc(meta.title)}</button></p>
      <div class="panel"><div class="chat big" id="chat" aria-live="polite"></div>
      <form class="send" data-f="send"><input id="msg" type="text" required maxlength="1000" autocomplete="off" placeholder="Votre message" aria-label="Votre message"><button class="btn sm" type="submit">Envoyer</button></form>
      <p class="note" style="margin-top:8px">Ne payez jamais à l’avance. Rencontrez le vendeur dans un lieu public.</p></div>`, 'conv');
    st.conv = { id: cid, listingId: meta.listingId, title: meta.title, other: meta.other, otherName: meta.otherName, messages };
    renderChat();
    api.markRead(cid).then(refreshUnread).catch(() => {});
  } catch (e) { closeOv(); fail(e); }
}
async function contact(l) {
  if (!st.user) { needLogin({ k: 'contact', id: l.id }); return; }
  const cid = await api.openConversation(l.id, l.owner, st.user.id);
  await showConversation(cid, { listingId: l.id, title: l.t, other: l.owner, otherName: l.seller });
}
async function showInbox() {
  if (!st.user) { needLogin(null); return; }
  const tok = openOv('<h2>Messages</h2><p class="loading">Chargement…</p>', 'inbox');
  try {
    const convs = await api.listConversations(st.user.id);
    if (tok !== st.ovTok) return;
    st.convs = convs;
    st.unread = convs.reduce((n, c) => n + c.unread, 0);
    renderAcct();
    openOv('<h2>Messages</h2>' + (convs.length
      ? `<div class="list">${convs.map(c => `<div><span class="t">${esc(shortName(c.otherName))} · ${esc(c.title)}${c.unread ? `<span class="dot">${c.unread}</span>` : ''}</span><span class="note">${ago(c.last)}</span><span class="a"><button type="button" class="btn sm" data-a="openconv" data-id="${esc(c.id)}">Ouvrir</button></span></div>`).join('')}</div>`
      : '<div class="panel"><p class="note">Aucune conversation pour le moment. Ouvrez une annonce et touchez « Écrire au vendeur ».</p></div>'), 'inbox');
  } catch (e) { closeOv(); fail(e); }
}

/* ---------- Mon compte ---------- */
function helpHtml() {
  const feedback = st.user
    ? `<form class="f" data-f="feedback" style="margin-top:0"><div class="two"><label for="fb-t">Sujet<select id="fb-t"><option>Idée d’amélioration</option><option>Problème rencontré</option><option>Question</option><option>Autre</option></select></label><label for="fb-r">Satisfaction<select id="fb-r"><option value="5">5 sur 5</option><option value="4">4 sur 5</option><option value="3">3 sur 5</option><option value="2">2 sur 5</option><option value="1">1 sur 5</option></select></label></div><label for="fb-m">Votre message<textarea id="fb-m" required maxlength="600" placeholder="Dites-nous ce qui manque ou ce qui ne marche pas"></textarea></label><button class="btn sm" type="submit" style="justify-self:start">Envoyer mon avis</button></form>`
    : '<p class="note">Connectez-vous pour nous envoyer votre avis.</p><div class="btns"><button type="button" class="btn sm" data-a="login">Se connecter</button></div>';
  return `<div class="panel"><h3>Donner votre avis</h3>${feedback}</div>
  <div class="panel"><h3>Questions fréquentes</h3>
  <details><summary>Comment publier une annonce ?</summary><p>Connectez-vous, touchez « Déposer une annonce », ajoutez des photos, un titre, un prix et une description.</p></details>
  <details><summary>Comment contacter un vendeur ?</summary><p>Ouvrez l’annonce et touchez « Écrire au vendeur ». Vous devez être connecté. Vos conversations sont dans « Messages ».</p></details>
  <details><summary>Comment éviter les arnaques ?</summary><p>Rencontrez le vendeur dans un lieu public, vérifiez l’article avant de payer et ne versez jamais d’argent à l’avance. Signalez toute annonce suspecte.</p></details>
  <details><summary>Puis-je modifier ou supprimer mon annonce ?</summary><p>Oui, depuis « Mes annonces » ou depuis la fiche de l’annonce. Vous pouvez aussi la marquer comme vendue.</p></details>
  <details><summary>Comment supprimer mon compte ?</summary><p>Ouvrez votre compte, puis « Paramètres » et « Supprimer mon compte ». Vos données sont effacées.</p></details>
  <details><summary>Combien coûte Locachat ?</summary><p>Le service est gratuit pendant le lancement.</p></details></div>
  <div class="panel"><h3>Informations légales</h3><div class="btns" style="margin-top:0"><button type="button" class="btn ghost sm" data-a="legal" data-k="cgu">Conditions d’utilisation</button><button type="button" class="btn ghost sm" data-a="legal" data-k="priv">Confidentialité</button></div></div>`;
}
function settingsHtml() {
  const th = store.get('lc_theme', 'auto');
  const p = st.profile || { display_name: '', city: '' };
  return `<form class="f" data-f="settings"><label for="p-n">Nom complet<input id="p-n" required maxlength="60" value="${esc(p.display_name)}"></label>
  <label for="p-c">Ville<select id="p-c"><option value="">Non précisée</option>${CITIES.map(c => `<option${p.city === c ? ' selected' : ''}>${c}</option>`).join('')}</select></label>
  <div class="panel" style="margin-top:0"><h3>Apparence</h3><div class="opts" role="radiogroup" aria-label="Thème">${[['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']].map(x => `<label><input type="radio" name="theme" value="${x[0]}"${th === x[0] ? ' checked' : ''}> ${x[1]}</label>`).join('')}</div></div>
  <button class="btn" type="submit" style="justify-self:start">Enregistrer</button></form>
  <div class="panel dng"><h3>Supprimer mon compte</h3><p class="note">Votre compte, vos annonces, vos photos et vos messages seront effacés définitivement.</p>
  ${st.delAcc
    ? '<form class="f" data-f="delacc"><label for="d-c">Tapez SUPPRIMER pour confirmer<input id="d-c" autocomplete="off"></label><p class="err" id="d-err" role="alert" hidden></p><button class="btn danger sm" type="submit" style="justify-self:start">Supprimer définitivement</button></form>'
    : '<div class="btns"><button type="button" class="btn ghost sm" data-a="delacc">Supprimer mon compte</button></div>'}</div>`;
}
function mineHtml() {
  if (!st.mine.length) return '<div class="panel"><p class="note">Vous n’avez pas encore d’annonce.</p></div><div class="btns"><button type="button" class="btn" data-a="publish">Déposer une annonce</button></div>';
  return `<div class="list">${st.mine.map(i => `<div><span class="t">${esc(i.t)}${i.sold ? ' · Vendu' : ''}</span><span class="note">${fmt(i.price)} · ${esc(i.city)} · ${ago(i.ts)}</span><span class="a"><button type="button" class="btn ghost sm" data-a="open" data-id="${esc(i.id)}">Voir</button><button type="button" class="btn ghost sm" data-a="edit" data-id="${esc(i.id)}">Modifier</button><button type="button" class="btn ghost sm" data-a="sold" data-id="${esc(i.id)}">${i.sold ? 'Remettre en vente' : 'Vendu'}</button><button type="button" class="btn ${st.confirmDel === i.id ? 'danger' : 'ghost'} sm" data-a="del" data-id="${esc(i.id)}">${st.confirmDel === i.id ? 'Confirmer' : 'Supprimer'}</button></span></div>`).join('')}</div><div class="btns"><button type="button" class="btn" data-a="publish">Déposer une annonce</button></div>`;
}
async function showAccount(tab, fresh = true) {
  if (!st.user) { needLogin(null); return; }
  st.tab = tab || st.tab || 'mine';
  const name = (st.profile && st.profile.display_name) || 'Mon compte';
  const tabs = [['mine', 'Mes annonces'], ['settings', 'Paramètres'], ['help', 'Aide et avis']];
  const head = `<h2>${esc(name)}</h2><p class="note" style="margin-top:6px">${esc(st.user.email || '')}</p>
    <div class="tabs" role="group" aria-label="Sections du compte">${tabs.map(x => `<button type="button" data-a="tab" data-t="${x[0]}" aria-pressed="${st.tab === x[0]}">${x[1]}</button>`).join('')}</div>`;
  const out = '<div class="btns"><button type="button" class="btn ghost sm" data-a="logout">Se déconnecter</button></div>';
  if (st.tab === 'mine') {
    if (fresh) {
      const tok = openOv(head + '<p class="loading">Chargement…</p>', 'account');
      try { st.mine = await api.fetchMyListings(st.user.id); } catch (e) { closeOv(); fail(e); return; }
      if (tok !== st.ovTok) return;
    }
    openOv(head + mineHtml(), 'account');
  } else if (st.tab === 'settings') openOv(head + settingsHtml() + out, 'account');
  else openOv(head + helpHtml() + out, 'account');
}
function showLegal(k) {
  const cgu = k === 'cgu';
  openOv(`<h2>${cgu ? 'Conditions d’utilisation' : 'Confidentialité'}</h2><div class="panel safe"><p>Texte provisoire. À faire rédiger et valider par un juriste avant d’ouvrir le site au public.</p></div>
  <div class="panel"><p>Ce que le texte final devra couvrir :</p><ul style="margin:8px 0 0;padding-left:18px;color:var(--muted)">${(cgu
    ? ['Rôle de Locachat : mise en relation, sans être partie à la vente', 'Articles et services interdits', 'Responsabilité des utilisateurs et des annonces', 'Modération, suspension de compte et signalements', 'Gratuité du lancement et évolution des tarifs']
    : ['Données collectées : nom, email, ville, annonces, photos, messages', 'Finalités : compte, mise en relation, modération', 'Durée de conservation et suppression du compte', 'Droits d’accès, de rectification et de suppression', 'Prestataires utilisés : Supabase (hébergement), Google (connexion Google)']
  ).map(x => `<li>${x}</li>`).join('')}</ul></div><div class="btns"><button type="button" class="btn ghost sm" data-a="close">Fermer</button></div>`, 'legal');
}

/* ---------- Clics ---------- */
document.addEventListener('click', e => {
  const a = e.target.closest('[data-a]');
  if (!a) return;
  const act = a.dataset.a, id = a.dataset.id;
  const run = p => p.catch(fail);
  if (act === 'cat') { st.cat = a.dataset.c; renderChips(); loadListings(true); }
  else if (act === 'more') loadListings(false);
  else if (act === 'retry') loadListings(true);
  else if (act === 'open') { st.confirmDel = null; run(openListing(id)); }
  else if (act === 'openlisting') run(openListing(id));
  else if (act === 'close') closeOv();
  else if (act === 'publish') showPublish();
  else if (act === 'edit') run(getListing(id).then(l => { if (l) showPublish(l); }));
  else if (act === 'login') { st.after = null; showAuth('login'); }
  else if (act === 'signup') showAuth('signup');
  else if (act === 'forgot') showAuth('forgot');
  else if (act === 'google') run(api.signInGoogle());
  else if (act === 'logout') run(api.signOut().then(() => applySession(null)).then(() => { closeOv(); toast('Vous êtes déconnecté.'); }));
  else if (act === 'inbox') run(showInbox());
  else if (act === 'openconv') { const c = st.convs.find(x => x.id === id); if (c) run(showConversation(c.id, { listingId: c.listingId, title: c.title, other: c.other, otherName: c.otherName })); }
  else if (act === 'contact') run(contact(st.listing));
  else if (act === 'account') { st.delAcc = false; run(showAccount('mine')); }
  else if (act === 'tab') { st.delAcc = false; run(showAccount(a.dataset.t)); }
  else if (act === 'help') openOv('<h2>Aide et avis</h2>' + helpHtml(), 'help');
  else if (act === 'legal') showLegal(a.dataset.k);
  else if (act === 'img') { st.imgIdx = Number(a.dataset.i); showListing(st.listing, true); }
  else if (act === 'eye') {
    const inp = a.parentNode.querySelector('input');
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    a.innerHTML = show ? EYE_OFF : EYE;
    a.setAttribute('aria-pressed', String(show));
    a.setAttribute('aria-label', show ? 'Cacher le mot de passe' : 'Afficher le mot de passe');
  }
  else if (act === 'gprev' || act === 'gnext') slide(act === 'gnext' ? 1 : -1);
  else if (act === 'copylink') {
    const url = shareUrl(st.listing);
    const done = () => toast('Lien copié');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => toast(url));
    else toast(url);
  }
  else if (act === 'rmphoto') {
    const p = st.form.photos.splice(Number(a.dataset.i), 1)[0];
    if (p && p.id) st.form.removed.push(p);
    renderPhotoThumbs();
  }
  else if (act === 'sold') run(toggleSold(id));
  else if (act === 'del') run(removeListing(id));
  else if (act === 'delacc') { st.delAcc = true; run(showAccount('settings', false)); }
});
// Photos suivante / précédente (flèches, clavier, glissement du doigt)
function slide(dir) {
  if (!st.listing || st.ov !== 'listing') return;
  const n = st.listing.imgs.length;
  if (n < 2) return;
  st.imgIdx = (st.imgIdx + dir + n) % n;
  showListing(st.listing, true);
}
let touchX = null;
document.addEventListener('touchstart', e => { touchX = e.target.closest && e.target.closest('#gal') ? e.touches[0].clientX : null; }, { passive: true });
document.addEventListener('touchend', e => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) > 40) slide(dx < 0 ? 1 : -1);
}, { passive: true });
$('#ov').addEventListener('click', e => { if (e.target === $('#ov')) closeOv(); });
document.addEventListener('keydown', e => {
  if ($('#ov').hidden) return;
  if (e.key === 'Escape') closeOv();
  else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) slide(e.key === 'ArrowRight' ? 1 : -1);
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'f-img') { addFormPhotos(t.files); t.value = ''; }
  else if (t.id === 'f-ty') { const bx = $('#rent-box'); if (bx) bx.hidden = t.value !== 'location'; }
  else if (t.name === 'theme') { applyTheme(t.value); store.set('lc_theme', t.value); }
});

/* ---------- Formulaires ---------- */
document.addEventListener('submit', e => {
  const name = e.target.dataset && e.target.dataset.f;
  if (!name) return;
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('[type=submit]');
  const go = async fn => {
    if (btn) btn.disabled = true;
    try { await fn(); } catch (err) { if (name === 'login' || name === 'signup' || name === 'forgot' || name === 'newpw') authErr(api.friendlyError(err)); else fail(err); }
    if (btn && btn.isConnected) btn.disabled = false;
  };
  if (name === 'login') go(() => api.signIn($('#a-e').value.trim(), $('#a-p').value));
  else if (name === 'signup') go(async () => {
    const email = $('#a-e').value.trim();
    const session = await api.signUp($('#a-n').value.trim(), $('#a-c').value, email, $('#a-p').value);
    if (!session) showAuth('checkmail', email);
  });
  else if (name === 'forgot') go(async () => { const email = $('#a-e').value.trim(); await api.sendReset(email); showAuth('sentreset', email); });
  else if (name === 'newpw') go(async () => { await api.setPassword($('#a-p').value); closeOv(); toast('Mot de passe modifié.'); });
  else if (name === 'pub') submitListing(form);
  else if (name === 'send') go(async () => {
    const input = $('#msg'), body = input.value.trim();
    if (!body || !st.conv) return;
    const m = await api.sendMessage(st.conv.id, st.user.id, body);
    input.value = '';
    if (st.conv && !st.conv.messages.some(x => x.id === m.id)) st.conv.messages.push(m);
    renderChat();
  });
  else if (name === 'report') go(async () => {
    if (!st.user) { needLogin(null); return; }
    await api.sendReport(st.listing.id, st.user.id, $('#rp-r').value);
    toast('Annonce signalée. Merci');
  });
  else if (name === 'feedback') go(async () => {
    await api.sendFeedback(st.user.id, $('#fb-t').value, Number($('#fb-r').value), $('#fb-m').value.trim());
    $('#fb-m').value = '';
    toast('Merci pour votre avis');
  });
  else if (name === 'settings') go(async () => {
    const display_name = $('#p-n').value.trim() || (st.profile && st.profile.display_name) || 'Utilisateur';
    const city = $('#p-c').value || null;
    await api.saveProfile(st.user.id, { display_name, city });
    st.profile = Object.assign({}, st.profile, { display_name, city });
    renderAcct(); loadListings(true);
    toast('Paramètres enregistrés');
  });
  else if (name === 'delacc') go(async () => {
    if ($('#d-c').value.trim().toUpperCase() !== 'SUPPRIMER') { const el = $('#d-err'); el.textContent = 'Tapez le mot SUPPRIMER pour confirmer.'; el.hidden = false; return; }
    await api.deleteAccount(st.user.id);
    await applySession(null);
    closeOv(); loadListings(true);
    toast('Votre compte a été supprimé.');
  });
});

/* ---------- Recherche et filtres ---------- */
let searchTimer = null;
$('#q').addEventListener('input', e => { st.q = e.target.value; clearTimeout(searchTimer); searchTimer = setTimeout(() => loadListings(true), 350); });
$('#city').addEventListener('change', e => { st.city = e.target.value; loadListings(true); });
$('#type').addEventListener('change', e => { st.type = e.target.value; loadListings(true); });
$('#sort').addEventListener('change', e => { st.sort = e.target.value; loadListings(true); });

/* ---------- Démarrage ---------- */
CITIES.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; $('#city').appendChild(o); });
renderAcct();
renderChips();
loadListings(true);
// Lien direct vers une annonce : ...?a=identifiant
const deepId = new URLSearchParams(location.search).get('a');
if (deepId && /^[0-9a-f-]{36}$/i.test(deepId)) openListing(deepId).catch(fail);

api.onAuth((event, session) => {
  // On attend un instant : Supabase demande de ne pas appeler la base directement dans cette fonction
  setTimeout(async () => {
    await applySession(session);
    if (event === 'PASSWORD_RECOVERY') showAuth('newpw');
  }, 0);
});

// Sur téléphone, la connexion en direct peut s'endormir : on vérifie les messages au retour sur la page
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !st.user) return;
  refreshUnread();
  if (st.ov === 'conv' && st.conv) {
    api.fetchMessages(st.conv.id).then(msgs => { if (st.conv) { st.conv.messages = msgs; renderChat(); } }).catch(() => {});
  }
});
setInterval(() => { if (!document.hidden) refreshUnread(); }, 60000);