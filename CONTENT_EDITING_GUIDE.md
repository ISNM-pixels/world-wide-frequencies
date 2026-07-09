# World Wide Frequencies Content Editing Guide

This site is data-driven. Do not edit artist cards, album cards, hero text, footer links, or contact info directly inside the HTML files unless you are changing layout/structure. Most content changes belong in `data/content.json`.

## Source Of Truth

- `data/content.json` is the main editable content file.
- `assets/images/` contains local images used by the JSON.
- `script.js` renders the content into the HTML templates.
- `index.html`, `artists.html`, `releases.html`, and `contact.html` are mostly templates with `data-*` mount points.

If a user asks to add/remove/change artists, albums, songs, images, hero copy, email, social links, or footer text, edit `data/content.json` first.

## Image Rules

Put new images in `assets/images/` and reference them from JSON with a relative path:

```json
"image": "assets/images/new-artist.jpg"
```

Recommended formats:

- `.jpg` or `.webp` for photos.
- `.png` for artwork with transparency.
- `.svg` for lightweight placeholder or generated vector-style art.

Keep filenames lowercase and descriptive:

```text
assets/images/artist-luna-veil.jpg
assets/images/album-night-current.webp
assets/images/hero-live-room.jpg
```

Every image field should have a matching alt field:

```json
"image": "assets/images/artist-luna-veil.jpg",
"imageAlt": "Luna Veil artist portrait"
```

## Editing Artists

Artists live in the `artists` array.

Required fields:

- `id`: unique lowercase identifier.
- `name`: display name.
- `genre`: short genre label.
- `image`: local image path.
- `joinedAt`: date used for automatic home ordering.

Recommended fields:

- `chip`: short label shown on artist cards.
- `imageAlt`: accessible image description.
- `description`: short artist description.
- `wide`: optional boolean for a wider artist card on desktop.

Example:

```json
{
  "id": "luna-veil",
  "name": "Luna Veil",
  "genre": "Hypnotic Techno",
  "chip": "Hypnotic Techno",
  "image": "assets/images/artist-luna-veil.jpg",
  "imageAlt": "Luna Veil artist portrait",
  "description": "Precision-built late-night techno with a cinematic edge.",
  "joinedAt": "2026-06-01"
}
```

To remove an artist, delete that artist object from the `artists` array. Check albums afterward: if albums still reference that artist name, decide whether those releases should stay.

## Editing Albums And Tracks

Albums and singles live in the `albums` array. Each album can contain multiple tracks.

Required fields:

- `id`: unique lowercase identifier.
- `title`: release title.
- `artist`: display artist name.
- `type`: usually `album` or `single`.
- `releaseDate`: date used for automatic home ordering.
- `cover`: local image path.
- `tracks`: array of track objects.

Recommended fields:

- `label`: short display label, such as `LP`, `Album`, or `Single`.
- `status`: short status, such as `Out Now` or `Archive`.
- `coverAlt`: accessible image description.

Example:

```json
{
  "id": "night-current",
  "title": "Night Current",
  "artist": "Luna Veil",
  "type": "album",
  "label": "LP",
  "status": "Out Now",
  "releaseDate": "2026-06-15",
  "cover": "assets/images/album-night-current.jpg",
  "coverAlt": "Night Current album artwork",
  "tracks": [
    { "title": "Night Current", "duration": "5:12" },
    { "title": "Soft Voltage", "duration": "4:46" }
  ]
}
```

To add a song, add one object inside `tracks`.

To remove a song, delete that track object.

To remove a release, delete the release object from `albums`.

## Home Page Ordering

The home page is automatic:

- New releases are the most recent `albums`, sorted by `releaseDate` descending.
- Roster preview uses the most recent `artists`, sorted by `joinedAt` descending.
- The audio player uses `player.albumId` and `player.trackTitle`. If those are missing or invalid, it falls back to the newest album and its first track.

Use ISO dates:

```json
"releaseDate": "2026-06-15"
```

Avoid ambiguous dates like `06/15/26`.

## Editing Site, Hero, Contact, Footer

Global content lives in `site`.

Common edits:

```json
"brand": "World Wide Frequencies",
"tagline": "Architects of the modern soundscape."
```

Hero content:

```json
"hero": {
  "eyebrow": "New Era",
  "title": "The Sound<br>Of The Future",
  "copy": "Pushing the boundaries of electronic music.",
  "image": "assets/images/hero-pulse.svg",
  "imageAlt": "Electronic concert crowd with purple lasers"
}
```

The hero title may include `<br>` for intentional line breaks. Avoid other HTML in JSON unless there is a clear reason.

Social and legal links:

```json
"socials": [
  { "label": "Instagram", "url": "https://instagram.com/example" }
],
"legal": [
  { "label": "Privacy Policy", "url": "#" }
]
```

## Best Practices For AI Editors

1. Prefer data edits over HTML edits.
2. Keep the JSON valid: no trailing commas, all strings quoted.
3. Keep IDs unique.
4. Use local image paths under `assets/images/`.
5. Add alt text for every new image.
6. Use ISO date format: `YYYY-MM-DD`.
7. Preserve existing visual classes and `data-*` attributes unless intentionally changing rendering.
8. After editing, validate JSON and reload the localhost page.

Recommended checks:

```powershell
node -e "JSON.parse(require('fs').readFileSync('data/content.json','utf8')); console.log('json ok')"
node --check script.js
```

If localhost is running, verify:

```text
http://127.0.0.1:5173/
http://127.0.0.1:5173/artists.html
http://127.0.0.1:5173/releases.html
http://127.0.0.1:5173/contact.html
```

## When To Edit HTML Or CSS

Edit HTML only when adding a new section, changing page layout, or adding a new mount point for rendered data.

Edit CSS only when changing visual design, responsive behavior, spacing, typography, or component states.

Do not duplicate content into HTML. If content appears in more than one place, add it to `data/content.json` and render it from `script.js`.

## Troubleshooting

If content does not appear:

- Confirm the site is opened through localhost, not directly as a file.
- Confirm `data/content.json` is valid JSON.
- Confirm paths in JSON match real files.
- Check the browser console for errors.

If an image is missing:

- Confirm the file exists in `assets/images/`.
- Confirm the JSON path is correct.
- Confirm the filename extension matches exactly.

If home ordering looks wrong:

- Check `releaseDate` on albums.
- Check `joinedAt` on artists.
- Use `YYYY-MM-DD` format.
