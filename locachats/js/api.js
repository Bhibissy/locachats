// Tout ce qui parle à Supabase est ici. Le reste du site (app.js) ne touche jamais à la base directement.
import { supabase } from './supabaseClient.js';

export const PAGE_SIZE = 20;
const BUCKET = 'listing-photos';

// Si Supabase renvoie une erreur, on la transforme en exception
function must(res) {
  if (res.error) throw res.error;
  return res.data;
}

// Transforme une erreur technique en phrase simple en français
export function friendlyError(e) {
  console.error(e);
  const m = String((e && e.message) || e || '').toLowerCase();
  const c = e && e.code;
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed') || m.includes('network request failed'))
    return 'Connexion impossible. Vérifiez votre réseau et réessayez.';
  if (m.includes('invalid login')) return 'Email ou mot de passe incorrect.';
  if (m.includes('already registered') || m === 'already') return 'Cet email a déjà un compte. Connectez-vous.';
  if (m.includes('email not confirmed')) return 'Confirmez votre email avant de vous connecter (regardez vos messages).';
  if (m.includes('not authorized') && m.includes('email')) return 'Cet email ne peut pas recevoir de message pour le moment.';
  if (m.includes('rate limit') || c === 'over_email_send_rate_limit' || c === 'over_request_rate_limit') return 'Trop de tentatives. Réessayez dans quelques minutes.';
  if (m.includes('password should') || m.includes('weak password')) return 'Mot de passe trop faible (8 caractères minimum).';
  if (m.includes('row-level security') || c === '42501') return 'Action non autorisée (30 annonces maximum, 4 photos maximum par annonce).';
  if (m.includes('payload too large') || m.includes('exceeded the maximum')) return 'Fichier trop lourd.';
  return 'Une erreur est survenue. Réessayez dans un instant.';
}

/* ---------- Connexion ---------- */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
export function onAuth(callback) {
  return supabase.auth.onAuthStateChange(callback);
}
export async function signUp(name, city, email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: name, city }, emailRedirectTo: location.origin + location.pathname }
  });
  if (error) throw error;
  // Quand l'email existe déjà, Supabase ne renvoie pas d'erreur mais une liste d'identités vide
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error('already');
  return data.session; // null = il faut d'abord confirmer l'email
}
export async function signIn(email, password) {
  must(await supabase.auth.signInWithPassword({ email, password }));
}
export async function signInGoogle() {
  must(await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } }));
}
export async function signOut() {
  await supabase.auth.signOut({ scope: 'local' });
}
export async function sendReset(email) {
  must(await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }));
}
export async function setPassword(password) {
  must(await supabase.auth.updateUser({ password }));
}

/* ---------- Profils ---------- */
export async function getProfile(id) {
  return must(await supabase.from('profiles').select('id,display_name,city').eq('id', id).maybeSingle());
}
export async function saveProfile(id, fields) {
  must(await supabase.from('profiles').update({ display_name: fields.display_name, city: fields.city }).eq('id', id));
}
async function getNames(ids) {
  if (!ids.length) return {};
  const rows = must(await supabase.from('profiles').select('id,display_name').in('id', ids));
  const names = {};
  rows.forEach(r => { names[r.id] = r.display_name; });
  return names;
}

/* ---------- Photos ---------- */
const thumbPathOf = path => path.replace(/\.jpg$/, '-t.jpg');
const publicUrl = path => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
const newName = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

async function removeFiles(paths) {
  const all = [];
  paths.forEach(p => { all.push(p, thumbPathOf(p)); });
  if (all.length) await supabase.storage.from(BUCKET).remove(all); // si ça échoue, ce n'est pas grave
}

