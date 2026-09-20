const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('dudidamDesktop',Object.freeze({
 status:provider=>ipcRenderer.invoke('dudidam:status',provider),
 ask:payload=>ipcRenderer.invoke('dudidam:ask',payload),
 login:()=>ipcRenderer.invoke('dudidam:login'),
 center:()=>ipcRenderer.send('dudidam:center'),
 move:delta=>ipcRenderer.send('dudidam:move',delta),
 passthrough:value=>ipcRenderer.send('dudidam:passthrough',value),
 minimize:()=>ipcRenderer.send('dudidam:minimize'),
 close:()=>ipcRenderer.send('dudidam:close')
}));
