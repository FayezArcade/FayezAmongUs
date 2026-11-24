# The Skeld task reference audit

The supplied overhead plan and gameplay stills were used for routes and scale. The task table links to genuine gameplay frames published by BlueStacks, MobyGames, and the community, with Innersloth’s own notes for the later vent update. The supplied YouTube video could not be opened for playback, so it was not used to assign timestamps or identify map sections. The short, task-specific recordings are supplementary references. Fayez Crew renders its own ship, suits, consoles, and controls. [BlueStacks illustrated walkthrough][bluestacks] · [MobyGames gallery][moby] · [The Skeld task index][index]

## Task and stage references

A visual task has an effect that another player can see in The Skeld when the original game’s visual-task setting is enabled. “Stage” here means a separate station visit unless the row explicitly describes phases inside a single visit.

| Task name on The Skeld | Location, input, and completion | Stages | Visual | Genuine reference |
| --- | --- | --- | --- | --- |
| Fix Wiring | Join each of four wires to the same color or symbol. Three panels are chosen in order from Electrical → Storage → Admin → Navigation → Cafeteria → Security. Connecting all four advances one panel. | 3 | No | [Electrical wiring screenshot][wires] · [Location order][wiring-order] |
| Swipe Card | In Admin, take the card out of the wallet and drag it through the reader at a moderate speed. The reader must accept the swipe. | 1 | No | [Admin card reader screenshot][card] |
| Download Data | In Cafeteria, Communications, Electrical, Navigation, or Weapons, press Download and keep the panel open until the progress bar fills. | 1 of 2 for Upload Data | No | [Communications download screenshot][download] |
| Upload Data | After downloading, go to Admin and press Upload. The full transfer completes the assignment. | 2 of 2 | No | [Data transfer task captures][data] · [Skeld upload playthrough][upload-video] |
| Divert Power | In Electrical, move the indicated switch up to send current to the designated room. The Reactor panel in the reference is a decoy station. | 1 of 2 | No | [Electrical power panel screenshot][divert] · [Task panel and routes][power] |
| Accept Diverted Power | In the designated destination, connect the receiver by operating the central switch. Destinations include Communications, Lower Engine, Navigation, O2, Security, Shields, Upper Engine, and Weapons. | 2 of 2 | No | [Receiver screenshots][power] · [East-wing gameplay recording][east] |
| Calibrate Distributor | In Electrical, press each of three controls when its rotating indicator reaches the connected band, in order. | 1 with 3 readings | No | [Electrical distributor screenshot][calibrate] |
| Start Reactor | In Reactor, watch and repeat a sequence one light at a time. Five progressively longer rounds finish the task. | 1 with 5 rounds | No | [Reactor memory panel screenshot][reactor] |
| Unlock Manifolds | In Reactor, select the ten numbered controls from 1 to 10 despite the shuffled grid. | 1 | No | [Reactor keypad screenshot][manifolds] |
| Submit Scan | In MedBay, stay on the scanner through the readout. Moving away or canceling interrupts the scan. | 1 | Yes. A green scan is visible. | [MedBay scan screenshot][scan] |
| Inspect Sample | In MedBay, start the sample test, wait about a minute and return to choose the anomalous tube. Choosing the wrong tube starts a retest. | 1 station with 2 phases | No | [Start screenshot][sample-start] · [Anomaly screenshot][sample-finish] |
| Clear Asteroids | In Weapons, aim and hit 20 moving objects. In The Skeld the external cannon fires while the player uses it. | 1 | Yes. Cannon fire is visible. | [Weapons target screenshot][asteroids] |
| Stabilize Steering | In Navigation, move the steering reticle to the center target and settle it. | 1 | No | [Navigation steering screenshot][steering] |
| Chart Course | In Navigation, drag the ship along the displayed waypoints in order to the end. | 1 | No | [Navigation course screenshot][chart] |
| Fuel Engines | Fill a portable canister in Storage, refuel Upper Engine, refill the canister in Storage, then refuel Lower Engine. Hold each fill control until full. | 4 visits | No | [Storage fuel screenshot][fuel-fill] · [Engine fuel screenshot][fuel-engine] · [Route][fuel-route] |
| Align Engine Output | Move the indicator to center in Upper and Lower Engine. Both panels must be aligned. | 2 | No | [Upper Engine alignment screenshot][align] |
| Empty Garbage | Pull and hold the disposal lever in Cafeteria. Repeat at the Storage outlet to finish. | 2 | Storage ejection only | [Cafeteria lever screenshot][garbage] · [Storage ejection screenshots][visual] |
| Empty Chute | Pull and hold the O2 chute lever. Repeat at the shared Storage outlet. | 2 | Storage ejection only | [Skeld O2 and Storage variant captures][waste] · [East-wing gameplay recording][east] |
| Clean O2 Filter | In O2, drag the leaves into the exhaust opening. The panel clears when all debris is gone. | 1 | No | [O2 filter screenshot][filter] |
| Prime Shields | In Shields, activate the unlit segments until all are on. The external shield lights illuminate. | 1 | Yes. Shield lights are visible. | [Shield panel screenshot][shields] · [External lights screenshots][visual] |
| Clean Vent | At an assigned vent, select each piece of debris until the grate is clean. Innersloth added the task in version 2021.6.30. | 1 | No regular visual confirmation. Cleaning may displace a vent occupant in Among Us. | [Skeld cleaning clip, publisher chapter 7:03][vent-video] · [Innersloth patch notes][vent] |

