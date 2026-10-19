import {ID, uid, clone, normalizePlan, PlaybackClock, captureTiles, sleep, warn, error} from "./core.js";
import {MapEffectsService} from "./map-effects.js";
import {audioDuration} from "./communicator.js";
import {LockViewAdapter} from "./lock-view-adapter.js";
export class BriefingPlayer {
  status = "idle"; index = -1; active = false;
  constructor(socket,client,onChange) {
    this.socket = socket; this.client = client; this.onChange = onChange;
    this.last = performance.now();
    this.timer = setInterval(() => { const now = performance.now(); this.clock?.tick(now-this.last); this.last = now; },30);
  }
  changed() { this.onChange?.(); }
  async play(raw,scene,{preview = false,onlyStep = null} = {}) {
    if (!game.user.isGM || this.active) return;
    if (!preview && !game.user.isActiveGM) throw new Error("Live playback is restricted to the active GM");
    new LockViewAdapter().check();
    this.briefing = normalizePlan(clone(raw),scene.id);
    if (onlyStep) this.briefing.steps = this.briefing.steps.filter(s => s.id === onlyStep);
    if (!this.briefing.steps.some(s => s.enabled)) throw new Error("Add an enabled timeline step first");
    this.scene = scene; this.preview = preview; this.index = -1; this.active = true; this.status = "starting";
    this.clock = new PlaybackClock(); this.skip = false; this.stopping = false; this.ownsRuntime = false; this.changed();
    this.originalTiles = preview ? {} : captureTiles(scene,this.briefing.steps);
    this.task = this.run();
    await this.task;
  }
  async run() {
    let normalFinish = false;
    try {
      const p = this.briefing;
      if (this.preview) {
        await this.client.start({id:uid(),sceneId:this.scene.id,preview:true,lockAll:p.settings.lockAll});
      } else {
        if (this.scene.getFlag(ID,"runtime")) throw new Error("A live session already exists on this scene. Use Recover Session first.");
        const targets = game.users.filter(u => !u.isGM && u.active && (p.settings.targetMode === "selected" ? p.targets.includes(u.id) : u.viewedScene === this.scene.id)).map(u => u.id);
        if (!targets.length) throw new Error("No connected players selected on this scene");
        if (!p.settings.pullScene && targets.some(id => game.users.get(id)?.viewedScene !== this.scene.id)) throw new Error("Some selected players are on another scene. Enable scene pull or change the selection.");
        for (const id of targets) if (!new LockViewAdapter().enabled(id)) warn(`${game.users.get(id)?.name}: enable Lock View for this player to enforce locks.`);
        await this.socket.begin(this.scene,p,targets,this.originalTiles); this.ownsRuntime = true;
        this.heartbeat = setInterval(() => { this.socket.send("heartbeat").catch(console.error); },5000);
        if (this.stopping) return;
        await this.socket.send("start",{pullScene:p.settings.pullScene,lockAll:p.settings.lockAll},targets,true);
      }
      if (this.stopping) return;
      this.status = "playing"; this.changed();
      for (this.index = 0; this.index < p.steps.length && !this.stopping; this.index++) {
        const s = p.steps[this.index];
        if (!s.enabled) continue;
        await this.clock.wait(0); if (this.stopping) break;
        this.skip = false; this.currentStep = s.id; this.changed();
        try {
          // Metadata failure is bounded; it must never prevent timeline progress.
          const voiceDuration = s.type === "dialogue" && s.timing === "auto" ? await audioDuration(s.data.voiceover) : 0;
          if (this.stopping) break;
          if (s.type === "tiles" && !this.preview) await MapEffectsService.applyTiles(this.scene,s);
          if (this.stopping) break;
          if (this.preview) await this.client.execute(s);
          else await this.socket.send("step",{step:s,index:this.index},undefined,true);
          if (this.stopping) break;
          if (s.timing === "manual") {
            this.status = this.clock.paused ? "paused" : "waiting"; this.changed();
            await this.clock.wait(Number.POSITIVE_INFINITY,() => this.skip);
          } else {
            let duration = s.timing === "duration" ? s.duration : 0;
            if (s.timing === "auto") duration = s.type === "dialogue" ? (s.duration || Math.max(s.data.audioSync && voiceDuration ? voiceDuration : Array.from(s.data.message).length*s.data.speed,voiceDuration)+s.data.hold) : s.duration;
            await this.clock.wait(duration,() => this.skip);
          }
          if (this.preview) this.client.overlay.clear(); else await this.socket.send("clear");
          if (!this.clock.paused) this.status = "playing";
        } catch (e) { error(new Error(`Step ${this.index+1}: ${e.message}`)); }
      }
      normalFinish = !this.stopping;
    } catch (e) { error(e); }
    finally { await this.finish(!normalFinish); }
  }
  async pause() {
    if (!this.active || this.status === "starting") return;
    this.clock.paused = !this.clock.paused;
    this.status = this.clock.paused ? "paused" : (this.briefing.steps[this.index]?.timing === "manual" ? "waiting" : "playing");
    if (this.preview) this.client.pause(this.clock.paused); else await this.socket.send(this.clock.paused ? "pause" : "resume"); this.changed();
  }
  next() { if (this.active) this.skip = true; }
  async stop() {
    if (!this.active) return;
    this.stopping = true; this.clock.cancelled = true; this.status = "stopping"; this.changed();
    this.socket.cancelPending();
    // Restore client locks immediately, then wait for any GM tile update in flight
    // before restoring the authoritative tile snapshot in finish().
    if (this.preview) await this.client.cleanup(true);
    else await this.socket.send("stop",{emergency:true,settings:this.briefing.settings});
    await this.task;
  }
  async finish(emergency) {
    clearInterval(this.heartbeat);
    const settings = this.briefing.settings;
    try {
      if (this.preview) await this.client.cleanup(true);
      else if (this.ownsRuntime) {
        await this.socket.send("stop",{emergency,settings},undefined,true);
        if (emergency || settings.tileFinish === "restore") await MapEffectsService.restoreTiles(this.scene,this.originalTiles);
        await this.socket.end();
      }
    } catch (e) {
      error(e); // Keep runtime snapshot for explicit recovery if restoration fails.
    } finally {
      this.active = false; this.index = -1; this.currentStep = null; this.status = "idle"; this.changed();
    }
  }
  async recover(scene) {
    if (!game.user.isActiveGM || this.active) throw new Error("Stop playback and use the active GM to recover a session");
    const runtime = scene.getFlag(ID,"runtime"); if (!runtime) return;
    await MapEffectsService.restoreTiles(scene,runtime.originalTiles ?? {});
    await scene.unsetFlag(ID,"runtime");
    warn("Session recovered. Player clients restore their local camera snapshot when the session flag is removed.");
  }
}
