# World Wide Frequencies — content and publishing

## Run and publish

Requires Node.js 22 or later. No dependencies or installation needed.

```text
npm run dev
```

Open http://127.0.0.1:5173/. After editing content or templates, run `npm run build` and reload. The server serves `dist/`, never the source checkout. `npm test` verifies generated routes, metadata, links, media and the preview/form behavior.

Vercel builds `main` with `npm run build` and publishes `dist/`. The existing production URL is https://world-wide-frequencies.vercel.app/. Commit and push validated source changes to deploy. Generated HTML is ignored by Git: never edit `dist/` directly. The former root and artist HTML files are now generated at the same public addresses.

## Edit content

`data/content.json` is the source of truth. `scripts/build.mjs` contains the shared layouts and page templates. `styles.css` handles presentation; `script.js` handles filters, demos and audio. The build produces all artist and release pages, metadata, sitemap and 404.

### Releases

Add an object to `albums` with a unique lowercase hyphenated `id`, `title`, display `artist`, `type` (`album`, `single`, `ep`), `label`, `status`, ISO `releaseDate`, `cover`, `coverAlt`, `artistIds`, `platforms` and `tracks`. The build creates `/releases/<id>.html`. Set `site.featuredReleaseId` to select the homepage feature; otherwise the latest release is used. The home grid uses release date order.

Each track needs a unique `id` within that release, `title`, full-song `duration` (e.g. `4:23`), and `previewUrl` (empty until available).

`artist` is the displayed credit. Set `artistIds` to known roster IDs to link credits and show the release on their profiles. Keep it empty when there is no confirmed relationship. The existing six releases and seven artists remain provisional; no relationships were inferred.

### Add your previews

Prepare the exact excerpt you want listeners to hear (approximately 25 seconds) and place it in `assets/audio/`. Use lowercase filenames. MP3 is recommended; WAV, OGG and M4A are also supported. A public HTTPS audio URL is also accepted.

```json
{
  "id": "synaptic-echoes",
  "title": "Synaptic Echoes",
  "duration": "4:23",
  "previewUrl": "assets/audio/synaptic-echoes-preview.mp3"
}
```

The player plays the entire excerpt file. It does not cut a full song or enforce a 25-second limit. Its timer reports the actual audio duration, independently of the full track time. Missing previews display “Preview coming soon”. No preview files are included with the provisional catalog. Do not commit QA audio fixtures.

One player is shared within each page. Playback begins only when a listener presses Preview; navigation stops it. Loading failures show an error and leave other previews available.

### Streaming buttons

In each release's `platforms`, add as many label/URL entries as needed:

```json
[
  { "label": "Spotify", "url": "https://open.spotify.com/album/YOUR_ID" },
  { "label": "Apple Music", "url": "https://music.apple.com/album/YOUR_ID" },
  { "label": "Tidal", "url": "https://tidal.com/album/YOUR_ID" },
  { "label": "Amazon Music", "url": "https://music.amazon.com/albums/YOUR_ID" }
]
```

Use actual release URLs. These examples are instructions, not working links. Empty or non-HTTP(S) links are not rendered. New services need no template changes. Streaming links open in a new tab.

### Artists

Add an object to `artists` with unique `id`, `name`, `genre`, `description`, optional `image` and `imageAlt`, `joinedAt` and `links` (the same label/URL format). The build creates `/artists/<id>.html` automatically. `profileUrl` remains for compatibility but generated routes use the ID.

Put photography in `assets/images/`. An empty image uses an initials placeholder; missing biography and links have honest pending states. Add confirmed releases through each release's `artistIds`.

### Site and contact

- `site.url`: production origin used for canonical and sitemap URLs.
- `site.contact.email`: actual public enquiries email, empty until confirmed.
- `site.socials`: real footer and contact links, using label/URL entries.
- `site.legal`: published legal page links; placeholders are hidden. Add reviewed text and operator details before collecting real submissions.
- `site.tagline`: footer text. Copyright year is generated automatically.

## Demo Drop is a simulation

`/demos.html` validates input and displays a simulated success message. No request, email, upload, analytics or browser storage is used by the form. Inputs are reset after success and on page restoration. A visible demo notice remains on the public page.

Before accepting real submissions, choose a delivery/storage service, implement a server endpoint, rate limiting and spam controls, add the appropriate privacy information, and replace the simulation handler. Only show a real confirmation after the server acknowledges receipt. Never place credentials in content JSON or browser JavaScript.

## Visual assets and checks

Existing SVG covers are retained as provisional artwork. The shared 1200×630 social card is a PNG for sharing previews. Never use Spinnin’ artwork, names or logos as label content.

Before deploying: build, run tests, inspect mobile/tablet/desktop views, test demos, test supplied audio, check platform links and verify the Vercel deployment status and production URL. Revert the release commit on main and push if a production rollback is needed.
