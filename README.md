# Fayez Crew

Fayez Crew is a private 4–10 player browser social-deduction game aboard the Meridian salvage ship. The captain starts a group match or a solo test from a walkable dropship. The crew completes assignments and votes on incidents while hidden infiltrators sabotage systems and pick off the crew. Optional roles start disabled.

## Play locally

Requires Node.js 22 or later. Run:

```sh
npm ci
npm run dev
```

Open the URL Vite prints. The dev server runs the relay on the same origin. On a trusted LAN, friends can use the displayed network URL if the host firewall permits it.

1. Select **CREATE ROOM**, enter your nickname and share the six-character code with friends.
2. Friends select **JOIN ROOM**, enter their nicknames and enter that code.
3. Move with **WASD** or **arrow keys**. Approach the GEAR terminal and use **E** to choose a unique color and equipment. Touch devices have a directional pad.
4. The captain can start a solo test with one player or a normal flight with four to ten connected players. Two and three players can share the lobby while waiting.
5. **E** interacts with nearby stations, repairs, hatches, the emergency console and reportable incidents. **M** opens the deck plan. Infiltrators can use **Q** to attempt a nearby elimination.
6. The captain can re-dock after the result. Share the same room code for the next flight.

## Solo testing

Create a room and press **START** while alone. After the countdown and role reveal, **Map** shows the same deck used for group matches. Every task station is available in solo mode. **Test controls** lets you select Engineer, Scientist, or Phantom to exercise untargeted abilities, trigger sabotage, clear hazards, and return to the same dropship. Finishing tasks or running out a sabotage timer keeps the test running.

## Verify

```sh
npm test
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

The server tests cover room isolation, role secrecy, authoritative actions, and puzzle rules. The browser scenario uses four separate Chromium contexts and the real built client and relay. It writes screenshots under `test-results/screenshots` by default. Set `FAYEZ_SCREENSHOTS` to choose a different location. Use an installed Chromium executable or install a Playwright Chromium build and omit `CHROMIUM_PATH`.

## Deploy

No production relay or Pages release is recorded here.

1. In the Render dashboard, create a Blueprint from [this repository](https://github.com/FayezArcade/FayezAmongUs) on `main`. Render reads `render.yaml`. It uses one instance, the Node HTTP server, `/health` and the Pages CORS origin. Rooms live in process memory. Render restarts, redeploys and sleeping instances discard active room state.
2. Wait for Render to report Live. Open `https://<service>.onrender.com/health` and confirm it returns `{"ok":true,"game":"Fayez Crew","deck":"meridian-2"}`. Keep the HTTPS origin without a path as the next step's value.
3. In GitHub repository settings, select **Pages → Build and deployment → GitHub Actions**. In **Secrets and variables → Actions → Variables**, create `FAYEZ_SERVER_URL` with the Render HTTPS origin. `CORS_ORIGIN` must contain the frontend origin only, such as `https://fayezarcade.github.io`, without the repository path.
4. Run **Actions → Publish Fayez Crew → Run workflow**. The workflow waits for the relay and checks its cross-origin handshake before publishing the client. HTTPS upgrades Socket.IO connections to secure WebSockets automatically.
5. Open the URL reported by the successful Pages deployment. Test creation and joining from separate browser sessions before sharing the link. The room form displays a connection state while Render wakes up.

To serve a built client locally with the standalone relay, run `npm run build` and `SERVE_CLIENT=1 npm start`, then open `http://localhost:3001`.

## Design and scope

- [Research and role references](RESEARCH.md)
- [Gameplay audit](docs/COMPLETE_GAMEPLAY_AUDIT.md)
- [Flight manual and concept art](docs/VISUAL-DESIGN.md)
- [Dropship update and screenshots](docs/DROPSHIP_UPDATE.md)
- [Character design and color order](docs/CHARACTERS.md)
- [Deck, meetings, and character scale comparisons](docs/MERIDIAN-DECK.md)
- [Earlier match screenshots](docs/screenshots/)

`client` contains the Vite UI and Canvas renderer. `server` owns the match and Socket.IO protocol. `shared` holds the deck data, puzzle stations and role definitions. All ship art, suits, UI and cues were made for this project.
