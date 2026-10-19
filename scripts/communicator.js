import {asset} from "./core.js";
export async function audioDuration(path, timeout = 2500) {
  if (!path) return 0;
  return new Promise(resolve => {
    const audio = new Audio(asset(path));
    const done = value => { clearTimeout(timer); audio.onloadedmetadata = audio.onerror = null; audio.removeAttribute("src"); audio.load(); resolve(value); };
    const timer = setTimeout(() => done(0),timeout);
    audio.preload = "metadata"; audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? Math.min(audio.duration * 1000,3600000) : 0); audio.onerror = () => done(0);
  });
}
export class CommunicatorOverlay {
  show(data) {
    this.clear(); this.data = data; this.elapsed = 0; this.count = 0;
    const root = document.createElement("section"); root.className = `dbp-communicator dbp-${data.style} dbp-${data.position}`;
    root.setAttribute("aria-label",data.speaker); root.style.width = `${data.width}px`; root.style.color = data.color;
    root.style.fontFamily = data.font; root.style.fontSize = `${data.fontSize}px`;
    const img = document.createElement("img"); img.src = data.portrait || "icons/svg/mystery-man.svg"; img.alt = data.speaker;
    img.onerror = () => { img.onerror = null; img.src = "icons/svg/mystery-man.svg"; };
    const body = document.createElement("div"); body.className = "dbp-comm-body";
    const name = document.createElement("strong"); name.textContent = data.speaker;
    const sub = document.createElement("small"); sub.textContent = data.subtitle;
    this.text = document.createElement("p"); this.text.setAttribute("role","log");
    body.append(name,sub,this.text); root.append(img,body); document.body.append(root); this.root = root;
    this.characters = Array.from(data.message);
    this.voice = data.voiceover ? new Audio(data.voiceover) : null;
    this.typing = !data.voiceover && data.typingSound ? new Audio(data.typingSound) : null;
    if (this.voice) {
      const voice = this.voice; voice.volume = data.volume;
      voice.onloadedmetadata = () => { if (data.audioSync && Number.isFinite(voice.duration)) this.syncDuration = voice.duration * 1000; };
      voice.onerror = () => { this.syncDuration = 0; };
      voice.play().catch(() => { this.syncDuration = 0; });
    }
    if (this.typing) this.typing.volume = data.volume;
    this.tick(0);
  }
  tick(delta) {
    if (!this.root || this.paused) return;
    this.elapsed += delta;
    const speed = this.syncDuration ? this.syncDuration / Math.max(1,this.characters.length) : this.data.speed;
    const count = speed === 0 ? this.characters.length : Math.min(this.characters.length,Math.floor(this.elapsed / speed));
    if (count !== this.count) {
      this.text.textContent = this.characters.slice(0,count).join(""); this.text.scrollTop = this.text.scrollHeight;
      if (this.typing && count % 3 === 0) { this.typing.currentTime = 0; this.typing.play().catch(() => {}); }
      this.count = count;
    }
  }
  pause(paused) {
    this.paused = paused;
    if (paused) { this.voice?.pause(); this.typing?.pause(); }
    else if (this.voice && !this.voice.ended) this.voice.play().catch(() => {});
  }
  clear() {
    for (const audio of [this.voice,this.typing]) if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); }
    this.root?.remove(); this.root = null; this.voice = this.typing = null; this.syncDuration = 0; this.paused = false;
  }
}
