import test from "node:test";
import assert from "node:assert/strict";
import {BriefingPlayer} from "../scripts/player.js";
import {plan,step,ID} from "../scripts/core.js";
function fixture() {
  const calls=[], flags={};
  const scene={id:"scene",tiles:new Map([["tile",{hidden:true}]]),getFlag:(ns,key)=>flags[key],unsetFlag:async(ns,key)=>delete flags[key],updateEmbeddedDocuments:async(type,updates)=>{calls.push(["tiles",updates]);for(const u of updates)Object.assign(scene.tiles.get(u._id),u);}};
  const users=[{id:"p1",name:"One",active:true,isGM:false,viewedScene:"scene"},{id:"p2",name:"Two",active:true,isGM:false,viewedScene:"scene"}];
  users.get=id=>users.find(x=>x.id===id);
  globalThis.game={user:{id:"gm",isGM:true,isActiveGM:true},users,modules:new Map([["LockView",{active:true,version:"2.1.0"}]])};
  globalThis.lockView={socket:{onSetView(){}},locks:{update(){},get(){}},Helpers:{getUserSetting:()=>true}};
  const client={start:async()=>calls.push(["preview-start"]),execute:async s=>calls.push(["preview-step",s.type]),cleanup:async()=>calls.push(["cleanup"]),pause(){},overlay:{clear(){}}};
  const socket={begin:async(s,p,targets,originalTiles)=>{flags.runtime={originalTiles};calls.push(["begin",targets]);},send:async(kind,data)=>calls.push([kind,data]),end:async()=>{delete flags.runtime;},cancelPending(){}};
  const player=new BriefingPlayer(socket,client,()=>{});
  return {player,scene,calls,flags};
}
test("live sequencer sends ordered steps to two players and restores only its tile snapshot",async()=>{
  const {player,scene,calls}=fixture();
  const p=plan("scene");p.steps=[step("camera"),step("tiles"),step("wait")];p.steps[1].data={tileIds:["tile"],operation:"show"};p.steps[2].duration=30;
  await player.play(p,scene);
  assert.deepEqual(calls.find(x=>x[0]==="begin")[1],["p1","p2"]);
  assert.deepEqual(calls.filter(x=>x[0]==="step").map(x=>x[1].step.type),["camera","tiles","wait"]);
  assert.equal(scene.tiles.get("tile").hidden,true);assert.equal(player.active,false);clearInterval(player.timer);
});
test("local preview emits no socket commands and performs no tile document writes",async()=>{
  const {player,scene,calls}=fixture();const p=plan("scene");p.steps=[step("tiles"),step("camera")];
  await player.play(p,scene,{preview:true});
  assert.deepEqual(calls.map(x=>x[0]),["preview-start","preview-step","preview-step","cleanup"]);clearInterval(player.timer);
});
test("manual continuation waits, pause freezes the clock, emergency stop restores keep-final tiles",async()=>{
  const {player,scene,calls}=fixture();const p=plan("scene");p.settings.tileFinish="keep";
  p.steps=[step("tiles"),step("wait")];p.steps[0].data={tileIds:["tile"],operation:"show"};p.steps[1].timing="manual";
  const playing=player.play(p,scene);while(player.status!=="waiting")await new Promise(r=>setTimeout(r,5));
  assert.equal(scene.tiles.get("tile").hidden,false);await player.pause();const elapsed=player.clock.elapsed;player.clock.tick(500);assert.equal(player.clock.elapsed,elapsed);
  await player.stop();await playing;assert.equal(scene.tiles.get("tile").hidden,true);assert.ok(calls.some(x=>x[0]==="stop"&&x[1].emergency));clearInterval(player.timer);
});
test("normal keep-final completion preserves tile changes",async()=>{
  const {player,scene}=fixture();const p=plan("scene");p.settings.tileFinish="keep";const s=step("tiles");s.data={tileIds:["tile"],operation:"show"};p.steps=[s];
  await player.play(p,scene);assert.equal(scene.tiles.get("tile").hidden,false);clearInterval(player.timer);
});
