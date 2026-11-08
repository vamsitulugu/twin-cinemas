# Cinema ⇄ Twin Hearts: the same movie in 3D
Opened from Twin Hearts **3D movie** (Watch Together → both ready), the cinema asks the Twin Hearts backend which movie you picked (`GET /api/cinema/:session/movie`):
- **cloud** → plays straight from a signed URL (needs CORS on the movie bucket for this site: GET/HEAD, header Range)
- **device** → the lobby asks both of you to choose your own copy of that movie (length must match within 3 s), then the host presses Start
- **none** → works as before (demo clock / choose a file)

## Auto-share: nobody chooses the movie twice
When one phone/browser has the movie (picked on Watch Together, or chosen once in the lobby) and the partner does not, the theatre uploads it **once** to the shared cloud and the partner streams it by itself.
- 7 s after a movie is loaded, if the partner has not reported the same movie, the theatre calls `POST /api/cinema/:id/share/init` → `/parts` → `/complete` (Twin Hearts backend, same Cloudflare R2 multipart upload as Watch Together cloud). `complete` sets the room's `shared_movie_id`, so `GET /api/cinema/:id/movie` answers `mode:'cloud'` for both phones.
- The lobby panel shows "Sharing the movie with your partner… 37%" / "Your partner is sharing the movie with you… 37%"; the partner then loads the cloud copy automatically and **Start movie night** unlocks. A phone that joins late (or missed the message) polls every 5 s until the cloud copy exists.
- If sharing is not possible (not Pro, no space, no R2 CORS…) nothing breaks: the old "choose your copy" flow stays.
- **Required once:** the R2 bucket needs CORS for the theatre site:
  `AllowedOrigins`: `https://twin-cinemas.vercel.app` (and your Twin Hearts web origin) · `AllowedMethods`: `GET, HEAD, PUT` · `AllowedHeaders`: `*` · `ExposeHeaders`: `ETag, Content-Range, Content-Length, Accept-Ranges`.
- Backend env: `CINEMA_AUTO_SHARE_FREE=1` lets free couples auto-share too (default: Pro only, like the cloud library); `CINEMA_SHARE_TTL_HOURS` (default 48) removes auto-shared movies later.