// Envoie les photos d'une annonce. Si une photo échoue, on retire celles déjà envoyées.
async function addPhotos(uid, listingId, photos, startPosition) {
  const done = [];
  try {
    for (let i = 0; i < photos.length; i++) {
      const base = `${uid}/${listingId}/${newName()}`;
      const path = base + '.jpg';
      const thumb = base + '-t.jpg';
      const opts = { contentType: 'image/jpeg', cacheControl: '31536000' };
      let r = await supabase.storage.from(BUCKET).upload(path, photos[i].main, opts);
      if (r.error) throw r.error;
      done.push(path);
      r = await supabase.storage.from(BUCKET).upload(thumb, photos[i].thumb, opts);
      if (r.error) throw r.error;
      r = await supabase.from('listing_photos').insert({ listing_id: listingId, path, position: startPosition + i });
      if (r.error) throw r.error;
    }
  } catch (e) {
    await removeFiles(done);
    throw e;
  }
}

/* ---------- Annonces ---------- */
const LIST_COLS = 'id,owner_id,title,description,category,type,city,price,sold,created_at,profiles(display_name),listing_photos(id,path,position),rent_unit,available_from,available_to,hours,min_duration,deposit,delivery';

// Les infos de location (facultatives). Pour une vente, on les vide.
function rentFields(f) {
  const r = f.type === 'location' && f.rent ? f.rent : {};
  return {
    rent_unit: f.type === 'location' ? (r.unit || 'jour') : null,
    available_from: r.from || null,
    available_to: r.to || null,
    hours: r.hours || null,
    min_duration: r.min || null,
    deposit: r.deposit == null ? null : r.deposit,
    delivery: !!r.delivery
  };
}

// Transforme une ligne de la base en objet simple pour le site
function shape(r) {
  const photos = (r.listing_photos || []).slice().sort((a, b) => a.position - b.position)
    .map(p => ({ id: p.id, path: p.path, position: p.position, url: publicUrl(p.path), thumb: publicUrl(thumbPathOf(p.path)) }));
  return {
    id: r.id,
    owner: r.owner_id,
    seller: (r.profiles && r.profiles.display_name) || 'Vendeur',
    t: r.title,
    desc: r.description,
    cat: r.category,
    type: r.type,
    city: r.city,
    price: Number(r.price),
    sold: r.sold,
    ts: new Date(r.created_at).getTime(),
    rent: r.type === 'location' ? { unit: r.rent_unit || 'jour', from: r.available_from, to: r.available_to, hours: r.hours, min: r.min_duration, deposit: r.deposit == null ? null : Number(r.deposit), delivery: !!r.delivery } : null,
    photos,
    imgs: photos.map(p => p.url),
    thumbs: photos.map(p => p.thumb)
  };
}

