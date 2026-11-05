const menuButton = document.querySelector('.menu-toggle');
const menu = document.querySelector('#site-menu');
function closeMenu() {
  menuButton?.setAttribute('aria-expanded', 'false');
  menuButton?.setAttribute('aria-label', 'Open navigation');
  menu?.classList.remove('is-open');
}
menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  menu.classList.toggle('is-open', open);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && menu?.classList.contains('is-open')) { closeMenu(); menuButton.focus(); }
});
document.addEventListener('click', e => { if (!e.target.closest('.site-header')) closeMenu(); });
menu?.addEventListener('click', e => { if(e.target.closest('a')) closeMenu(); });

const cards = [...document.querySelectorAll('[data-release-card]')];
const filters = [...document.querySelectorAll('[data-filter]')];
const searchInput = document.querySelector('[data-search-input]');
let filter = 'all';
function filterCatalog() {
  const query = (searchInput?.value || '').trim().toLocaleLowerCase();
  let count = 0;
  cards.forEach(card => {
    const visible = (filter === 'all' || card.dataset.type === filter) && card.dataset.search.includes(query);
    card.hidden = !visible;
    if (visible) count++;
  });
  const counter = document.querySelector('[data-result-count]');
  if(counter) counter.textContent = `${count} ${count === 1 ? 'release' : 'releases'}`;
  const empty = document.querySelector('[data-no-results]');
  if(empty) empty.hidden = count > 0;
}
filters.forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  filters.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  filterCatalog();
}));
searchInput?.addEventListener('input', filterCatalog);
document.querySelector('[data-reset-filters]')?.addEventListener('click', () => {
  filter = 'all'; searchInput.value = '';
  filters.forEach(item => item.setAttribute('aria-pressed', String(item.dataset.filter === 'all')));
  filterCatalog(); searchInput.focus();
});

// Browser-only simulation: never send or persist form values.
const form = document.querySelector('[data-demo-form]');
if (form) {
  const status = form.querySelector('.form-status');
  const submit = form.querySelector('[type="submit"]');
  const rules = {artist:'Enter your artist name.',email:'Enter a valid email address.',track:'Enter the track title.',link:'Enter a complete http:// or https:// listening or download link.'};
  const clearError = input => {
    input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby');
    const error = form.querySelector(`#error-${input.name}`);
    if (error) error.textContent = '';
  };
  form.addEventListener('input', e => { clearError(e.target); status.textContent = ''; status.classList.remove('success'); });
  form.addEventListener('submit', e => {
    e.preventDefault();
    let firstInvalid;
    for(const [name,message] of Object.entries(rules)) {
      const input = form.elements.namedItem(name);
      clearError(input);
      let valid = Boolean(input.value.trim()) && input.checkValidity();
      if(name === 'link') {
        try { valid = valid && ['https:', 'http:'].includes(new URL(input.value.trim()).protocol); }
        catch { valid = false; }
      }
      if (!valid) {
        input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', `error-${name}`);
        form.querySelector(`#error-${name}`).textContent = message;
        firstInvalid ||= input;
      }
    }
    if (firstInvalid) { status.textContent = 'Please check the highlighted fields.'; firstInvalid.focus(); return; }
    submit.disabled = true; submit.textContent = 'Submitting…'; form.setAttribute('aria-busy', 'true');
    status.textContent = 'Simulating your submission…';
    window.setTimeout(() => {
      form.reset(); form.removeAttribute('aria-busy'); submit.disabled = false;
      submit.textContent = 'Submit another demo ↗';
      status.textContent = 'Demo submitted successfully — simulation complete. No music or personal details were sent or stored.';
      status.classList.add('success'); status.focus();
    }, 800);
  });
  window.addEventListener('pageshow', () => form.reset());
}

