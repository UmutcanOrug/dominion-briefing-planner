import {tileUpdates, warn, t} from "./core.js";
export class MapEffectsService {
  markers = [];
  ping(data) {
    const node = document.createElement("div"); node.className = "dbp-marker"; node.style.setProperty("--marker-color",data.color);
    const ring = document.createElement("i"); ring.style.animationDuration = `${data.lifetime/data.pulses}ms`;
    const label = document.createElement("span"); label.textContent = data.label; node.append(ring,label); document.body.append(node);
    this.markers.push({node,data,elapsed:0}); this.tick(0);
  }
  tick(delta) {
    for (const marker of [...this.markers]) {
      marker.elapsed += delta;
      if (marker.elapsed >= marker.data.lifetime || !canvas.ready) { marker.node.remove(); this.markers.splice(this.markers.indexOf(marker),1); continue; }
      const p = canvas.stage.worldTransform.apply({x:marker.data.x,y:marker.data.y});
      const view = canvas.app.canvas ?? canvas.app.view, rect = view.getBoundingClientRect();
      marker.node.style.left = `${rect.left + p.x*rect.width/canvas.app.screen.width}px`;
      marker.node.style.top = `${rect.top + p.y*rect.height/canvas.app.screen.height}px`;
    }
  }
  pause(paused) { for (const marker of this.markers) marker.node.firstChild.style.animationPlayState = paused ? "paused" : "running"; }
  clear() { for (const m of this.markers) m.node.remove(); this.markers = []; }
  static async applyTiles(scene,s) {
    if (!game.user.isGM) throw new Error("Only the GM can change scene tiles");
    const missing = s.data.tileIds.filter(id => !scene.tiles.has(id));
    if (missing.length) warn(`${t("MissingTiles")}: ${missing.join(", ")}`);
    const updates = tileUpdates(scene,s); if (updates.length) await scene.updateEmbeddedDocuments("Tile",updates);
  }
  static async restoreTiles(scene,originals) {
    if (!game.user.isGM) return;
    const updates = Object.entries(originals).filter(([id]) => scene.tiles.has(id)).map(([_id,hidden]) => ({_id,hidden}));
    if (updates.length) await scene.updateEmbeddedDocuments("Tile",updates);
  }
}
