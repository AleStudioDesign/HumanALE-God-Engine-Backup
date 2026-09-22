const {app,BrowserWindow,ipcMain,shell,dialog,screen,desktopCapturer,Tray,Menu,nativeImage,globalShortcut}=require('electron');
const http=require('node:http');
const {readFile,writeFile}=require('node:fs/promises');
const {mkdtempSync}=require('node:fs');
const path=require('node:path');
const {tmpdir}=require('node:os');

let win,panelWin,server,origin,bridges,agentHub,terminalManager,terminalPolicy,indonesianStt,indonesianTts,tray,saveTimer,pointerTimer;
let baseWindowSize={width:420,height:480};
let panelZoomFactor=1;
let quitting=false;
let pendingDismiss='';
let passthrough=false;
let passthroughLocked=false;
let panelViewportOpen=false;
const summonShortcut='CommandOrControl+Alt+5';
const ciSmoke=process.argv.includes('--ci-smoke');
if(process.platform==='win32')app.setAppUserModelId('id.my.aleprinting.dudidam');
if(ciSmoke)app.setPath('userData',mkdtempSync(path.join(tmpdir(),'dudidam-ci-smoke-')));

function statePath(){return path.join(app.getPath('userData'),'window-state.json');}
function projectRootPath(){return path.join(app.getPath('userData'),'project-root.txt');}
async function readProjectRoot(){try{return (await readFile(projectRootPath(),'utf8')).trim();}catch{return '';}}
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
function showAvatar(){
 if(!win||win.isDestroyed())return;
 pendingDismiss='';win.show();win.setAlwaysOnTop(true,'floating');win.moveTop();win.focus();
 if(!win.webContents.isLoading())win.webContents.send('dudidam:show');
}
function summonAvatar(){
 if(!win||win.isDestroyed())return;
 pendingDismiss='';win.show();win.center();win.setAlwaysOnTop(true,'floating');win.moveTop();
 if(!win.webContents.isLoading())win.webContents.send('dudidam:summon');
}
function finishDismiss(){
 const reason=pendingDismiss||'hide';pendingDismiss='';
 if(reason==='quit'){quitting=true;app.quit();return;}
 panelWin?.hide();
 win?.hide();
}
function requestDismiss(reason='hide'){
 if(!win||win.isDestroyed()){if(reason==='quit'){quitting=true;app.quit();}return;}
 pendingDismiss=reason==='quit'?'quit':'hide';
 if(!win.isVisible()||win.webContents.isLoading()){finishDismiss();return;}
 win.webContents.send('dudidam:dismiss',pendingDismiss);
}
function rebuildTrayMenu(){
 if(!tray||tray.isDestroyed())return;
 tray.setContextMenu(Menu.buildFromTemplate([
  {label:'Tampilkan HumanALE God Engine',click:showAvatar},
  {label:'Panggil ALE (Ctrl+Alt+5)',click:summonAvatar},
  {label:'Sembunyikan',click:()=>requestDismiss('hide')},
  {type:'separator'},
  {label:'Selalu di atas',type:'checkbox',checked:win?.isAlwaysOnTop()??true,click:item=>win?.setAlwaysOnTop(item.checked,'floating')},
  {label:'Tembus klik penuh',type:'checkbox',checked:passthroughLocked,click:item=>setPassthroughLock(item.checked)},
  {type:'separator'},
  {label:'Keluar',click:()=>requestDismiss('quit')}
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
function resizeForPanel(zoom=1,open=false){
 if(!win||win.isDestroyed())return;
 panelViewportOpen=Boolean(open);
 panelZoomFactor=Math.max(1,Math.min(1.45,Number(zoom)||1));
 const factor=panelViewportOpen?panelZoomFactor:1;
 const [oldW,oldH]=win.getSize(),[oldX,oldY]=win.getPosition();
 const center={x:Math.round(oldX+oldW/2),y:Math.round(oldY+oldH/2)};
 const display=screen.getDisplayNearestPoint(center),area=display.workArea;
 const width=Math.min(area.width,Math.round(baseWindowSize.width*factor));
 const height=Math.min(area.height,Math.round(baseWindowSize.height*factor));
 const x=Math.max(area.x,Math.min(area.x+area.width-width,Math.round(center.x-width/2)));
 const y=Math.max(area.y,Math.min(area.y+area.height-height,Math.round(center.y-height/2)));
 const [currentW,currentH]=win.getSize();
 if(currentW===width&&currentH===height)return;
 win.setBounds({x,y,width,height},false);
}
function resizeForAvatar(value=420){
 const size=Math.max(180,Math.min(540,Number(value)||420));
 baseWindowSize={width:Math.max(360,size+40),height:Math.max(420,size+100)};
 resizeForPanel(panelZoomFactor,panelViewportOpen);
}
async function openPanel(view='controls'){
 if(!win||win.isDestroyed())return;
 const allowed=['controls','chatDialog','agentDialog','terminalDialog'];
 const target=allowed.includes(view)?view:'controls';
 const bounds=win.getBounds(),display=screen.getDisplayNearestPoint({x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2}),area=display.workArea;
 const terminalView=target==='terminalDialog';
 const width=Math.min(terminalView?900:460,area.width),height=Math.min(terminalView?720:680,area.height);
 if(panelWin&&!panelWin.isDestroyed()){
  const current=panelWin.getBounds();
  const x=Math.max(area.x,Math.min(area.x+area.width-width,current.x));
  const y=Math.max(area.y,Math.min(area.y+area.height-height,current.y));
  panelWin.setBounds({x,y,width,height},false);
  panelWin.show();panelWin.focus();panelWin.webContents.send('dudidam:panel-view',target);return;
 }
 const rightSpace=area.x+area.width-(bounds.x+bounds.width),leftSpace=bounds.x-area.x;
 let x;
 if(rightSpace>=width+16)x=bounds.x+bounds.width+16;
 else if(leftSpace>=width+16)x=bounds.x-width-16;
 else if(area.width>=bounds.width+width+16){
  const leftAvatarX=area.x+width+16;
  const rightAvatarX=area.x+area.width-width-16-bounds.width;
  const putPanelLeft=Math.abs(bounds.x-leftAvatarX)<=Math.abs(bounds.x-rightAvatarX);
  const avatarX=putPanelLeft?leftAvatarX:rightAvatarX;
  win.setPosition(avatarX,bounds.y);
  x=putPanelLeft?area.x:avatarX+bounds.width+16;
 }else x=rightSpace>=leftSpace?area.x+area.width-width:area.x;
 const y=Math.max(area.y,Math.min(area.y+area.height-height,bounds.y));
 panelWin=new BrowserWindow({width,height,x,y,minWidth:350,minHeight:360,backgroundColor:'#081610',frame:true,resizable:true,alwaysOnTop:true,show:false,title:'HumanALE God Engine · Panel',webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,spellcheck:false}});
 panelWin.setAlwaysOnTop(true,'floating');
 panelWin.webContents.setWindowOpenHandler(({url})=>{try{if(['https://chatgpt.com','https://github.com'].includes(new URL(url).origin))shell.openExternal(url);}catch{}return {action:'deny'};});
 panelWin.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(origin+'/'))event.preventDefault();});
 panelWin.webContents.on('will-attach-webview',event=>event.preventDefault());
 panelWin.on('closed',()=>{panelWin=null;});
 try{await panelWin.loadURL(origin+'/?panel='+encodeURIComponent(target));panelWin?.show();panelWin?.focus();}
 catch(error){console.error('HumanALE God Engine panel failed:',error);throw error;}
}
function publishGlobalPointer(){
 if(!win||win.isDestroyed()||!win.isVisible()||win.webContents.isLoading())return;
 const point=screen.getCursorScreenPoint(),areas=screen.getAllDisplays().map(display=>display.workArea);
 const left=Math.min(...areas.map(area=>area.x)),top=Math.min(...areas.map(area=>area.y));
 const right=Math.max(...areas.map(area=>area.x+area.width)),bottom=Math.max(...areas.map(area=>area.y+area.height));
 const bounds=win.getBounds(),centerX=bounds.x+bounds.width/2,centerY=bounds.y+bounds.height/2;
 const x=Math.max(-1,Math.min(1,(point.x-centerX)/Math.max(1,(right-left)/2)));
 const y=Math.max(-1,Math.min(1,(point.y-centerY)/Math.max(1,(bottom-top)/2)));
 win.webContents.send('dudidam:global-pointer',{x,y});
}

