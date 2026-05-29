const contentUrl = "data/content.json";

const state = {
  content: null,
  releaseFilter: "all",
};

const byDateDesc = (dateKey) => (a, b) => {
  const aTime = Date.parse(a[dateKey] || "") || 0;
  const bTime = Date.parse(b[dateKey] || "") || 0;
  return bTime - aTime;
};

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const setText = (selector, value) => {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value || "";
  });
};

const setHtml = (selector, value) => {
  document.querySelectorAll(selector).forEach((node) => {
    node.innerHTML = value || "";
  });
};

const imageMarkup = (src, alt, className = "") => {
  const safeSrc = src || "assets/images/album-null-state.svg";
  return `<img ${className ? `class="${className}"` : ""} src="${escapeHtml(safeSrc)}" alt="${escapeHtml(alt || "")}" loading="lazy" onerror="this.src='assets/images/album-null-state.svg'">`;
};

const getSortedAlbums = () => [...(state.content?.albums || [])].sort(byDateDesc("releaseDate"));

const getSortedArtists = () =>
  [...(state.content?.artists || [])].sort((a, b) => {
    const bTime = Date.parse(b.joinedAt || "") || 0;
    const aTime = Date.parse(a.joinedAt || "") || 0;
    return bTime - aTime;
  });

const getPrimaryTrack = (album) => album?.tracks?.[0] || { title: album?.title || "Untitled", duration: "0:00" };

function initMenu() {
  document.querySelectorAll("[data-menu-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const panel = document.querySelector("[data-mobile-menu]");
      const isOpen = panel.classList.toggle("open");
      button.setAttribute("aria-expanded", String(isOpen));
    });
  });
}

function initDemoForm() {
  document.querySelectorAll("[data-demo-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      const original = button.innerHTML;
      button.innerHTML = "Transmission Sent <span class=\"material-symbols-outlined\">check</span>";
      button.disabled = true;

      window.setTimeout(() => {
        button.innerHTML = original;
        button.disabled = false;
        form.reset();
      }, 2200);
    });
  });
}

function renderSiteChrome() {
  const site = state.content.site || {};
  setText("[data-site-brand]", site.brand || "Obsidian Pulse");
  renderFooter(site);
}

