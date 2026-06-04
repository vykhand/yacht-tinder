---
name: record-demo
description: Record (or refresh) the GIF demo of the yacht-tinder app shown in the README. Use when asked to record a demo, make a showcase GIF, or update docs/demo.gif. Drives the running app through Discover (swipe), Search, and Saved, then exports an optimized GIF.
---

# Record the yacht-tinder demo GIF

Produces `docs/demo.gif` — a short showcase of the three core flows (swipe deck → semantic
search → shortlist) — and keeps it embedded near the top of `README.md`.

There are two ways to record. **Prefer pagecast** if its MCP tools are connected; otherwise use
the self-contained fallback script (same Playwright + ffmpeg engine).

## Preconditions (both methods)

1. The app must be running: `npm run dev` (serves `http://localhost:3000`). Start it in the
   background and wait until the port is listening; stop it afterward with `npm run stop`.
2. ffmpeg must be installed (`ffmpeg -version`).

## Method A — pagecast (preferred)

pagecast is installed as a project MCP server in `.mcp.json`. Its tools only connect after Claude
Code reloads, so if you don't see `record_page` / `interact_page` etc., reload first (restart
Claude Code or re-trust the project), then:

1. `record_page("http://localhost:3000", platform="github")` — opens the app, starts recording.
2. `interact_page(...)` in sequence to showcase:
   - Discover: drag the top card right (like), drag the next left (pass), tap the anchor button.
   - Tap the **Search** tab → click an example query chip → let results render → scroll.
   - Tap the **Saved** tab → show the shortlist.
3. `stop_recording()` then `convert_to_gif()` (GitHub/README preset, ~1280×720 or the app's
   portrait size). Save the result to `docs/demo.gif`.

## Method B — fallback script (no MCP needed)

```bash
npm run dev > /tmp/yt-dev.log 2>&1 &          # start app
until lsof -ti :3000 >/dev/null 2>&1; do sleep 0.3; done
node scripts/record-demo.mjs                   # records → docs/demo.gif (warms model first)
npm run stop                                    # stop app
```

`scripts/record-demo.mjs` launches Playwright with `recordVideo`, injects a visible cursor,
drives the same Discover→Search→Saved sequence, then runs an ffmpeg palette conversion. It
defaults to **full capture quality** (≈9 MB). For a smaller GIF, pass the `DEMO_*` env vars:

```bash
DEMO_WIDTH=320 DEMO_FPS=12 DEMO_DENOISE=8:6:12:12 DEMO_TRIM=1 DEMO_MAXCOLORS=160 \
  node scripts/record-demo.mjs       # ≈3–4 MB
```

## After recording

Ensure `README.md` embeds it near the top:

```markdown
<p align="center"><img src="docs/demo.gif" alt="yacht·tinder demo" width="320"></p>
```

Then commit `docs/demo.gif` + README and push.
