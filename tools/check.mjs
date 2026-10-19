import fs from "node:fs/promises";
import path from "node:path";
import {spawnSync} from "node:child_process";
const root = process.cwd(), manifest = JSON.parse(await fs.readFile("module.json","utf8"));
const assert = (ok,message) => { if (!ok) throw new Error(message); };
for (const file of [...manifest.esmodules,...manifest.styles,...manifest.languages.map(l=>l.path),manifest.readme,manifest.license,"templates/planner.hbs"]) { await fs.access(file); }
assert(manifest.id==="dominion-briefing-planner","Wrong module id");
assert(manifest.relationships.requires.some(m=>m.id==="LockView"),"LockView must be required");
assert(!manifest.relationships.requires.some(m=>/lancer/i.test(m.id)),"Lancer must not be required");
assert(manifest.manifest.endsWith("/releases/latest/download/module.json"),"Stable manifest URL required");
assert(manifest.download.includes(`/v${manifest.version}/`),"Download/version mismatch");
assert(JSON.parse(await fs.readFile("package.json","utf8")).version===manifest.version,"Package version mismatch");
const en = JSON.parse(await fs.readFile("lang/en.json","utf8")).DBP, tr = JSON.parse(await fs.readFile("lang/tr.json","utf8")).DBP;
assert(JSON.stringify(Object.keys(en).sort())===JSON.stringify(Object.keys(tr).sort()),"Localization keys differ");
for (const file of await fs.readdir("scripts")) {
  if (!file.endsWith(".js")) continue;
  const full=path.join(root,"scripts",file), source=await fs.readFile(full,"utf8");
  const check=spawnSync(process.execPath,["--check",full],{encoding:"utf8"}); assert(check.status===0,check.stderr);
  for (const match of source.matchAll(/from\s+["'](\.[^"']+)["']/g)) await fs.access(path.resolve(path.dirname(full),match[1]));
  for (const match of source.matchAll(/\bt\(["']([^"']+)["']\)/g)) assert(Object.hasOwn(en,match[1]),`Missing translation ${match[1]}`);
}
console.log("Manifest, imports, JavaScript syntax and EN/TR localization verified.");
