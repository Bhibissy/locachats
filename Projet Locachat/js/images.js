// Prépare une photo avant l'envoi : vérifie le fichier, puis la réduit.
// On crée 2 versions : une grande (900 px) pour la fiche, une petite (360 px) pour la liste.
// Résultat : environ 100 Ko + 20 Ko par photo, même si la photo d'origine fait 5 Mo.

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_ORIGINAL = 15 * 1024 * 1024; // 15 Mo
const MAX_FINAL = 900 * 1024; // le serveur refuse au-delà de 1 Mo

async function decode(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* on essaie l'autre méthode */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Cette image est illisible.')); };
    img.src = url;
  });
}

function toBlob(source, w, h, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Cette image est illisible.'))), 'image/jpeg', quality);
  });
}

export async function prepareImage(file) {
  if (!TYPES.includes(file.type)) throw new Error('Format non accepté. Utilisez une photo JPEG, PNG ou WebP.');
  if (file.size > MAX_ORIGINAL) throw new Error('Photo trop lourde (15 Mo maximum).');
  const img = await decode(file);
  const w = img.width || img.naturalWidth;
  const h = img.height || img.naturalHeight;
  let main = await toBlob(img, w, h, 900, 0.72);
  if (main.size > MAX_FINAL) main = await toBlob(img, w, h, 700, 0.6);
  if (main.size > MAX_FINAL) throw new Error('Photo trop lourde, même réduite. Essayez-en une autre.');
  const thumb = await toBlob(img, w, h, 360, 0.65);
  return { main, thumb, preview: URL.createObjectURL(thumb) };
}