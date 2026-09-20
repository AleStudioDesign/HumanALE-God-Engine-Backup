const {app,BrowserWindow,ipcMain,shell,dialog,screen}=require('electron');
const http=require('node:http');const {readFile}=require('node:fs/promises');const path=require('node:path');
let win,server,origin,bridge;
if(!app.requestSingleInstanceLock()){app.quit();}else{
app.on('second-instance',()=>{if(win){win.show();win.focus();}});
app.whenReady().then(async()=>{
 const {ChatGPTBridge}=await import('./bridge.mjs');bridge=new ChatGPTBridge();const root=path.resolve(__dirname,'../public');
 const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
 server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const asset=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!asset.startsWith(root+path.sep)||!types[path.extname(asset)]){res.writeHead(404);res.end();return;}const data=await readFile(asset);res.writeHead(200,{'Content-Type':types[path.extname(asset)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);}catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
 const bounds=screen.getPrimaryDisplay().workAreaSize,width=Math.min(620,bounds.width),height=Math.min(680,bounds.height);
 win=new BrowserWindow({width,height,center:true,frame:false,transparent:true,backgroundColor:'#00000000',hasShadow:false,resizable:false,alwaysOnTop:true,title:'Dudidam — Avatar Transparan',show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:true,spellcheck:false}});
 win.setAlwaysOnTop(true,'floating');
 win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
 const trusted=e=>e.sender===win?.webContents&&e.senderFrame?.url?.startsWith(origin+'/');
 ipcMain.handle('dudidam:status',async e=>{if(!trusted(e))return {error:'Akses ditolak.'};try{return await bridge.status();}catch(e){return {configured:false,error:e.message};}});
 ipcMain.handle('dudidam:ask',async(e,value)=>{if(!trusted(e))return {error:'Akses ditolak.'};try{return await bridge.ask(value);}catch(e){return {error:e.message};}});
 ipcMain.handle('dudidam:login',async e=>{if(!trusted(e))return {error:'Akses ditolak.'};try{return await bridge.login();}catch(e){return {error:e.message};}});
 ipcMain.on('dudidam:center',e=>{if(trusted(e))win.center();});ipcMain.on('dudidam:minimize',e=>{if(trusted(e))win.minimize();});ipcMain.on('dudidam:close',e=>{if(trusted(e))win.close();});
 ipcMain.on('dudidam:move',(e,d)=>{if(!trusted(e)||!Number.isFinite(d?.dx)||!Number.isFinite(d?.dy))return;const [x,y]=win.getPosition();win.setPosition(x+Math.round(Math.max(-100,Math.min(100,d.dx))),y+Math.round(Math.max(-100,Math.min(100,d.dy))));});
 win.webContents.setWindowOpenHandler(({url})=>{try{if(new URL(url).origin==='https://chatgpt.com')shell.openExternal(url);}catch{}return {action:'deny'};});win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith(origin+'/'))e.preventDefault();});win.webContents.on('will-attach-webview',e=>e.preventDefault());
 win.webContents.session.setPermissionRequestHandler(async(contents,permission,callback,details)=>{if(contents!==win.webContents||!contents.getURL().startsWith(origin+'/')||permission!=='media'){callback(false);return;}const types=details.mediaTypes||[];const result=await dialog.showMessageBox(win,{type:'question',title:'Izin perangkat Dudidam',message:'Izinkan '+(types.includes('video')?'kamera':'mikrofon')+' untuk sesi ini?',detail:'Kamera hanya mengirim satu foto ketika tombol Kirim foto ditekan.',buttons:['Izinkan','Batal'],defaultId:1,cancelId:1});callback(result.response===0);});
 win.once('ready-to-show',()=>win.show());win.on('closed',()=>{bridge.stop();server.close();win=null;});await win.loadURL(origin+'/');
 console.log('Dudidam desktop ready: transparent=true; frame=false; centered=true; chatgpt=local-login');
});app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>{bridge?.stop();server?.close();});}
