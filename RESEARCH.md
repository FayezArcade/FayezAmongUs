# Classic social deduction research

Innersloth describes a race between crew maintenance and hidden opponents. Crew win through collective task completion or ejection of all opponents. Information comes from observation, shared meetings, the Admin display, and cameras. Opponents get private roles, disguisable downtime, shortcuts and sabotage. [Official gameplay guide and screenshots](https://www.innersloth.com/games/among-us/)

The classic ship creates alibis with rooms, short corridors, alternate routes and isolated workstations. Classic tasks range from brief manipulation (card swipe) to multistep maintenance (fuel and data transfers). An emergency can interrupt a planned route and pull people to different stations. The report and emergency button converge on the same discussion-and-vote loop. Innersloth's beginner guide discusses card swipe on The Skeld, fixing lights, vent sightings, and the evidentiary role of visual tasks. [Innersloth beginner guide](https://innersloth.zendesk.com/hc/en-us/articles/7794240573460-Beginner-s-Guide-to-Among-Us)

The official gameplay page includes gameplay imagery and embedded video. The available source also included a classic Skeld gameplay listing. Full-motion playback and sound-by-sound review were unavailable in this research pass. Published imagery was used as a reference source only. [Classic Skeld footage listing](https://www.youtube.com/watch?v=UUTm92aU68g)

## Fayez Crew implementation

A compact two-action menu leads to a walkable salvage shuttle. Color and gear are applied while players move in shared space. The original Meridian ship is a transit grid with a central Hub, an outlying Atmos station and a U-shaped route to the industrial deck. Doors and bulkheads control line of sight, while service hatches shorten cross-deck trips. Each equipment bay has a recognizable prop silhouette and accent.

Captain and crew language, original equipment panels, cyan/amber flight instrumentation and round pressure suits give the game its own visual identity. A private role card starts each round. Incidents prompt an intercom meeting, a timed ballot and an airlock result. Gameplay cues are synthesized with Web Audio. The server owns movement, assignments, puzzle transitions, sabotage, votes and results. Local rendering interpolates other players between snapshots.
