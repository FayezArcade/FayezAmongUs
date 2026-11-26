# Meridian room and hallway expansion

## Reference review

The requested **The Skeld Map Tour** did not play in this session. The watch request was blocked by the connection proxy and the indexed page exposed no video frames or playback timeline. No timestamps are available from that video. The review used the supplied room collage and overhead image, a published overhead with all 14 rooms, and genuine in-game stills covering each room below. Several guide stills carry task arrows or panel callouts. The captured room backgrounds and player framing were used for reference. [Requested tour](https://www.youtube.com/watch?v=P4XxQSF3IsA) · [Genuine overhead reference](https://cdn.gamerjournalist.com/primary/2020/11/Among-Us-Skeld-Map.jpg) · [Gameplay stills source](https://steamcommunity.com/sharedfiles/filedetails/?id=2209446270)

## Room review and measured changes

Dimensions are world-unit width × height before wall trim. Area accounts for the chamfered corners, and excludes subtraction for solid furniture. Each width and height grew by approximately 26–38%. The checkpoint is [Meridian 4 at `20026b5`](https://github.com/FayezArcade/FayezAmongUs/commit/20026b5488e2a9ea179c172f4da310b91327836b).

| Room | Before | After | Floor area | Observation and Meridian design | Gameplay source |
| --- | ---: | ---: | ---: | --- | --- |
| Cafeteria | 320 × 220 | 424 × 282 | +72% | Spread-out tables define several walking lanes. Meridian separates the five solid table tops and puts the emergency approach and ten spawns on the open side. | [Frame](https://cdn.mobygames.com/0a600cc6-c3a1-11ed-9226-02420a000121.webp) |
| Weapons | 164 × 152 | 216 × 196 | +69% | A central weapon rig gives the room a clear purpose. Meridian backs it with maintenance equipment and preserves the west-to-south approach. | [Frame](https://images.steamusercontent.com/ugc/1593666197209217804/F54FB5B10431CDA7E2E8946B5EA414C2A7C53CF0/) |
| O2 | 150 × 136 | 190 × 174 | +62% | Filter cylinders and wall equipment frame the working floor. Meridian uses an independent north entry on the east trunk. | [Frame](https://images.steamusercontent.com/ugc/1593666197209176895/826B6096B8BD46185163A5D2F389D554A3DDFB45/) |
| Navigation | 158 × 148 | 218 × 190 | +81% | A compact bridge has its displays toward the bow. Meridian adds an instrument bank and keeps the west entry distinct from the southbound trunk. | [Frame](https://images.steamusercontent.com/ugc/1593666197209165769/F98E580D485E91CBFD0B114F1D8B9785F9C677DC/) |
| Shields | 164 × 156 | 218 × 200 | +77% | The generator area has a central repeat of lights. Meridian keeps its round array and adds power equipment alongside the cargo route. | [Frame](https://images.steamusercontent.com/ugc/1593666197209101762/5BBA65A953824FDAD062AEC578C24089B42D5016/) |
| Communications | 169 × 133 | 220 × 170 | +67% | Radio equipment occupies the perimeter of a small room off the cargo hall. Meridian gives this room its own short north spur and radio equipment. | [Frame](https://images.steamusercontent.com/ugc/1593666197209006445/61F9345D8EAB84CBFF0A05B2C4D2D66F4F3826E2/) |
| Storage | 243 × 220 | 310 × 278 | +62% | Floor striping and stacked cargo help convey scale. Meridian puts solid crates and racks along the sides of a clear central floor. | [Frame](https://images.steamusercontent.com/ugc/1593666272676159751/B5B12A8EE80462F6267463100001316099EFB7A0/) |
| Admin | 170 × 143 | 222 × 182 | +69% | A command table and observation consoles define the interior. Meridian places the room on a short spur from the central hall and keeps the O2 hull separate. | [Frame](https://images.steamusercontent.com/ugc/1593666197209046099/CAD34494443A4C99797364BD55A4527B593D2FB6/) |
| Electrical | 210 × 166 | 272 × 214 | +67% | Power banks and cable runs line the larger room. Meridian adds wall hardware, gives the distributor and hatch more clearance, and retains a single southern entry. | [Frame](https://images.steamusercontent.com/ugc/1593666197208689431/C669172E5210CCC75B5EF9ABBE9CE7E09D943C3A/) |
| Lower Engine | 192 × 152 | 248 × 200 | +69% | Large machinery contrasts with a side walking lane. Meridian uses a longer bay, a north approach from the engineering spine, and an east cargo exit. | [Frame](https://steamuserimages-a.akamaihd.net/ugc/1676988882896878859/A1AB5FD4C45DE14FC992003386E5AF89B9175286/) |
| Reactor | 152 × 172 | 192 × 222 | +63% | The tall reactor assembly contrasts with an approach across the engineering intersection. Meridian keeps the west-side reactor and enlarges the floor between the repair stations. | [Frame](https://images.steamusercontent.com/ugc/1622941672101939250/937BE5849C33ECEA6C575BFA43BD20A4857D9B5D/) |
| Security | 142 × 134 | 184 × 174 | +71% | A monitor bank faces an open bay. Meridian has a wider workstation, a rack, and one west door from the Reactor junction. | [Frame](https://images.steamusercontent.com/ugc/1593666197205843089/C6C861E558027091F7883855AE663A678EDF115B/) |
| MedBay | 146 × 142 | 192 × 184 | +70% | Beds and a scan station define a clinic with an open aisle. Meridian uses a three-bed bank and nearby equipment, with an independent north spur from the upper hall. | [Frame](https://i.pinimg.com/originals/83/8f/65/838f659b318fca76dbdbb06203248b97.png) |
| Upper Engine | 174 × 140 | 226 × 184 | +73% | The upper machinery sits by a width change into the corridor. Meridian leaves room to pass from the east hall to the south engineering spine. | [Frame](https://cms-cdn.now.gg/cms-media/2023/09/Among-Us_Crewmate-Tasks_EN_5.png) |

## Navigation, collision, and scale

- The port definitions place the same openings in the room walls, floor collision, shutter frames, and map. The rebuilt footprint is 1,920 × 1,180 world units. The 22 ports and 13 timed shutters use the width of their own route. Spurs are 88–92 units wide, engineering and cargo routes are 98, and the main Cafeteria passages are 100–104. Bends and junctions use overlapping floor runs.
- MedBay opens north to a spur off the upper Cafeteria hall. Security opens west on the engineering spine, opposite Reactor. Each room has one access point. Hull separates them from each other and from Electrical. The O2 and Admin floors are also separate.
- Task positions, vents, repairs and vision limits follow shared world data. The same coordinates drive the blue plan, sabotage plan, world markings and server checks. Solid tables and perimeter furnishings affect movement. Low furniture does not block direct sight. Some machinery shells and seating details remain decorative.
- The suit drawing scale remains 0.67, the movement radius remains 9, and the desktop follow zoom still caps at 1.43. For a roughly 34-unit suit, height is 12% of the new Cafeteria depth, compared with 15% before. A roughly 25-unit-wide suit occupies 24–28% of the hall width, compared with 32% before. The Cafeteria-to-Weapons hall, at 100 units, gives a 25% ratio close to the published passage still. Camera framing and actual walking captures supplied the visual check. [Weapons passage reference](https://cdn.mobygames.com/68277b2a-ac20-11ed-a12e-02420a000130.webp)
- The live game identifies this geometry and collision model as `meridian-5`. The client and Render relay must report the same revision.

## Verification and captures

The production build and 55 automated tests passed. Tests cover all room and station access points, spawn clearance, furniture collision, open wall spans, door closure, local input prediction, and real private multiplayer socket sessions. A built-client Chromium walk-through entered all 14 rooms, inspected the blue map, and closed and reopened the Cafeteria east shutter. The scale run captured the suit beside a table and inside the east corridor.

All before captures came from the checkpoint build, and all after captures came from the rebuilt game. The source screenshots remain linked for research. [Before and after maps](screenshots/room-expansion/maps.jpg) · [MedBay and Security](screenshots/room-expansion/medbay-security.jpg) · [All rooms and passage captures](screenshots/room-expansion/)

Reproduce with the production bundle and an installed Playwright Chromium, or set `CHROMIUM_PATH` to an installed executable.

```sh
npm test
npm run build
node test/deck-tour.mjs
node test/scale.mjs
```

## Meridian 8 room pass

The stills above were reviewed again alongside the supplied collage. Electrical’s reference shows a wide upper instrument bay, a narrower lower approach, and wiring tying the two areas together. Meridian uses its own asymmetric outline, a side vent, staggered consoles, and a clear south entrance. The outline drives collision, visibility, the physical walls, and both map overlays. The entrance, adjacent hall, and shutter stayed in place. Electrical’s task prompts use a shorter reach around their individual stations.

The other 13 rooms retain their expanded footprints, doorways, task access and equipment landmarks. Cafeteria keeps five tables and drops the wall service clutter. Weapons retains its turret and one maintenance rack. O2 puts its remaining secondary hardware on the perimeter, and Navigation keeps its forward displays and clears its lower corner. Shields retains the central shield array. Communications keeps the dish and clears the entry side. Storage preserves an open aisle through two crates and a side rack. Admin retains the console table and one side cabinet. The two Engine rooms and Reactor keep their main machinery and lose secondary racks. Security keeps the monitor bench, while MedBay keeps two wall beds and clears the center aisle to the scanner.

[Western and central rooms](screenshots/final-release/rooms-west.jpg) · [Eastern rooms](screenshots/final-release/rooms-east.jpg) · [Electrical before and after](screenshots/final-release/electrical-before-after.jpg) · [Physical map](screenshots/final-release/physical-map.jpg) · [Blue overlay](screenshots/final-release/blue-map.jpg)
