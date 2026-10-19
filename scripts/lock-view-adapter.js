import {clone, warn} from "./core.js";
/** Internal Lock View 2.x bridge. Never imports or writes dependency files/flags. */
export class LockViewAdapter {
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
  async move({x,y,scale}) {
    const lv = this.check(), apply = lv.locks.applyLocks;
    // Lock View's absolute API consumes the viewport's top-left, not its center.
    // Unlike onSetViewDialog, onSetView correctly accepts zero coordinates.
    try { await lv.socket.onSetView({type:"absolute",position:{x:x-window.innerWidth/(2*scale),y:y-window.innerHeight/(2*scale)},width:window.innerWidth/scale}); }
    finally { lv.locks.applyLocks = apply; }
  }
  locks(patch, preview = false) {
    const lv = this.check();
    if (!preview && !this.enabled()) warn(`${game.user.name}: Lock View Enable is disabled; camera locks cannot be enforced.`);
    // fromSocket=true prevents Lock View's own all-user broadcast. save=false avoids flag writes.
    lv.locks.update(patch,{fromSocket:true,save:false});
  }
  async restore(snapshot, {camera = true, locks = true} = {}) {
    if (!snapshot) return;
    const lv = this.check();
    try { if (camera && canvas.ready) await this.move(snapshot.position); }
    finally {
      if (locks) this.locks(snapshot.locks,true);
      lv.locks.applyLocks = snapshot.applyLocks;
    }
  }
}
