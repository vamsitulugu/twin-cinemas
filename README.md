# Twin Cinema
A 3D cinema for two people in different places: meet at the door, walk in, pick seats, share popcorn, chat above your heads, and watch together with synced playback.

## Run
    npm install
    npm run dev        # also reachable from your phone via the printed network URL
    npm run build      # deploy the dist folder (Vercel: framework preset Vite)

## Two people, two places
1. Create a Supabase project. Settings > API: copy the URL and anon key. Realtime broadcast needs no tables.
2. Copy `.env.example` to `.env` and fill both values. On Vercel add the same two variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
3. Share a room link like https://your-site/#our-room. One of you picks Person 1, the other Person 2.
Without the .env values it runs in local test mode (two tabs of the same browser).

## The movie
Each of you picks the SAME video file with "Choose movie". Only controls sync (start, pause, break, seek, drift correction), not the video itself. No file = a 30 s demo.

## Controls
WASD / arrows / tap floor / on-screen joystick (phones) to walk; drag to look; tap a seat then Sit here. Menu: Start, Pause, Break, Screen, Full screen, 360, Sound, Popcorn, emotes, chat, Leave.

## Structure
src/state.js   story state machine (door > enter > explore > seated > watch <> paused/break > end)
src/hall.js    hall, seats, screen, curtains, lobby, lighting, collision
src/camera.js  camera shots: door, follow, seat, orbit 360, screen, couple, full
src/avatar.js  rigged GLB avatars, procedural walk/sit/wave, seated audience
src/player.js  a person in the hall (me or partner): move, sit, stand, popcorn
src/net.js     Supabase Realtime room, presence heartbeat (BroadcastChannel fallback)
src/video.js   movie source (file or demo), play/pause/seek, drift correction
src/audio.js   synthesized sounds (room tone, door, chat, crunch, chime)
public/models  avatar_f.glb, avatar_m.glb (swap in your own rigged models with Mixamo bone names)
