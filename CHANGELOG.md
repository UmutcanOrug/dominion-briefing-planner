# Changelog

## 1.1.0 — 2026-10-19

- Added smooth camera pan and zoom through the Lock View adapter. Movement defaults to 2000 ms and supports 0–60000 ms, cosine ease in/out or constant speed, and an Instant option. Existing saved camera steps inherit the new defaults.
- Camera movement time is separate from the hold after arrival; timeline playback waits for the camera to arrive.
- Pause freezes travel; Resume continues; Next completes the target; Stop cancels remaining frames before restoration. No multi-second unlocking or core/dependency monkey-patching.
- Camera-aware acknowledgement timeouts now allow long moves and exclude paused time.
- 24 automated tests passed, plus an actual Lock View 2.1.0 source-contract check in a simulated canvas. Live Forge multiplayer testing remains pending.

## 1.0.0 — 2026-10-19

- Initial visual briefing planner for Foundry 13: scene plans, editable timeline, six action types, ordered GM playback and isolated local preview.
- Guarded Lock View 2.x camera/lock adapter; instant center/zoom transitions and local lock restoration.
- Portrait dialogue, typing, optional audio, presets, tactical markers and native tile visibility.
- Signed GM commands, target routing, duplicate suppression, readiness timeouts, cancellation and recovery snapshots.
- English/Turkish interface, import/export, Forge manifest and installable release ZIP.
- Previous is explicitly disabled; tile preview is skipped; real Foundry/Forge multiplayer validation remains pending. See the test report.
