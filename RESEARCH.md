# Classic social deduction research

Innersloth describes a race between crew maintenance and hidden opponents. Crew win through collective task completion or ejection of all opponents. Information comes from observation, shared meetings, the Admin display, and cameras. Opponents get private roles, disguisable downtime, shortcuts and sabotage. [Official gameplay guide and screenshots](https://www.innersloth.com/games/among-us/)

The classic ship creates alibis with rooms, short corridors, alternate routes and isolated workstations. Classic tasks range from brief manipulation (card swipe) to multistep maintenance (fuel and data transfers). An emergency can interrupt a planned route and pull people to different stations. The report and emergency button converge on the same discussion-and-vote loop. Innersloth's beginner guide discusses card swipe on The Skeld, fixing lights, vent sightings, and the evidentiary role of visual tasks. [Innersloth beginner guide](https://innersloth.zendesk.com/hc/en-us/articles/7794240573460-Beginner-s-Guide-to-Among-Us)

The official gameplay page includes gameplay imagery and embedded video. The available source also included a classic Skeld gameplay listing. Full-motion playback and sound-by-sound review were unavailable in this research pass. Published imagery was used as a reference source only. [Classic Skeld footage listing](https://www.youtube.com/watch?v=UUTm92aU68g)

## Fayez Among Us implementation

A compact two-action menu leads to a walkable salvage shuttle. Color and gear are applied while players move in shared space. The original Meridian ship is a transit grid with a central Hub, an outlying Atmos station and a U-shaped route to the industrial deck. Doors and bulkheads control line of sight, while service hatches shorten cross-deck trips. Each equipment bay has a recognizable prop silhouette and accent.

Captain and crew language, original equipment panels, cyan/amber flight instrumentation and round pressure suits give the game its own visual identity. A private role card starts each round. Incidents prompt an intercom meeting, a timed ballot and an airlock result. Gameplay cues are synthesized with Web Audio. The server owns movement, assignments, puzzle transitions, sabotage, votes and results. Local rendering interpolates other players between snapshots.

## Role research as of November 2026

The primary sources are Innersloth announcements for the main desktop/mobile/console game. Spawn rates, ability timing and several limits are lobby configuration. Universal timing defaults for the current build were unavailable in the official announcements.

| Role | Official Classic behavior | Fayez Among Us rule |
| --- | --- | --- |
| Crewmate | Maintain the ship, report incidents, discuss and vote. | Receives shared common assignments and randomized station assignments. |
| Impostor | Blend in, eliminate at close range, vent and sabotage. | Receives cover tasks. The server gates range, team, line of sight and cooldown. |
| Crewmate ghost | Continue assigned maintenance after death. | Can pass walls, complete tasks and use ghost chat. |
| Impostor ghost | Can cause disruption after death. | Can sabotage. Cannot eliminate, vote or report. |
| Engineer | Use vents as a crewmate. Duration and cooldown are configurable. | Activate at a hatch for a travel window, then surface automatically. |
| Scientist | Open remote vitals. Task completion recharges its battery. | Completing an assignment restores a spent charge. Vitals have duration and cooldown. |
| Guardian Angel | Use a shield to protect a living crewmate. | Range, duration, cooldown and consumption on a blocked strike. |
| Shapeshifter | Take the appearance of another crewmate for a limited time. | Temporary disguise with a new visual identity. No configurable egg trace. |
| Tracker | Track someone's position on the map for a limited time. | Proximity tag and delayed private map position. Comms disrupt it. |
| Noisemaker | Trigger a sound and position indicator on elimination. | Time-limited position alert. |
| Phantom | Turn invisible for a limited time. | Position withheld from living opponents. Strike ends the cloak. |
| Detective | Track a case and interrogate players about their position during the incident. The official settings allow a per-case interrogation limit. | Record a nearby incident, examine recent room sightings, and retain private notes. |
| Viper | Elimination evidence dissolves across several stages. Decay timing is configurable. | Decaying original suit prop, configurable decay duration and strike cooldown. |
| Judge | Unlock Overrule by completing tasks. First valid Overrule overrides one ballot. A wrong accusation ejects the Judge. | One completed assignment unlocks it. Wrong calls eject the Judge. One valid override per ballot. |
| Influencer | Send up to three randomly offered images to a living crewmate. Refreshes are limited. | Five randomly dealt original symbols, three selections at most, one refresh per flight and a private recipient. |

Sources by feature generation. [2021 roles](https://www.innersloth.com/new-roles-cosmicubes-out-now-emergency-meeting-33/) · [2024 roles](https://www.innersloth.com/new-roles-enter-the-fray-v2024-6-18--emergency-meeting-38/) · [Detective and Viper](https://www.innersloth.com/new-roles-are-on-the-scene-of-17-0-0-emergency-meeting-41/) · [Judge](https://www.innersloth.com/new-crewmate-role-the-judge-emergency-meeting-43/) · [Influencer](https://www.innersloth.com/new-ghost-crewmate-role-the-influencer-emergency-meeting-44/) · [Current mobile patch listing](https://www.innersloth.com/category/among-us/)

## Classic ship audit

The Skeld groups main movement around a central Cafeteria with longer routes through engines and the industrial side of the ship. Admin provides counts, Security provides camera views, and Electrical, Navigation and Storage create destinations with different sightlines and traffic. Vent circuits skip walks through some corridors. Doors briefly break routes. Lights constrain crew sight. Comms interrupt task and monitoring information. Oxygen and Reactor have time-limited recovery, and a reported body clears the critical emergency. The emergency button is limited and unavailable during an active system failure. Meetings separate discussion from a timed ballot, allow abstaining via Skip and can end without a removal through a tie. [Official beginner guide](https://innersloth.zendesk.com/hc/en-us/articles/7794240573460-Beginner-s-Guide-to-Among-Us) · [Skeld gameplay captures](https://www.mobygames.com/game/149316/among-us/screenshots/) · [Innersloth settings notes](https://www.innersloth.com/a-match-made-in-update-16-0-0-emergency-meeting-40/)

The Skeld task catalogue includes card and wires; data transfer, power divert, calibration, course plotting, intake and vent cleaning, asteroid targeting, shields, steering and manifolds; and engine alignment, waste, fueling, sample inspection, reactor and med scan. Community sources differentiate the release-era list and later additions such as vent cleaning. Each Fayez Among Us task uses its own stations, art and thresholds. The game retains long-task station credit through meetings. [Skeld task index](https://among-us.fandom.com/wiki/Category%3AThe_Skeld_tasks) · [Illustrated task guide](https://www.bluestacks.com/blog/game-guides/among-us/au-skeld-task-guide-en.html) · [Task playthrough index](https://www.youtube.com/watch?v=VDLy2jI2_9A)

The visual review used official itch.io screenshots and sampled footage from Innersloth's Steam release trailer. [Visual comparison](docs/VISUAL_COMPARISON.md) · [Innersloth itch.io page](https://innersloth.itch.io/among-us) · [Official Steam listing](https://store.steampowered.com/app/945360/Among_Us/)
