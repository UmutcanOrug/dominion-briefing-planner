import test from "node:test";
import assert from "node:assert/strict";
import {normalizePlan,normalizeStep,step,plan,tileUpdates,captureTiles,PlaybackClock,asset} from "../scripts/core.js";
import {BriefingStorage} from "../scripts/storage.js";
test("imports validate schema, clamp fields and reject executable assets",()=>{
  assert.throws(()=>normalizePlan({schemaVersion:99,steps:[]},"s"),/newer/);
  assert.throws(()=>normalizePlan({steps:[{type:"script"}]},"s"),/Unknown/);
  assert.throws(()=>normalizePlan({steps:Array(501).fill({type:"wait"})},"s"),/500/);
  const p=normalizePlan({id:"bad id",steps:[{type:"camera",data:{x:0,y:-25,scale:Infinity}},{type:"dialogue",data:{portrait:"javascript:alert(1)",message:"<script>text</script>",speed:-10}}]},"scene");
  assert.equal(p.sceneId,"scene"); assert.equal(p.steps[0].data.x,0); assert.equal(p.steps[0].data.scale,1);
  assert.equal(p.steps[1].data.portrait,""); assert.equal(p.steps[1].data.message,"<script>text</script>"); assert.equal(p.steps[1].data.speed,0);
  assert.equal(asset("https://assets.forge-vtt.com/abc/p.png"),"https://assets.forge-vtt.com/abc/p.png");
  assert.equal(asset("data:text/html,bad"),"");
});
test("normalization removes prototype keys, isolates presets and repairs duplicate IDs",()=>{
  const p=normalizePlan(JSON.parse('{"steps":[{"id":"one","type":"wait"},{"id":"one","type":"wait"}],"__proto__":{"unsafe":true}}'),"s");
  assert.notEqual(p.steps[0].id,p.steps[1].id); assert.equal(Object.hasOwn(p,"__proto__"),false);
  const malicious=normalizePlan({steps:[],presets:[{id:'"><img src=x onerror=alert(1)>',data:{}}]},"s");
  assert.match(malicious.presets[0].id,/^[\w-]+$/);
  const original=plan("s"); original.presets=[{id:"speaker",name:"General",data:step("dialogue").data}]; original.steps=[step("dialogue")];
  const copy=BriefingStorage.duplicate(original); copy.presets[0].data.speaker="Different";
  assert.notEqual(copy.id,original.id); assert.notEqual(copy.steps[0].id,original.steps[0].id); assert.notEqual(copy.presets[0].data.speaker,original.presets[0].data.speaker);
});
test("tile snapshots and updates touch only referenced tiles and skip missing IDs",()=>{
  const scene={tiles:new Map([["a",{hidden:true}],["b",{hidden:false}],["unrelated",{hidden:false}]])};
  const s=normalizeStep({type:"tiles",data:{tileIds:["a","b","missing"],operation:"toggle"}});
  assert.deepEqual(captureTiles(scene,[s]),{a:true,b:false});
  assert.deepEqual(tileUpdates(scene,s),[{_id:"a",hidden:false},{_id:"b",hidden:true}]);
  s.data.operation="show"; assert.ok(tileUpdates(scene,s).every(x=>x.hidden===false));
  s.enabled=false; assert.deepEqual(captureTiles(scene,[s]),{});
});
test("clock freezes while paused, skips manual wait and cancels without a dangling timer",async()=>{
  const c=new PlaybackClock(); c.tick(100); c.paused=true; c.tick(500); assert.equal(c.elapsed,100);
  c.paused=false; c.tick(50); assert.equal(c.elapsed,150);
  let skip=false; const waiting=c.wait(Infinity,()=>skip); skip=true; await waiting;
  const cancel=c.wait(Infinity); c.cancelled=true; await cancel;
});
test("scene flag persistence roundtrip and import never reuse identity",async()=>{
  globalThis.game={user:{isGM:true}};
  const scene={id:"scene",flags:{},getFlag:(ns,key)=>scene.flags[key],setFlag:async(ns,key,value)=>{scene.flags[key]=structuredClone(value);}};
  const p=plan("scene"); p.steps.push(step("camera"),step("dialogue"));
  await BriefingStorage.save(scene,[p]); const reloaded=BriefingStorage.load(scene);
  assert.deepEqual(reloaded,[p]); reloaded[0].name="Edited"; assert.notEqual(scene.flags.plans[0].name,"Edited");
  const imported=BriefingStorage.import(JSON.stringify(p),{id:"other"}); assert.equal(imported.sceneId,"other"); assert.notEqual(imported.id,p.id);
  game.user.isGM=false; await assert.rejects(()=>BriefingStorage.save(scene,[p]),/GM/);
});
