# Dominion Briefing Planner

A visual mission briefing director for **Foundry VTT 13**, built for Savage Worlds Adventure Edition and The Forge. Create saved scene timelines that coordinate Lock View cameras, portrait dialogue, tactical markers, tile reveals and timed pauses.

**Install manifest:**

```text
https://github.com/UmutcanOrug/dominion-briefing-planner/releases/latest/download/module.json
```

[Download the release ZIP](https://github.com/UmutcanOrug/dominion-briefing-planner/releases/latest/download/dominion-briefing-planner.zip) · [Türkçe kullanım](docs/KULLANIM-TR.md) · [Test report](docs/TESTING.md)

## Installation on The Forge

1. In The Forge Bazaar, choose **Install from Manifest** (custom module installation).
2. Paste the manifest URL above and install. Use the released `module.json`, not a GitHub repository page or source-code archive.
3. Install **Lock View** (`LockView`) 2.x from the Bazaar if needed.
4. Launch your Foundry 13 world. In **Manage Modules**, enable Lock View and Dominion Briefing Planner, then reload.
5. In Lock View's user configuration, enable **Enable** for each participating player. Keep **Control** limited to the GM or designated trusted users. The planner warns if a target's locks cannot be enforced.
6. Open a scene, choose Token Controls, then the satellite-dish **Briefing Planner** button.

The native configured FilePicker is used for portraits and sounds, including Forge Assets. The module does not need Lancer Communicator, socketlib, a build step, or changes to SWADE.

Forge also supports custom package upload through its Import Wizard. If using this route, upload the release ZIP. See [Forge's custom module guidance](https://forums.forge-vtt.com/t/pixels-module-download-issue/105116/5) and [module upload guidance](https://forums.forge-vtt.com/t/how-to-upload-a-modified-version-of-a-module-system/10510).

## Build a briefing

1. Click **Create** and edit the briefing name above the timeline.
2. Add Camera, Dialogue, Map Ping, Tile Visibility, Wait / Delay, or View Locks. New actions are inserted after the selected step. Move them with the arrow buttons.
3. Select a card to edit its properties. Every action can be enabled, disabled, duplicated, or removed.
4. For cameras, position the GM view and click **Capture Camera Position**, or use **Pick Position on Map**. Choose **Smooth pan and zoom**, set **Camera movement time** (default 2000 ms), and choose smooth start/finish or constant speed. Choose **Instant** for a cut. Coordinates are scene coordinates. Map selection cancels with Escape and automatically expires.
5. For dialogue, choose a portrait, name, text, style and timing. **Save Speaker** creates a reusable preset in this briefing. Applying a preset copies its values; later overrides do not modify other steps. Duplicate a briefing or export/import it to carry presets to another scene.
6. For tile steps, click **Select Tiles on Map**, select existing tiles (Shift for multiple), then confirm in the floating toolbar. Tile IDs stay stable across saves. Missing tiles are reported.
7. Select all connected players on this scene, or choose individual players. Enable scene pull to move selected players who are viewing another scene. Each client waits for its own canvas before camera commands.
8. Choose camera/lock restoration and whether tiles return to their original state or keep the final state at normal completion. Emergency Stop always restores the original affected tiles and client locks.
9. Click **Save**. Each scene stores multiple plans independently in scene flags. Export/import validates schema and creates a fresh briefing ID.

Use **Preview Locally** for the whole timeline or **Preview Step** for the selected action. Preview affects the GM client only, emits no multiplayer commands, and skips authoritative tile changes with a visible notice. Live tile changes are native scene document updates and are visible to **everyone** on that scene, including nonparticipants.

## Timing and controls

- **Continue immediately:** execute, then advance. Give dialogue a wait mode if it needs to stay visible.
- **Duration / hold:** wait the configured milliseconds after execution. For cameras this is an additional hold after the movement finishes; **Camera movement time** controls the actual travel.
- **Automatic dialogue:** use an explicit duration if provided; otherwise wait for typing/voiceover and the optional hold time. Audio metadata loads have a bounded timeout; unplayable audio falls back to text timing. Audio-synchronized reveal spreads characters over the voiceover duration.
- **Wait for GM Next:** keep the action active until the director presses Next.
- **Pause / Resume:** suspend camera movement, timeline waits, text reveal, marker lifetimes, pulse animation and audio where browser playback permits. Next while paused is applied after Resume.
- **Next:** complete an active camera move at its destination and skip the current timed/manual wait. In-flight document writes and network acknowledgements are allowed to settle safely.
- **Stop:** cancel progression, remove overlays/markers and restore captured client/tile state.
- **Previous:** explicitly disabled in v1; stop and replay from the beginning to preserve deterministic state.

The active GM directs live playback. Other GMs can edit or preview. The current step is highlighted. Client readiness/step acknowledgements time out instead of blocking forever. Disconnected recipients are skipped. Reconnecting clients need a restarted briefing; this release does not replay a partial timeline automatically.

## Lock View compatibility and limits

The dependency's actual module ID is `LockView`. The adapter was inspected against released **2.1.0** and upstream **2.1.1_pre1** source. It accepts 2.x versions only when required runtime methods exist. This is a guarded integration with **internal methods**, not a claim of a stable upstream API. See [source review](docs/ARCHITECTURE.md).

The adapter calls Lock View's local absolute camera handler and local lock updater. Smooth movement interpolates center and zoom on animation frames and applies each position through that same handler. Lock View's `applyLocks` is restored after every call; it is never disabled for the whole movement. Pause cancels scheduled frames, Next finishes at the target, and Stop drains an in-flight call before restoring the original camera. It converts center/zoom into each client's viewport coordinates, supports destinations with zero X/Y, and restores `applyLocks` in `finally`. No Lock View source imports, world setting writes, scene lock flag writes, token movement, or core monkey patches are used.

Camera transitions default to **smooth pan and zoom over 2000 ms**, with configurable movement time (0–60000 ms) and either cosine ease in/out or linear interpolation. Existing saved camera steps receive these defaults when loaded; select Instant to retain a cut. Zoom remains restricted to **0.05–3** by the dependency. Different browser sizes share a center and scale, not an identical visible rectangle. Original zooms outside Lock View's supported absolute range cannot be restored by that handler. Avoid those zooms when using restoration. Use Camera movement time for travel speed and a separate Duration hold for pacing after arrival.

Other v1 limits: one scene per timeline; no safe backward navigation; no tile fades; local tile preview is skipped; presets are per briefing; no chat output; no late-join resynchronization; browser autoplay/CORS restrictions can suppress audio. Timing is synchronized by ordered commands and acknowledgements, not sample-accurate audio scheduling. A player's frozen tab may fall behind until the next step or watchdog cleanup.

## Recovery and security

The GM publishes an ephemeral ECDSA public key and tile snapshot in a GM-writable scene runtime flag. Player clients verify every command signature against that trust anchor and the active GM before acting. Session IDs and sequence numbers suppress duplicate/replayed packets. No command handler permits players to update scene documents. Raw socket acknowledgements are **advisory** because Foundry's module socket does not provide authenticated sender metadata; they cannot authorize a command or a world update.

Heartbeat loss or director disconnect restores local effects after approximately 25 seconds. Closing the planner or changing the GM scene stops playback. After a GM reload/crash, open the affected scene and choose **Recover Session** to restore the saved tile snapshot and clear its runtime flag. Client camera snapshots are held locally; they cannot survive a full browser reload. Lock View's persistent settings are never changed by this module.

## Validation and development

This release targets V13 Build 351. **No running licensed Foundry V13 / Forge multiplayer instance was available during development.** Automated tests and the browser UI fixture passed; they do not establish end-to-end Foundry multiplayer compatibility. Run the real-instance checklist in [TESTING.md](docs/TESTING.md) before a game session.

```sh
node tools/check.mjs
node --test tests/*.test.mjs
node tools/build.mjs
```

Packaging uses only Node's standard library and works without external archiving tools. The ZIP has `module.json` at its root and includes only runtime files and documentation. Run `node tools/preview-server.mjs` for the standalone UI verification fixture; its Foundry APIs are simulated.

Original module code is MIT licensed. Lock View and Lancer Communicator were studied as integration/functional references; their code and assets are not bundled.
