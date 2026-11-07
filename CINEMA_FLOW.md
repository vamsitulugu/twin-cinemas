# Cinema ⇄ Twin Hearts: the same movie in 3D
Opened from Twin Hearts **3D movie** (Watch Together → both ready), the cinema asks the Twin Hearts backend which movie you picked (`GET /api/cinema/:session/movie`):
- **cloud** → plays straight from a signed URL (needs CORS on the movie bucket for this site: GET/HEAD, header Range)
- **device** → the lobby asks both of you to choose your own copy of that movie (length must match within 3 s), then the host presses Start
- **none** → works as before (demo clock / choose a file)
