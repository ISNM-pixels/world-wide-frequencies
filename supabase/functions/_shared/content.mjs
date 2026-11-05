export const ADMIN_EMAIL = 'imagesoundandmedia@tutamail.com';
export const IMAGE_LIMIT = 500 * 1024;
export const AUDIO_LIMIT = 2 * 1024 * 1024;
export const STORAGE_LIMIT = 50 * 1024 * 1024;
export const MEDIA_PATH = /^media\/[a-f0-9]{64}\.(webp|mp3)$/;
export function validateContent(content, { publishing = false } = {}) {
  const fail = message => { throw new Error(message); };
  if (!content || typeof content !== 'object' || !content.site || !Array.isArray(content.artists) || !Array.isArray(content.albums)) fail('El contenido no tiene un formato válido.');
  if (JSON.stringify(content).length > 1024 * 1024) fail('El catálogo supera el límite de 1 MB.');
  if (content.artists.length > 200 || content.albums.length > 500) fail('El catálogo supera los límites de esta versión.');
  const text = (v, label, max, required = true) => {
    if (typeof v !== 'string' || v.length > max || (required && !v.trim())) fail(`Revisa ${label}.`);
  };
  const links = list => {
    if (!Array.isArray(list) || list.length > 30) fail('La lista de enlaces no es válida.');
    for (const l of list) {
      text(l.label, 'el nombre del enlace', 80);
      try { if (!['http:', 'https:'].includes(new URL(l.url).protocol)) fail('Usa enlaces HTTP o HTTPS.'); }
      catch { fail('El enlace no es válido.'); }
    }
  };
  const media = (v, optional) => {
    if (!v && optional) return;
    if (typeof v !== 'string' || !(MEDIA_PATH.test(v) || /^assets\/images\/[a-z0-9-]+\.(svg|png|jpg|webp)$/.test(v))) fail('Selecciona un archivo válido de la biblioteca.');
  };
  const ids = (items, label) => {
    const set = new Set();
    for (const item of items) { if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id) || set.has(item.id)) fail(`El identificador de ${label} debe ser único y contener letras minúsculas, números y guiones.`); set.add(item.id); }
    return set;
  };
  const artists = ids(content.artists, 'artista'); ids(content.albums, 'lanzamiento');
  text(content.site.brand, 'la marca', 100); text(content.site.tagline, 'el lema', 300, false);
  if (content.site.url !== 'https://world-wide-frequencies.vercel.app') fail('La dirección de producción no puede cambiarse desde el panel.');
  for (const key of ['email','supportEmail']) { const email=content.site.contact?.[key]; if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Revisa los emails de contacto.'); }
  links(content.site.socials || []); links(content.site.legal || []);
  for (const a of content.artists) {
    text(a.name, 'el nombre del artista', 150); text(a.genre || '', 'el género', 150, false); text(a.description || '', 'la biografía', 12000, false);
    media(a.image, true); links(a.links || []);
  }
  for (const a of content.albums) {
    text(a.title, 'el título del lanzamiento', 200); text(a.artist, 'el crédito artístico', 200);
    if (!['album','single','ep'].includes(a.type)) fail('Selecciona álbum, single o EP.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.releaseDate) || !Number.isFinite(Date.parse(a.releaseDate))) fail('Indica una fecha válida.');
    media(a.cover, !publishing); links(a.platforms || []);
    if (!Array.isArray(a.artistIds) || a.artistIds.some(id=>!artists.has(id))) fail('Uno de los artistas asociados ya no existe.');
    if (!Array.isArray(a.tracks) || a.tracks.length > 100 || (publishing && !a.tracks.length)) fail('Añade al menos una pista antes de publicar.');
    ids(a.tracks, 'pista');
    for (const t of a.tracks) {
      text(t.title, 'el título de la pista', 200);
      if (typeof t.duration !== 'string' || (t.duration !== '' && !/^\d{1,3}:[0-5]\d$/.test(t.duration))) fail('Usa una duración como 4:23 o deja el campo pendiente.');
      if (t.previewUrl && !MEDIA_PATH.test(t.previewUrl)) fail('Selecciona un fragmento de la biblioteca.');
    }
  }
  if (content.site.featuredReleaseId && !content.albums.some(a=>a.id===content.site.featuredReleaseId)) fail('El lanzamiento destacado ya no existe.');
  return content;
}
export function referencedMedia(content) {
  const paths = new Set();
  for (const a of content.artists || []) if (MEDIA_PATH.test(a.image)) paths.add(a.image);
  for (const a of content.albums || []) {
    if (MEDIA_PATH.test(a.cover)) paths.add(a.cover);
    for (const t of a.tracks || []) if (MEDIA_PATH.test(t.previewUrl)) paths.add(t.previewUrl);
  }
  return [...paths];
}
