const {app,BrowserWindow,ipcMain,shell,dialog,screen,desktopCapturer,Tray,Menu,nativeImage,globalShortcut}=require('electron');
const http=require('node:http');
const {readFile,writeFile}=require('node:fs/promises');
const path=require('node:path');

let win,server,origin,bridges,agentHub,tray,saveTimer;
let quitting=false;
let passthrough=false;
let passthroughLocked=false;
const summonShortcut='CommandOrControl+Alt+5';
const ciSmoke=process.argv.includes('--ci-smoke');

function statePath(){return path.join(app.getPath('userData'),'window-state.json');}
async function readWindowPosition(){try{const value=JSON.parse(await readFile(statePath(),'utf8'));return Number.isFinite(value?.x)&&Number.isFinite(value?.y)?value:null;}catch{return null;}}
function safePosition(saved,width,height){
 const display=saved?screen.getDisplayNearestPoint({x:Math.round(saved.x+width/2),y:Math.round(saved.y+height/2)}):screen.getPrimaryDisplay();
 const area=display.workArea;
 const fallback={x:Math.round(area.x+(area.width-width)/2),y:Math.round(area.y+(area.height-height)/2)};
 if(!saved)return fallback;
 return {x:Math.max(area.x-width+120,Math.min(area.x+area.width-120,Math.round(saved.x))),y:Math.max(area.y-height+120,Math.min(area.y+area.height-120,Math.round(saved.y)))};
}
function savePositionSoon(){
 clearTimeout(saveTimer);
 saveTimer=setTimeout(async()=>{if(!win||win.isDestroyed())return;const [x,y]=win.getPosition();try{await writeFile(statePath(),JSON.stringify({x,y}),'utf8');}catch{}},250);
}
function showAvatar(){if(!win||win.isDestroyed())return;win.show();win.setAlwaysOnTop(true,'floating');win.moveTop();win.focus();}
function summonAvatar(){
 if(!win||win.isDestroyed())return;
 win.show();win.center();win.setAlwaysOnTop(true,'floating');win.moveTop();
 if(!win.webContents.isLoading())win.webContents.send('dudidam:summon');
}
function rebuildTrayMenu(){
 if(!tray||tray.isDestroyed())return;
 tray.setContextMenu(Menu.buildFromTemplate([
  {label:'Tampilkan Dudidam',click:showAvatar},
  {label:'Panggil ALE (Ctrl+Alt+5)',click:summonAvatar},
  {label:'Sembunyikan',click:()=>win?.hide()},
  {type:'separator'},
  {label:'Selalu di atas',type:'checkbox',checked:win?.isAlwaysOnTop()??true,click:item=>win?.setAlwaysOnTop(item.checked,'floating')},
  {label:'Tembus klik penuh',type:'checkbox',checked:passthroughLocked,click:item=>setPassthroughLock(item.checked)},
  {type:'separator'},
  {label:'Keluar',click:()=>{quitting=true;app.quit();}}
 ]));
}
function applyPassthrough(value){
 const next=Boolean(value);
 if(next===passthrough)return;
 passthrough=next;
 win?.setIgnoreMouseEvents(passthrough,{forward:true});
}
function setDynamicPassthrough(value){if(!passthroughLocked)applyPassthrough(value);}
function setPassthroughLock(value){passthroughLocked=Boolean(value);applyPassthrough(passthroughLocked);rebuildTrayMenu();}

