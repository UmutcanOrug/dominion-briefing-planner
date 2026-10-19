# Validation report — v1.1.0

Date: 19 October 2026. Target: Foundry VTT 13 Build 351, SWADE, The Forge.

## Executed

- Node.js 24 automated suite: **24 tests passed**, covering schema/asset validation, duplicate IDs, preset isolation and identifier sanitization, affected-tile snapshots, toggle/show operations, pause/cancel clocks, persistence/import, camera coordinates including zero, restoration on errors, unsupported Lock View versions, ECDSA tamper/wrong-key rejection, two simulated recipient routing, replay/target/session validation, ordered GM sequencing, local preview isolation, manual wait, emergency restoration, keep-final completion, recipient filtering, scene-aware camera restoration and director-disconnect watchdog cleanup.
- Static checker: JavaScript syntax, relative import targets, manifest/runtime paths, version consistency, EN/TR translation key parity, LockView dependency and release download URLs.
- Browser fixture using the actual planner/overlay/player modules and simulated Foundry APIs: English and Turkish three-column layouts; manual dialogue waits; Pause/Resume/Next; overlay cleanup after completion. Screenshot: `planner-ui-tr.png`.
- Release ZIP inspection: root `module.json`, runtime imports/templates/styles/localizations present, reference repositories and local publishing helpers excluded.

**The automated tests simulate Foundry APIs. Two simulated recipients are not two real Foundry clients.** No running licensed Foundry V13 or Forge multiplayer world was available. The manifest's V13 compatibility target is a package declaration, not evidence that the live checklist below passed.

## Camera animation checks in 1.1.0

Eight additional deterministic tests cover intermediate center/zoom positions, linear/cosine easing, pause/resume without paused-time jumps, Next completing the target, Stop canceling future frames, scene teardown, pan failures restoring `applyLocks`, and cancellation before a move starts.

A separate local source-contract check ran the unchanged Lock View **v2.1.0** socket camera handler, lock class and pan wrapper with a simulated core canvas: intermediate movement succeeded while player pan/zoom remained locked between frames. The reference source is not bundled or redistributed.

## Real-instance checklist — not yet executed

Use one GM and at least two separate player clients in a disposable scene.

| Scenario | Required observation | Status |
| --- | --- | --- |
| Install on Forge | Manifest resolves, release ZIP installs under the correct module ID, dependency enables | Pending live Forge test |
| ApplicationV2 | Scene tool opens; resize and independent panes work; native Forge file picker returns assets | Pending live test |
| Camera | Both targets smoothly reach captured center/zoom over the selected movement time; Pause/Resume/Next/Stop work mid-move; tokens stay in place; zero coordinates work | Pending live test |
| Locks | Enable on each player; pan/zoom blocked; next scripted camera move still succeeds | Pending live test |
| Different scenes | Only selected players are pulled; camera waits for their canvas | Pending live test |
| Dialogue | Both recipients see names/portraits and typing; manual waits; missing images/audio fall back | Pending live test |
| Audio | Forge Assets URLs play under normal browser autoplay/CORS policy; pause/resume works | Pending live test |
| Pings | Correct scene point/color/label; pulses expire; pause freezes; Stop removes all | Pending live test |
| Tiles | Native tile hidden state changes; missing tile warns; only referenced tiles restore | Pending live test |
| Preview | No player camera/dialogue/ping activity; no authoritative tile/Lock View flag updates | Pending live test |
| Timeline | Mixed sequence ordered; skip/pause/resume/stop leave no timers or locked clients | Pending live test |
| Persistence | Multiple plans survive a Foundry reload; import/export remains editable | Pending live test |
| Disconnect | Recipient disconnect doesn't block; director disconnect triggers local watchdog cleanup | Pending live test |
| Recovery | GM reload leaves recoverable tile snapshot; Recover Session restores it and clears runtime | Pending live test |
| Isolation | Nonparticipant clients see no temporary effects; native tile updates remain scene-wide | Pending live test |

Reproduce automated checks with `node tools/check.mjs` and `node --test tests/*.test.mjs`. Reproduce the fixture with `node tools/preview-server.mjs`, then open `http://127.0.0.1:4173` or add `?lang=tr`.
