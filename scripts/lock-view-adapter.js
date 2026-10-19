import {clone, warn} from "./core.js";
/** Internal Lock View 2.x bridge. Never imports or writes dependency files/flags. */
export class LockViewAdapter {
  animation = null; paused = false; draining = null; generation = 0;
  check() {
    const module = game.modules.get("LockView"), lv = globalThis.lockView;
    if (!module?.active || !/^2\./.test(module.version) || typeof lv?.socket?.onSetView !== "function" || typeof lv?.locks?.update !== "function" || typeof lv?.locks?.get !== "function" || typeof lv?.Helpers?.getUserSetting !== "function")
      throw new Error("Compatible Lock View 2.x is required. Check the module and reload Foundry.");
    return lv;
  }
  enabled(userId = game.user.id) { return !!this.check().Helpers.getUserSetting("enable",userId); }
  capture() {
    const lv = this.check();
    return {locks:clone(lv.locks.get()), applyLocks:lv.locks.applyLocks, position:clone(canvas.scene._viewPosition)};
  }
  async setPosition({x,y,scale}) {
    const lv = this.check(), apply = lv.locks.applyLocks;
    // Lock View's absolute API consumes the viewport's top-left, not its center.
    // Unlike onSetViewDialog, onSetView correctly accepts zero coordinates.
    try { await lv.socket.onSetView({type:"absolute",position:{x:x-window.innerWidth/(2*scale),y:y-window.innerHeight/(2*scale)},width:window.innerWidth/scale}); }
    finally { lv.locks.applyLocks = apply; }
  }
  async move(destination) {
    const generation = ++this.generation;
    await this.cancel({invalidate:false});
    if (generation !== this.generation) return false;
    if (destination.motion !== "smooth" || !(destination.moveDuration > 0)) {
      await this.setPosition(destination); return true;
    }
    this.check();
    const from = clone(canvas.scene._viewPosition);
    return new Promise((resolve,reject) => {
      const animation = {from,to:clone(destination),sceneId:canvas.scene.id,elapsed:0,previous:null,frame:null,inFlight:null,resolve,reject};
      this.animation = animation;
      this.schedule(animation);
    });
  }
  schedule(animation) {
    if (this.animation !== animation || this.paused || animation.frame !== null) return;
    animation.frame = requestAnimationFrame(time => {
      animation.frame = null;
      this.advance(animation,time).catch(e => {
        if (this.animation === animation) { this.animation = null; animation.reject(e); }
      });
    });
  }
  async advance(animation,time) {
    if (this.animation !== animation || this.paused) return;
    if (!canvas.ready || canvas.scene?.id !== animation.sceneId) { await this.cancel(); return; }
    if (animation.previous !== null) animation.elapsed += Math.max(0,time-animation.previous);
    animation.previous = time;
    const progress = Math.min(1,animation.elapsed/animation.to.moveDuration);
    const eased = animation.to.easing === "linear" ? progress : (1-Math.cos(Math.PI*progress))/2;
    const position = Object.fromEntries(["x","y","scale"].map(key => [key,animation.from[key]+(animation.to[key]-animation.from[key])*eased]));
    // Every frame uses Lock View's own authorized move. Its lock bypass exists
    // only within that one call and is restored before yielding to user input.
    // Never leave applyLocks=false for a whole multi-second animation.
    animation.inFlight = this.setPosition(position);
    try { await animation.inFlight; } finally { animation.inFlight = null; }
    if (this.animation !== animation) return;
    if (progress === 1) { this.animation = null; animation.resolve(true); }
    else this.schedule(animation);
  }
  pause(paused) {
    this.paused = paused;
    const animation = this.animation; if (!animation) return;
    animation.previous = null;
    if (paused && animation.frame !== null) { cancelAnimationFrame(animation.frame); animation.frame = null; }
    if (!paused && !animation.inFlight) this.schedule(animation);
  }
  async cancel({finish = false, invalidate = true} = {}) {
    if (invalidate) this.generation++;
    const previous = this.draining;
    const animation = this.animation;
    if (!animation) { await previous; return; }
    this.animation = null;
    if (animation.frame !== null) cancelAnimationFrame(animation.frame);
    const draining = (async () => {
      try {
        await previous; await animation.inFlight;
        if (finish && canvas.ready && canvas.scene?.id === animation.sceneId) await this.setPosition(animation.to);
        animation.resolve(finish);
      } catch(e) { animation.reject(e); throw e; }
    })();
    this.draining = draining;
    try { await draining; } finally { if (this.draining === draining) this.draining = null; }
  }
  async finish() { await this.cancel({finish:true}); }
  locks(patch, preview = false) {
    const lv = this.check();
    if (!preview && !this.enabled()) warn(`${game.user.name}: Lock View Enable is disabled; camera locks cannot be enforced.`);
    // fromSocket=true prevents Lock View's own all-user broadcast. save=false avoids flag writes.
    lv.locks.update(patch,{fromSocket:true,save:false});
  }
  async restore(snapshot, {camera = true, locks = true} = {}) {
    await this.cancel(); this.paused = false;
    if (!snapshot) return;
    const lv = this.check();
    try { if (camera && canvas.ready) await this.move(snapshot.position); }
    finally {
      if (locks) this.locks(snapshot.locks,true);
      lv.locks.applyLocks = snapshot.applyLocks;
    }
  }
}
