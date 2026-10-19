import test from "node:test";
import assert from "node:assert/strict";
import {createSigningKey,signPacket,verifyPacket,BriefingSocketService} from "../scripts/protocol.js";
test("ECDSA rejects payload tampering and signatures from another key",async()=>{
  const keys=await createSigningKey(), other=await createSigningKey();
  const packet=await signPacket(keys.privateKey,{sessionId:"s",kind:"camera",x:12});
  assert.equal(await verifyPacket(keys.publicKey,packet),true);
  assert.equal(await verifyPacket(other.publicKey,packet),false);
  packet.body.x=15; assert.equal(await verifyPacket(keys.publicKey,packet),false);
});
test("GM trust anchor, targets, replay suppression and forged sender rejection",async()=>{
  const keys=await createSigningKey(); const calls=[];
  const runtime={id:"session",briefingId:"briefing",sceneId:"scene",directorId:"gm",targets:["player1","player2"],publicKey:keys.publicKey,expires:Date.now()+10000};
  const users=new Map([["gm",{id:"gm",isGM:true,active:true}],["player1",{id:"player1",active:true}],["player2",{id:"player2",active:true}]]); users.activeGM={id:"gm"};
  globalThis.game={user:{id:"player1"},users,scenes:new Map([["scene",{getFlag:()=>runtime}]]),socket:{on(){},emit(){}}};
  const socket=new BriefingSocketService({handle:async b=>{calls.push({user:game.user.id,kind:b.kind});}});
  const body={version:1,sessionId:"session",briefingId:"briefing",sceneId:"scene",directorId:"gm",targets:["player1","player2"],sequence:1,kind:"start",messageId:"m"};
  const packet=await signPacket(keys.privateKey,body);
  await socket.receive(packet); await socket.receive(packet); assert.equal(calls.length,1);
  // A separate client has independent replay tracking; two recipients execute once each.
  game.user={id:"player2"}; const second=new BriefingSocketService({handle:async b=>calls.push({user:game.user.id,kind:b.kind})}); await second.receive(packet); assert.equal(calls.length,2);
  await second.receive({...packet,body:{...body,sequence:2,kind:"step"}}); assert.equal(calls.length,2);
  const attacker=await createSigningKey(); await second.receive(await signPacket(attacker.privateKey,{...body,sequence:3,directorId:"gm"})); assert.equal(calls.length,2);
  await second.receive(await signPacket(keys.privateKey,{...body,sequence:4,targets:["someoneElse"]})); assert.equal(calls.length,2);
  runtime.id="replaced"; await second.receive(await signPacket(keys.privateKey,{...body,sequence:5})); assert.equal(calls.length,2);
});
