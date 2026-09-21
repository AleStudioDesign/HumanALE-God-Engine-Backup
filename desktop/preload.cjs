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
 avatarViewport:value=>ipcRenderer.send('dudidam:avatar-viewport',value),
 panelViewport:value=>ipcRenderer.send('dudidam:panel-viewport',value),
 minimize:()=>ipcRenderer.send('dudidam:minimize'),
 close:()=>ipcRenderer.send('dudidam:close'),
 finishDismiss:reason=>ipcRenderer.send('dudidam:dismiss-complete',reason),
 onSummon:callback=>{if(typeof callback!=='function')return()=>{};const handler=()=>callback();ipcRenderer.on('dudidam:summon',handler);return()=>ipcRenderer.removeListener('dudidam:summon',handler);},
 onDismiss:callback=>{if(typeof callback!=='function')return()=>{};const handler=(_event,reason)=>callback(reason);ipcRenderer.on('dudidam:dismiss',handler);return()=>ipcRenderer.removeListener('dudidam:dismiss',handler);},
 onGlobalPointer:callback=>{if(typeof callback!=='function')return()=>{};const handler=(_event,point)=>callback(point);ipcRenderer.on('dudidam:global-pointer',handler);return()=>ipcRenderer.removeListener('dudidam:global-pointer',handler);}
}));
