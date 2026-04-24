
# AI Gesture Whiteboard — Full Build Plan

I'll build the entire app in one pass, then verify. Heads-up on a few realities:

- **Always-on PWA service worker** will cause the Lovable editor preview to serve stale content. You'll need hard-refreshes during iteration. Offline behavior is best tested in the published build.
- **MediaPipe & Tesseract WASM/model files** are large. I'll lazy-load them from CDNs by default and document how to drop them into `public/models/` and `public/tesseract/` for strict offline use.
- **Webcam requires HTTPS** (works on the Lovable preview and published URL, not on `http://`).
- **GitHub OAuth** is not natively supported by Lovable Cloud — using **Email + Google** as agreed.

---

## Phase 1 — Backend (Lovable Cloud)

Enable Lovable Cloud and create:

**Tables**
- `profiles` (id → auth.users, display_name, avatar_url, created_at)
- `user_settings` (user_id PK, theme, gesture_mappings jsonb, ui_layout jsonb, brush_settings jsonb, smoothing jsonb, updated_at)
- `whiteboards` (id, user_id, title, data jsonb, thumbnail_url, share_token uuid unique nullable, is_public bool, created_at, updated_at)

**RLS**
- Owner can CRUD their own rows
- Public SELECT on `whiteboards` where `is_public = true` (for share links)

**Triggers**
- Auto-create `profiles` + default `user_settings` row on signup
- `updated_at` trigger on settings/whiteboards

**Edge functions**
- `smart-ink-ai` — accepts a base64 stroke raster, calls Lovable AI Gateway (Gemini Vision) for handwriting → text / shape classification, returns structured JSON via tool calling. Handles 402/429.

**Auth**
- Email + Google enabled, autoconfirm email on for smooth dev

---

## Phase 2 — App Shell, Routing, Theme

- `App.tsx` routes: `/` (board), `/auth`, `/settings`, `/dashboard` (saved boards), `/b/:shareToken` (read-only viewer), `*` NotFound
- Dark-mode-first design system in `index.css` + `tailwind.config.ts` (HSL tokens, semantic colors, glass surfaces, accent gradient)
- `AuthProvider` with `onAuthStateChange` set up before `getSession()`
- Responsive shell: desktop collapsible sidebar; mobile floating toolbar + bottom sheet

---

## Phase 3 — Local Persistence & Sync Engine

- `lib/idb.ts` — IndexedDB wrapper (settings, boards, pending-sync queue)
- `hooks/useSyncEngine.ts` — read/write local-first; on `online` event, flush queue to Supabase; on auth, pull remote → merge by `updated_at`
- `hooks/useSettings.ts` — typed accessor for gesture mappings, brush, smoothing, theme

---

## Phase 4 — Gesture Engine

- `lib/gestures/landmarks.ts` — finger-extension math (compare tip vs PIP/MCP joints), pinch distance, palm centroid, normalized → canvas coords
- `lib/gestures/oneEuro.ts` — One-Euro filter for cursor smoothing (configurable mincutoff/beta from settings)
- `lib/gestures/poses.ts` — pose classifier → `DRAW | HOVER | PAN | ERASE | PINCH | NONE` with hysteresis to prevent flicker
- `components/GestureController.tsx` — webcam + `@mediapipe/tasks-vision` HandLandmarker, RAF loop, emits gesture events; small live preview with landmark overlay

---

## Phase 5 — Smart Canvas

- `components/SmartCanvas.tsx` — HTML5 canvas, RAF render loop, layer model (strokes, shapes, text nodes)
- Tools: pen (variable thickness via `perfect-freehand`), eraser, rectangle, circle, arrow, text, equation
- Pan/zoom via fist gesture or touch; pinch to select/move objects
- Equation tool: input → `mathjs` evaluate → render result
- Pointer + gesture input share the same tool pipeline

---

## Phase 6 — Smart Ink (tri-mode)

- `lib/ink/heuristics.ts` — instant offline detection: line / rectangle / circle / arrow / triangle from stroke bbox + curvature
- `lib/ink/tesseract.ts` — lazy-loaded Tesseract.js worker for offline character/digit OCR
- `lib/ink/ai.ts` — calls `smart-ink-ai` edge function for online handwriting (best accuracy)
- Pipeline on `pointerup` / gesture-end: heuristics → if low confidence and online → AI; else → Tesseract; replace strokes with vector node

---

## Phase 7 — Export & Share (your new request)

`components/ExportShareMenu.tsx` in the toolbar:

1. **Download PNG** — rasterize current canvas (with white/dark bg option) → `toBlob` → download
2. **Download JSON** — serialize board state (strokes, shapes, text, viewport) → download `.lovable-board.json`
3. **Import JSON** — load a board file back into the canvas
4. **Copy share link** (signed-in only) — generates/reuses `share_token`, sets `is_public = true`, copies `https://.../b/:token` to clipboard, shows toast
5. **Revoke share** — clears token, sets `is_public = false`
6. `/b/:shareToken` — read-only viewer route that fetches public board and renders it (no gestures, no edit)

---

## Phase 8 — Onboarding & Settings

- `react-joyride` tour on first visit (localStorage flag): camera permission → gestures overlay → tools → export → settings
- `pages/Settings.tsx`:
  - Gesture remapping grid (pose → tool dropdown)
  - Brush defaults (size, color, smoothing)
  - Velocity-filter sliders (One-Euro mincutoff/beta)
  - Theme toggle, camera mirror toggle
  - All persisted via `useSyncEngine`

---

## Phase 9 — PWA

- `vite-plugin-pwa` with `registerType: "autoUpdate"`, manifest (name, icons, standalone, dark theme color)
- Workbox runtime caching for MediaPipe/Tesseract/CDN models
- `navigateFallbackDenylist: [/^\/~oauth/, /^\/b\//]`
- README section: where to drop offline model files into `public/`

---

## Phase 10 — Verification Pass

I'll explicitly check and report on:
- Routes load, auth flow (email + Google) works
- Webcam permission + MediaPipe initializes; all 5 gestures fire
- All canvas tools draw/erase/move correctly with mouse and gesture
- Heuristic shape correction replaces shaky strokes
- AI Smart Ink edge function returns structured output (with 402/429 handling)
- IndexedDB persists offline; syncs to Supabase on reconnect
- PNG export, JSON export/import, share link copy + public viewer route
- Settings remap actually changes active gesture mapping
- Mobile (484px) and desktop layouts both usable
- Onboarding tour triggers on first visit only
- Console clean of errors; security scan passes

If anything fails, I fix it in the same loop and re-verify before handing back.

---

**Approve to start the build.**
