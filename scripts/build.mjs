import { readFile, writeFile, mkdir, cp, rm, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { loadPublishedContent } from './load-content.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const { content: data, revision } = await loadPublishedContent(root);
const { site, artists, albums } = data;
const base = new URL(site.url);
if (base.protocol !== 'https:') throw new Error('site.url must use HTTPS');
const escape = (v = '') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const local = value => `/${String(value).replace(/^\/+/, '')}`;
const external = value => { try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; } };
const validLinks = links => (links || []).filter(l => l.label && external(l.url));
const image = (src, alt, extra = '') => `<img src="${escape(local(src))}" alt="${escape(alt)}" width="800" height="800" ${extra}>`;
const arrow = '<span aria-hidden="true">↗</span>';
const releasePath = a => `/releases/${a.id}`;
const artistPath = a => `/artists/${a.id}`;
const sorted = [...albums].sort((a,b) => b.releaseDate.localeCompare(a.releaseDate));
const featured = albums.find(a => a.id === site.featuredReleaseId) || sorted[0];
const date = value => new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'long', year:'numeric', timeZone:'UTC' }).format(new Date(`${value}T00:00:00Z`));
const icon = `<svg class="brand-mark" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 18h3m3-7v14m4-18v22m4-18v14m3-7h3" stroke="currentColor" stroke-width="2"/></svg>`;

