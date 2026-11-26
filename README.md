# Fayez Among Us

Fayez Among Us is a private 4–10 player browser social-deduction game aboard the Meridian salvage ship. The host starts matches from a walkable dropship. Crewmates complete tasks and vote while Impostors sabotage the ship. Optional roles start disabled. A host can also enable the mod-inspired Jester and Vulture, each with an independent win condition.

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
4. Four connected players are required to launch with one impostor. Two impostors require six players, and three require eight. Smaller groups can wait in the dropship. The captain can save lobby rules before launch.
5. **Space** uses the centered action for nearby stations, repairs, hatches, the emergency console and reportable incidents. Hold **Tab** to peek at the deck plan, or toggle it with **M** or the **Map** button. Use **V** near a hatch if your role can enter it. Impostors can use **Q** to attempt a nearby elimination. The **Chat** tab is available during meetings.
6. The host can select **Play Again** after the result. Share the same room code for the next flight.

## Verify

```sh
npm test
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
CHROMIUM_PATH=/usr/bin/chromium npm run test:neutrals
CHROMIUM_PATH=/usr/bin/chromium npm run test:instruments
```

The server tests cover room isolation, role secrecy, authoritative actions, and puzzle rules. The browser scenario uses five independent multiplayer contexts across consecutive rounds against the built client and relay. The instrument check also drives each browser task control against its server validator. Screenshots go to `test-results/screenshots` and `test-results/instruments` by default. Set `FAYEZ_SCREENSHOTS` to choose a different location. Use an installed Chromium executable or install Playwright Chromium and omit `CHROMIUM_PATH`. [PowerShell commands](docs/PC_HANDOFF.md#tests-and-release-verification)

## Deploy

GitHub Pages serves the built frontend. Render hosts the single-instance Socket.IO relay defined in `render.yaml`. The publishing workflow compares the relay's `/health` revision to `shared/deck.js` and checks the Pages origin before deploying. [Live frontend](https://fayezarcade.github.io/FayezAmongUs/) · [Live relay health](https://fayez-crew-relay.onrender.com/health)

For a release, use **Publish Fayez Among Us** on `main` and verify a room can be created and joined from separate browser sessions. See the handoff for configuration, the Pages source-HTML white-screen recovery, and the verification steps. [Deployment details](docs/PC_HANDOFF.md#github-pages-and-render)

To serve a built client locally with the standalone relay, run `npm run build` and `SERVE_CLIENT=1 npm start`, then open `http://localhost:3001`.

## Design and scope

- [Research and role references](RESEARCH.md)
- [Gameplay audit](docs/COMPLETE_GAMEPLAY_AUDIT.md)
- [Flight manual and concept art](docs/VISUAL-DESIGN.md)
- [Dropship update and screenshots](docs/DROPSHIP_UPDATE.md)
- [Character design and color order](docs/CHARACTERS.md)
- [Deck, meetings, and character scale comparisons](docs/MERIDIAN-DECK.md)
- [Expanded Meridian deck, room references, and gameplay captures](docs/MERIDIAN-EXPANSION.md)
- [Sabotage, Security, and multiplayer playtest screenshots](docs/GAMEPLAY-SYSTEMS.md)
- [Skeld task audit and genuine source links](docs/SKELD_TASK_REFERENCE_AUDIT.md)
- [Earlier match screenshots](docs/screenshots/)

`client` contains the Vite UI and Canvas renderer. `server` owns the match and Socket.IO protocol. `shared` holds the deck data, puzzle stations and role definitions. All ship art, suits, UI and cues were made for this project.
