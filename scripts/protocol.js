import {ID, uid, sleep, warn} from "./core.js";
const algorithm = {name:"ECDSA",namedCurve:"P-256"};
const signing = {name:"ECDSA",hash:"SHA-256"};
const bytes = object => new TextEncoder().encode(JSON.stringify(object));
const b64 = array => btoa(String.fromCharCode(...new Uint8Array(array)));
const un64 = s => Uint8Array.from(atob(s),c => c.charCodeAt(0));
export async function createSigningKey() {
  const pair = await crypto.subtle.generateKey(algorithm,true,["sign","verify"]);
  return {privateKey:pair.privateKey, publicKey:await crypto.subtle.exportKey("jwk",pair.publicKey)};
}
export async function signPacket(key, body) { return {body,signature:b64(await crypto.subtle.sign(signing,key,bytes(body)))}; }
export async function verifyPacket(publicKey,packet) {
  try {
    const key = await crypto.subtle.importKey("jwk",publicKey,algorithm,false,["verify"]);
    return await crypto.subtle.verify(signing,key,un64(packet.signature),bytes(packet.body));
  } catch { return false; }
}
/** GM-only scene flag is the trust anchor; sender IDs in raw module sockets are never authority. */
export class BriefingSocketService {
  sequence = 0; received = new Map(); pending = new Map(); queue = Promise.resolve(); outgoing = Promise.resolve();
  constructor(client) {
    this.client = client;
    game.socket.on(`module.${ID}`, packet => {
      if (packet?.ack) { this.acknowledge(packet); return; }
      this.queue = this.queue.then(() => this.receive(packet)).catch(e => console.warn(ID,e));
    });
  }
  async begin(scene,briefing,targets,originalTiles) {
    if (!game.user.isActiveGM) throw new Error("The active GM must direct live briefings");
    this.keys = await createSigningKey(); this.sequence = 0;
    const runtime = {id:uid(),briefingId:briefing.id,sceneId:scene.id,directorId:game.user.id,targets,publicKey:this.keys.publicKey,
      created:Date.now(),expires:Date.now()+43200000,originalTiles};
    await scene.setFlag(ID,"runtime",runtime); this.runtime = runtime; this.scene = scene; return runtime;
  }
  async send(kind,data = {}, targets = this.runtime?.targets ?? [], expectAck = false) {
    if (!this.runtime) return [];
    const body = {version:1,sessionId:this.runtime.id,briefingId:this.runtime.briefingId,sceneId:this.runtime.sceneId,directorId:game.user.id,
      sequence:++this.sequence,messageId:uid(),kind,targets,data,sentAt:Date.now()};
    let pending;
    if (expectAck) { pending = {waiting:new Set(targets.filter(id => game.users.get(id)?.active)),errors:[]}; this.pending.set(body.messageId,pending); }
    const key = this.keys.privateKey;
    const emission = this.outgoing.then(async () => {
      const packet = await signPacket(key,body);
      game.socket.emit(`module.${ID}`,packet);
      if (targets.includes(game.user.id)) await this.receive(packet);
    });
    this.outgoing = emission.catch(() => {});
    await emission;
    if (!pending) return [];
    const timeout = Date.now() + (kind === "start" ? 18000 : 7000);
    while (pending.waiting.size && Date.now() < timeout && this.runtime?.id === body.sessionId) {
      for (const id of pending.waiting) if (!game.users.get(id)?.active) pending.waiting.delete(id);
      await sleep(50);
    }
    this.pending.delete(body.messageId);
    if (pending.waiting.size) warn(`Briefing: no ${kind} response from ${[...pending.waiting].map(id => game.users.get(id)?.name).join(", ")}. Continuing.`);
    pending.errors.forEach(warn); return pending.errors;
  }
  acknowledge(packet) {
    // ACKs are advisory, never authorize commands or document writes. Raw Foundry
    // module sockets do not expose authenticated senders; spoofed ACKs cannot run steps.
    const p = this.pending.get(packet.messageId);
    if (!p || packet.sessionId !== this.runtime?.id || !p.waiting.has(packet.userId)) return;
    p.waiting.delete(packet.userId);
    if (packet.error) p.errors.push(`${game.users.get(packet.userId)?.name}: ${String(packet.error).slice(0,500)}`);
  }
  async receive(packet) {
    const b = packet?.body;
    if (!b || b.version !== 1 || !Array.isArray(b.targets) || !b.targets.includes(game.user.id) || typeof packet.signature !== "string") return;
    if (JSON.stringify(packet).length > 100000 || !Number.isInteger(b.sequence)) return;
    const scene = game.scenes.get(b.sceneId), runtime = scene?.getFlag(ID,"runtime");
    if (!runtime || runtime.id !== b.sessionId || runtime.briefingId !== b.briefingId || runtime.expires < Date.now() || runtime.directorId !== b.directorId || game.users.activeGM?.id !== b.directorId) return;
    if (!runtime.targets.includes(game.user.id) || b.targets.some(id => !runtime.targets.includes(id))) return;
    if ((this.received.get(runtime.id) ?? 0) >= b.sequence || !(await verifyPacket(runtime.publicKey,packet))) return;
    this.received.set(runtime.id,b.sequence);
    if (this.received.size > 50) this.received.delete(this.received.keys().next().value);
    // Authentication is serialized; execution waits for canvasReady independently
    // so Stop and cancellation can interrupt a scene still loading.
    this.client.handle(b,runtime).then(() => this.reply(b)).catch(e => this.reply(b,e.message));
  }
  reply(body,error) {
    const packet = {ack:true,userId:game.user.id,messageId:body.messageId,sessionId:body.sessionId,error};
    if (game.user.id === this.runtime?.directorId) this.acknowledge(packet);
    game.socket.emit(`module.${ID}`,packet);
  }
  async end() {
    const scene = this.scene, id = this.runtime?.id;
    this.runtime = null; this.keys = null; this.pending.clear();
    if (id && scene?.getFlag(ID,"runtime")?.id === id) await scene.unsetFlag(ID,"runtime");
  }
  cancelPending() { for (const pending of this.pending.values()) pending.waiting.clear(); }
}
