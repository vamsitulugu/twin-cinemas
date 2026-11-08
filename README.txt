Fix: lobby frames now show the movies from the Library page (they live in each phone's browser storage, so the app hands them to the cinema in the link).
 us-app        : public/cinema-invite.js, CINEMA_SETUP.md      -> redeploy the app (Vercel: twinhearts)
 twin-cinemas  : src/lib-codec.js (new), src/invite.js, src/main.js, src/style.css  -> redeploy the cinema (Vercel)
(frames.js / lobby.js are unchanged from the last zip and already on your GitHub.)
Then open the cinema FROM the app again (Together -> Twin Cinema / invite) so the link carries the library.
