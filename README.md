# LivingSpeech for the web

A progressive web app version of [LivingSpeech](https://github.com/masukomi/living_speech),
a simple communication tool for people who can't speak: type, and your
device speaks it. Lives at <https://LivingSpeech.fyi>.

It speaks with the text-to-speech voices built into your phone, tablet,
or computer, using the browser's Web Speech API. Nothing you type leaves
your device.

## ℹ️ Everything Runs Locally 🎉
Everything you type is private. 

<https://LivingSpeech.fyi> has no server side code.  
The text you type is never sent to the server. 

## Features

- **Type naturally.** Return speaks the text and clears the box. On a
  keyboard, Shift+Return adds a new line. The text box grows as you type,
  up to half the screen height, then scrolls.
- **Recent phrases.** Everything you've said in the last 24 hours is kept
  for quick reuse. Tap the play button to say it again, or tap the text to
  put it in the text box for editing.
- **Choose a voice** from the ones your device has installed. The ⓘ button
  explains how to download better quality Enhanced and Premium voices on
  iPhone and iPad.
- **Custom pronunciations**, one per line: `cli -> see el eye`.
- **Adjustable size.** Text starts at your browser's (and on iPhone, your
  system's) text size. Settings has a Text size percentage on top of that,
  with no upper limit, and the whole app scales with it.
- **Play and stop.** The play button beside the text box speaks what you've
  typed, and becomes a stop button while anything is being spoken.
  Pressing Return mid-speech stops it and speaks the new text.
- **Works offline** once installed, and **updates itself**: each time the
  app is opened or brought back to the foreground it checks for a new
  version, installs it in the background, and reloads (or, if you're in the
  middle of typing, shows a "Tap to update" banner).

## Installing on a phone

- **iPhone / iPad (Safari):** open the site, tap Share, then **Add to Home Screen**.
- **Android (Chrome):** open the site, tap ⋮, then **Install app** or **Add to Home screen**.

## Limitations compared to the Mac app

These are browser restrictions, not choices:

- Siri voices and Personal Voice aren't available to web apps on iOS.
- Speech stops if you lock the phone or switch apps.
- Audio can't be routed into Zoom etc. by the app itself.
- Speech only starts after a tap or key press. Returning from the
  keyboard counts.

## Development

No dependencies; just Node (for the build script and tests) and Python
(for a local web server).

```sh
npm run dev      # serve src/ at http://localhost:8000 (service worker fetches fresh files)
npm test         # unit tests (node --test)
npm run build    # write a deployable copy to dist/
npm run preview  # build, then serve dist/ at http://localhost:8000
```

### Deploying

Run `npm run build` and upload the contents of `dist/` to the web root.

The build stamps a hash of every file into `dist/sw.js` and
`dist/version.js`. The changed `sw.js` is what tells installed copies
there's a new version, so always deploy a fresh build; never edit files
in `dist/` by hand.

Host requirements:

- HTTPS (service workers require it; `localhost` is exempt).
- Serve `sw.js` with `Cache-Control: no-cache` if your host lets you set
  headers. The app already asks browsers to bypass the HTTP cache when
  checking for updates, so this is just belt and braces.
- `manifest.webmanifest` should be served as `application/manifest+json`.

### Layout

| File | Purpose |
|---|---|
| `src/index.html`, `src/style.css` | The two views (Speak and Settings) and the voice info dialog |
| `src/app.js` | Main view: input, speaking, recent list, update handling |
| `src/settings.js` | Settings view: voice list, text size, pronunciations |
| `src/speech.js` | Wrapper around `speechSynthesis`; splits long text into sentence-sized pieces |
| `src/pronounce.js` | Custom pronunciations (a port of the Mac app's `internal/pronounce`) |
| `src/store.js` | Settings and recent phrases in `localStorage` |
| `src/update.js`, `src/sw.js` | Offline caching and update-on-launch |
| `scripts/build.mjs` | Copies `src/` to `dist/` and stamps the version |
| `scripts/icon-*.svg` | Sources for the PNG icons in `src/icons/` |

## License

Copyright ©2026 Kay Rhodes

LivingSpeech is free software: you can redistribute it and/or modify it
under the terms of the [GNU General Public License](LICENSE.txt) as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
