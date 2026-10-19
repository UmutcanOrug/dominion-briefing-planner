import {ID, TYPES, t, clone, uid, step, escapeHTML as e, error, warn} from "./core.js";
import {BriefingStorage} from "./storage.js";
import {CanvasSelectionService} from "./selection.js";
const {ApplicationV2,HandlebarsApplicationMixin} = foundry.applications.api;
const icons = {camera:"fa-crosshairs",dialogue:"fa-comment",ping:"fa-location-dot",tiles:"fa-eye",wait:"fa-clock",lock:"fa-lock"};
const btn = (cmd,label,icon = "",disabled = false,extra = "") => `<button type="button" data-cmd="${cmd}" title="${e(t(label))}" ${disabled?"disabled":""} ${extra}>${icon?`<i class="fa-solid ${icon}"></i>`:""}<span>${e(t(label))}</span></button>`;
export class BriefingPlannerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {id:"dominion-briefing-planner", classes:["dbp-planner"],position:{width:1120,height:720},window:{title:"DBP.Title",icon:"fa-solid fa-satellite-dish",resizable:true},tag:"div"};
  static PARTS = {main:{template:`modules/${ID}/templates/planner.hbs`,scrollable:[".dbp-library",".dbp-timeline",".dbp-properties"]}};
  selection = new CanvasSelectionService(); drafts = new Map(); dirty = false;
  constructor(player,options = {}) { super(options); this.player = player; this.loadScene(canvas.scene); }
  loadScene(scene) {
    if (!scene || this.player.active) return;
    if (this.scene) this.drafts.set(this.scene.id,{plans:this.plans,planId:this.planId,stepId:this.stepId,dirty:this.dirty});
    this.scene = scene;
    const draft = this.drafts.get(scene.id);
    this.plans = draft?.plans ?? BriefingStorage.load(scene); this.planId = draft?.planId ?? this.plans[0]?.id; this.stepId = draft?.stepId; this.dirty = draft?.dirty ?? false;
    if (this.rendered) this.render();
  }
  get plan() { return this.plans.find(p => p.id === this.planId); }
  get selected() { return this.plan?.steps.find(s => s.id === this.stepId); }
  _canRender() { return game.user.isGM && !!canvas.scene; }
  async _prepareContext() { return {body:this.body()}; }
  body() {
    const p = this.plan, active = this.player.active, status = this.player.status;
    const bar = `<header class="dbp-top"><div><b>${e(t("Title"))}</b><small>${e(this.scene.name)} ${this.dirty?`• ${e(t("Unsaved"))}`:""}</small></div><span class="dbp-status ${active?(this.player.preview?"preview":"live"):""}">${e(active ? t(this.player.preview?"Preview":"Live")+" · "+t(status) : t("Ready"))}</span>${btn("save","Save","fa-floppy-disk",active)}</header>`;
    const library = `<aside class="dbp-library"><h3>${e(t("Briefings"))}</h3><div class="dbp-pair">${btn("new","Create","fa-plus",active)}${btn("import","Import","fa-file-import",active)}</div><nav>${this.plans.map(b => `<button type="button" data-cmd="selectPlan" data-id="${b.id}" class="${p?.id===b.id?"selected":""}" ${active?"disabled":""}>${e(b.name)} <small>${b.steps.length}</small></button>`).join("")}</nav>${p?`<div class="dbp-pair">${btn("duplicatePlan","Duplicate","fa-copy",active)}${btn("deletePlan","Delete","fa-trash",active)}</div>${btn("export","Export","fa-file-export",active)}<h3>${e(t("Participants"))}</h3>${this.select("targetMode",["scene","selected"],p.settings.targetMode,"settings")}${game.users.filter(u=>!u.isGM).map(u=>`<label class="dbp-user"><input type="checkbox" data-user="${u.id}" ${p.targets.includes(u.id)?"checked":""} ${active?"disabled":""}><i class="dbp-dot ${u.active?"online":""}"></i>${e(u.name)}<small>${e(u.viewedScene===this.scene.id?t("OnScene"):t("OtherScene"))}</small></label>`).join("")}<h3>${e(t("PlaybackSettings"))}</h3>${["pullScene","lockAll","restoreCamera","restoreLocks"].map(k=>this.field(k,p.settings[k],"checkbox","settings")).join("")}${this.select("tileFinish",["restore","keep"],p.settings.tileFinish,"settings")}`:""}${btn("recover","Recover","fa-life-ring",active)}</aside>`;
    const timeline = `<main class="dbp-timeline"><div class="dbp-timeline-heading"><h3>${e(t("Timeline"))}</h3>${p?`<input type="text" aria-label="${e(t("Name"))}" value="${e(p.name)}" data-plan-name ${active?"disabled":""}>`:""}</div>${p?`<div class="dbp-add">${TYPES.map(type=>btn(`add:${type}`,type,icons[type],active)).join("")}</div><ol>${p.steps.map((s,i)=>`<li data-id="${s.id}" class="dbp-step ${s.type} ${this.stepId===s.id?"selected":""} ${this.player.currentStep===s.id?"playing":""} ${!s.enabled?"muted":""}"><button type="button" data-cmd="selectStep" data-id="${s.id}"><span class="dbp-number">${String(i+1).padStart(2,"0")}</span><i class="fa-solid ${icons[s.type]}"></i><span><b>${e(s.label || (s.type==="dialogue"?s.data.speaker:t(s.type)))}</b><small>${e(t(s.type))} · ${e(t(s.timing))}${s.duration?` · ${s.duration/1000}s`:""}</small></span></button><div class="dbp-step-tools">${btn("up","Up","fa-arrow-up",active||i===0,`data-id="${s.id}"`)}${btn("down","Down","fa-arrow-down",active||i===p.steps.length-1,`data-id="${s.id}"`)}</div></li>`).join("")}</ol>${!p.steps.length?`<p class="dbp-empty">${e(t("AddHint"))}</p>`:""}`:`<p class="dbp-empty">${e(t("CreateHint"))}</p>`}</main>`;
    const properties = `<aside class="dbp-properties"><h3>${e(t("Properties"))}</h3><fieldset ${active?"disabled":""}>${this.properties()}</fieldset></aside>`;
    const footer = `<footer class="dbp-playback">${btn("play","Play","fa-play",active||!p)}${btn("preview","Preview","fa-eye",active||!p)}${btn("previewStep","PreviewStep","fa-magnifying-glass-play",active||!this.selected)}<div class="dbp-divider"></div>${btn("pause",status==="paused"?"Resume":"Pause",status==="paused"?"fa-play":"fa-pause",!active||status==="starting")}${btn("next","Next","fa-forward-step",!active||status==="starting")}${btn("previous","Previous","fa-backward-step",true,`data-tooltip="${e(t("PreviousLimit"))}"`)}${btn("stop","Stop","fa-stop",!active)}<input type="file" data-import accept="application/json,.json" hidden></footer>`;
    return bar+`<div class="dbp-columns">${library}${timeline}${properties}</div>`+footer;
  }
  field(key,value,type="text",scope="data",extra="") {
    const attr = `data-field="${key}" data-scope="${scope}"`;
    const disabled = this.player.active ? "disabled" : "";
    return `<label class="dbp-field ${type==="checkbox"?"check":""}"><span>${e(t(key))}</span>${type==="textarea"?`<textarea ${attr} ${disabled} rows="6">${e(value)}</textarea>`:`<input type="${type}" ${attr} ${disabled} ${type==="checkbox"?(value?"checked":""):`value="${e(value)}"`} ${type==="number"?'step="any"':""} ${extra}>`}</label>`;
  }
  select(key,options,value,scope="data") {
    return `<label class="dbp-field"><span>${e(t(key))}</span><select data-field="${key}" data-scope="${scope}" ${this.player.active?"disabled":""}>${options.map(o=>`<option value="${e(o)}" ${o===value?"selected":""}>${e(t(o))}</option>`).join("")}</select></label>`;
  }
  properties() {
    const s = this.selected; if (!s) return `<p>${e(t("SelectHint"))}</p>`;
    const d = s.data;
    let html = this.field("label",s.label,"text","step")+this.field("enabled",s.enabled,"checkbox","step");
    if (["camera","ping"].includes(s.type)) {
      html += `<div class="dbp-pair">${this.field("x",d.x,"number")}${this.field("y",d.y,"number")}</div>${btn("pick","Pick","fa-crosshairs")}`;
    }
    if (s.type === "camera") html += this.field("scale",d.scale,"number","data",'min="0.05" max="3"')+btn("capture","Capture","fa-camera")+this.field("lockPan",d.lockPan,"checkbox")+this.field("lockZoom",d.lockZoom,"checkbox")+`<p class="dbp-note">${e(t("CameraLimit"))}</p><details><summary>${e(t("CameraTargets"))}</summary>${game.users.filter(u=>!u.isGM).map(u=>`<label class="dbp-user"><input type="checkbox" data-camera-user="${u.id}" ${d.targets.includes(u.id)?"checked":""}>${e(u.name)}</label>`).join("")}</details>`;
    if (s.type === "dialogue") {
      html += `<label class="dbp-field"><span>${e(t("Presets"))}</span><select data-preset><option value="">${e(t("SelectPreset"))}</option>${this.plan.presets.map(p=>`<option value="${p.id}">${e(p.name)}</option>`).join("")}</select></label><div class="dbp-pair">${btn("savePreset","SavePreset","fa-user-plus")}${btn("deletePreset","DeletePreset","fa-user-minus")}</div>`;
      for (const k of ["speaker","subtitle","portrait"]) html += this.field(k,d[k])+(k==="portrait"?btn("file:portrait","Browse","fa-folder-open"):"");
      html += this.field("message",d.message,"textarea")+this.select("style",["military","radio","imperial"],d.style)+this.select("font",["sans-serif","serif","monospace"],d.font);
      for (const k of ["fontSize","speed","width","hold","volume"]) html += this.field(k,d[k],"number");
      html += this.field("color",d.color,"color")+this.select("position",["bottom","top","center"],d.position);
      for (const k of ["typingSound","voiceover"]) html += this.field(k,d[k])+btn(`file:${k}`,"Browse","fa-folder-open");
      html += this.field("audioSync",d.audioSync,"checkbox");
    }
    if (s.type === "ping") html += this.field("color",d.color,"color")+this.field("label",d.label)+this.field("lifetime",d.lifetime,"number")+this.field("pulses",d.pulses,"number")+this.field("pull",d.pull,"checkbox");
    if (s.type === "tiles") html += btn("tiles","SelectTiles","fa-object-group")+`<ul class="dbp-tiles">${d.tileIds.map(id=>`<li>${e(id)} ${this.scene.tiles.has(id)?"":`⚠ ${e(t("Missing"))}`}</li>`).join("")}</ul>`+this.select("operation",["show","hide","toggle"],d.operation)+`<p class="dbp-note">${e(t("TilePreviewLimit"))}</p>`;
    if (s.type === "lock") html += this.select("control",["pan","zoom","both"],d.control)+this.field("locked",d.locked,"checkbox");
    html += `<hr>${this.select("timing",s.type==="dialogue"?["auto","manual","duration","immediate"]:["immediate","duration","manual"],s.timing,"step")}${this.field("duration",s.duration,"number","step",'min="0" max="3600000"')}<div class="dbp-pair">${btn("duplicateStep","Duplicate","fa-copy")}${btn("deleteStep","Delete","fa-trash")}</div>`;
    return html;
  }
  _onRender(context,options) {
    super._onRender(context,options);
    const root = this.element.querySelector(".dbp-shell");
    root.addEventListener("click",event=> { const button=event.target.closest("[data-cmd]"); if (button && !button.disabled) this.command(button.dataset.cmd,button).catch(error); });
    root.addEventListener("change",event => this.change(event).catch(error));
  }
  mark() { this.dirty = true; this.render(); }
  async change(event) {
    const el = event.target; if (this.player.active) return;
    if (el.matches("[data-import]")) {
      const file = el.files[0]; if (!file) return;
      if (file.size>2000000) throw new Error("Import exceeds 2 MB");
      const imported = BriefingStorage.import(await file.text(),this.scene); this.plans.push(imported); this.planId = imported.id; this.stepId = null; this.mark(); return;
    }
    if (!this.plan) return;
    if (el.matches("[data-plan-name]")) this.plan.name = el.value.slice(0,150);
    if (el.dataset.user) { this.plan.targets = this.plan.targets.filter(id=>id!==el.dataset.user); if (el.checked) this.plan.targets.push(el.dataset.user); }
    if (el.dataset.cameraUser && this.selected) { this.selected.data.targets = this.selected.data.targets.filter(id=>id!==el.dataset.cameraUser); if (el.checked) this.selected.data.targets.push(el.dataset.cameraUser); }
    if (el.matches("[data-preset]") && this.selected) {
      const preset = this.plan.presets.find(p=>p.id===el.value);
      if (preset) this.selected.data = {...clone(preset.data),message:this.selected.data.message,preset:preset.id};
    }
    if (el.dataset.field) {
      const target = el.dataset.scope === "settings" ? this.plan.settings : el.dataset.scope === "step" ? this.selected : this.selected?.data;
      if (target && Object.hasOwn(target,el.dataset.field)) target[el.dataset.field] = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.value;
    }
    this.mark();
  }
  async command(cmd,button) {
    const p = this.plan, s = this.selected;
    if (this.player.active && !["pause","next","stop","selectStep"].includes(cmd)) return;
    if (cmd === "save") { this.plans = await BriefingStorage.save(this.scene,this.plans); this.dirty = false; this.render(); return; }
    if (cmd === "new") { const b = BriefingStorage.create(this.scene); b.name = t("NewBriefing"); this.plans.push(b); this.planId = b.id; this.stepId = null; }
    if (cmd === "selectPlan") { this.planId = button.dataset.id; this.stepId = null; this.render(); return; }
    if (cmd === "selectStep") { this.stepId = button.dataset.id; this.render(); return; }
    if (cmd === "duplicatePlan" && p) { const b = BriefingStorage.duplicate(p); this.plans.push(b); this.planId = b.id; }
    if (cmd === "deletePlan" && p) { if (!(await foundry.applications.api.DialogV2.confirm({window:{title:t("Delete")},content:`<p>${e(p.name)} — ${e(t("DeleteConfirm"))}</p>`}))) return; this.plans = this.plans.filter(b=>b.id!==p.id); this.planId = this.plans[0]?.id; this.stepId = null; }
    if (cmd === "import") { this.element.querySelector("[data-import]").click(); return; }
    if (cmd === "export") { BriefingStorage.export(p); return; }
    if (cmd === "recover") { await this.player.recover(this.scene); return; }
    if (cmd.startsWith("add:") && p) { const newStep=step(cmd.split(":")[1]); const after=p.steps.findIndex(s=>s.id===this.stepId); p.steps.splice(after<0?p.steps.length:after+1,0,newStep); this.stepId=newStep.id; }
    if (cmd === "duplicateStep" && s) { const copy=clone(s); copy.id=uid(); p.steps.splice(p.steps.indexOf(s)+1,0,copy); this.stepId=copy.id; }
    if (cmd === "deleteStep" && s) { p.steps=p.steps.filter(x=>x.id!==s.id); this.stepId=null; }
    if (["up","down"].includes(cmd)) { const i=p.steps.findIndex(x=>x.id===button.dataset.id), j=i+(cmd==="up"?-1:1); if (i>=0 && j>=0 && j<p.steps.length) [p.steps[i],p.steps[j]]=[p.steps[j],p.steps[i]]; }
    if (cmd === "capture" && s) Object.assign(s.data,clone(canvas.scene._viewPosition));
    if (cmd === "pick" && s) { const point=await this.selection.point(this); if (point) Object.assign(s.data,point); }
    if (cmd === "tiles" && s) { const selected=await this.selection.tiles(this); if (selected) s.data.tileIds=selected; }
    if (cmd.startsWith("file:") && s) {
      const key=cmd.split(":")[1];
      // CONFIG respects Forge's registered native FilePicker implementation.
      const Picker=foundry.applications.apps.FilePicker.implementation;
      new Picker({type:key==="portrait"?"image":"audio",current:s.data[key],callback:path=>{s.data[key]=path;this.mark();}}).render(true); return;
    }
    if (cmd === "savePreset" && s) { const data=clone(s.data); data.message=""; const preset={id:uid(),name:data.speaker,data}; p.presets.push(preset); s.data.preset=preset.id; }
    if (cmd === "deletePreset" && s) { p.presets=p.presets.filter(x=>x.id!==s.data.preset); s.data.preset=""; }
    if (["play","preview","previewStep"].includes(cmd)) { await this.player.play(p,this.scene,{preview:cmd!=="play",onlyStep:cmd==="previewStep"?s.id:null}); return; }
    if (cmd === "pause") { await this.player.pause(); return; }
    if (cmd === "next") { this.player.next(); return; }
    if (cmd === "stop") { await this.player.stop(); return; }
    this.mark();
  }
  async _preClose(options) {
    if (this.player.active) await this.player.stop();
    this.selection.cancel?.();
    if (this.dirty) {
      const save=await foundry.applications.api.DialogV2.confirm({window:{title:t("Unsaved")},content:`<p>${e(t("SaveBeforeClose"))}</p>`});
      if (save) { this.plans=await BriefingStorage.save(this.scene,this.plans); this.dirty=false; }
    }
    return super._preClose(options);
  }
}
