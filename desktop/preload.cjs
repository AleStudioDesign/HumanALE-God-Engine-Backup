const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('dudidamDesktop',Object.freeze({
 status:()=>ipcRenderer.invoke('dudidam:status'),
 ask:payload=>ipcRenderer.invoke('dudidam:ask',payload),
 login:()=>ipcRenderer.invoke('dudidam:login'),
 center:()=>ipcRenderer.send('dudidam:center'),
 move:delta=>ipcRenderer.send('dudidam:move',delta),
 mousePassthrough:ignore=>ipcRenderer.send('dudidam:mouse-passthrough',Boolean(ignore)),
 minimize:()=>ipcRenderer.send('dudidam:minimize'),
 close:()=>ipcRenderer.send('dudidam:close')
}));
