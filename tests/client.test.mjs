import test from "node:test";
import assert from "node:assert/strict";
import {ClientPlayback} from "../scripts/client.js";
import {step} from "../scripts/core.js";
function fixture() {
  const calls=[];
  globalThis.game={user:{id:"p"},users:new Map([["gm",{active:true}]]),scenes:new Map()};
  globalThis.canvas={ready:true,scene:{id:"scene"}};
  const client=new ClientPlayback();
  client.adapter={capture:()=>({position:{x:1,y:2,scale:1},locks:{pan:false,zoom:false}}),move:async d=>calls.push(["move",d]),locks:d=>calls.push(["locks",d]),restore:async(snapshot,options)=>calls.push(["restore",options])};
  client.overlay={clear:()=>calls.push(["clear"]),show:d=>calls.push(["dialogue",d]),pause:p=>calls.push(["pause",p]),tick(){}};
  client.effects={clear(){},ping:d=>calls.push(["ping",d]),pause(){},tick(){}};
  game.scenes.set("scene",{id:"scene"});
  return {client,calls};
}
test("recipient starts locally, pause applies to the next effect, stop restores and clears",async()=>{
  const {client,calls}=fixture();
  const runtime={id:"session",sceneId:"scene",directorId:"gm",lockAll:true};
  await client.handle({kind:"start",data:{}},runtime);
  assert.ok(calls.some(x=>x[0]==="locks"&&x[1].pan));
  await client.handle({kind:"pause",sessionId:"session"},runtime);
  await client.handle({kind:"step",sessionId:"session",data:{step:step("dialogue")}},runtime);
  assert.ok(calls.some(x=>x[0]==="dialogue"));assert.equal(client.paused,true);
  await client.handle({kind:"stop",sessionId:"session",data:{emergency:true,settings:{}}},runtime);
  assert.equal(client.session,null);assert.ok(calls.some(x=>x[0]==="restore"&&x[1].camera&&x[1].locks));clearInterval(client.timer);
});
test("camera-specific recipients filter movement and scene changes never restore old scene center",async()=>{
  const {client,calls}=fixture();await client.start({id:"s",sceneId:"scene",directorId:"gm"});
  const s=step("camera");s.data.targets=["other"];await client.execute(s);assert.equal(calls.filter(x=>x[0]==="move").length,0);
  s.data.targets=["p"];await client.execute(s);assert.equal(calls.filter(x=>x[0]==="move").length,1);
  canvas.scene={id:"different"};await client.cleanup(true);assert.equal(calls.find(x=>x[0]==="restore")[1].camera,false);clearInterval(client.timer);
});
test("watchdog restores local state after director disappearance",async()=>{
  const {client,calls}=fixture();await client.start({id:"s",sceneId:"scene",directorId:"gm"});
  game.users.get("gm").active=false;client.tick();await Promise.resolve();assert.equal(client.session,null);assert.ok(calls.some(x=>x[0]==="restore"));clearInterval(client.timer);
});
