const assert=require('node:assert/strict');
const {mkdir,writeFile}=require('node:fs/promises');
const path=require('node:path');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

exports.run=async({win,panelWin})=>{
 const js=source=>win.webContents.executeJavaScript(source);
 const pj=source=>panelWin.webContents.executeJavaScript(source);
 const snapshot=()=>js('window.dudidamAvatar.getAvatarSnapshot()');
 const out=process.env.DUDIDAM_AVATAR_SMOKE_DIR;
 if(out)await mkdir(out,{recursive:true});
 const capture=async name=>{if(out)await writeFile(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG());};
 const change=async(id,value)=>pj('(()=>{const el=document.getElementById('+JSON.stringify(id)+');el.value='+JSON.stringify(value)+';el.dispatchEvent(new Event('+JSON.stringify(id==='neuralZoom'?'input':'change')+',{bubbles:true}));return true;})()');
 let ready;
 for(let i=0;i<60;i++){ready=await snapshot();if(ready.ready)break;await wait(100);}
 assert.ok(ready.ready&&ready.points>10000,'reference must be bundled and sampled');
 await change('environment','dark');
 await change('color','cyan');
 await js("document.body.style.setProperty('background','#03080d','important');window.dudidamAvatar.hideAssistantPopup()");
 await wait(1800);await capture('01-reference-face');
 const base=await snapshot();assert.ok(base.surfaceLinks>200&&base.evolution>.02,'surface code must be connected and alive');
 const aim=async(x,y,name)=>{
  await js("(()=>{clearInterval(window.__smokeAimTimer);const area=document.getElementById('avatarArea'),r=area.getBoundingClientRect();const tick=()=>area.onpointermove({clientX:r.left+r.width*"+x+",clientY:r.top+r.height*"+y+",screenX:0,screenY:0});tick();window.__smokeAimTimer=setInterval(tick,35);})()");
  await wait(850);const head=(await snapshot()).head;await capture(name);
  await js("clearInterval(window.__smokeAimTimer)");return head;
 };
 const left=await aim(.06,.5,'06-look-left'),right=await aim(.94,.5,'07-look-right');
 const up=await aim(.5,.06,'08-look-up'),down=await aim(.5,.94,'09-look-down');
 assert.ok(left.yaw<-.28&&right.yaw>.28&&up.pitch>.17&&down.pitch<-.17,'four-way gaze must be visually distinct: '+JSON.stringify({left,right,up,down}));
 await js("document.getElementById('avatarArea').onpointerleave()");
 await change('emotion','happy');await wait(450);assert.equal((await snapshot()).emotion,'happy');
 await change('emotion','neutral');
 await pj("(()=>{for(const id of ['animate','track']){const input=document.getElementById(id);input.checked=false;input.dispatchEvent(new Event('change',{bubbles:true}));}})()");
 await wait(900);
 const mouthFrame=()=>js("(()=>{const canvas=document.getElementById('avatar'),scale=Math.min(canvas.width/1.32,canvas.height/1.78),width=Math.round(scale*.50),height=Math.round(scale*.34),x=Math.round((canvas.width-width)/2),y=Math.round(canvas.height*.48+.285*scale-height*.43),pixels=canvas.getContext('2d').getImageData(x,y,width,height).data;return Array.from({length:width*height},(_,i)=>pixels[i*4+3]);})()");
 const quietMouth=await mouthFrame();await capture('02-mouth-quiet');
 await pj("new BroadcastChannel('dudidam-avatar-panel').postMessage({type:'speech-level',level:.85})");
 await wait(500);assert.ok((await snapshot()).speech>.7);const speakingMouth=await mouthFrame();await capture('02-audio-lips');
 const mouthDifference=quietMouth.reduce((sum,value,i)=>sum+Math.abs(value-speakingMouth[i]),0)/quietMouth.length;
 assert.ok(mouthDifference>3,'mouth pixels must visibly change while speaking: '+mouthDifference.toFixed(2));
 await pj("new BroadcastChannel('dudidam-avatar-panel').postMessage({type:'speech-level',level:0})");
 await wait(600);assert.ok((await snapshot()).speech<.04);
 let liveVoiceLevels=[];
 if(process.env.DUDIDAM_VOICE_SMOKE==='1'){
  await pj("(()=>{document.getElementById('prompt').value='halo';document.getElementById('chatForm').requestSubmit();})()");
  let captured=false;
  for(let i=0;i<90;i++){
   const level=(await snapshot()).speech;
   if(level>.04){liveVoiceLevels.push(level);if(!captured&&level>.35){await capture('02-live-voice');captured=true;}}
   if(liveVoiceLevels.length>10&&level<.04)break;
   await wait(80);
  }
  assert.ok(liveVoiceLevels.length>8&&Math.max(...liveVoiceLevels)>.35,'Indonesian reply must drive the actual avatar mouth');
  assert.ok(Math.max(...liveVoiceLevels)-Math.min(...liveVoiceLevels)>.08,'real speech must vary the mouth opening');
 }
 await pj("(()=>{for(const id of ['animate','track']){const input=document.getElementById(id);input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));}})()");
 const first=(await snapshot()).head;await wait(500);const second=(await snapshot()).head;
 assert.ok(Math.abs(first.yaw-second.yaw)+Math.abs(first.pitch-second.pitch)>1e-7,'idle pose must remain alive');
 await change('neuralZoom','2.7');await wait(1100);
 const core=await snapshot();assert.equal(core.zoom,2.7);assert.equal(core.nodes,459);await capture('03-neural-core');
 await change('neuralZoom','1');await wait(1000);
 // Actual renderer pointer events -> existing Dudidam IPC -> native window move.
 const rect=await js("(()=>{const r=document.getElementById('avatarArea').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()");
  const before=win.getPosition();
  panelWin.hide();win.show();win.focus();
  await js("window.dragTrace=[];for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])document.getElementById('avatarArea').addEventListener(type,e=>window.dragTrace.push({type,x:e.screenX,y:e.screenY,clientX:e.clientX,clientY:e.clientY,buttons:e.buttons}),{capture:true})");
 await js('window.dudidamDesktop.passthrough(false)');await wait(100);
 const p={x:Math.round(rect.x),y:Math.round(rect.y)};
  win.webContents.sendInputEvent({type:'mouseDown',...p,globalX:before[0]+p.x,globalY:before[1]+p.y,button:'left',clickCount:1});
  await wait(100);
  win.webContents.sendInputEvent({type:'mouseMove',x:p.x+40,y:p.y+22,globalX:before[0]+p.x+40,globalY:before[1]+p.y+22,button:'left',modifiers:['leftButtonDown']});
 await wait(120);
  win.webContents.sendInputEvent({type:'mouseUp',x:p.x,y:p.y,globalX:before[0]+p.x+40,globalY:before[1]+p.y+22,button:'left',clickCount:1});
 await wait(150);
 const after=win.getPosition();
  const dragTrace=await js('window.dragTrace');
  assert.ok(Math.abs(after[0]-before[0])+Math.abs(after[1]-before[1])>10,'drag face must move native window: '+JSON.stringify({before,after,dragTrace}));
 await js("window.dudidamDesktop.minimize()");await wait(450);
 const during=(await snapshot()).presence;assert.ok(during>0&&during<1);await capture('04-dissolve');
 await wait(2850);assert.equal(win.isVisible(),false,'hide waits for particle dissolve');
 win.show();win.webContents.send('dudidam:show');await wait(450);await capture('05-assemble');
 await wait(1200);assert.equal((await snapshot()).presence,1);
 await js("document.body.style.removeProperty('background')");
 const report={passed:true,reference:ready,directions:{left,right,up,down},core,drag:{before,after},mouthDifference,liveVoiceSamples:liveVoiceLevels.length,speech:true,emotions:true,transitions:true};
 if(out)await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
 console.log('Reference avatar smoke passed: '+JSON.stringify(report));
};
