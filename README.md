# Happy Girlfriend Day ❤️ — Albin & Arlin

A premium, single-page romantic galaxy website. Pure HTML / CSS / vanilla JS — no frameworks.

## Files
- `index.html` — page structure
- `style.css` — all styling (galaxy theme, glassmorphism, animations, responsive rules)
- `script.js` — canvas galaxy/stars, scroll reveals, counter, lightbox, letter, finale effects
- `assets/` — put your real photos and the music file here

## Before you launch

1. **Photos** — add six images to `assets/` named exactly:
   `photo1.jpg`, `photo2.jpg`, `photo3.jpg`, `photo4.jpg`, `photo5.jpg`, `photo6.jpg`
   (until then, the gallery shows a soft nebula placeholder with 🌌).

2. **Music** — add the song file to:
   `assets/until-i-found-you-stephen-sanchez.mp3`
   It only plays after the visitor taps "Tap To Begin ❤️" (browsers block autoplay until a real tap, and iPhone Safari especially requires this).
   *Note: you'll need to legally obtain/license the MP3 yourself — none is bundled here.*

3. **Date** — the live counter starts from `27 May 2026`, set inside `script.js` (`START_DATE`). Change it there if needed.

## Notes on behavior
- The hero galaxy/stars run on `<canvas>` for 60fps performance, with reduced-motion users getting a single static frame instead of a continuous loop.
- Photos lazy-load via `IntersectionObserver` as they scroll into view.
- The mute button appears in the top-right once the experience begins.
- Tap the envelope in the "Secret Letter" section to open it — the letter slides up and types itself out.
- Scrolling into the finale section triggers one automatic firework/confetti moment; tapping "❤️ Forever ❤️" replays it and reveals the final thank-you line.

## Deploying
This is fully static — drop the folder on any static host (GitHub Pages, Netlify, Vercel, or a plain web server) and it works as-is.