const player = document.querySelector('.audio-player');
const queue = JSON.parse(document.querySelector('#preview-data')?.textContent || '[]');
const audio = player?.querySelector('audio');
const previewButtons = [...document.querySelectorAll('[data-preview]')];
if (player && audio && queue.length) {
  let selected = -1;
  let playAttempt = 0;
  const playButton = player.querySelector('[data-play]');
  const seek = player.querySelector('[data-seek]');
  const elapsed = player.querySelector('[data-elapsed]');
  const duration = player.querySelector('[data-duration]');
  const message = player.querySelector('[data-player-message]');
  const format = seconds => {
    if(!Number.isFinite(seconds)) return '0:00';
    const whole = Math.max(0,Math.floor(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  };
  const updatePlay = () => {
    const playing = !audio.paused && !audio.ended;
    playButton.textContent = playing ? 'Ⅱ' : '▶';
    playButton.setAttribute('aria-label', playing ? 'Pause preview' : 'Play preview');
    previewButtons.forEach(b => {
      const active = selected >= 0 && b.dataset.preview === queue[selected].key;
      b.classList.toggle('is-playing', active && playing);
      b.setAttribute('aria-pressed', String(active && playing));
    });
  };
  const play = async () => {
    const attempt = ++playAttempt;
    try { await audio.play(); }
    catch(error) {
      if(attempt !== playAttempt || error.name === 'AbortError') return;
      message.textContent = audio.error ? 'This preview could not be loaded. Try another track.' : 'Playback could not start. Press play to try again.';
      updatePlay();
    }
  };
  const select = index => {
    if (index < 0 || index >= queue.length) return;
    ++playAttempt; audio.pause(); selected = index;
    const item = queue[index];
    player.hidden = false; document.body.classList.add('player-open');
    player.querySelector('[data-now-title]').textContent = item.title;
    player.querySelector('[data-now-artist]').textContent = item.artist;
    const cover = player.querySelector('.player-cover'); cover.src = item.cover; cover.alt = `${item.title} artwork`;
    elapsed.textContent = '0:00'; duration.textContent = '0:00'; seek.value = 0; seek.max = 0; seek.disabled = true;
    message.textContent = 'Loading preview…';
    audio.src = item.src; audio.load(); play();
  };
  audio.volume = 0.8;
  previewButtons.forEach(button => button.addEventListener('click', () => {
    const index = queue.findIndex(t => t.key === button.dataset.preview);
    if(index === selected && !audio.paused) audio.pause();
    else if(index === selected && !audio.error) play();
    else select(index);
  }));
  playButton.addEventListener('click', () => { if(audio.paused) { if(audio.error) select(selected); else play(); } else audio.pause(); });
  player.querySelector('[data-previous]').disabled = queue.length < 2;
  player.querySelector('[data-next]').disabled = queue.length < 2;
  player.querySelector('[data-previous]').addEventListener('click', () => select((selected - 1 + queue.length) % queue.length));
  player.querySelector('[data-next]').addEventListener('click', () => select((selected + 1) % queue.length));
  player.querySelector('[data-volume]').addEventListener('input', e => { audio.volume = Number(e.target.value); });
  seek.addEventListener('input', () => { if(Number.isFinite(audio.duration)) audio.currentTime = Number(seek.value); });
  audio.addEventListener('loadedmetadata', () => {
    const validDuration = Number.isFinite(audio.duration) && audio.duration > 0;
    seek.max = validDuration ? audio.duration : 0; seek.disabled = !validDuration;
    duration.textContent = format(audio.duration); message.textContent = '';
  });
  audio.addEventListener('playing', () => { message.textContent = ''; });
  audio.addEventListener('timeupdate', () => { seek.value = audio.currentTime; elapsed.textContent = format(audio.currentTime); });
  audio.addEventListener('error', () => { message.textContent = 'This preview could not be loaded. Try another track.'; seek.disabled = true; updatePlay(); });
  for(const event of ['play','pause','ended']) audio.addEventListener(event, updatePlay);
  player.querySelector('[data-close-player]').addEventListener('click', () => {
    ++playAttempt; audio.pause(); player.hidden = true; document.body.classList.remove('player-open');
    previewButtons.find(b=>b.dataset.preview===queue[selected]?.key)?.focus();
  });
  window.addEventListener('pagehide', () => { ++playAttempt; audio.pause(); });
}
document.querySelectorAll('img').forEach(img => img.addEventListener('error', () => {
  if (!img.dataset.fallback) { img.dataset.fallback = 'true'; img.src = '/assets/images/album-null-state.svg'; }
}));
