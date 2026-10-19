# Architecture and source review

## Services

| File / service | Responsibility |
| --- | --- |
| `planner-app.js` / BriefingPlannerApp | ApplicationV2 and Handlebars wrapper; three-column editor; scene drafts and GM controls |
| `storage.js` / BriefingStorage | GM-only scene flag persistence, independent duplication, schema validation and import/export |
| `player.js` / BriefingPlayer | Authoritative sequence, pauseable clock, bounded acknowledgements, cancellation and tile restoration |
| `client.js` / ClientPlayback | Recipient readiness, local effect execution, local camera snapshot and watchdog cleanup |
| `protocol.js` / BriefingSocketService | Signed command envelopes, trust anchor, target routing, replay prevention, advisory acknowledgements |
| `lock-view-adapter.js` / LockViewAdapter | Guarded Lock View 2.x internal bridge, local camera moves and locks; no dependency imports |
| `communicator.js` / CommunicatorOverlay | DOM text/portrait overlay, Unicode code point reveal, bounded audio metadata, pause and cleanup |
| `map-effects.js` / MapEffectsService | Temporary screen markers projected from scene coordinates; native GM tile document updates |
| `selection.js` / CanvasSelectionService | Temporary map click interception and native tile layer selection; Escape/timeouts/cleanup |
| `core.js` | Serializable schema, defaults, validation and pauseable clock |

Plans are stored at `flags.dominion-briefing-planner.plans`. Schema version 1 normalizes missing fields and rejects newer unknown versions. Future migrations belong in `normalizePlan`; no class instances or timers enter saved plans. Runtime flags are written only at start/end/recovery, not per-step progression. The runtime tile snapshot supports recovery after a GM reload.

## Inspected references

Sources were inspected before implementation on 19 October 2026:

- [Lock View](https://github.com/MaterialFoundry/LockView), released tag [v2.1.0](https://github.com/MaterialFoundry/LockView/tree/v2.1.0) plus upstream commit `90089b3a93180481b2f7a6893555ec8dc196bde6` (`2.1.1_pre1`). Files: `lockview.js`, `module.json`, `src/socket.js`, `src/locks.js`, `src/apps/setViewDialog.js`, `src/controlButtons.js`, `src/helpers.js`, and `src/libWrapper/overrides.js`.
- [Lancer Communicator](https://github.com/KamiliaBlow/Lancer-communication-module), commit `1c67d58a82a76c22f41e5079d539952b354296dc`. Reviewed communicator socket listener, portrait/name/message UI, typing and sound handling, bounded audio loading, voiceover timing and styling. No source or assets copied.
- [Foundry V13 ApplicationV2](https://foundryvtt.com/api/v13/classes/foundry.applications.api.ApplicationV2.html), [SceneControl](https://foundryvtt.com/api/v13/interfaces/foundry.SceneControl.html), and [FilePicker implementation](https://foundryvtt.com/api/v13/classes/foundry.applications.apps.FilePicker.html#implementation).

## Lock View findings

`lockView.socket.setViewDialog(data, users)` iterates recipients and calls `onSetViewDialog` locally or emits to the dependency socket. Its coordinate checks are truthy, so a destination with zero X or Y is not handled reliably. It also exposes no smooth-movement duration. Dominion instead uses the dependency's `onSetView({type:'absolute', position, width})` locally after verifying a Dominion signed command. Its absolute position is a top-left coordinate, which the adapter derives from the requested center, zoom and each client's viewport size.

`onSetView` temporarily disables `locks.applyLocks`, pans, emits a viewbox and restores that toggle. Dominion adds a `finally` guard because the upstream method can return early or fail before restoration. Absolute zoom is limited to 3 by that source. `locks.update(patch, {fromSocket:true, save:false})` applies a client-local lock without broadcasting or persisting it; no changes to the user's `Enable` preference are forced.

Do not treat the guarded 2.x internal integration as a guaranteed public API. A module version outside 2.x or missing required methods fails clearly. No core wrappers, dependency source changes or custom replacement camera locks exist here.

## Protocol and execution

The GM creates an ephemeral P-256 signing key and stores its public key, session ID, director ID, participants and tile snapshot in a GM-writable scene flag. Commands include protocol version, session/briefing/scene IDs, monotonic sequence, message ID, kind, targets and payload. Signing/emission and verification are ordered to prevent heartbeat/step races. Clients verify the flag's director against the active GM and verify ECDSA before acting. Only a GM's local director runs tile updates.

Acknowledgements report readiness, execution start, completion of cleanup, or errors. They are advisory and explicitly not authenticated by a payload user ID. Timeouts are 18 seconds for start and 7 seconds for other acknowledged commands; canvas readiness itself is bounded at 15 seconds. Heartbeats run every 5 seconds and clients clean up after 25 seconds without them. No single recipient blocks the sequence indefinitely.

Pauseable clock waits are canceled by Stop. An in-flight tile write settles before restoring only the originally captured tile IDs. Previous is disabled because a complete checkpoint reconstruction implementation is outside v1. A stopped briefing can be replayed from the beginning.
