import {ID, clone, normalizePlan, plan, uid} from "./core.js";
export class BriefingStorage {
  static load(scene) { return clone(scene.getFlag(ID,"plans") ?? []).map(p => normalizePlan(p, scene.id)); }
  static async save(scene, plans) {
    if (!game.user.isGM) throw new Error("Only a GM can save briefings");
    if (plans.length > 100) throw new Error("A scene supports at most 100 briefings");
    const normalized = plans.map(p => normalizePlan(p,scene.id));
    await scene.setFlag(ID,"plans",normalized);
    return normalized;
  }
  static create(scene) { return plan(scene.id); }
  static duplicate(p) { const copy = clone(p); copy.id = uid(); copy.name += " (copy)"; copy.steps.forEach(s => s.id = uid()); return copy; }
  static import(text, scene) {
    if (text.length > 2000000) throw new Error("Import exceeds 2 MB");
    const p = normalizePlan(JSON.parse(text),scene.id); p.id = uid(); return p;
  }
  static export(p) {
    const a = document.createElement("a");
    const url = URL.createObjectURL(new Blob([JSON.stringify(p,null,2)],{type:"application/json"}));
    a.href = url; a.download = `${p.name.replace(/[^\w-]/g,"_")}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  }
}
