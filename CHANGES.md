# Movie system replaced by the Twin Hearts movie-page engine (Nov 9, 2026)
- New `src/watch.js` (shared room + shared clock + buffering hold + drift correction, same as Watch Together); `src/video.js` and the cinema's own sync removed.
- `main.js`: ping/pong, scheduled start, buf/sync/meta/seek messages, auto-share, next-movie picker removed; the scene (`ctl`) is separate from the movie (room).
- Ad breaks pause/resume the room. Tests: `node tests/watch-sync.test.mjs`.

# What changed in this update

1. SEAT BUG FIXED. The chat / alerts / leave buttons were moved into the button bar, but the bar is
   emptied on every refresh, and the code then looked the buttons up by id (which returns null once they are
   detached) -> error -> the "Sit here" button never appeared. They are now kept by reference.
2. CLARITY RESTORED. Full resolution from the start (same as your original), never below 1x.
   The auto-resolution only steps down after two slow readings in a row and in small steps.
3. LESS WORK PER FRAME (measured): triangles 2.29M -> 0.95M and draw calls 683 -> 464 per frame.
   - Seats: bevel detail cut (looks the same, ~5x fewer triangles per seat).
   - Seated crowd no longer casts shadows (flag CROWD_SHADOWS in src/avatar.js, set true to restore).
   - Lobby lights are switched off once you are inside the hall (shaders for both set-ups are
     compiled during loading, so no hitch).
   - Shadows refresh EVERY frame while someone walks/sits (no shadow lag behind the body),
     a few times a second otherwise, and not at all in the lobby.
4. Kept from the previous update: no per-frame garbage in avatar poses, throttled seek bar / screen texture,
   smoother and capped camera flick, hover names for the right-hand buttons, view popup.
5. Added an empty favicon link (removes a harmless 404).

Note: node_modules is NOT included (the one in your repo was installed on Windows and does not work elsewhere).
Run:  npm install   then   npm run dev   (or npm run build)
