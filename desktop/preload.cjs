const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('dudidamDesktop',Object.freeze({
 status:provider=>ipcRenderer.invoke('dudidam:status',provider),
 ask:payload=>ipcRenderer.invoke('dudidam:ask',payload),
 login:()=>ipcRenderer.invoke('dudidam:login'),
 agents:()=>ipcRenderer.invoke('dudidam:agents'),
 runAgent:payload=>ipcRenderer.invoke('dudidam:agent-run',payload),
 openAgent:id=>ipcRenderer.invoke('dudidam:agent-open',id),
 center:()=>ipcRenderer.send('dudidam:center'),
 move:delta=>ipcRenderer.send('dudidam:move',delta),
 passthrough:value=>ipcRenderer.send('dudidam:passthrough',value),
 passthroughLock:value=>ipcRenderer.send('dudidam:passthrough-lock',value),
 minimize:()=>ipcRenderer.send('dudidam:minimize'),
 close:()=>ipcRenderer.send('dudidam:close'),
 onSummon:callback=>{if(typeof callback!=='function')return()=>{};const handler=()=>callback();ipcRenderer.on('dudidam:summon',handler);return()=>ipcRenderer.removeListener('dudidam:summon',handler);}
}));
