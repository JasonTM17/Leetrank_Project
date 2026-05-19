# Screenshots and demo assets

Hero assets used by the root `README.md`. Captured against the local stack
(`docker compose -f docker-compose.yml -f docker-compose.local.yml up -d`)
on `http://localhost:13000` using Playwright.

## Files

| File | Viewport | Notes |
|------|----------|-------|
| `home.png` | 1920x1080 | Landing page |
| `problems.png` | 1920x1080 | Problem catalogue with filters |
| `problem-detail.png` | 1920x1080 | Two Sum, Monaco editor, run/submit panel |
| `contests.png` | 1920x1080 | Contests index |
| `leaderboard.png` | 1920x1080 | All-time ranking |
| `api-docs.png` | 1920x1080 | OpenAPI docs page |
| `status.png` | 1920x1080 | Public `/status` health board |
| `mobile/home.png` | 375x667 | Responsive home |
| `mobile/problems.png` | 375x667 | Responsive problems |
| `mobile/contests.png` | 375x667 | Responsive contests |
| `dark/home.png` | 1920x1080 | Home in dark mode |
| `dark/problems.png` | 1920x1080 | Problems in dark mode |
| `demo.gif` | 900px wide, ~17s | End-to-end flow: home -> problems -> editor -> submit -> leaderboard -> contests |
| `demo.webm` | 1280x720, VP9 | Same flow, higher fidelity |
| `demo/frame-*.png` | 1280x720 | Source frames the gif/webm are assembled from |

## Reproducing

1. Boot the stack:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.local.yml up -d
   curl -fsS http://localhost:13000/api/health   # expect 200
   ```

2. Capture frames with Playwright (the agent harness uses the Playwright MCP
   tools; equivalent CLI commands below):

   ```bash
   npx playwright screenshot --viewport-size=1920,1080 --full-page \
     http://localhost:13000/ docs/screenshots/home.png
   npx playwright screenshot --viewport-size=1920,1080 --full-page \
     http://localhost:13000/problems docs/screenshots/problems.png
   # ...repeat for each route
   ```

3. Re-encode the demo from the frame sequence:

   ```bash
   # GIF (small, README-friendly)
   ffmpeg -y -f concat -safe 0 -i docs/screenshots/demo/concat.txt \
     -vf "fps=12,scale=900:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5" \
     -loop 0 docs/screenshots/demo.gif

   # WebM (higher quality, smaller than GIF for long clips)
   ffmpeg -y -f concat -safe 0 -i docs/screenshots/demo/concat.txt \
     -vf "scale=1280:720:flags=lanczos,format=yuv420p" -r 24 \
     -c:v libvpx-vp9 -b:v 1M -row-mt 1 docs/screenshots/demo.webm
   ```

The `concat.txt` manifest controls per-frame durations. Update it if you
add or reorder frames.

## Conventions

- Light mode by default. Dark mode shots live in `dark/`.
- Mobile shots use iPhone SE viewport (375x667) and live in `mobile/`.
- Filenames are kebab-case and match the route they capture.
- Keep PNGs under ~1 MB each. Re-export at lower scale if a capture grows.
