import {ID,t,error} from "./core.js";
import {ClientPlayback} from "./client.js";
import {BriefingSocketService} from "./protocol.js";
import {BriefingPlayer} from "./player.js";
import {BriefingPlannerApp} from "./planner-app.js";
let client,socket,player,app;
function open() {
  if (!game.user.isGM || !canvas.ready) return;
  try { if (!app) app = new BriefingPlannerApp(player); app.render({force:true}); }
  catch(e) { error(e); }
}
Hooks.on("getSceneControlButtons",controls => {
  if (!game.user.isGM) return;
  if (controls.tokens?.tools) controls.tokens.tools.dominionBriefing = {name:"dominionBriefing",title:"DBP.Title",icon:"fa-solid fa-satellite-dish",button:true,onChange:open,visible:true,order:90};
});
Hooks.once("ready",() => {
  client = new ClientPlayback(); socket = new BriefingSocketService(client);
  player = new BriefingPlayer(socket,client,() => {
    if (!player.active && canvas.ready && app?.scene?.id !== canvas.scene?.id) app?.loadScene(canvas.scene);
    if (app?.rendered) app.render();
  });
  game.modules.get(ID).api = {open,stop:() => player.stop()};
  if (game.user.isActiveGM && game.scenes.some(scene=>scene.getFlag(ID,"runtime"))) ui.notifications.warn(t("RecoveryHint"));
});
Hooks.on("canvasTearDown",() => {
  app?.selection.cancel?.();
  if (player?.active) player.stop().catch(error);
  // Scene teardown can happen while a target client's new briefing scene loads.
  if (client?.snapshot) client.cleanup(true,{skipCamera:true}).catch(error);
});
Hooks.on("canvasReady",() => { if (app && !player.active) app.loadScene(canvas.scene); });
Hooks.on("updateScene",scene => {
  if (client?.session && !client.session.preview && scene.id===client.session.sceneId && scene.getFlag(ID,"runtime")?.id!==client.session.id) client.cleanup(true).catch(error);
});
window.addEventListener("beforeunload",() => { client?.overlay.clear(); client?.effects.clear(); });
