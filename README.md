# Fayez Crew

Fayez Crew is a private 4–10 player browser social-deduction game aboard the Meridian salvage ship. The captain starts a group match or a solo test from a walkable dropship. The crew completes assignments and votes on incidents while hidden infiltrators sabotage systems and pick off the crew. Optional roles start disabled.

[Play the live game](https://fayezarcade.github.io/FayezAmongUs/) · [Windows development handoff](docs/PC_HANDOFF.md)

## Play locally

Requires Node.js 22 or later. Run:

```sh
npm ci
npm run dev
```

Open the URL Vite prints. The dev server runs the relay on the same origin. On a trusted LAN, friends can use the displayed network URL if the host firewall permits it.

1. Select **CREATE ROOM**, enter your nickname and share the six-character code with friends.
2. Friends select **JOIN ROOM**, enter their nicknames and enter that code.
3. Move with **WASD** or **arrow keys**. Approach the GEAR terminal and use **Space** to choose a unique color and equipment. Touch devices have a directional pad and an on-screen action.
4. The captain can start a solo test with one player or a normal flight with four to ten connected players. Two and three players can share the lobby while waiting.
5. **Space** uses the centered action for nearby stations, repairs, hatches, the emergency console and reportable incidents. **M** or the top-right **Map** button toggles the deck plan. Infiltrators can use **Q** to attempt a nearby elimination. The **Chat** tab is available during meetings.
6. The captain can re-dock after the result. Share the same room code for the next flight.

## Solo testing

Create a room and press **START** while alone. After the countdown and role reveal, **Map** shows the same deck used for group matches. Every task station is available in solo mode. **Test controls** lets you select Engineer, Scientist, or Phantom to exercise untargeted abilities, trigger sabotage, clear hazards, and return to the same dropship. Finishing tasks or running out a sabotage timer keeps the test running.

## Verify

```sh
npm test
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
CHROMIUM_PATH=/usr/bin/chromium npm run test:instruments
```

The server tests cover room isolation, role secrecy, authoritative actions, and puzzle rules. The browser scenario uses four independent multiplayer contexts and a separate solo context against the built client and relay. The instrument check also drives each browser task control against its server validator. Screenshots go to `test-results/screenshots` and `test-results/instruments` by default. Set `FAYEZ_SCREENSHOTS` to choose a different location. Use an installed Chromium executable or install Playwright Chromium and omit `CHROMIUM_PATH`. [PowerShell commands](docs/PC_HANDOFF.md#tests-and-release-verification)

## Deploy

GitHub Pages serves the built frontend. Render hosts the single-instance Socket.IO relay defined in `render.yaml`. The publishing workflow compares the relay's `/health` revision to `shared/deck.js` and checks the Pages origin before deploying. [Live frontend](https://fayezarcade.github.io/FayezAmongUs/) · [Live relay health](https://fayez-crew-relay.onrender.com/health)

For a release, use **Publish Fayez Crew** on `main` and verify a room can be created and joined from separate browser sessions. See the handoff for configuration, the Pages source-HTML white-screen recovery, and the verification steps. [Deployment details](docs/PC_HANDOFF.md#github-pages-and-render)

To serve a built client locally with the standalone relay, run `npm run build` and `SERVE_CLIENT=1 npm start`, then open `http://localhost:3001`.

## Design and scope

- [Research and role references](RESEARCH.md)
- [Gameplay audit](docs/COMPLETE_GAMEPLAY_AUDIT.md)
- [Flight manual and concept art](docs/VISUAL-DESIGN.md)
- [Dropship update and screenshots](docs/DROPSHIP_UPDATE.md)
- [Character design and color order](docs/CHARACTERS.md)
- [Deck, meetings, and character scale comparisons](docs/MERIDIAN-DECK.md)
- [Expanded Meridian deck, room references, and gameplay captures](docs/MERIDIAN-EXPANSION.md)
- [Skeld task audit and genuine source links](docs/SKELD_TASK_REFERENCE_AUDIT.md)
- [Earlier match screenshots](docs/screenshots/)

`client` contains the Vite UI and Canvas renderer. `server` owns the match and Socket.IO protocol. `shared` holds the deck data, puzzle stations and role definitions. All ship art, suits, UI and cues were made for this project.
