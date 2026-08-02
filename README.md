**English** | [فارسی](README.fa.md)

---
# PromptMotion Studio

PromptMotion Studio is a 100% offline browser app for generating short motion-graphic videos from a prompt. It renders animated scenes on an HTML canvas, mixes optional audio in the browser, and exports a downloadable video file.

## Features

- Prompt-to-video motion graphics with live preview
- 13 procedural scene styles, including Nebula, Ocean, Starfield, Aurora, Synthwave, Matrix, Bubbles, Snowfall, and more
- Text editor with prompt/title and subtitle controls
- Text adjustment panel for size, vertical position, opacity, custom color, subtitle visibility, and subtitle position
- 11 text animation modes such as Kinetic, Cinematic Title, Typewriter, Cascade, Wave, Slam, Glitch, Blur Focus, Neon Flicker, and Gold Display
- Color palettes, film grain, vignette, seed shuffle, and multi-scene timeline mode
- Procedural ambient audio plus optional MP3/WAV upload
- Export presets for YouTube, Reels, and Square formats
- Recent videos list for the current session
- Works offline with no server calls

## How It Works

1. Type a prompt and optional subtitle.
2. Pick a visual style, color palette, text animation, and export settings.
3. The app renders every frame on a canvas.
4. Audio is generated or mixed locally with Web Audio.
5. The browser records and exports the final video file.

## Usage

- Press **Generate video** to render.
- Press **Cmd/Ctrl + Enter** to generate with the keyboard.
- Press **Esc** while rendering to cancel.
- Use the **Text** tab to edit and adjust text layout.
- Use **Recent videos** to save or reload generated videos from the current session.

## Offline Notes

The app does not call external APIs for rendering. Everything happens locally in your browser. Uploaded audio is decoded locally and does not leave your device.

## Development

This project is built with React, Vite, and Tailwind CSS.

```bash
npm install
npm run build
```
