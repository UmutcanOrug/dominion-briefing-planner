import {t} from "./core.js";
export class CanvasSelectionService {
  cancel = null;
  async point(app) {
    this.cancel?.(); await app.minimize();
    ui.notifications.info(t("PickHint"));
    try {
      return await new Promise(resolve => {
        const view = canvas.app.canvas ?? canvas.app.view;
        const cleanup = () => { view.removeEventListener("pointerdown",pick,true); document.removeEventListener("keydown",key,true); clearTimeout(timer); this.cancel = null; };
        const pick = e => { if (e.button !== 0) return; e.preventDefault(); e.stopImmediatePropagation();
          const rect = view.getBoundingClientRect();
          const local = canvas.stage.worldTransform.applyInverse({x:(e.clientX-rect.left)*canvas.app.screen.width/rect.width,y:(e.clientY-rect.top)*canvas.app.screen.height/rect.height});
          cleanup(); resolve({x:Math.round(local.x),y:Math.round(local.y)}); };
        const key = e => { if (e.key === "Escape") { e.stopImmediatePropagation(); cleanup(); resolve(null); } };
        this.cancel = () => { cleanup(); resolve(null); };
        const timer = setTimeout(this.cancel,60000);
        view.addEventListener("pointerdown",pick,true); document.addEventListener("keydown",key,true);
      });
    } finally { await app.maximize(); }
  }
  async tiles(app) {
    this.cancel?.();
    const previous = canvas.activeLayer;
    const selected = canvas.tiles.controlled.map(tile => tile.id);
    await app.minimize(); canvas.tiles.activate();
    const bar = document.createElement("div"); bar.className = "dbp-selection";
    const hint = document.createElement("span"); hint.textContent = t("TileHint"); bar.append(hint);
    document.body.append(bar);
    try {
      return await new Promise(resolve => {
        const finish = value => { clearTimeout(timer); document.removeEventListener("keydown",key,true); this.cancel = null; resolve(value); };
        for (const [label,fn] of [["UseTiles",() => finish(canvas.tiles.controlled.map(x => x.id))],["Cancel",() => finish(null)]]) {
          const button = document.createElement("button"); button.textContent = t(label); button.onclick = fn; bar.append(button);
        }
        const key = e => { if (e.key === "Escape") { e.stopImmediatePropagation(); finish(null); } };
        this.cancel = () => finish(null); const timer = setTimeout(this.cancel,120000);
        document.addEventListener("keydown",key,true);
      });
    } finally {
      bar.remove(); canvas.tiles.releaseAll(); selected.forEach(id => canvas.tiles.get(id)?.control({releaseOthers:false})); previous?.activate(); await app.maximize();
    }
  }
}
