Dominion Briefing Planner 1.1.0 adds the requested **animated camera pan and zoom**.

- Choose **Smooth pan and zoom** in a Camera step.
- Set **Camera movement time**: `2000` = 2 seconds; `5000` = 5 seconds. Longer durations move the screen more slowly.
- Choose smooth start/finish or constant speed. Select **Instant** for a cut.
- Existing saved camera steps default to a smooth 2-second movement when loaded.
- The general step Duration remains a separate hold after arrival.
- Pause freezes camera travel, Resume continues, Next completes the target, and Stop cancels the movement before restoring the camera.

Every intermediate position goes through Lock View's own camera handler; Lock View is not left unlocked for the duration of the animation. No dependency files or Foundry core methods are patched.

**Validation:** 24 automated tests passed. A separate test using the actual Lock View v2.1.0 camera handler and lock wrapper passed with a simulated Foundry canvas. **Real Foundry/Forge multiplayer validation remains pending.**

**Forge manifest (unchanged):**

```text
https://github.com/UmutcanOrug/dominion-briefing-planner/releases/latest/download/module.json
```

Update the module on Forge, reload the world, and open an existing or new Camera step. Requires Lock View 2.1.0+ within its 2.x series. [Türkçe kullanım](https://github.com/UmutcanOrug/dominion-briefing-planner/blob/main/docs/KULLANIM-TR.md).