if(!app.requestSingleInstanceLock())app.quit();
else{
 app.on('second-instance',showAvatar);
 app.whenReady().then(async()=>{
  const [{ChatGPTBridge},{CopilotBridge},{OpenAIBridge},{GrokBridge},{GeminiBridge},{ClaudeBridge},{DeepSeekBridge},{AskCodiBridge},{DeveloperAgentHub,agentDefinitions},{TerminalManager},policyModule,{IndonesianStt},{IndonesianTts}]=await Promise.all([import('./bridge.mjs'),import('./copilot.mjs'),import('./openai-api.mjs'),import('./grok.mjs'),import('./gemini.mjs'),import('./claude.mjs'),import('./deepseek.mjs'),import('./askcodi.mjs'),import('./agent-hub.mjs'),import('./terminal-manager.mjs'),import('./terminal-policy.mjs'),import('./indonesian-stt.mjs'),import('./indonesian-tts.mjs')]);
  bridges={chatgpt:new ChatGPTBridge(),copilot:new CopilotBridge(),openai:new OpenAIBridge(),grok:new GrokBridge(),gemini:new GeminiBridge(),claude:new ClaudeBridge(),deepseek:new DeepSeekBridge(),askcodi:new AskCodiBridge()};
  agentHub=new DeveloperAgentHub();
  const savedProjectRoot=await readProjectRoot();if(savedProjectRoot)agentHub.setProjectRoot(savedProjectRoot);
  terminalPolicy=policyModule;
  const emitTerminal=(channel,...args)=>{for(const target of [win,panelWin]){if(target&&!target.isDestroyed()&&!target.webContents.isLoading())target.webContents.send(channel,...args);}};
  terminalManager=new TerminalManager({
   workspace:agentHub.getProjectRoot(),
   onData:(id,data)=>emitTerminal('dudidam:terminal-data',id,data),
   onExit:(id,exitCode)=>emitTerminal('dudidam:terminal-exit',id,exitCode)
  });
  indonesianStt=new IndonesianStt();
  indonesianTts=new IndonesianTts();
  const agentLinks=Object.fromEntries(agentDefinitions().map(item=>[item.id,item.url]));
  const root=path.resolve(__dirname,'../public');
  const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
  const vendorAssets={
   '/vendor/xterm.js':{path:path.resolve(__dirname,'../node_modules/@xterm/xterm/lib/xterm.js'),type:'text/javascript; charset=utf-8'},
   '/vendor/xterm.css':{path:path.resolve(__dirname,'../node_modules/@xterm/xterm/css/xterm.css'),type:'text/css; charset=utf-8'},
   '/vendor/addon-fit.js':{path:path.resolve(__dirname,'../node_modules/@xterm/addon-fit/lib/addon-fit.js'),type:'text/javascript; charset=utf-8'}
  };
  server=http.createServer(async(req,res)=>{try{
   const url=new URL(req.url,'http://localhost');
   const vendor=vendorAssets[url.pathname];
   if(vendor){const data=await readFile(vendor.path);res.writeHead(200,{'Content-Type':vendor.type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);return;}
   const asset=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
   if(!asset.startsWith(root+path.sep)||!types[path.extname(asset)]){res.writeHead(404);res.end();return;}
   const data=await readFile(asset);res.writeHead(200,{'Content-Type':types[path.extname(asset)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);
  }catch{res.writeHead(404);res.end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  origin='http://127.0.0.1:'+server.address().port;
  const workArea=screen.getPrimaryDisplay().workAreaSize,width=Math.min(420,workArea.width),height=Math.min(480,workArea.height);baseWindowSize={width,height};
  const position=safePosition(await readWindowPosition(),width,height);
  win=new BrowserWindow({width,height,x:position.x,y:position.y,frame:false,transparent:true,backgroundColor:'#00000000',hasShadow:false,resizable:false,alwaysOnTop:true,skipTaskbar:true,title:'HumanALE God Engine — Avatar Transparan',show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false,spellcheck:false}});
  win.setAlwaysOnTop(true,'floating');
  win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
  const trusted=e=>(e.sender===win?.webContents||e.sender===panelWin?.webContents)&&e.senderFrame?.url?.startsWith(origin+'/');

  const pickProvider=value=>['copilot','openai','grok','gemini','claude','deepseek','askcodi'].includes(value)?value:'chatgpt';
  ipcMain.handle('dudidam:status',async(e,provider)=>{if(!trusted(e))return {error:'Akses ditolak.'};try{return await bridges[pickProvider(provider)].status();}catch(error){return {configured:false,error:error.message};}});
  ipcMain.handle('dudidam:ask',async(e,value)=>{if(!trusted(e))return {error:'Akses ditolak.'};try{const provider=pickProvider(value?.provider);const payload={...value};delete payload.provider;return await bridges[provider].ask(payload);}catch(error){return {error:error.message};}});
  ipcMain.handle('dudidam:login',async e=>{if(!trusted(e))return {error:'Akses ditolak.'};try{return await bridges.chatgpt.login();}catch(error){return {error:error.message};}});
  ipcMain.handle('dudidam:login-copilot',async e=>{if(!trusted(e))return {error:'Akses ditolak.'};try{return await bridges.copilot.login();}catch(error){return {error:error.message};}});
  ipcMain.handle('dudidam:stt-status',async e=>{if(!trusted(e))return {configured:false,error:'Akses ditolak.'};return await indonesianStt.status();});
  ipcMain.handle('dudidam:transcribe',async(e,value)=>{if(!trusted(e))return {error:'Akses ditolak.'};try{return await indonesianStt.transcribe(value);}catch(error){return {error:error.message};}});
  ipcMain.handle('dudidam:tts-status',async e=>{if(!trusted(e))return {configured:false,error:'Akses ditolak.'};return await indonesianTts.status();});
  ipcMain.handle('dudidam:synthesize',async(e,value)=>{if(!trusted(e))return {error:'Akses ditolak.'};try{return await indonesianTts.synthesize(value);}catch(error){return {error:error.message};}});
  ipcMain.on('dudidam:panel-open',(e,view)=>{if(trusted(e))openPanel(view);});
  ipcMain.on('dudidam:panel-close',e=>{if(trusted(e))panelWin?.hide();});
  ipcMain.handle('dudidam:agents',async e=>{if(!trusted(e))return {error:'Akses ditolak.'};try{return await agentHub.status();}catch(error){return {error:error.message};}});
  ipcMain.handle('dudidam:project-root-choose',async e=>{
   if(!trusted(e))return {error:'Akses ditolak.'};
   const result=await dialog.showOpenDialog(panelWin?.isVisible()?panelWin:win,{title:'Pilih folder checkout proyek HumanALE God Engine',properties:['openDirectory']});
   if(result.canceled||!result.filePaths?.[0])return {canceled:true};
   const selected=path.resolve(result.filePaths[0]);
   agentHub.setProjectRoot(selected);terminalManager?.setWorkspace(selected);
   try{await writeFile(projectRootPath(),selected,'utf8');}catch(error){return {error:'Folder terpilih, tetapi pengaturan tidak dapat disimpan: '+error.message};}
   return {ok:true,...await agentHub.status()};
  });
  ipcMain.handle('dudidam:agent-run',async(e,value)=>{if(!trusted(e))return {error:'Akses ditolak.'};try{return await agentHub.run(value);}catch(error){return {error:error.message};}});
  ipcMain.handle('dudidam:agent-open',async(e,id)=>{if(!trusted(e))return {error:'Akses ditolak.'};const url=agentLinks[String(id||'')];if(!url||!url.startsWith('https://'))return {error:'Tautan agent tidak valid.'};await shell.openExternal(url);return {ok:true};});
  ipcMain.handle('dudidam:terminal-create',async(e,value)=>{
   if(!trusted(e))return {error:'Akses ditolak.'};
   const shellId=['auto','pwsh','powershell','cmd'].includes(String(value?.shell||''))?String(value.shell):'auto';
   const profileId=['claude','codex','cursor','gemini'].includes(String(value?.profile||''))?String(value.profile):undefined;
   const options={shell:shellId,profile:profileId,title:String(value?.title||'').slice(0,80),cols:value?.cols,rows:value?.rows};
   try{return await terminalManager.create(options);}catch(error){return {error:error.message};}
  });
  ipcMain.handle('dudidam:terminal-write',async(e,value)=>{if(!trusted(e))return {error:'Akses ditolak.'};try{return terminalManager.write(value?.sessionId,value?.data);}catch(error){return {error:error.message};}});
  ipcMain.handle('dudidam:terminal-resize',async(e,value)=>{if(!trusted(e))return {error:'Akses ditolak.'};try{return terminalManager.resize(value?.sessionId,value?.cols,value?.rows);}catch(error){return {error:error.message};}});
  ipcMain.handle('dudidam:terminal-kill',async(e,value)=>{if(!trusted(e))return {error:'Akses ditolak.'};try{return terminalManager.kill(value?.sessionId);}catch(error){return {error:error.message};}});
  ipcMain.handle('dudidam:terminal-restart',async(e,value)=>{if(!trusted(e))return {error:'Akses ditolak.'};try{return await terminalManager.restart(value?.sessionId);}catch(error){return {error:error.message};}});
  ipcMain.handle('dudidam:terminal-clear',async(e,value)=>{if(!trusted(e))return {error:'Akses ditolak.'};try{return terminalManager.clear(value?.sessionId);}catch(error){return {error:error.message};}});
  ipcMain.handle('dudidam:terminal-list',async e=>{if(!trusted(e))return {error:'Akses ditolak.'};return {sessions:terminalManager.list()};});
  ipcMain.handle('dudidam:terminal-detect',async e=>{if(!trusted(e))return {error:'Akses ditolak.'};try{return await terminalManager.detect();}catch(error){return {error:error.message};}});
  ipcMain.handle('dudidam:terminal-recent',async(e,value)=>{if(!trusted(e))return {error:'Akses ditolak.'};return {output:terminalManager.getRecentOutput(value?.sessionId,value?.limit)};});
  ipcMain.handle('dudidam:terminal-cwd',async(e,value)=>{if(!trusted(e))return {error:'Akses ditolak.'};try{return await terminalManager.setCwd(value?.sessionId,value?.cwd);}catch(error){return {error:error.message};}});
  ipcMain.handle('dudidam:terminal-policy',async(e,value)=>{if(!trusted(e))return {error:'Akses ditolak.'};return terminalPolicy.classifyCommand(value?.command);});
  ipcMain.handle('dudidam:terminal-execute',async(e,value)=>{
   if(!trusted(e))return {error:'Akses ditolak.'};
   const command=String(value?.command||'').trim(),decision=terminalPolicy.classifyCommand(command);
   if(decision.category==='BLOCK')return {error:decision.reason,category:'BLOCK'};
   if(decision.category==='CONFIRM'){
    const result=await dialog.showMessageBox(panelWin?.isVisible()?panelWin:win,{type:'warning',title:'Konfirmasi command HumanALE God Engine',message:'Command ini dapat mengubah project atau sistem.',detail:decision.reason+'\n\n'+command,buttons:['Jalankan','Batal'],defaultId:1,cancelId:1,noLink:true});
    if(result.response!==0)return {cancelled:true,category:'CONFIRM',reason:decision.reason};
   }
   try{terminalManager.write(value?.sessionId,command+'\r');return {ok:true,category:decision.category};}
   catch(error){return {error:error.message,category:decision.category};}
  });
  ipcMain.on('dudidam:center',e=>{if(trusted(e)){win.center();savePositionSoon();}});
  ipcMain.on('dudidam:minimize',e=>{if(trusted(e))requestDismiss('hide');});
  ipcMain.on('dudidam:close',e=>{if(trusted(e))requestDismiss('hide');});
  ipcMain.on('dudidam:dismiss-complete',e=>{if(trusted(e))finishDismiss();});
  ipcMain.on('dudidam:passthrough',(e,value)=>{if(e.sender===win?.webContents&&trusted(e))setDynamicPassthrough(value);});
  ipcMain.on('dudidam:passthrough-lock',(e,value)=>{if(trusted(e))setPassthroughLock(value);});
  ipcMain.on('dudidam:avatar-viewport',(e,value)=>{if(trusted(e))resizeForAvatar(value?.size);});
  ipcMain.on('dudidam:panel-viewport',(e,value)=>{if(e.sender===win?.webContents&&trusted(e))resizeForPanel(value?.zoom,Boolean(value?.open));});
  ipcMain.on('dudidam:move',(e,d)=>{if(!trusted(e)||passthrough||!Number.isFinite(d?.dx)||!Number.isFinite(d?.dy))return;const [x,y]=win.getPosition(),[currentWidth,currentHeight]=win.getSize();const next=safePosition({x:x+Math.max(-100,Math.min(100,d.dx)),y:y+Math.max(-100,Math.min(100,d.dy))},currentWidth,currentHeight);win.setPosition(next.x,next.y);});

  win.webContents.setWindowOpenHandler(({url})=>{try{if(new URL(url).origin==='https://chatgpt.com')shell.openExternal(url);}catch{}return {action:'deny'};});
  win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith(origin+'/'))e.preventDefault();});
  win.webContents.on('will-attach-webview',e=>e.preventDefault());
  win.webContents.session.setPermissionCheckHandler((contents,permission,requestingOrigin)=>(contents===win.webContents||contents===panelWin?.webContents)&&permission==='media'&&typeof requestingOrigin==='string'&&requestingOrigin.startsWith(origin));
  win.webContents.session.setDisplayMediaRequestHandler(async(request,callback)=>{if(request.securityOrigin!==origin||!request.userGesture||!request.audioRequested){callback({});return;}try{const sources=await desktopCapturer.getSources({types:['screen']});if(!sources.length){callback({});return;}callback({video:sources[0],audio:'loopback'});}catch{callback({});}});
  win.webContents.session.setPermissionRequestHandler(async(contents,permission,callback,details)=>{if((contents!==win.webContents&&contents!==panelWin?.webContents)||!contents.getURL().startsWith(origin+'/')||permission!=='media'){callback(false);return;}const mediaTypes=details.mediaTypes||[];const result=await dialog.showMessageBox(panelWin?.isVisible()?panelWin:win,{type:'question',title:'Izin perangkat HumanALE God Engine',message:'Izinkan '+(mediaTypes.includes('video')?'kamera':'mikrofon')+' untuk sesi ini?',detail:'Mikrofon dipakai hanya saat Wake ALE, dikte, atau reaksi suara yang kamu aktifkan; status Wake selalu terlihat di layar. Kamera hanya mengirim satu foto setelah tombol kirim foto ditekan.',buttons:['Izinkan','Batal'],defaultId:1,cancelId:1});callback(result.response===0);});

  const trayIcon=nativeImage.createFromPath(path.join(root,'reference.png')).resize({width:20,height:20,quality:'best'});
  tray=new Tray(trayIcon);
  tray.setToolTip('HumanALE God Engine — asisten mengambang');
  tray.on('click',()=>win?.isVisible()?requestDismiss('hide'):showAvatar());
  rebuildTrayMenu();
  const shortcutRegistered=globalShortcut.register(summonShortcut,summonAvatar);
  if(!shortcutRegistered)console.warn('HumanALE God Engine global summon shortcut unavailable:',summonShortcut);
  win.on('move',()=>{if(!panelViewportOpen)savePositionSoon();});
  win.on('close',event=>{if(!quitting){event.preventDefault();requestDismiss('hide');}});
  win.once('ready-to-show',()=>win.show());
  await win.loadURL(origin+'/');
  pointerTimer=setInterval(publishGlobalPointer,50);
  if(ciSmoke){
   const rendererReady=await win.webContents.executeJavaScript("Boolean(document.querySelector('#avatar')) && typeof window.dudidamDesktop?.onGlobalPointer === 'function' && typeof window.dudidamDesktop?.avatarViewport === 'function' && document.title.includes('HumanALE God Engine')");
   if(!rendererReady)throw new Error('Renderer HumanALE God Engine tidak siap.');
   const wakeIdle=await win.webContents.executeJavaScript("Boolean(document.querySelector('#wakeToggle')) && !document.querySelector('#wakeToggle').checked && document.querySelector('#wakeIndicator')?.textContent?.includes('nonaktif')");
   if(!wakeIdle)throw new Error('Wake mic harus nonaktif saat HumanALE God Engine mulai.');
   await openPanel('controls');
   const panelReady=await panelWin.webContents.executeJavaScript("new Promise(resolve=>{const deadline=Date.now()+2500;const check=()=>{const ready=document.body.classList.contains('detached-panel')&&document.querySelector('#controls')?.open&&document.documentElement.classList.contains('panel-surface');if(ready||Date.now()>deadline)resolve(Boolean(ready));else setTimeout(check,50);};check();})");
   if(!panelReady)throw new Error('Panel terpisah HumanALE God Engine tidak siap.');
   const avatarControls=await panelWin.webContents.executeJavaScript("Boolean(document.querySelector('#emotion')) && Boolean(document.querySelector('#voiceStyle')) && document.querySelector('#voiceStyle').value==='baby-robot'");
   if(!avatarControls)throw new Error('Kontrol emosi dan suara bayi robot tidak siap.');
   const avatarBounds=win.getBounds(),panelBounds=panelWin.getBounds(),workArea=screen.getDisplayNearestPoint({x:avatarBounds.x+avatarBounds.width/2,y:avatarBounds.y+avatarBounds.height/2}).workArea;
   if(workArea.width>=avatarBounds.width+panelBounds.width+16&&avatarBounds.x<panelBounds.x+panelBounds.width&&panelBounds.x<avatarBounds.x+avatarBounds.width&&avatarBounds.y<panelBounds.y+panelBounds.height&&panelBounds.y<avatarBounds.y+avatarBounds.height)throw new Error(`Panel menutupi avatar walau layar cukup lebar: ${JSON.stringify({avatarBounds,panelBounds,workArea})}`);
   await panelWin.webContents.executeJavaScript("new BroadcastChannel('dudidam-avatar-panel').postMessage({type:'persona',provider:'copilot'})");
   const personaReady=await win.webContents.executeJavaScript("new Promise(resolve=>setTimeout(()=>resolve(document.querySelector('#personaBadge')?.textContent.includes('COPILOT')),100))");
   if(!personaReady)throw new Error('Tampilan Copilot tidak tersambung ke avatar.');
   if(process.env.DUDIDAM_CAPTURE_SMOKE){
    await new Promise(resolve=>setTimeout(resolve,700));
    await writeFile(process.env.DUDIDAM_CAPTURE_SMOKE,(await win.capturePage()).toPNG());
    await panelWin.webContents.executeJavaScript("{const el=document.querySelector('#emotion');el.value='happy';el.dispatchEvent(new Event('change',{bubbles:true}));}");
    await new Promise(resolve=>setTimeout(resolve,250));
    await writeFile(process.env.DUDIDAM_CAPTURE_SMOKE.replace(/\.png$/,'-happy.png'),(await win.capturePage()).toPNG());
   }
   if(process.env.DUDIDAM_VOICE_SMOKE==='1'){
    const voiceReady=await panelWin.webContents.executeJavaScript("Promise.all([window.dudidamDesktop.sttStatus(),window.dudidamDesktop.ttsStatus()]).then(([stt,tts])=>stt.configured&&tts.configured)");
    if(!voiceReady)throw new Error('Runtime suara Indonesia lokal belum siap.');
    const speechReady=await panelWin.webContents.executeJavaScript("window.dudidamDesktop.synthesize({text:'Halo dari HumanALE God Engine.',style:'baby-robot'}).then(result=>result.mime==='audio/wav'&&result.audio?.length>1000)");
    if(!speechReady)throw new Error('Suara Indonesia lokal gagal dibuat lewat panel.');
   }
   if(process.env.DUDIDAM_COPILOT_SMOKE==='1'){
    const copilotReady=await panelWin.webContents.executeJavaScript("window.dudidamDesktop.ask({provider:'copilot',message:'Jawab satu kata: siap',history:[]}).then(result=>Boolean(result.text)&&!result.error)");
    if(!copilotReady)throw new Error('Percakapan GitHub Copilot dari panel gagal.');
   }
   console.log('HumanALE God Engine CI smoke passed: packaged runtime, renderer, and detached panel loaded.');
   quitting=true;app.quit();return;
  }
  console.log('HumanALE God Engine desktop ready: transparent=true; frame=false; alwaysOnTop=true; tray=true; systemAudio=loopback');
 }).catch(error=>{console.error('HumanALE God Engine startup failed:',error);app.exit(1);});
 app.on('window-all-closed',()=>{});
  app.on('before-quit',()=>{quitting=true;globalShortcut.unregisterAll();clearTimeout(saveTimer);clearInterval(pointerTimer);Object.values(bridges||{}).forEach(item=>item?.stop());agentHub?.stop();terminalManager?.killAll?.();indonesianStt?.stop();indonesianTts?.stop();panelWin?.destroy();server?.close();tray?.destroy();});
}