if(!app.requestSingleInstanceLock())app.quit();
else{
 app.on('second-instance',showAvatar);
 app.whenReady().then(async()=>{
  const [{ChatGPTBridge},{OpenAIBridge},{GrokBridge},{GeminiBridge},{ClaudeBridge},{DeepSeekBridge},{AskCodiBridge},{DeveloperAgentHub,agentDefinitions}]=await Promise.all([import('./bridge.mjs'),import('./openai-api.mjs'),import('./grok.mjs'),import('./gemini.mjs'),import('./claude.mjs'),import('./deepseek.mjs'),import('./askcodi.mjs'),import('./agent-hub.mjs')]);
  bridges={chatgpt:new ChatGPTBridge(),openai:new OpenAIBridge(),grok:new GrokBridge(),gemini:new GeminiBridge(),claude:new ClaudeBridge(),deepseek:new DeepSeekBridge(),askcodi:new AskCodiBridge()};
  agentHub=new DeveloperAgentHub();
  const agentLinks=Object.fromEntries(agentDefinitions().map(item=>[item.id,item.url]));
  const root=path.resolve(__dirname,'../public');
  const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
  server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const asset=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!asset.startsWith(root+path.sep)||!types[path.extname(asset)]){res.writeHead(404);res.end();return;}const data=await readFile(asset);res.writeHead(200,{'Content-Type':types[path.extname(asset)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);}catch{res.writeHead(404);res.end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  origin='http://127.0.0.1:'+server.address().port;
  const workArea=screen.getPrimaryDisplay().workAreaSize,width=Math.min(420,workArea.width),height=Math.min(480,workArea.height);
  const position=safePosition(await readWindowPosition(),width,height);
  win=new BrowserWindow({width,height,x:position.x,y:position.y,frame:false,transparent:true,backgroundColor:'#00000000',hasShadow:false,resizable:false,alwaysOnTop:true,skipTaskbar:true,title:'Dudidam — Avatar Transparan',show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false,spellcheck:false}});
  win.setAlwaysOnTop(true,'floating');
  win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
  const trusted=e=>e.sender===win?.webContents&&e.senderFrame?.url?.startsWith(origin+'/');

  const pickProvider=value=>['openai','grok','gemini','claude','deepseek','askcodi'].includes(value)?value:'chatgpt';
  ipcMain.handle('dudidam:status',async(e,provider)=>{if(!trusted(e))return {error:'Akses ditolak.'};try{return await bridges[pickProvider(provider)].status();}catch(error){return {configured:false,error:error.message};}});
  ipcMain.handle('dudidam:ask',async(e,value)=>{if(!trusted(e))return {error:'Akses ditolak.'};try{const provider=pickProvider(value?.provider);const payload={...value};delete payload.provider;return await bridges[provider].ask(payload);}catch(error){return {error:error.message};}});
  ipcMain.handle('dudidam:login',async e=>{if(!trusted(e))return {error:'Akses ditolak.'};try{return await bridges.chatgpt.login();}catch(error){return {error:error.message};}});
  ipcMain.handle('dudidam:agents',async e=>{if(!trusted(e))return {error:'Akses ditolak.'};try{return await agentHub.status();}catch(error){return {error:error.message};}});
  ipcMain.handle('dudidam:agent-run',async(e,value)=>{if(!trusted(e))return {error:'Akses ditolak.'};try{return await agentHub.run(value);}catch(error){return {error:error.message};}});
  ipcMain.handle('dudidam:agent-open',async(e,id)=>{if(!trusted(e))return {error:'Akses ditolak.'};const url=agentLinks[String(id||'')];if(!url||!url.startsWith('https://'))return {error:'Tautan agent tidak valid.'};await shell.openExternal(url);return {ok:true};});
  ipcMain.on('dudidam:center',e=>{if(trusted(e)){win.center();savePositionSoon();}});
  ipcMain.on('dudidam:minimize',e=>{if(trusted(e))win.hide();});
  ipcMain.on('dudidam:close',e=>{if(trusted(e))win.hide();});
  ipcMain.on('dudidam:passthrough',(e,value)=>{if(trusted(e))setDynamicPassthrough(value);});
  ipcMain.on('dudidam:passthrough-lock',(e,value)=>{if(trusted(e))setPassthroughLock(value);});
  ipcMain.on('dudidam:move',(e,d)=>{if(!trusted(e)||passthrough||!Number.isFinite(d?.dx)||!Number.isFinite(d?.dy))return;const [x,y]=win.getPosition();const next=safePosition({x:x+Math.max(-100,Math.min(100,d.dx)),y:y+Math.max(-100,Math.min(100,d.dy))},width,height);win.setPosition(next.x,next.y);});

  win.webContents.setWindowOpenHandler(({url})=>{try{if(new URL(url).origin==='https://chatgpt.com')shell.openExternal(url);}catch{}return {action:'deny'};});
  win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith(origin+'/'))e.preventDefault();});
  win.webContents.on('will-attach-webview',e=>e.preventDefault());
  win.webContents.session.setPermissionCheckHandler((contents,permission,requestingOrigin)=>contents===win.webContents&&permission==='media'&&typeof requestingOrigin==='string'&&requestingOrigin.startsWith(origin));
  win.webContents.session.setDisplayMediaRequestHandler(async(request,callback)=>{if(request.securityOrigin!==origin||!request.userGesture||!request.audioRequested){callback({});return;}try{const sources=await desktopCapturer.getSources({types:['screen']});if(!sources.length){callback({});return;}callback({video:sources[0],audio:'loopback'});}catch{callback({});}});
  win.webContents.session.setPermissionRequestHandler(async(contents,permission,callback,details)=>{if(contents!==win.webContents||!contents.getURL().startsWith(origin+'/')||permission!=='media'){callback(false);return;}const mediaTypes=details.mediaTypes||[];const result=await dialog.showMessageBox(win,{type:'question',title:'Izin perangkat Dudidam',message:'Izinkan '+(mediaTypes.includes('video')?'kamera':'mikrofon')+' untuk sesi ini?',detail:'Audio dipakai hanya saat kontrol reaksi suara aktif. Kamera hanya mengirim satu foto setelah tombol kirim foto ditekan.',buttons:['Izinkan','Batal'],defaultId:1,cancelId:1});callback(result.response===0);});

  const trayIcon=nativeImage.createFromPath(path.join(root,'reference.png')).resize({width:20,height:20,quality:'best'});
  tray=new Tray(trayIcon);
  tray.setToolTip('Dudidam — asisten mengambang');
  tray.on('click',()=>win?.isVisible()?win.hide():showAvatar());
  rebuildTrayMenu();
  const shortcutRegistered=globalShortcut.register(summonShortcut,summonAvatar);
  if(!shortcutRegistered)console.warn('Dudidam global summon shortcut unavailable:',summonShortcut);
  win.on('move',savePositionSoon);
  win.on('close',event=>{if(!quitting){event.preventDefault();win.hide();}});
  win.once('ready-to-show',()=>win.show());
  await win.loadURL(origin+'/');
  if(ciSmoke){
   const rendererReady=await win.webContents.executeJavaScript("Boolean(document.querySelector('#avatar')) && Boolean(window.dudidamDesktop) && document.title.includes('Dudidam')");
   if(!rendererReady)throw new Error('Renderer Dudidam tidak siap.');
   console.log('Dudidam CI smoke passed: packaged runtime and renderer loaded.');
   quitting=true;app.quit();return;
  }
  console.log('Dudidam desktop ready: transparent=true; frame=false; alwaysOnTop=true; tray=true; systemAudio=loopback');
 }).catch(error=>{console.error('Dudidam startup failed:',error);app.exit(1);});
 app.on('window-all-closed',()=>{});
 app.on('before-quit',()=>{quitting=true;globalShortcut.unregisterAll();clearTimeout(saveTimer);Object.values(bridges||{}).forEach(item=>item?.stop());agentHub?.stop();server?.close();tray?.destroy();});
}
