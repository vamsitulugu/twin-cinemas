Lobby movie frames — copy each folder's files over the same paths in the matching repo.
 us-app        : routes/cinema.js (new GET /api/cinema/:id/library), tests/cinema.test.js   -> redeploy the backend (Render)
 twin-cinemas  : src/frames.js (new), src/lobby.js, src/main.js, src/invite.js, src/style.css -> redeploy the cinema (Vercel)
Check backend: node tests/cinema.test.js  (15 pass)
