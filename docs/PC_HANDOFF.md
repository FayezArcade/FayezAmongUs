# Fayez Crew Windows development handoff

## Start here

Handoff baseline verified on November 24, 2026.

- Use the existing [FayezArcade/FayezAmongUs repository](https://github.com/FayezArcade/FayezAmongUs). Develop from `main`, which contains the current Meridian release and this handoff. [Public game](https://fayezarcade.github.io/FayezAmongUs/) · [Render relay health](https://fayez-crew-relay.onrender.com/health)
- The live gameplay revision is `meridian-3`. The stable gameplay and screenshot baseline is `c1523d90ba3ed3ce098a891ca242dca6171981fa`. Use `git log -1 -- docs/PC_HANDOFF.md` to find this handoff's own commit.
- The Chromebook's older line of work is preserved at `50a577aa1542a678a98835904d366ec95c0883ef` on `classic-dropship-solo`. Its tree matches the earlier Meridian release `df91427`, and `main` contains later work. Both source worktrees were clean and the stash was empty at handoff. There is no unpublished gameplay patch to recover. [Archived branch](https://github.com/FayezArcade/FayezAmongUs/tree/classic-dropship-solo)

| Baseline commits on `main` | What shipped |
| --- | --- |
| [`fc08e7b`](https://github.com/FayezArcade/FayezAmongUs/commit/fc08e7b) | Two-choice menu, walkable dropship, 18 suits, private room flow, solo practice. |
| [`df91427`](https://github.com/FayezArcade/FayezAmongUs/commit/df91427) | Meridian deck and map, station tasks, report and emergency cut-ins, voting tablet, character scale correction and clean front. |
| [`ea225d9`](https://github.com/FayezArcade/FayezAmongUs/commit/ea225d9fc2612bfe1902ccf7e9d9f1fc627d25c2) | Corridor and shutter pass, task-stage updates, Space, top-right Map, and meeting-only chat. |
| [`c1523d9`](https://github.com/FayezArcade/FayezAmongUs/commit/c1523d90ba3ed3ce098a891ca242dca6171981fa) | Skeld task audit, measured scale comparisons, and verified in-game capture gallery. |
| [`b928da4`](https://github.com/FayezArcade/FayezAmongUs/commit/b928da42cea1d37ce19838f30090e4181358a37e) | Handoff browser-test adjustments for badge marker visibility, shutter clearance and the distributor approach. |

## Set up on Windows

Open the cloned repository folder in the Codex Windows app. Use Git and Node.js 22 or later. These commands use PowerShell and the Windows npm launcher.

```powershell
git clone https://github.com/FayezArcade/FayezAmongUs.git
Set-Location FayezAmongUs
git switch main
git status --short --branch
node --version
npm.cmd ci
npm.cmd run dev
```

Open the URL Vite prints, typically `http://localhost:5173`. Vite attaches the Socket.IO relay on the same origin, so a fresh clone needs no API key, database, Render credential, or `.env` file. The saved nickname is browser-local. Use independent browser profiles or private contexts for multiplayer tests. On a trusted LAN, use the network URL printed by Vite and permit the test port through Windows Firewall if needed.

Stop the dev server with Ctrl+C before starting a standalone built client on the same terminal. With no `VITE_SERVER_URL` override, `npm.cmd run build` followed by `$env:SERVE_CLIENT = '1'` and `npm.cmd start` serves both the build and local relay at `http://localhost:3001`. Keep a production relay URL out of local Vite settings when you intend to create test rooms on your PC.

## Current gameplay and code map

| Area | Behavior and entry point |
| --- | --- |
| Menu and dropship | Two choices, **Create Room** and **Join Room**. The captain copies a six-character private code, changes settings, and starts from a walkable original dropship. The laptop gates the full color locker, accessory choice and optional name display. Seats and crates have lobby collision. [Dropship design and captures](DROPSHIP_UPDATE.md) |
| Flight and result | Current flights require 4–10 connected players and satisfy the selected infiltrator-count rule. Smaller groups can wait in the lobby. The launch countdown leads to a private role reveal, then Cafeteria spawn. Tasks, ejection, parity and unrepaired critical sabotage drive outcomes. The captain can return everyone to the same room code for another round. |
| Controls and HUD | WASD, arrows and the touch pad move. **Space** or the centered on-screen action handles the locker, tasks, repairs, hatches, consoles, reports and emergency meetings according to context. A focused form or panel retains its keyboard input. **M** or the top-right Map button toggles the plan. **Q** attempts an eligible close-range elimination and **R** is the direct report shortcut. Current room and task preview are top left, shared progress is top center, and role controls are bottom right. |
| Meetings | Separate emergency and report introductions feed a common tablet. A megaphone marks a body reporter. Discussion defaults to 30 seconds and voting to 60, with independent host settings. Ballots support skip, ties, confirmation, optional early end, anonymity, and configurable team reveal. Chat and Ballot tabs share the visible timer. Unread counts, draft retention, mute, server throttling, room isolation and ghost filtering are in place. Chat opens after the intro and is limited to meetings. |
| Client and shared data | [`client/main.js`](../client/main.js) owns the UI, input and room session. [`client/art.js`](../client/art.js) renders the 2D Canvas scene, line-of-sight shading, suits and map. [`client/tasks.js`](../client/tasks.js) handles the instrument interactions. [`shared/deck.js`](../shared/deck.js) provides geometry, stations and palettes. [`shared/roles.js`](../shared/roles.js) lists role rules and defaults. |
| Relay and match state | [`server/index.js`](../server/index.js) hosts Socket.IO and `/health`. [`server/game.js`](../server/game.js) owns rooms, movement, assignments, combat, sabotage, voting and outcomes. [`server/puzzles.js`](../server/puzzles.js) validates task steps. Movement is normalized input, with a 33 ms simulation tick and recipient-specific snapshots about every 66 ms. The client interpolates rendered positions. `enter`, `move` and `command` are the main socket events. `enter` checks `deckRevision` so incompatible clients and relays fail explicitly. |
| Privacy and recovery | The server filters visible players, hidden roles, masks, tactical data, tasks and meeting chat per recipient. The resume token stays in session storage and has about a 45-second disconnect lease. Host migration and rejoin work within the same live relay process. Ghost crew can move through walls and still finish tasks. |
| Optional roles | Engineer, Scientist, Tracker, Noisemaker, Detective, Judge, Guardian Angel, Influencer, Shapeshifter, Phantom and Viper are wired into the host settings and server. All start disabled. Their current mechanics and scope limits are tracked in the [role research](../RESEARCH.md) and the backlog below. |
| Internal testing | Automated browser and Socket.IO tests create real multiplayer lobbies. The dedicated instrument harness exercises each task with its server validator outside the public game. |

## Map, doors and character requirements

Keep one original top-down 2D ship. The familiar Skeld movement flow informs Meridian while room cuts, furniture, shapes and artwork remain original. Retain room-specific colors and equipment, readable starfield boundaries, floor seams, thick outlines and wall-aware vision.

- The western Cafeteria hall reaches Upper Engine and branches to MedBay. Upper and Lower Engine share a vertical spine, with Reactor and Security to either side. Electrical branches north from the Lower Engine–Storage corridor.
- Cafeteria's south trunk reaches the Admin spur and Storage. The cargo hall links Storage and Shields and branches into Communications. Cafeteria's east passage reaches Weapons. Its eastern trunk branches to O2 and Navigation, then runs south to Shields. Avoid new shortcut connections and false doors.
- All 14 room footprints, 22 open thresholds and 13 sabotage shutters come from `shared/deck.js`. Use its `routes`, `corridors`, `entrances`, `doors`, `walkable` and `clearDeckLine` when changing openings. A sabotage shutter rejects an obstructed closure and normally reopens after 9.5 seconds. Keep physical art, player radius, vent paths, spawns, collision, line of sight, station markers and authoritative action ranges aligned. Use [`test/deck-route.mjs`](../test/deck-route.mjs) for route verification.
- The blue map shows the same room and corridor footprints, current player location, unfinished task stations, closed doors and active repairs. The sabotage plan uses the same geometry and shows its tactical controls to eligible players. [Deck notes and measured gameplay comparisons](MERIDIAN-DECK.md)
- Use a compact, rounded bean suit, one large horizontal pale-blue visor, a small offset backpack, two short separated legs, thick dark outlines and simple shading darker at the bottom. The opaque visor conceals the face. Keep the front clean and free of chest or belly panels, buttons and badges. Preserve the original renderer across the drifting menu suits, locker, lobby, ship, meetings, voting, role reveal, ghosts and results. Keep four-way walk poses, a stable standing pose, launch and role poses, and ghost motion without changing the silhouette's proportions.
- The palette order is **Red, Blue, Green, Pink, Orange, Yellow**, then **Black, White, Purple, Brown, Cyan, Lime**, then **Maroon, Rose, Banana, Gray, Tan, Coral**. The server enforces one player per color in a room. Keep labels legible and preserve nickname and accessory synchronization. [Character design and 18-color captures](CHARACTERS.md)
- World drawing scale is `0.67`, movement radius is 9 world units, camera zoom is capped at `1.52`, and the normal corridor width is 74 units. The suit is roughly 34 world units high and 25 wide. The central table width is 112, Reactor equipment is 78 wide and the Electrical wall bank spans 164. Current comparisons are about 30% suit height to center tabletop, 34% suit width to corridor, 44% suit height to Reactor machinery and 21% suit height to Electrical panels. Use comparable framing and exclude hats and name labels when measuring. Keep wall collision and interaction ranges in world units if the view changes.

## Skeld task requirements and current coverage

The [Skeld task reference audit](SKELD_TASK_REFERENCE_AUDIT.md) records the original control, completion rule, rooms, stages, visual status and genuine capture or video links for each of the 21 task/stage entries. The game has 42 registered assignment variants. User-provided images are visual direction for original work. Keep task research tied to actual Skeld footage or stills. The [requested video](https://www.youtube.com/watch?v=Mj6tdAjFWOo) was inaccessible to the Chromebook session. [Earlier video comparison and fallback sources](VISUAL_COMPARISON.md)

| Station group | Keep these tasks and rules |
| --- | --- |
| Common work | **Fix Wiring** matches four color-coded leads by drag or select-pair. Meridian has three ordered three-panel routes covering Electrical, Storage, Admin, Navigation, Cafeteria and Security. **Swipe Card** is in Admin and validates a steady swipe. |
| Data and electrical power | **Download Data** starts in Cafeteria, Communications, Electrical, Navigation or Weapons and **Upload Data** completes in Admin. Both are timed. **Divert Power** starts in Electrical and **Accept Diverted Power** completes at the designated relay in Communications, either Engine, Navigation, O2, Security, Shields or Weapons. |
| Reactor and Electrical | **Calibrate Distributor** uses three timed readings. **Start Reactor** repeats an expanding sequence. **Unlock Manifolds** requires ascending order on the shuffled keypad. |
| MedBay | **Submit Scan** is a held scanner action. **Inspect Sample** starts a server timer, survives closing the panel or a meeting, and asks for the anomalous tube when analysis completes. |
| Weapons, Navigation, Shields and O2 | **Clear Asteroids** targets moving debris. **Stabilize Steering** aligns the crosshair. **Chart Course** traces ordered waypoints. **Prime Shields** turns all cells on. **Clean O2 Filter** removes debris by drag or assisted tap. |
| Engineering, waste and vents | **Align Engine Output** uses both Engines. **Fuel Engines** alternates Storage with Upper Engine then Lower Engine. **Empty Garbage** starts in Cafeteria and **Empty Chute** in O2. Both finish in Storage using the disposal lever. **Clean Vent** is assigned to one of Meridian's existing hatches and blocks use of that hatch during cleaning. |

Maintain server validation of phase, distance, stage, line of sight, timing and authorization. Keep the next stage marker visible after a successful intermediate step, then remove it and credit the shared task bar on completion. Preserve interruptions during meetings and comms sabotage, prior stage credit, ghost crew access and impostor cover tasks without team credit. Retain feedback, cancel/retry, mouse and touch, and keyboard alternatives. Nearby living crew work has local effects for scanner use, weapon hits, shield lights and final waste ejection. Fayez uses shorter timers and fewer weapon hits than the reference.

## Known gaps and outstanding work

The current release covers the requested room flow, menus, suits, task families, Space controls, meetings and solo/multiplayer loop. Open items below distinguish missing functionality from evidence or coverage that still needs work.

| Area | Remaining work or limitation |
| --- | --- |
| Pages white screen during publishing | GitHub still reports `legacy` Pages from `main:/`. Its automatic branch job can publish the root Vite source rather than the built bundle. This has produced a temporary white screen and can persist after documentation-only pushes, since those changes skip the custom workflow's path filter. The custom publish workflow restores the built site. Changing the Pages source needs repository-owner access. |
| Requested gameplay video | Obtain accessible playback or user-provided timestamps/frames if that particular recording is still needed. Identify confirmed Skeld segments first, then study camera, walks, collisions, room props, tasks and meetings. No timings or observations from that video are claimed. Current comparison sources are genuine stills and separately identified official trailer frames. |
| Scale and geometry polish | The remaining measured corridor/door and satellite table proportions differ from the reference. Play-deck props, including tables, are generally decorative while lobby furniture has collision. If adding solid play-deck furniture, audit the remaining walking lanes, spawns, interaction reach, line of sight and touch behavior together. |
| Task and sabotage browser coverage | Server tests cover all registered puzzle validators and stage order. Finish dedicated pointer, keyboard and touch scenarios for the remaining instruments, and browser cases for ghost task credit, meeting/comms interruption, simultaneous hatch use, oxygen and reactor repairs, and additional shutter placements. Electrical's vent and distributor are close together. The nearest-action prompt can select the other task when approaching from the west. Verify station spacing and overlay markers together before changing that placement. |
| Task and monitoring parity | The three authored wiring routes cover the six stations. The reference has additional combinations. Current visual-task effects have no host toggle. Security lists who is in sectors and Admin gives anonymous room counts. Live camera feeds remain unimplemented. Match new task settings or feeds with privacy tests before shipping them. |
| Optional-role and load coverage | Detective uses recent sightings and incident notes instead of an incident-time case file, interrogation limits or suspicion zones. Shapeshifter has a temporary disguise but no configurable transformation trace. Additional dedicated role-browser tests and loss/latency playtests are open. Ten-player lobby capacity is tested. A full ten-player live match and touch-device playtest remain open. |
| Hosting constraints | One Render process holds rooms in memory. Redeploys, restarts and expiry lose that state, and a cold relay can delay room entry or require a retry. There is no cross-process room recovery. The current scope is private codes and one ship. |

The [earlier gameplay audit](COMPLETE_GAMEPLAY_AUDIT.md) and [early visual guide](VISUAL-DESIGN.md) are historical. Use this handoff and [the latest deck notes](MERIDIAN-DECK.md) for release status, the clean 18-color suit, the current wiring stages and meeting-only chat.

## Visual references and evidence

- The repository preserves original project design boards as editable SVGs with a contact sheet, and real browser captures of the menu, lobby, 18-color picker, solo and multiplayer sessions, ship, tasks, reports and voting. The latest files include a Cafeteria and corridor before/after and open/closed door captures. [Original concept boards](references/) · [Current release captures](screenshots/passage-hud/) · [Character captures](screenshots/characters/) · [Dropship captures](screenshots/dropship/)
- Keep third-party game art, extracted frames and screenshots as source links for research. Fayez Crew uses its own play assets. The user-provided palette and lobby images are described in the design notes, and the supplied scale examples are supplemented with accessible publisher captures. [Official gallery](https://innersloth.itch.io/among-us) · [Official Steam trailer](https://store.steampowered.com/app/945360/Among_Us/) · [Skeld map/reference index](https://among-us.fandom.com/wiki/The_Skeld) · [Active task gallery](https://www.bluestacks.com/blog/game-guides/among-us/au-skeld-task-guide-en.html) · [MobyGames gameplay screenshots](https://www.mobygames.com/game/149316/among-us/screenshots/)
- The side-by-side [deck comparison](MERIDIAN-DECK.md) links the genuine Cafeteria, Weapons corridor, Electrical and Reactor stills. The [earlier visual comparison](VISUAL_COMPARISON.md) links the original publisher captures for the lobby, task and ballot. The [task audit](SKELD_TASK_REFERENCE_AUDIT.md) links the original minigame frames individually.

## Tests and release verification

The handoff baseline passed **51 automated tests** across eight Socket.IO scenarios, 42 registered task variants and a shared-geometry check. The socket suite includes ten-player lobby capacity. The production bundle built successfully. The browser scenario passed four simultaneous Chromium contexts and a fifth solo context, covering reload, chat switching and mute, voting, keyboard interaction, narrow-screen UI, shutter closure and reopening, and pointer task flows. The scale script captured a suit beside the Cafeteria table and in the Weapons hallway. A separate production smoke test verified the Pages bundle revision, Render health and creating/joining a private room from two browser sessions. [Last gameplay Verify run](https://github.com/FayezArcade/FayezAmongUs/actions/runs/45384302206) · [Last gameplay Publish run](https://github.com/FayezArcade/FayezAmongUs/actions/runs/45384301841)

Run these in the Windows clone. Use Playwright-managed Chromium by default. To use an existing Chrome or Edge installation, set `$env:CHROMIUM_PATH` to its verified `.exe` path and skip the browser installation command.

```powershell
npm.cmd test
npm.cmd run build
npm.cmd exec -- playwright-core install chromium
$env:FAYEZ_SCREENSHOTS = 'test-results/windows-handoff'
npm.cmd run test:browser
$env:FAYEZ_SCREENSHOTS = 'test-results/windows-scale'
node test/scale.mjs
```

Windows was the handoff destination. The test runs recorded here were made in the source environment. If a Windows Node shell reports no matches for the npm test glob, run `node --test test/multiplayer.test.js test/puzzles.test.js` directly. Generated `test-results/`, `dist/` and `node_modules/` are ignored and recreated as needed.

## GitHub Pages and Render

| Setting | Current configuration |
| --- | --- |
| Source and production URLs | Repo branch `main`, Pages at [fayezarcade.github.io/FayezAmongUs](https://fayezarcade.github.io/FayezAmongUs/), Relay at [fayez-crew-relay.onrender.com](https://fayez-crew-relay.onrender.com/health). |
| Frontend artifact | Vite writes `dist/` with a relative base. Repository Actions variable `FAYEZ_SERVER_URL` is the public HTTPS Render origin, with no path. It is bundled as `VITE_SERVER_URL`. A root document containing `src="/client/main.js"` is source HTML. The deployed bundle should load an `assets/` JavaScript file. |
| Render Blueprint | [`render.yaml`](../render.yaml) defines one free Node web service on Node 22.16.0. Build is `npm ci --omit=dev` and start is `npm start`. Render supplies `PORT`; local default is 3001. `CORS_ORIGIN` is `https://fayezarcade.github.io` without the project path. Health is `{"ok":true,"game":"Fayez Crew","deck":"meridian-3"}`. |
| Verify workflow | [`verify.yml`](../.github/workflows/verify.yml) runs Node 22 install, automated tests and build on pushes and PRs. The interactive Chromium suite is run separately. |
| Publish workflow | [`pages.yml`](../.github/workflows/pages.yml) runs on relevant `main` changes or manual dispatch. It checks relay revision and cross-origin Socket.IO polling, builds the client, uploads `dist/`, then deploys to the `github-pages` environment. The workflow allows a short wait for the Render rollout. |

For a map/protocol release, keep the client and relay revision synchronized in `shared/deck.js`. Check Render `/health`, then wait for **Publish Fayez Crew** to succeed. If the public site is blank, first inspect its HTML. If it loads the source entry, open **Actions → Publish Fayez Crew → Run workflow**, selecting `main`, or run `gh workflow run pages.yml --ref main --repo FayezArcade/FayezAmongUs`. Verify the artifact URL again after deploy. If the menu loads but joining fails, check the relay, its reported deck, the Pages origin/CORS and the actual room flow before changing the UI.

## Recommended continuation

1. Clone `main` on the PC, open this file in Codex, and run the PowerShell baseline above. Keep the backup branch available for history. Verify that a lobby blocks launch with fewer than four connected players. With four sessions, start a round and exercise an emergency, a report and a vote.
2. Use the repository owner's browser to inspect **Settings → Pages → Build and deployment**. If it still shows branch deployment, set the source to **GitHub Actions** and run **Publish Fayez Crew** on `main`. Confirm the public URL serves the built asset and two independent profiles can share a room. This is the most direct follow-up for the previous white screen.
3. For gameplay follow-up, branch from the current `main` and start with a focused browser case for the specific issue. The highest-value remaining coverage is ghost/comms task interruptions, touch input, and a full ten-player match. Update shared geometry and station validation together for any map change. Use the linked reference frames before adjusting scale.
4. Keep each release's visible UI and resulting match under test. Run the Node tests, build and Chromium scenario before pushing. Check both Actions jobs, Render health and the public site afterward. Save actual Fayez Crew captures with the change and link external research sources at their publishers.
