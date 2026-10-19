import {ID, clone, normalizeStep, sleep, warn} from "./core.js";
import {LockViewAdapter} from "./lock-view-adapter.js";
import {CommunicatorOverlay} from "./communicator.js";
import {MapEffectsService} from "./map-effects.js";
export class ClientPlayback {
  adapter = new LockViewAdapter(); overlay = new CommunicatorOverlay(); effects = new MapEffectsService(); paused = false;
  constructor() {
    this.last = performance.now();
    this.timer = setInterval(() => this.tick(),30);
  }
  tick() {
    const now = performance.now(), delta = now-this.last; this.last = now;
    if (this.session && !this.session.preview && (Date.now()-this.heartbeat > 25000 || !game.users.get(this.session.directorId)?.active)) {
      this.cleanup(true).catch(console.error); return;
    }
    if (!this.paused) { this.overlay.tick(delta); this.effects.tick(delta); }
    else this.effects.tick(0);
  }
  async handle(body,runtime) {
    if (body.kind === "start") { this.ready = this.start({...runtime,...body.data}); return this.ready; }
    if (this.session?.id !== body.sessionId) return;
    this.heartbeat = Date.now();
    if (body.kind === "heartbeat") return;
    if (body.kind === "stop") return this.cleanup(body.data.emergency,body.data.settings);
    if (body.kind === "pause" || body.kind === "resume") { this.pause(body.kind === "pause"); return; }
    if (body.kind === "clear") { this.overlay.clear(); return; }
    if (body.kind === "step") { await this.ready; if (this.session?.id === body.sessionId) await this.execute(normalizeStep(body.data.step)); }
  }
  async start(session) {
    await this.cleanup(true);
    this.session = session; this.heartbeat = Date.now(); this.paused = false;
    const scene = game.scenes.get(session.sceneId);
    if (!scene) throw new Error("Briefing scene is unavailable");
    if (canvas.scene?.id !== scene.id) {
      if (!session.pullScene) throw new Error("Player is on a different scene; enable scene pull");
      // Static Lock View clients require its documented forceView option.
      Promise.resolve(scene.view({forceView:true})).catch(e => warn(e.message));
    }
    const deadline = Date.now()+15000;
    while ((!canvas.ready || canvas.scene?.id !== scene.id) && Date.now() < deadline && this.session === session) await sleep(50);
    if (this.session !== session) return;
    if (!canvas.ready || canvas.scene?.id !== scene.id) { await this.cleanup(true); throw new Error("Scene canvas was not ready within 15 seconds"); }
    this.snapshot = this.adapter.capture(); this.snapshotSceneId = scene.id;
    if (session.lockAll) this.adapter.locks({pan:true,zoom:true},session.preview);
  }
  async execute(s) {
    if (!this.session || canvas.scene?.id !== this.session.sceneId) return;
    this.overlay.clear();
    const d = clone(s.data);
    if (s.type === "camera" && (!d.targets.length || d.targets.includes(game.user.id) || this.session.preview)) {
      await this.adapter.move(d);
      if (d.lockPan || d.lockZoom) this.adapter.locks({...(d.lockPan?{pan:true}:{}),...(d.lockZoom?{zoom:true}:{})},this.session.preview);
    }
    if (s.type === "dialogue") this.overlay.show(d);
    if (s.type === "ping") { this.effects.ping(d); if (d.pull) await this.adapter.move({...d,scale:canvas.scene._viewPosition.scale}); }
    if (s.type === "lock") this.adapter.locks(d.control === "both" ? {pan:d.locked,zoom:d.locked} : {[d.control]:d.locked},this.session.preview);
    if (s.type === "tiles" && this.session.preview) warn("Local preview: tile document updates are skipped.");
    if (this.paused) { this.overlay.pause(true); this.effects.pause(true); }
  }
  pause(paused) { this.paused = paused; this.overlay.pause(paused); this.effects.pause(paused); }
  async cleanup(emergency = true, settings = {}) {
    this.session = null; this.overlay.clear(); this.effects.clear(); this.paused = false;
    const snapshot = this.snapshot; this.snapshot = null;
    if (snapshot) await this.adapter.restore(snapshot,{camera:settings.skipCamera !== true && canvas.scene?.id===this.snapshotSceneId && (emergency || settings.restoreCamera !== false),locks:emergency || settings.restoreLocks !== false});
  }
}