## Fayez Crew behavior

- Task stations and their map markers come from the shared deck file. Wiring draws one of three authored routes covering all six reference rooms. The randomly assigned task family is common to the room, and each subsequent location is unlocked by the previous panel.
- The five download origins share an Admin upload terminal. The eight receiving relays share an Electrical start. The task list and Space prompt show the current stage name. Fuel follows Storage → Upper Engine → Storage → Lower Engine. The two waste routes share the Storage outlet.
- Inspect Sample has five tubes and a 12-second first analysis. Its server countdown survives closing the panel, walking away, interrupted communications, and meetings. Data takes 2.7 seconds per station. Weapons requires three tracked hits. Scan uses a held control. These durations and counts are tuned for Fayez Crew’s shorter rounds.
- Crew-visible effects include the scanner ring, cannon flashes, shield lights, and final waste ejection. Clean Vent uses Fayez Crew’s existing hatch network. It blocks new entry and travel to the assigned hatch while the panel is being serviced.
- Mouse, touch, and keyboard controls share the same server validation. Wiring supports drag and select-pair. Course plotting supports drag and ordered taps. Filter cleaning supports dragging to the exhaust and assisted taps. The server checks proximity, order, timing, current stage, and communications. A canceled foreground instrument restarts its current stage. Previous visits stay recorded. Ghosts can work on crew assignments, and impostor cover work earns no team credit.

[bluestacks]: https://www.bluestacks.com/blog/game-guides/among-us/au-skeld-task-guide-en.html
[moby]: https://www.mobygames.com/game/149316/among-us/screenshots/
[index]: https://among-us.fandom.com/wiki/Category:The_Skeld_tasks
[wires]: https://cdn-www.bluestacks.com/bs-images/Among-Us-Task-Guide_EN_6.jpg
[wiring-order]: https://among-us.fandom.com/wiki/Fix_Wiring
[card]: https://cdn-www.bluestacks.com/bs-images/Among-Us-Task-Guide_EN_2.jpg
[download]: https://cdn-www.bluestacks.com/bs-images/Among-Us-Task-Guide_EN_5.jpg
[data]: https://among-us.fandom.com/wiki/Upload_Data#Stage_2:_Upload_Data
[upload-video]: https://www.youtube.com/watch?v=-xfKBcspG78
[divert]: https://cdn-www.bluestacks.com/bs-images/Among-Us-Task-Guide_EN_4.jpg
[power]: https://among-us.fandom.com/wiki/Divert_Power
[east]: https://www.youtube.com/watch?v=Zi1e2ppOrB8
[calibrate]: https://cdn-www.bluestacks.com/bs-images/Among-Us-Task-Guide_EN_7.jpg
[reactor]: https://cdn-www.bluestacks.com/bs-images/Among-Us-Task-Guide_EN_16.jpg
[manifolds]: https://cdn-www.bluestacks.com/bs-images/Among-Us-Task-Guide_EN_15.jpg
[scan]: https://cdn-www.bluestacks.com/bs-images/Among-Us-Task-Guide_EN_9.jpg
[sample-start]: https://cdn-www.bluestacks.com/bs-images/Among-Us-Task-Guide_EN_10.jpg
[sample-finish]: https://cdn-www.bluestacks.com/bs-images/Among-Us-Task-Guide_EN_11.jpg
[asteroids]: https://cdn-www.bluestacks.com/bs-images/Among-Us-Task-Guide_EN_20.jpg
[steering]: https://cdn-www.bluestacks.com/bs-images/Among-Us-Task-Guide_EN_13.jpg
[chart]: https://cdn-www.bluestacks.com/bs-images/Among-Us-Task-Guide_EN_12.jpg
[fuel-fill]: https://cdn-www.bluestacks.com/bs-images/Among-Us-Task-Guide_EN_18.jpg
[fuel-engine]: https://cdn-www.bluestacks.com/bs-images/Among-Us-Task-Guide_EN_19.jpg
[fuel-route]: https://among-us.fandom.com/wiki/Fuel_Engines
[align]: https://cdn-www.bluestacks.com/bs-images/Among-Us-Task-Guide_EN_8.jpg
[garbage]: https://cdn-www.bluestacks.com/bs-images/Among-Us-Task-Guide_EN_3.jpg
[waste]: https://among-us.fandom.com/wiki/Empty_Garbage
[visual]: https://among-us.fandom.com/wiki/Visual_tasks
[filter]: https://cdn-www.bluestacks.com/bs-images/Among-Us-Task-Guide_EN_14.jpg
[shields]: https://cdn-www.bluestacks.com/bs-images/Among-Us-Task-Guide_EN_17.jpg
[vent-video]: https://www.youtube.com/watch?v=L4Ce7qsiVnc&t=423s
[vent]: https://www.innersloth.com/vent-cleaning-patch-notes/
