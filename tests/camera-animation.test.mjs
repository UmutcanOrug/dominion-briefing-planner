import test from "node:test";
import assert from "node:assert/strict";
import {setImmediate as settle} from "node:timers/promises";
import {LockViewAdapter} from "../scripts/lock-view-adapter.js";
function fixture() {
  const frames = new Map(), positions = []; let id=0;
  globalThis.requestAnimationFrame = callback => { frames.set(++id,callback); return id; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  globalThis.window = {innerWidth:1200,innerHeight:800};
  globalThis.game = {user:{id:"p"},modules:new Map([["LockView",{active:true,version:"2.1.0"}]])};
  globalThis.canvas = {ready:true,scene:{id:"scene",_viewPosition:{x:0,y:0,scale:1}}};
  globalThis.lockView = {Helpers:{getUserSetting:()=>true},locks:{applyLocks:true,pan:true,zoom:true,get(){return {pan:this.pan,zoom:this.zoom,boundingBox:false};},update(p){Object.assign(this,p);}},socket:{async onSetView(d){lockView.locks.applyLocks=false;canvas.scene._viewPosition={x:d.position.x+d.width/2,y:d.position.y+window.innerHeight/(2*(window.innerWidth/d.width)),scale:window.innerWidth/d.width};positions.push(structuredClone(canvas.scene._viewPosition));lockView.locks.applyLocks=true;}}};
  const adapter = new LockViewAdapter();
  const target = {x:1000,y:600,scale:2,motion:"smooth",moveDuration:1000,easing:"linear"};
  const frame = async time => { const next=frames.entries().next().value; assert.ok(next,"Expected a pending animation frame");frames.delete(next[0]);next[1](time);await settle(); };
  return {adapter,frames,positions,target,frame};
}
test("camera travels through intermediate centers and zoom levels with Lock View locks retained",async()=>{
  const {adapter,target,frame,positions,frames}=fixture();
  const finished=adapter.move(target);await settle();await frame(0);await frame(250);
  assert.equal(canvas.scene._viewPosition.x,250);assert.equal(canvas.scene._viewPosition.y,150);assert.equal(canvas.scene._viewPosition.scale,1.25);
  assert.equal(lockView.locks.applyLocks,true);assert.equal(lockView.locks.pan,true);assert.equal(lockView.locks.zoom,true);
  await frame(1000);assert.equal(await finished,true);assert.equal(positions.at(-1).x,1000);assert.equal(frames.size,0);
});
test("camera pause freezes movement and resume excludes elapsed paused time",async()=>{
  const {adapter,target,frame,frames}=fixture();const finished=adapter.move(target);await settle();await frame(0);await frame(250);
  adapter.pause(true);assert.equal(frames.size,0);assert.equal(canvas.scene._viewPosition.x,250);
  adapter.pause(false);await frame(9000);assert.equal(canvas.scene._viewPosition.x,250);
  await frame(9250);assert.equal(canvas.scene._viewPosition.x,500);await frame(9750);assert.equal(await finished,true);
});
test("Next finishes at the destination and Stop cancels without another camera frame",async()=>{
  const {adapter,target,frame,frames}=fixture();const finished=adapter.move(target);await settle();await frame(0);await frame(200);
  await adapter.finish();assert.equal(await finished,true);assert.equal(canvas.scene._viewPosition.x,1000);assert.equal(frames.size,0);
  const cancelled=adapter.move({...target,x:0});await settle();await frame(300);await frame(500);const before=canvas.scene._viewPosition.x;
  await adapter.cancel();assert.equal(await cancelled,false);assert.equal(canvas.scene._viewPosition.x,before);assert.equal(frames.size,0);assert.equal(lockView.locks.applyLocks,true);
});
test("easing changes the path and scene teardown cancels without moving the next scene",async()=>{
  const {adapter,target,frame,frames}=fixture();const finished=adapter.move({...target,easing:"easeInOut"});await settle();await frame(0);await frame(250);
  assert.ok(canvas.scene._viewPosition.x>140&&canvas.scene._viewPosition.x<150);
  canvas.scene={id:"other",_viewPosition:{x:7,y:8,scale:1}};await frame(500);
  assert.equal(await finished,false);assert.equal(canvas.scene._viewPosition.x,7);assert.equal(frames.size,0);
});
test("errors restore applyLocks and cancellation invalidates a not-yet-started move",async()=>{
  const {adapter,target,frame,frames}=fixture();
  lockView.socket.onSetView=async()=>{lockView.locks.applyLocks=false;throw new Error("pan failed");};
  const failed=adapter.move(target);const checked=assert.rejects(failed,/pan failed/);await settle();await frame(0);await checked;
  assert.equal(lockView.locks.applyLocks,true);assert.equal(adapter.animation,null);
  const cancelled=adapter.move(target);await adapter.cancel();assert.equal(await cancelled,false);assert.equal(frames.size,0);
});