export async function fetchListings({ q, city, cat, type, sort, page }) {
  let query = supabase.from('listings').select(LIST_COLS, { count: 'exact' });
  if (cat) query = query.eq('category', cat);
  if (city) query = query.eq('city', city);
  if (type) query = query.eq('type', type);
  const words = (q || '').replace(/[,()%*\\"]/g, ' ').trim();
  if (words) query = query.or(`title.ilike.%${words}%,description.ilike.%${words}%`);
  query = query.order('sold', { ascending: true }); // les annonces vendues en dernier
  if (sort === 'asc') query = query.order('price', { ascending: true });
  else if (sort === 'desc') query = query.order('price', { ascending: false });
  else query = query.order('created_at', { ascending: false });
  const from = page * PAGE_SIZE;
  const res = await query.range(from, from + PAGE_SIZE - 1);
  if (res.error) throw res.error;
  return { rows: res.data.map(shape), total: res.count || 0 };
}

export async function fetchMyListings(uid) {
  const rows = must(await supabase.from('listings').select(LIST_COLS).eq('owner_id', uid).order('created_at', { ascending: false }));
  return rows.map(shape);
}

export async function fetchListing(id) {
  const row = must(await supabase.from('listings').select(LIST_COLS).eq('id', id).maybeSingle());
  return row ? shape(row) : null;
}

export async function createListing(uid, f, newPhotos) {
  const row = must(await supabase.from('listings').insert({
    owner_id: uid, title: f.t, description: f.desc, category: f.cat, type: f.type, city: f.city, price: f.price, ...rentFields(f)
  }).select('id').single());
  try {
    await addPhotos(uid, row.id, newPhotos, 0);
  } catch (e) {
    await supabase.from('listings').delete().eq('id', row.id);
    throw e;
  }
  return row.id;
}

export async function updateListing(uid, id, f, removedPhotos, newPhotos, startPosition) {
  must(await supabase.from('listings').update({
    title: f.t, description: f.desc, category: f.cat, type: f.type, city: f.city, price: f.price, ...rentFields(f)
  }).eq('id', id));
  if (removedPhotos.length) {
    must(await supabase.from('listing_photos').delete().in('id', removedPhotos.map(p => p.id)));
    await removeFiles(removedPhotos.map(p => p.path));
  }
  if (newPhotos.length) await addPhotos(uid, id, newPhotos, startPosition);
}

export async function setSold(id, sold) {
  must(await supabase.from('listings').update({ sold }).eq('id', id));
}

export async function deleteListing(id, photos) {
  must(await supabase.from('listings').delete().eq('id', id));
  await removeFiles(photos.map(p => p.path));
}

/* ---------- Messagerie ---------- */
export async function openConversation(listingId, sellerId, buyerId) {
  const find = async () => must(await supabase.from('conversations').select('id').eq('listing_id', listingId).eq('buyer_id', buyerId).maybeSingle());
  const existing = await find();
  if (existing) return existing.id;
  const res = await supabase.from('conversations').insert({ listing_id: listingId, buyer_id: buyerId, seller_id: sellerId }).select('id').single();
  if (res.error) {
    if (res.error.code === '23505') { const again = await find(); if (again) return again.id; }
    throw res.error;
  }
  return res.data.id;
}

export async function listConversations(uid) {
  const rows = must(await supabase.from('conversations')
    .select('id,listing_id,buyer_id,seller_id,last_message_at,listings(title)')
    .order('last_message_at', { ascending: false }).limit(50));
  const unread = must(await supabase.from('messages').select('conversation_id').is('read_at', null).neq('sender_id', uid));
  const counts = {};
  unread.forEach(m => { counts[m.conversation_id] = (counts[m.conversation_id] || 0) + 1; });
  const others = rows.map(r => (r.buyer_id === uid ? r.seller_id : r.buyer_id));
  const names = await getNames([...new Set(others)]);
  return rows.map((r, i) => ({
    id: r.id,
    listingId: r.listing_id,
    title: r.listings ? r.listings.title : 'Annonce supprimée',
    other: others[i],
    otherName: names[others[i]] || 'Utilisateur',
    unread: counts[r.id] || 0,
    last: new Date(r.last_message_at).getTime()
  }));
}

export async function unreadCount(uid) {
  const res = await supabase.from('messages').select('id', { count: 'exact', head: true }).is('read_at', null).neq('sender_id', uid);
  if (res.error) throw res.error;
  return res.count || 0;
}

export async function fetchMessages(conversationId) {
  const rows = must(await supabase.from('messages').select('id,sender_id,body,created_at')
    .eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(100));
  return rows.reverse();
}

export async function sendMessage(conversationId, uid, body) {
  return must(await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: uid, body })
    .select('id,sender_id,body,created_at').single());
}

export async function markRead(conversationId) {
  must(await supabase.rpc('mark_conversation_read', { conv: conversationId }));
}

// Écoute les nouveaux messages en direct. Renvoie une fonction pour arrêter l'écoute.
export function subscribeMessages(onInsert) {
  const channel = supabase.channel('messages-' + newName())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => onInsert(payload.new))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

/* ---------- Signalements, avis, compte ---------- */
export async function sendReport(listingId, uid, reason) {
  must(await supabase.from('reports').insert({ listing_id: listingId, reporter_id: uid, reason }));
}
export async function sendFeedback(uid, subject, rating, message) {
  must(await supabase.from('feedback').insert({ user_id: uid, subject, rating, message }));
}
export async function deleteAccount(uid) {
  const mine = await fetchMyListings(uid);
  const paths = [];
  mine.forEach(l => l.photos.forEach(p => paths.push(p.path)));
  await removeFiles(paths);
  must(await supabase.rpc('delete_my_account'));
  await supabase.auth.signOut({ scope: 'local' });
}