function renderFooter(site) {
  document.querySelectorAll("[data-footer]").forEach((footer) => {
    const socials = (site.socials || []).slice(0, 3);
    const legal = site.legal || [];

    footer.innerHTML = `
      <div class="container footer-main">
        <div class="footer-brand">
          <div class="footer-logo">${escapeHtml(site.brand || "Obsidian Pulse")}</div>
          <p class="footer-copy">${escapeHtml(site.tagline || "")}</p>
        </div>
        <div class="footer-links">
          <div class="footer-column">
            <h4>Connect</h4>
            ${socials.map((link) => `<a href="${escapeHtml(link.url || "#")}">${escapeHtml(link.label)}</a>`).join("")}
          </div>
          <div class="footer-column">
            <h4>Legal</h4>
            ${legal.map((link) => `<a href="${escapeHtml(link.url || "#")}">${escapeHtml(link.label)}</a>`).join("")}
          </div>
        </div>
      </div>
      <div class="container footer-bottom"><p class="copyright">${escapeHtml(site.copyright || "")}</p></div>
    `;
  });
}

function renderHome() {
  const site = state.content.site || {};
  const hero = site.hero || {};
  const heroImage = document.querySelector("[data-hero-image]");

  if (heroImage) {
    heroImage.src = hero.image || "assets/images/hero-pulse.svg";
    heroImage.alt = hero.imageAlt || "";
  }

  setText("[data-hero-eyebrow]", hero.eyebrow || "");
  setHtml("[data-hero-title]", hero.title || "");
  setText("[data-hero-copy]", hero.copy || "");
  setText("[data-home-release-subtitle]", site.home?.releaseSubtitle || "");
  setText("[data-home-roster-title]", site.home?.rosterTitle || "The Roster");

  const latestAlbums = getSortedAlbums().slice(0, 3);
  const featured = latestAlbums[0];
  const secondary = latestAlbums.slice(1);
  const releasesMount = document.querySelector("[data-home-releases]");

  if (releasesMount) {
    releasesMount.innerHTML = featured
      ? `
        ${renderFeaturedRelease(featured)}
        <div class="mini-stack">${secondary.map(renderMiniRelease).join("")}</div>
      `
      : `<p class="empty-state">No releases have been added yet.</p>`;
  }

  const artistsMount = document.querySelector("[data-home-artists]");
  if (artistsMount) {
    artistsMount.innerHTML = getSortedArtists().slice(0, 4).map(renderHomeArtist).join("");
  }

  renderPlayer();
}

function renderFeaturedRelease(album) {
  return `
    <article class="feature-card">
      ${imageMarkup(album.cover, album.coverAlt)}
      <div class="image-gradient"></div>
      <div class="card-body">
        <div class="release-meta">
          <span class="release-tag">${escapeHtml(album.label || album.type || "Release")}</span>
          <span class="release-state">${escapeHtml(album.status || "")}</span>
        </div>
        <h3 class="card-title">${escapeHtml(album.title)}</h3>
        <p class="card-artist">${escapeHtml(album.artist)}</p>
      </div>
    </article>
  `;
}

function renderMiniRelease(album) {
  return `
    <article class="mini-release">
      ${imageMarkup(album.cover, album.coverAlt)}
      <div class="image-gradient"></div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(album.title)}</h3>
        <p class="card-artist">${escapeHtml(album.artist)}</p>
      </div>
    </article>
  `;
}

function renderHomeArtist(artist) {
  return `
    <a class="home-artist" href="artists.html">
      <span class="home-artist-photo">${imageMarkup(artist.image, artist.imageAlt)}</span>
      <h3>${escapeHtml(artist.name)}</h3>
      <p>${escapeHtml(artist.genre)}</p>
    </a>
  `;
}

function renderArtistsPage() {
  const mount = document.querySelector("[data-artists-grid]");
  if (!mount) return;

  const artists = getSortedArtists();
  mount.innerHTML = artists.length
    ? artists.map(renderArtistCard).join("")
    : `<p class="empty-state">No artists have been added yet.</p>`;
}

function renderArtistCard(artist) {
  return `
    <article class="artist-card ${artist.wide ? "wide" : ""}">
      ${imageMarkup(artist.image, artist.imageAlt)}
      <div class="artist-overlay">
        <div class="artist-content">
          <span class="artist-chip">${escapeHtml(artist.chip || artist.genre || "Artist")}</span>
          <h2 class="artist-name">${escapeHtml(artist.name)}</h2>
          <p class="artist-description">${escapeHtml(artist.description || "")}</p>
          <div class="artist-line"></div>
        </div>
      </div>
    </article>
  `;
}

function renderReleasesPage() {
  const mount = document.querySelector("[data-releases-grid]");
  if (!mount) return;

  const albums = getSortedAlbums().filter((album) => state.releaseFilter === "all" || album.type === state.releaseFilter);
  mount.innerHTML = albums.length
    ? albums.map(renderReleaseCard).join("")
    : `<p class="empty-state">No releases match this filter.</p>`;
}

function renderReleaseCard(album) {
  return `
    <article class="release-card" data-release-type="${escapeHtml(album.type || "album")}">
      <div class="release-art">
        ${imageMarkup(album.cover, album.coverAlt)}
        <div class="play-overlay"><span class="material-symbols-outlined fill">play_circle</span></div>
      </div>
      <div class="release-info">
        <div>
          <h2 class="release-title">${escapeHtml(album.title)}</h2>
          <p class="release-artist">${escapeHtml(album.artist)}</p>
        </div>
        <span class="release-kind">${escapeHtml(album.label || album.type || "Release")}</span>
      </div>
      <ol class="track-list">
        ${(album.tracks || []).map((track, index) => `
          <li>
            <span>${String(index + 1).padStart(2, "0")}. ${escapeHtml(track.title)}</span>
            <span>${escapeHtml(track.duration || "")}</span>
          </li>
        `).join("")}
      </ol>
    </article>
  `;
}

function initReleaseFilters() {
  document.querySelectorAll("[data-release-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.releaseFilter = button.dataset.releaseFilter || "all";
      document.querySelectorAll("[data-release-filter]").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
      renderReleasesPage();
    });
  });
}

function renderContactPage() {
  const site = state.content.site || {};
  const contact = site.contact || {};
  const emailNode = document.querySelector("[data-contact-email]");

  setText("[data-contact-title]", contact.title || "Transmit.");
  setText("[data-contact-network-title]", contact.networkTitle || "Network");
  setText("[data-contact-note]", contact.note || "");

  if (emailNode) {
    emailNode.textContent = site.email || "";
    emailNode.href = `mailto:${site.email || ""}`;
  }

  const socialsMount = document.querySelector("[data-contact-socials]");
  if (socialsMount) {
    socialsMount.innerHTML = (site.socials || [])
      .filter((link) => link.label !== "Newsletter Signup")
      .map((link) => `
        <li>
          <a href="${escapeHtml(link.url || "#")}">
            <span>${escapeHtml(link.label)}</span>
            <span class="material-symbols-outlined">arrow_forward</span>
          </a>
        </li>
      `)
      .join("");
  }
}

function renderPlayer() {
  const mount = document.querySelector("[data-player]");
  if (!mount) return;

  const albums = getSortedAlbums();
  const player = state.content.player || {};
  const selectedAlbum = albums.find((album) => album.id === player.albumId) || albums[0];
  const selectedTrack =
    selectedAlbum?.tracks?.find((track) => track.title === player.trackTitle) || getPrimaryTrack(selectedAlbum);

  if (!selectedAlbum) {
    mount.innerHTML = "";
    return;
  }

  mount.innerHTML = `
    <div class="container player-inner">
      <div class="now-playing">
        ${imageMarkup(selectedAlbum.cover, selectedAlbum.coverAlt)}
        <span>
          <span class="track-title">${escapeHtml(selectedTrack.title)}</span>
          <span class="track-artist">${escapeHtml(selectedAlbum.artist)}</span>
        </span>
      </div>
      <div class="player-controls">
        <button type="button" aria-label="Previous track"><span class="material-symbols-outlined">skip_previous</span></button>
        <button class="play" type="button" aria-label="Play"><span class="material-symbols-outlined fill" style="font-size:32px;">play_arrow</span></button>
        <button type="button" aria-label="Next track"><span class="material-symbols-outlined">skip_next</span></button>
      </div>
      <div class="progress"><span>0:00</span><div class="bar"></div><span>${escapeHtml(selectedTrack.duration || "0:00")}</span></div>
      <button class="volume-button" type="button" aria-label="Volume"><span class="material-symbols-outlined">volume_up</span></button>
    </div>
  `;
}

async function loadContent() {
  const response = await fetch(contentUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${contentUrl}`);
  state.content = await response.json();
}

async function init() {
  initMenu();
  initDemoForm();
  initReleaseFilters();

  try {
    await loadContent();
    renderSiteChrome();
    renderHome();
    renderArtistsPage();
    renderReleasesPage();
    renderContactPage();
  } catch (error) {
    console.error(error);
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<div class="data-error">Content could not be loaded. Check data/content.json and run the site through localhost.</div>`
    );
  }
}

init();
