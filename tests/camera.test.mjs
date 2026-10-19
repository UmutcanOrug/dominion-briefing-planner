import test from "node:test";
import assert from "node:assert/strict";
import {LockViewAdapter} from "../scripts/lock-view-adapter.js";
test("Lock View bridge moves locked cameras at zero coordinates and restores in finally",async()=>{
  const updates=[]; let fail=false;
  globalThis.window={innerWidth:1920,innerHeight:1080};
  globalThis.game={user:{id:"p",name:"Player"},modules:new Map([["LockView",{active:true,version:"2.1.0"}]])};
  globalThis.canvas={ready:true,scene:{_viewPosition:{x:4,y:5,scale:1}}};
  globalThis.lockView={Helpers:{getUserSetting:()=>true},locks:{pan:true,zoom:true,applyLocks:true,get(){return {pan:this.pan,zoom:this.zoom,boundingBox:false};},update(patch,options){updates.push({patch,options});Object.assign(this,patch);}},socket:{async onSetView(data){lockView.locks.applyLocks=false;if(fail)throw new Error("pan failure");canvas.scene._viewPosition={x:data.position.x+data.width/2,y:data.position.y+(window.innerHeight/(window.innerWidth/data.width))/2,scale:window.innerWidth/data.width};}}};
  const adapter=new LockViewAdapter(), snapshot=adapter.capture();
  await adapter.move({x:0,y:0,scale:2}); assert.deepEqual(canvas.scene._viewPosition,{x:0,y:0,scale:2}); assert.equal(lockView.locks.applyLocks,true);
  adapter.locks({pan:false}); assert.deepEqual(updates[0].options,{fromSocket:true,save:false});
  await adapter.restore(snapshot); assert.deepEqual(canvas.scene._viewPosition,snapshot.position); assert.equal(lockView.locks.pan,true);
  fail=true; await assert.rejects(()=>adapter.move({x:3,y:5,scale:1})); assert.equal(lockView.locks.applyLocks,true);
});
test("unsupported dependency versions fail clearly",()=>{
  globalThis.game={modules:new Map([["LockView",{active:true,version:"3.0.0"}]])};
  assert.throws(()=>new LockViewAdapter().check(),/Compatible Lock View/);
});
