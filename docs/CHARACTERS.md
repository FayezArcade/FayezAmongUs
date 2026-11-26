# Character overhaul

The supplied 18-suit reference set the color order, the compact outline, the broad blue glass, the small packs and the short separated boots. Fayez Among Us's original suit uses a beveled inset viewport, a clean front, shaded boots and an offset rectangular service pack. The north-facing pose exposes a plain rounded backpack.

| Row | Colors |
| --- | --- |
| 1 | Red, Blue, Green, Pink, Orange, Yellow |
| 2 | Black, White, Purple, Brown, Cyan, Lime |
| 3 | Maroon, Rose, Banana, Gray, Tan, Coral |

The same vector renderer draws the drifting menu suits, actual players, locker tiles and previews, ballots, role reveals and round results. Portraits cache the rendered image. Movement snapshots carry the direction applied by the existing collision check. Standing holds that facing, walking animates two separate boots, and ghosts float with a short trail. World suits use the revised scale and footprint documented in the [deck comparison](MERIDIAN-DECK.md).

The server assigns and validates suit colors using the ordered palette. A busy color remains unavailable to another player. Wire puzzle colors use their own original palette.

[Actual browser captures](screenshots/characters/)
