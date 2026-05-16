# Asset Specifications

## backgrounds/
Curated photographs for login + session entry screens.

### Requirements
- Resolution: 2560×1600 minimum
- Treatment: desaturated 20-30%, warm tint, lifted shadows
- Mood: quiet, observational, never dramatic
- Subject: landscapes, water, fog, winter light, soft mornings
- All must work with white text overlay
- Consistent color grading across the full set
- 3-4 images per season folder

### Naming
`01-description.jpg`, `02-description.jpg`, etc.

---

## video/
Ambient motion loop for the Session processing state.

### Requirements
- Duration: 10-15 seconds, seamless loop
- Resolution: 1920×1080
- Subject: slow clouds, water ripple, fog drift, light through trees
- Very slow motion — barely perceptible
- Desaturated, warm-tinted (matches photo grading)
- Format: MP4 (h.264), <2MB
- Muted (no audio track)

### Naming
`ambient-loop.mp4`

---

## audio/
Session entry + completion sounds.

### Requirements

**entry.mp3**
- Single soft tone (bell, singing bowl, or piano note)
- Duration: 1-2 seconds with natural decay
- Warm, mid-range frequency
- Quiet — ambient, not attention-grabbing

**complete.mp3**
- Softer/different tone from entry (resolution feeling)
- Duration: 1-2 seconds
- Barely there

### Format
MP3, <100KB each

---

## textures/
Subtle paper/grain texture for reflection reading screen.

### Requirements
- Very subtle noise/grain (3-5% opacity when applied)
- Warm white base matching #fafaf9
- Seamless tileable OR large enough for viewport (2560×1600)
- Format: PNG, <50KB

### Naming
`paper-grain.png`

---

## illustrations/
Minimal illustrations for empty states.

### Requirements
- Style: single-line, minimal, hand-drawn feeling
- Colors: #d6d3d1 and #a8a29e only (stone-300/400)
- Size: at least 240×240px (display at ~120px)
- Subject: abstract/symbolic — NOT literal finance imagery
- Format: SVG

### Files needed
- `empty-dashboard.svg` — "no data yet" (horizon line? open space?)
- `empty-reflections.svg` — "no sessions yet" (open book? page?)
- `all-clear.svg` — "nothing to review" (calm check? clear sky?)
- `empty-forecast.svg` — "need more data" (path ahead? gentle arrow?)

---

## logo/

### mark/
The Horizon circle mark in various sizes.
- `horizon-mark.svg` — vector source
- `horizon-mark-32.png` — 32px favicon
- `horizon-mark-64.png` — 64px
- `horizon-mark-128.png` — 128px
- `horizon-mark-512.png` — 512px
- `horizon-mark-1024.png` — 1024px app icon

### wordmark/
Logo + text lockup.
- `horizon-wordmark.svg` — vector
- `horizon-wordmark-dark.svg` — for light backgrounds
- `horizon-wordmark-light.svg` — for dark backgrounds

### appicon/
macOS/desktop app icon.
- `appicon-1024.png` — 1024×1024 rounded square
- `appicon.icns` — macOS format (future)

### social/
Open Graph / link preview images.
- `og-image.png` — 1200×630