for (const [name, items] of [['artists',artists], ['albums',albums]]) {
  const ids = new Set();
  for (const item of items) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id) || ids.has(item.id)) throw new Error(`Invalid or duplicate ${name} id: ${item.id}`);
    ids.add(item.id);
  }
}
for (const a of artists) {
  a.profileUrl = artistPath(a);
  if (a.image) if (!a.image.startsWith('assets/uploads/')) await access(path.join(root, a.image));
}
for (const album of albums) {
  if (!album.cover.startsWith('assets/uploads/')) await access(path.join(root, album.cover));
  if (!['album','single','ep'].includes(album.type)) throw new Error(`Invalid release type: ${album.id}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(album.releaseDate) || Number.isNaN(Date.parse(album.releaseDate))) throw new Error(`Invalid release date: ${album.id}`);
  for (const id of album.artistIds || []) if (!artists.some(a => a.id === id)) throw new Error(`Unknown artist: ${id}`);
  const trackIds = new Set();
  for (const track of album.tracks) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(track.id) || trackIds.has(track.id)) throw new Error(`Invalid track id in ${album.id}`);
    trackIds.add(track.id);
    if (track.previewUrl) {
      if (!external(track.previewUrl)) {
        if (!/^\/?assets\/(audio|uploads)\/[a-zA-Z0-9_./-]+\.(mp3|m4a|ogg|wav)$/i.test(track.previewUrl) || track.previewUrl.includes('..')) throw new Error(`Invalid preview path: ${track.previewUrl}`);
        if (!track.previewUrl.startsWith('assets/uploads/')) await access(path.join(root, track.previewUrl.replace(/^\//,'')));
      }
    }
  }
}

const brand = () => `<a class="brand" href="/" aria-label="World Wide Frequencies home">${icon}<span>WORLD WIDE<br><strong>FREQUENCIES</strong></span></a>`;
const navItems = [['Releases','/releases'],['Artists','/artists'],['About','/about'],['Contact','/contact'],['Demo Drop','/demos']];
const nav = active => `<a class="skip-link" href="#main">Skip to content</a><header class="site-header"><div class="nav-inner">${brand()}<button class="menu-toggle" aria-controls="site-menu" aria-expanded="false" aria-label="Open navigation" type="button"><span></span><span></span><span></span></button><nav id="site-menu" aria-label="Main navigation">${navItems.map(([label,url])=>`<a href="${url}" ${active===label?'aria-current="page"':''} class="${label==='Demo Drop'?'nav-demo':''}">${label}</a>`).join('')}</nav></div></header>`;
const footer = () => `<footer class="site-footer"><div class="container footer-main"><div>${brand()}<p>${escape(site.tagline)}</p></div><div class="footer-nav"><span class="eyebrow">Explore</span>${navItems.map(([label,url])=>`<a href="${url}">${label}</a>`).join('')}</div>${validLinks(site.socials).length?`<div class="footer-nav"><span class="eyebrow">Follow</span>${validLinks(site.socials).map(l=>`<a href="${escape(l.url)}" target="_blank" rel="noopener noreferrer">${escape(l.label)} ${arrow}</a>`).join('')}</div>`:''}</div><div class="container footer-bottom"><small>© ${new Date().getFullYear()} World Wide Frequencies</small><span>Independent sounds. Worldwide.</span>${validLinks(site.legal).map(l=>`<a href="${escape(l.url)}">${escape(l.label)}</a>`).join('')}</div></footer>`;
const strip = (title, link='', label='View all') => `<div class="section-bar"><h2>${title}</h2>${link?`<a href="${link}">${label}<span aria-hidden="true">→</span></a>`:''}</div>`;
const card = a => `<article class="release-card" data-release-card data-type="${escape(a.type)}" data-search="${escape(`${a.title} ${a.artist}`.toLowerCase())}"><a class="cover-link" href="${releasePath(a)}" aria-label="View ${escape(a.title)} by ${escape(a.artist)}">${image(a.cover,a.coverAlt,'loading="lazy"')}<span class="cover-action">View release ${arrow}</span></a><div class="card-meta"><h3><a href="${releasePath(a)}">${escape(a.title)}</a></h3><span class="format-tag">${escape(a.label || a.type)}</span></div><p class="card-artist">${escape(a.artist)}</p><p class="card-date">${escape(date(a.releaseDate))}</p></article>`;
const initials = a => a.name.split(/[\s-]+/).map(s=>s[0]).slice(0,2).join('');
const portrait = a => a.image ? image(a.image,a.imageAlt||a.name,'loading="lazy"') : `<div class="portrait-placeholder" aria-label="Artist photograph coming soon"><span>${escape(initials(a))}</span><small>World Wide Frequencies</small></div>`;
const artistCard = a => `<article class="artist-card"><a href="${artistPath(a)}"><div class="portrait">${portrait(a)}<span class="portrait-arrow" aria-hidden="true">↗</span></div><h3>${escape(a.name)}</h3><p>${escape(a.genre)}</p></a></article>`;
const demoBanner = () => `<section class="demo-banner"><div class="container"><div><span class="eyebrow">For the artists</span><h2>Your sound.<br>Our next discovery.</h2><p>Introduce your music to World Wide Frequencies.</p></div><a class="button button-light" href="/demos">Send us your demo ${arrow}</a></div></section>`;
const artistCredit = album => (album.artistIds || []).length ? album.artistIds.map(id => {const a=artists.find(a=>a.id===id);return `<a href="${artistPath(a)}">${escape(a.name)}</a>`;}).join(', ') : escape(album.artist);
const platformButtons = links => validLinks(links).map(l=>`<a class="platform-button" href="${escape(l.url)}" target="_blank" rel="noopener noreferrer">${escape(l.label)} ${arrow}</a>`).join('');
const tracks = a => `<ol class="tracklist">${a.tracks.map((t,i)=>`<li><span class="track-number">${String(i+1).padStart(2,'0')}</span><div class="track-name"><strong>${escape(t.title)}</strong><span>${escape(a.artist)}</span></div><span class="full-duration"><span class="sr-only">${t.duration?'Full track duration: ':'Track duration coming soon'}</span>${t.duration?escape(t.duration):'—'}</span>${t.previewUrl?`<button class="preview-button" type="button" data-preview="${escape(`${a.id}/${t.id}`)}" aria-label="Play preview of ${escape(t.title)}"><span aria-hidden="true">▶</span> Preview</button>`:'<span class="preview-pending">Preview coming soon</span>'}</li>`).join('')}</ol>`;

const queue = albums.flatMap(a=>a.tracks.filter(t=>t.previewUrl).map(t=>({key:`${a.id}/${t.id}`,title:t.title,artist:a.artist,cover:local(a.cover),src:external(t.previewUrl)?t.previewUrl:local(t.previewUrl)})));
const player = () => `<aside class="audio-player" aria-label="Music preview player" hidden><div class="container player-inner"><img class="player-cover" src="/assets/favicon.svg" alt="" width="48" height="48"><div class="player-info"><strong data-now-title></strong><span data-now-artist></span><small>Track preview</small></div><div class="player-controls"><button type="button" data-previous aria-label="Previous preview">⏮</button><button type="button" class="player-play" data-play aria-label="Play preview">▶</button><button type="button" data-next aria-label="Next preview">⏭</button></div><div class="player-timeline"><span data-elapsed>0:00</span><input type="range" min="0" max="0" value="0" step="0.1" data-seek aria-label="Preview position" disabled><span data-duration>0:00</span></div><label class="player-volume"><span class="sr-only">Volume</span><span aria-hidden="true">Vol</span><input type="range" min="0" max="1" step="0.05" value="0.8" data-volume></label><button type="button" data-close-player aria-label="Close preview player">×</button><p class="player-message" role="status" data-player-message></p></div><audio preload="none"></audio></aside><script id="preview-data" type="application/json">${JSON.stringify(queue).replaceAll('<','\\u003c')}</script>`;

const pages = [];
async function page(route, title, description, active, body, {ogImage='assets/images/social-card.png',noindex=false}={}) {
  const canonical = new URL(route,base).href;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${canonical}">${noindex?'<meta name="robots" content="noindex">':''}<meta property="og:type" content="website"><meta property="og:site_name" content="World Wide Frequencies"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${new URL(local(ogImage),base).href}"><meta name="twitter:card" content="summary_large_image"><link rel="icon" type="image/svg+xml" href="/assets/favicon.svg"><link rel="stylesheet" href="/styles.css"><script src="/script.js" defer></script></head><body>${nav(active)}<main id="main">${body}</main>${footer()}${player()}</body></html>`;
  const target = path.join(out,route==='/'?'index.html':`${route.replace(/^\//,'')}.html`);
  await mkdir(path.dirname(target),{recursive:true});
  await writeFile(target,html);
  if(!noindex) pages.push(canonical);
}

// dist is always a fixed directory inside this checkout.
if (path.dirname(out)!==root || path.basename(out)!=='dist') throw new Error('Unsafe output directory');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
await cp(path.join(root,'assets'),path.join(out,'assets'),{recursive:true});
await loadPublishedContent.materialize(out);
await mkdir(path.join(out,'admin'),{recursive:true});
for(const f of ['index.html','admin.css']) await cp(path.join(root,'admin',f),path.join(out,'admin',f));
await build({entryPoints:[path.join(root,'admin/app.js')],bundle:true,minify:true,format:'iife',platform:'browser',target:'es2022',outfile:path.join(out,'admin/app.js')});
await writeFile(path.join(out,'publication.json'),JSON.stringify({revision}));
for(const file of ['styles.css','script.js']) await cp(path.join(root,file),path.join(out,file));

await page('/', 'World Wide Frequencies — Independent Music Label', 'Explore releases and artists from World Wide Frequencies. Independent sounds across genres.', '', `${featured?`<section class="hero"><div class="hero-backdrop" aria-hidden="true" style="background-image:url('${escape(local(featured.cover))}')"></div><div class="container hero-inner"><a class="hero-art" href="${releasePath(featured)}">${image(featured.cover,featured.coverAlt,'fetchpriority="high"')}</a><div class="hero-copy"><span class="eyebrow">Featured release · ${escape(featured.status)}</span><h1>${escape(featured.title)}</h1><p>${escape(featured.artist)}</p><a class="button button-outline" href="${releasePath(featured)}">View release ${arrow}</a></div></div><span class="hero-caption">World Wide Frequencies / Releases</span></section>`:`<section class="hero institutional"><div class="container"><span class="eyebrow">Independent music label</span><h1>World Wide<br>Frequencies.</h1><p>Independent sounds. Worldwide.</p><div class="institutional-actions"><a class="button button-outline" href="/artists">Meet the artists ↗</a><a class="button" href="/demos">Send us your demo ↗</a></div></div></section>`}<section class="section container">${strip(sorted.length?'Out now':'New releases','/releases','More releases')}<div class="release-grid">${sorted.length?sorted.slice(0,4).map(card).join(''):'<p class="empty-note">New releases coming soon.</p>'}</div></section><section class="section container roster-section">${strip('The artists','/artists','Full roster')}<div class="artist-grid home-artists">${artists.slice(0,4).map(artistCard).join('')}</div></section>${demoBanner()}`);

await page('/releases','Releases — World Wide Frequencies','Discover the World Wide Frequencies catalog: albums, singles, EPs and track previews.','Releases',`<div class="container page-top"><span class="eyebrow">The catalog</span><h1>Releases</h1><p>Explore the sounds of World Wide Frequencies.</p></div><section class="container section catalog-section" aria-label="Music catalog"><div class="catalog-tools"><div class="filters" aria-label="Release format">${[['all','All releases'],['album','Albums'],['single','Singles'],['ep','EPs']].map(([type,label])=>`<button type="button" data-filter="${type}" aria-pressed="${type==='all'}">${label}</button>`).join('')}</div><label class="search-label"><span class="sr-only">Search releases or artists</span><input type="search" data-search-input placeholder="Search releases or artists" autocomplete="off"><span aria-hidden="true">⌕</span></label></div><p class="catalog-count" role="status" data-result-count>${albums.length} releases</p><div class="release-grid">${sorted.length?sorted.map(card).join(''):'<p class="empty-note">New releases coming soon.</p>'}</div><div class="empty-state" data-no-results hidden><h2>No releases found</h2><p>Try another title, artist or format.</p><button class="button" type="button" data-reset-filters>Clear filters</button></div></section>`);

for(const a of albums) await page(releasePath(a),`${a.title} — ${a.artist} | World Wide Frequencies`,`${a.title} by ${a.artist}. Released ${date(a.releaseDate)}. Explore tracks, previews and streaming platforms.`, 'Releases',`<div class="container detail-top"><a class="back-link" href="/releases">← All releases</a><section class="release-detail"><div class="detail-art">${image(a.cover,a.coverAlt,'fetchpriority="high"')}</div><div class="release-heading"><span class="eyebrow">${escape(a.label)} · ${escape(a.status)}</span><h1>${escape(a.title)}</h1><p class="detail-artist">${artistCredit(a)}</p><p class="detail-date">${escape(date(a.releaseDate))} <span aria-hidden="true">/</span> ${a.tracks.length} ${a.tracks.length===1?'track':'tracks'}</p><div class="streaming"><h2>Listen & discover</h2>${validLinks(a.platforms).length?`<div class="platforms">${platformButtons(a.platforms)}</div>`:'<p class="pending-note">Streaming links will be added here.</p>'}</div></div></section><section class="track-section">${strip('Tracklist')}<p class="section-description">Track times refer to the full songs. Available previews play a short, selected excerpt.</p>${tracks(a)}</section></div><section class="section container">${strip('More releases','/releases')}<div class="release-grid">${sorted.filter(b=>b.id!==a.id).slice(0,4).map(card).join('')}</div></section>`);

await page('/artists','Artists — World Wide Frequencies','Meet the artists of World Wide Frequencies, spanning electronic, rock, jazz and classical music.','Artists',`<header class="container page-top"><span class="eyebrow">Across genres. Across borders.</span><h1>The artists</h1><p>Different perspectives. A shared space for music.</p></header><section class="container section" aria-label="Artist roster"><div class="artist-grid">${artists.map(artistCard).join('')}</div></section>${demoBanner()}`);
for(const a of artists) {
  const related = sorted.filter(r=>(r.artistIds||[]).includes(a.id));
  const hasBio = a.description && !/being curated|added soon/.test(a.description);
  await page(artistPath(a),`${a.name} — World Wide Frequencies`,`${a.name} · ${a.genre}. Artist profile, music and official links from World Wide Frequencies.`, 'Artists',`<div class="container detail-top"><a class="back-link" href="/artists">← All artists</a><section class="artist-detail"><div class="portrait profile-portrait">${portrait(a)}</div><div><span class="eyebrow">World Wide Frequencies / Artist</span><h1>${escape(a.name)}</h1><p class="detail-artist">${escape(a.genre)}</p><div class="biography"><h2>Biography</h2><p>${escape(hasBio?a.description:'A closer look at the artist. Biography and photography coming soon.')}</p></div>${validLinks(a.links).length?`<div class="platforms">${platformButtons(a.links)}</div>`:'<p class="pending-note">Official artist links coming soon.</p>'}</div></section><section class="section">${strip('Releases')}${related.length?`<div class="release-grid">${related.map(card).join('')}</div>`:'<p class="empty-note">Releases for this artist will appear here when announced.</p>'}</section></div>`);
}
await page('/about','About — World Wide Frequencies','World Wide Frequencies is a music label bringing different sounds and perspectives together across genres.','About',`<section class="container page-top"><span class="eyebrow">The label</span><h1>Independent sounds.<br>Worldwide.</h1></section><section class="container about-layout section"><div class="about-symbol" aria-hidden="true">${icon}</div><div class="prose"><h2>A space for different sounds.</h2><p>${escape(site.about || 'World Wide Frequencies is a music label with a cross-genre perspective. From electronic music to rock, jazz and classical, the catalog is a place for distinct voices and individual approaches.')}</p><p>Discover our artists, explore their releases and find your next listen.</p><a class="text-link" href="/artists">Meet the artists ${arrow}</a></div></section>${demoBanner()}`);

await page('/contact','Contact — World Wide Frequencies','Contact World Wide Frequencies and find information about submitting your music.','Contact',`<section class="container page-top"><span class="eyebrow">Get in touch</span><h1>Contact</h1><p>Music starts a conversation.</p></section><div class="container contact-grid section"><section><h2>General enquiries</h2>${site.contact.email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(site.contact.email)?`<a class="contact-email" href="mailto:${escape(site.contact.email)}">${escape(site.contact.email)}</a>`:'<p class="pending-note">Our general contact channel will be available here soon.</p>'}${site.contact.supportEmail?`<h2 class="support-heading">Support</h2><a class="contact-email" href="mailto:${escape(site.contact.supportEmail)}">${escape(site.contact.supportEmail)}</a>`:''}${validLinks(site.socials).length?`<div class="platforms">${platformButtons(site.socials)}</div>`:''}</section><section><span class="eyebrow">For artists</span><h2>Have music to share?</h2><p>Visit Demo Drop for the submission form and guidelines.</p><a class="button" href="/demos">Go to Demo Drop ${arrow}</a></section></div>`);

await page('/demos','Demo Drop — Send Us Your Demo | World Wide Frequencies','Introduce your sound to World Wide Frequencies. Explore our demo submission guidelines.','Demo Drop',`<section class="container page-top"><span class="eyebrow">Demo Drop</span><h1>Send us your demo.</h1><p>A new sound. A different perspective. We want to hear yours.</p></section><div class="container demo-layout section"><aside class="demo-guidelines"><h2>Before you send</h2><ol><li><strong>Make it yours.</strong><p>Share your own original music.</p></li><li><strong>Keep it private.</strong><p>Use a private listening or download link, such as SoundCloud or Dropbox. Include any access instructions in your message.</p></li><li><strong>Tell us about it.</strong><p>Introduce yourself and the track. One song per submission keeps things focused.</p></li></ol></aside><div class="form-panel"><form data-demo-form novalidate aria-label="Demo submission"><h2>Your submission</h2><div class="form-row"><label>Artist name <span aria-hidden="true">*</span><input id="demo-artist" aria-label="Artist name" name="artist" autocomplete="off" required maxlength="100"><span class="field-error" id="error-artist"></span></label><label>Email address <span aria-hidden="true">*</span><input id="demo-email" aria-label="Email address" name="email" type="email" autocomplete="off" required maxlength="254"><span class="field-error" id="error-email"></span></label></div><label>Track title <span aria-hidden="true">*</span><input id="demo-track" aria-label="Track title" name="track" required maxlength="150" autocomplete="off"><span class="field-error" id="error-track"></span></label><label>Private listening / download link <span aria-hidden="true">*</span><input id="demo-link" aria-label="Private listening / download link" name="link" type="url" placeholder="https://" required maxlength="2048" autocomplete="off"><span class="field-error" id="error-link"></span></label><label>A little about you <span class="optional">(optional)</span><textarea name="message" rows="4" maxlength="3000" placeholder="Your story, your sound, and anything we should know."></textarea></label><button class="button" type="submit">Submit demo ${arrow}</button><p class="form-status" role="status" aria-live="polite" tabindex="-1"></p></form></div></div>`);
await page('/404','Page not found — World Wide Frequencies','This page could not be found. Explore the World Wide Frequencies catalog.','',`<section class="container not-found"><span class="eyebrow">404 / Lost frequency</span><h1>Let's find your<br>way back.</h1><p>The page you're looking for isn't here.</p><a class="button" href="/releases">Explore releases ${arrow}</a></section>`,{noindex:true});
await writeFile(path.join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map(url=>`<url><loc>${escape(url)}</loc></url>`).join('')}</urlset>`);
await writeFile(path.join(out,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${new URL('/sitemap.xml',base).href}\n`);
await mkdir(path.join(out,'data'),{recursive:true});
await writeFile(path.join(out,'data/content.json'),JSON.stringify(data));
console.log(`Built ${pages.length} pages + 404 in dist. ${queue.length} previews available.`);
