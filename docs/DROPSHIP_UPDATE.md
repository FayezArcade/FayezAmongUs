# Dropship update

The three supplied reference screenshots guided the layout. The game renders its own hull, equipment and suits in Canvas.

| Reference | Fayez Crew implementation |
| --- | --- |
| 1, full dropship | A complete gray shuttle silhouette surrounds the cabin. Two broad side pods carry paired exhaust ports. A canopy sits above an inset upper airlock. The original cabin angles, pod shape, console and aft ramp give the shuttle its own profile. |
| 1 and 3, waiting interior | Ten blue padded chairs follow the upper shoulders. Three storage crates break up the lower grid and a fourth supports the green-screen laptop. A steel center aisle divides the inset ribbed floor. Seats, crates and the upper bulkhead constrain player movement. The camera fits the full shuttle and leaves space for the bottom controls. Compact suits remain readable against the floor. |
| 2, online menu | A black starfield, drifting original suits, pale outlines and two centered buttons. Create Room uses the saved nickname when available. Join Room always includes the nickname and code fields. |
| 3, lobby UI | Compact settings sit at top left and host settings sit at top right. Start sits above the large room code, copy control and player count at the bottom center. The current chat is limited to meetings. |

## Solo flight

A single connected host can start when no other players occupy the lobby. The server records the test mode during the three-second countdown. It reveals a crewmate, opens the existing map and assigns every available task. Solo test controls allow manual selection of Engineer, Scientist and Phantom, triggering or clearing sabotage, and returning to the same room. The sole player can operate both Reactor panels within the normal window. Critical sabotage expires without ending the test, and crew task completion leaves the map open. The normal round still applies role requirements, victory rules and the multiplayer Reactor requirement.

[Browser captures](screenshots/dropship/)
