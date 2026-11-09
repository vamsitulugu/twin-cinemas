# Cinema ⇄ Twin Hearts: the same movie, the same player rules

The theatre does **not** have its own movie system any more. The movie is picked on the Twin Hearts **Watch Together** page (web and Android, unchanged),
and the theatre screen plays it with the **Twin Hearts movie-page engine** (`src/watch.js`, a port of `us-app/public/movie.js`).

## One room, one clock
- One room per couple on the Twin Hearts server: `/api/movie/:couple` (`watch_sessions`): `playing`, `position_sec`, `updated_at`, `action_seq`.
  Everyone computes `expected = position_sec + (sharedClock − updated_at)`, so web, Android and the theatre always agree.
- Shared clock: `GET /api/movie/time` (3 samples, lowest round trip), refreshed every 45 s.
- Every play / pause / seek is a numbered action: broadcast on `watch_together:<couple>` **and** written with `PATCH /api/movie/:couple/state`
  (the Android app only polls the server, so the theatre also polls the room every 2 s).
- Stalls: if my video cannot keep up for 1.5 s, both of us pause ("buffering" action) and resume when it can.
- Drift: speed nudge ±5 % when 0.4–1.5 s off, one hard seek when further, nothing within 4 s of a seek or while buffering.

## Where the movie comes from (nothing is chosen twice)
- **device**: the file picked on Watch Together is handed over (web: postMessage, Android: the app's own stream). Each phone plays its own copy.
- **cloud**: the shared cloud movie (`GET /api/cinema/:session/movie` → signed URL). On an error a fresh URL is fetched and playback returns to the same second.
- **none / opened on its own**: a local file (no sync) or the 30 s demo clock.
- If nothing was handed over, the 🎞 button in the lobby / More menu picks a local copy (length must match within 3 s, like Watch Together).
- Cloud playback needs CORS on the movie bucket for this site: `GET, HEAD`, header `Range`.

## Scene vs movie
The cinema still has its own channel for the **scene** only (avatars, seats, chat, curtains, camera, `ctl` = which screen state you are in).
Play / pause / seek / position never travel on it: they go through the room.
- Start (both seated): curtains open, 3.2 s later the movie starts for both through the room.
- Pause / resume / break / seek / Watch again: written to the room; the partner's scene follows (a "loading" pause does not change the scene).
- Ad breaks: the room is paused while the ad runs, then resumed, so nobody loses movie time.
- End: *Leave theatre* / *Choose another movie* on the end screen ends the Twin Hearts session for both (watch history). Leaving mid-movie does not end it.

## Removed
Own clock/ping-pong, scheduled starts, `buf`/`sync`/`meta`/`seek` messages, same-file check between partners, auto-share upload to the cloud,
"next movie" picker bridge. (`/api/cinema/:id/share/*` on the server is now unused.)

While the theatre is open, the Twin Hearts movie page (web) and Android Movie screen stay quiet (no second player under the theatre).
