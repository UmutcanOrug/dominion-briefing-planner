export const ID = "dominion-briefing-planner";
export const SCHEMA = 1;
export const TYPES = ["camera", "dialogue", "ping", "tiles", "wait", "lock"];
export const clone = value => structuredClone(value);
export const uid = () => crypto.randomUUID();
export const t = key => globalThis.game?.i18n?.localize(`DBP.${key}`) ?? key;
export const warn = message => { console.warn(`${ID} | ${message}`); globalThis.ui?.notifications?.warn(escapeHTML(message)); };
export const error = e => { console.error(ID, e); globalThis.ui?.notifications?.error(escapeHTML(`${t("Error")}: ${e.message ?? e}`)); };
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"})[c]);
export const n = (value, fallback = 0, min = -1000000, max = 1000000) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
const str = (value, max = 1000) => typeof value === "string" ? value.slice(0, max) : "";
const choice = (value, list, fallback) => list.includes(value) ? value : fallback;
export const ids = value => Array.isArray(value) ? [...new Set(value.filter(x => typeof x === "string" && /^[\w-]{1,80}$/.test(x)))].slice(0, 200) : [];
export function asset(value) {
  const path = str(value, 2048).trim();
  if (/^(?:[a-z]+:|\/\/)/i.test(path) && !/^https?:\/\//i.test(path)) return "";
  return path;
}
export function step(type = "dialogue") {
  return normalizeStep({id: uid(), type, enabled: true, timing: type === "dialogue" ? "auto" : type === "wait" ? "duration" : "immediate", duration: type === "wait" ? 1500 : 0, data: {}});
}
export function normalizeStep(raw) {
  if (!raw || !TYPES.includes(raw.type)) throw new Error("Unknown timeline action");
  const d = raw.data ?? {};
  let data;
  if (raw.type === "camera") data = {x:n(d.x), y:n(d.y), scale:n(d.scale,1,0.05,3), motion:choice(d.motion,["smooth","instant"],"smooth"), moveDuration:n(d.moveDuration,2000,0,60000), easing:choice(d.easing,["easeInOut","linear"],"easeInOut"), lockPan:!!d.lockPan, lockZoom:!!d.lockZoom, targets:ids(d.targets)};
  if (raw.type === "dialogue") data = {
    speaker:str(d.speaker || "Command", 150), subtitle:str(d.subtitle,150), portrait:asset(d.portrait), message:str(d.message,20000),
    style:choice(d.style,["military","radio","imperial"],"military"), font:choice(d.font,["sans-serif","serif","monospace"],"sans-serif"),
    fontSize:n(d.fontSize,18,12,40), color:/^#[\da-f]{6}$/i.test(d.color) ? d.color : "#e3e9df",
    speed:n(d.speed,35,0,250), width:n(d.width,700,280,1200), position:choice(d.position,["bottom","top","center"],"bottom"),
    typingSound:asset(d.typingSound), voiceover:asset(d.voiceover), audioSync:!!d.audioSync, hold:n(d.hold,1500,0,60000), volume:n(d.volume,0.6,0,1), preset:str(d.preset,80)
  };
  if (raw.type === "ping") data = {x:n(d.x), y:n(d.y), color:/^#[\da-f]{6}$/i.test(d.color) ? d.color : "#ef6658", label:str(d.label,150), lifetime:n(d.lifetime,3000,100,120000), pulses:n(d.pulses,3,1,30), pull:!!d.pull};
  if (raw.type === "tiles") data = {tileIds:ids(d.tileIds), operation:choice(d.operation,["show","hide","toggle"],"show")};
  if (raw.type === "wait") data = {};
  if (raw.type === "lock") data = {control:choice(d.control,["pan","zoom","both"],"both"), locked:d.locked !== false};
  return {id: /^[\w-]{1,80}$/.test(raw.id) ? raw.id : uid(), type:raw.type, label:str(raw.label,150), enabled:raw.enabled !== false,
    timing:choice(raw.timing,["immediate","duration","manual","auto"],"immediate"), duration:n(raw.duration,0,0,3600000), data};
}
export function plan(sceneId, name = "New briefing") {
  return normalizePlan({id:uid(), name, sceneId, steps:[]}, sceneId);
}
export function normalizePlan(raw, sceneId) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid briefing document");
  if (raw.schemaVersion && raw.schemaVersion > SCHEMA) throw new Error("This briefing requires a newer module version");
  if (!Array.isArray(raw.steps) || raw.steps.length > 500) throw new Error("Briefing must contain at most 500 steps");
  const settings = raw.settings ?? {};
  const steps = raw.steps.map(normalizeStep);
  const seen = new Set();
  for (const s of steps) { if (seen.has(s.id)) s.id = uid(); seen.add(s.id); }
  return {id: /^[\w-]{1,80}$/.test(raw.id) ? raw.id : uid(), schemaVersion:SCHEMA, name:str(raw.name || "New briefing",150), sceneId,
    steps, targets:ids(raw.targets), presets:(Array.isArray(raw.presets) ? raw.presets : []).slice(0,100).map(p => ({id:/^[\w-]{1,80}$/.test(p?.id) ? p.id : uid(), name:str(p?.name,150), data:normalizeStep({type:"dialogue",data:p?.data}).data})),
    settings:{targetMode:choice(settings.targetMode,["scene","selected"],"scene"), pullScene:!!settings.pullScene, lockAll:!!settings.lockAll,
      restoreCamera:settings.restoreCamera !== false, restoreLocks:settings.restoreLocks !== false, tileFinish:choice(settings.tileFinish,["restore","keep"],"restore")}};
}
export function tileUpdates(scene, s) {
  return s.data.tileIds.flatMap(id => { const tile = scene.tiles.get(id); return tile ? [{_id:id, hidden:s.data.operation === "toggle" ? !tile.hidden : s.data.operation === "hide"}] : []; });
}
export function captureTiles(scene, steps) {
  return Object.fromEntries([...new Set(steps.filter(s => s.enabled && s.type === "tiles").flatMap(s => s.data.tileIds))].filter(id => scene.tiles.has(id)).map(id => [id, scene.tiles.get(id).hidden]));
}
export class PlaybackClock {
  elapsed = 0; paused = false; cancelled = false;
  tick(delta) { if (!this.paused && !this.cancelled) this.elapsed += Math.max(0, delta); }
  async wait(ms, predicate = () => false) {
    const start = this.elapsed;
    while (!this.cancelled && (this.paused || (this.elapsed - start < ms && !predicate()))) await sleep(30);
  }
}
