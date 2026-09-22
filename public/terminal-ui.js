(()=>{
 const desktop=window.dudidamDesktop;
 const dialog=document.querySelector('#terminalDialog');
 if(!desktop||!dialog||typeof window.Terminal!=='function'||!window.FitAddon?.FitAddon)return;

 const tabs=document.querySelector('#terminalTabs');
 const host=document.querySelector('#terminalViews');
 const shellSelect=document.querySelector('#terminalShell');
 const statusEl=document.querySelector('#terminalStatus');
 const cwdEl=document.querySelector('#terminalCwd');
 const cliEl=document.querySelector('#terminalCliStatus');
 const sessions=new Map();
 let activeId='';

 const theme={background:'#020805',foreground:'#d7f7df',cursor:'#b8ffb8',black:'#08110c',red:'#ff8d8d',green:'#9effbd',yellow:'#e8da8b',blue:'#8abfff',magenta:'#d3a5ff',cyan:'#86e9ff',white:'#e6ffed',brightBlack:'#557060',brightRed:'#ffb0b0',brightGreen:'#c3ffd2',brightYellow:'#fff1ad',brightBlue:'#b3d3ff',brightMagenta:'#e4c6ff',brightCyan:'#b9f5ff',brightWhite:'#ffffff'};

 function setStatus(text){statusEl.textContent=text;}
 function tabLabel(session){return session.title||session.shellLabel||'Terminal';}
 function activate(id){
  const item=sessions.get(id);if(!item)return;
  activeId=id;
  for(const [key,value] of sessions){value.view.hidden=key!==id;value.tab.classList.toggle('active',key===id);}
  cwdEl.textContent=item.session.cwd||'';
  setStatus('● Running · PID '+(item.session.pid||'—'));
  requestAnimationFrame(()=>{try{item.fit.fit();desktop.terminalResize(id,item.term.cols,item.term.rows);}catch{}item.term.focus();});
 }
 function addTab(session){
  const term=new window.Terminal({cursorBlink:true,convertEol:false,scrollback:6000,fontFamily:'"Cascadia Code","Cascadia Mono",Consolas,monospace',fontSize:12,theme,allowProposedApi:false});
  const fit=new window.FitAddon.FitAddon();term.loadAddon(fit);
  const view=document.createElement('div');view.className='terminal-view';view.hidden=true;host.append(view);term.open(view);
  const tab=document.createElement('button');tab.type='button';tab.className='terminal-tab';tab.textContent=tabLabel(session);
  const close=document.createElement('span');close.textContent=' ×';close.setAttribute('aria-label','Tutup terminal');tab.append(close);
  tab.addEventListener('click',async event=>{if(event.target===close){event.stopPropagation();await closeSession(session.id);return;}activate(session.id);});
  tabs.append(tab);
  term.onData(data=>desktop.terminalWrite(session.id,data));
  term.attachCustomKeyEventHandler(event=>{
   if(event.type!=='keydown')return true;
   if(event.ctrlKey&&event.shiftKey&&event.code==='KeyC'){const selection=term.getSelection();if(selection)navigator.clipboard?.writeText(selection);return false;}
   if(event.ctrlKey&&event.shiftKey&&event.code==='KeyV'){navigator.clipboard?.readText().then(text=>desktop.terminalWrite(session.id,text));return false;}
   if(event.ctrlKey&&event.code==='KeyF'){event.preventDefault();const q=prompt('Cari teks terminal');if(q){const buffer=term.buffer.active;for(let y=buffer.baseY+buffer.cursorY;y>=0;y--){const line=buffer.getLine(y)?.translateToString(true)||'';if(line.toLowerCase().includes(q.toLowerCase())){term.scrollToLine(y);break;}}}return false;}
   return true;
  });
  sessions.set(session.id,{session,term,fit,view,tab});
  requestAnimationFrame(()=>{fit.fit();desktop.terminalResize(session.id,term.cols,term.rows);});
  activate(session.id);
 }
 async function newTerminal(options={}){
  try{
   setStatus('Starting…');
   const result=await desktop.terminalCreate({shell:options.shell||shellSelect.value||'auto',startupCommand:options.startupCommand||'',title:options.title||'',cols:120,rows:30});
   if(result?.error)throw new Error(result.error);
   addTab(result);return result;
  }catch(error){setStatus('⚠ '+(error?.message||'Terminal gagal dibuat.'));return null;}
 }
 async function closeSession(id){
  try{await desktop.terminalKill(id);}catch{}
  const item=sessions.get(id);if(!item)return;
  item.term.dispose();item.view.remove();item.tab.remove();sessions.delete(id);
  if(activeId===id){const next=[...sessions.keys()].at(-1)||'';activeId='';if(next)activate(next);else setStatus('○ Stopped');}
 }
 async function restartActive(){
  if(!activeId)return;
  const old=sessions.get(activeId);if(!old)return;
  const result=await desktop.terminalRestart(activeId);
  old.term.dispose();old.view.remove();old.tab.remove();sessions.delete(activeId);
  if(result?.error){setStatus('⚠ '+result.error);return;}
  addTab(result);
 }
 function active(){return sessions.get(activeId);}
 async function refreshDetection(){
  const data=await desktop.terminalDetect();if(data?.error){cliEl.textContent=data.error;return;}
  cwdEl.textContent=active()?.session.cwd||data.workspace||'';
  const entries=Object.values(data.registry||{}).map(item=>item.id+': '+item.state);
  cliEl.textContent=entries.join(' · ');
  for(const id of ['claude','codex','cursor','gemini']){const button=document.querySelector('[data-terminal-cli="'+id+'"]');if(button)button.disabled=data.registry?.[id]?.state!=='READY';}
 }
 async function openTerminal(kind='auto'){
  if(!dialog.open){document.querySelectorAll('dialog[open]').forEach(item=>item.close());dialog.showModal();}
  if(kind==='claude')return newTerminal({startupCommand:'claude',title:'Claude',shell:'auto'});
  if(kind==='codex')return newTerminal({startupCommand:'codex',title:'Codex',shell:'auto'});
  if(kind==='cursor')return newTerminal({startupCommand:'agent',title:'Cursor',shell:'auto'});
  if(kind==='gemini')return newTerminal({startupCommand:'gemini',title:'Gemini',shell:'auto'});
  if(kind==='powershell')kind='powershell';
  if(kind==='cmd')kind='cmd';
  if(!sessions.size||kind!=='auto')await newTerminal({shell:kind});
  await refreshDetection();
 }
 async function runCommand(command,confirmed=false){
  if(!activeId){const created=await newTerminal({shell:'auto'});if(!created)return;}
  const result=await desktop.terminalExecute({sessionId:activeId,command,confirmed});
  if(result?.needsConfirmation){
   if(confirm(result.reason+'\n\nJalankan command ini?\n'+command))return runCommand(command,true);
   return {cancelled:true};
  }
  if(result?.error){alert(result.error);return result;}
  return result;
 }

 desktop.onTerminalData((id,data)=>sessions.get(id)?.term.write(data));
 desktop.onTerminalExit((id,exitCode)=>{
  const item=sessions.get(id);if(!item)return;
  item.session.status='stopped';setStatus('○ Stopped · exit '+(exitCode??'—'));item.term.write('\r\n\x1b[90m[Dudidam: terminal selesai]\x1b[0m\r\n');
 });
 window.addEventListener('resize',()=>{const item=active();if(!item)return;requestAnimationFrame(()=>{item.fit.fit();desktop.terminalResize(activeId,item.term.cols,item.term.rows);});});

 document.querySelector('#terminalOpen')?.addEventListener('click',()=>openTerminal('auto'));
 document.querySelector('#terminalNew')?.addEventListener('click',()=>newTerminal({shell:shellSelect.value||'auto'}));
 document.querySelector('#terminalClear')?.addEventListener('click',()=>{const item=active();if(item){item.term.clear();desktop.terminalClear(activeId);}});
 document.querySelector('#terminalRestart')?.addEventListener('click',restartActive);
 document.querySelector('#terminalKill')?.addEventListener('click',()=>activeId&&closeSession(activeId));
 document.querySelector('#terminalRefresh')?.addEventListener('click',refreshDetection);
 for(const button of document.querySelectorAll('[data-terminal-cli]'))button.addEventListener('click',()=>openTerminal(button.dataset.terminalCli));

 const chatForm=document.querySelector('#chatForm'),promptBox=document.querySelector('#prompt');
 chatForm?.addEventListener('submit',event=>{
  const text=promptBox?.value?.trim()||'';
  if(!/^\/(?:terminal|run)\b/i.test(text))return;
  event.preventDefault();event.stopImmediatePropagation();
  promptBox.value='';
  if(/^\/terminal\b/i.test(text)){
   const kind=text.replace(/^\/terminal\b/i,'').trim().toLowerCase()||'auto';
   const mapped={powershell:'powershell',pwsh:'pwsh',cmd:'cmd',claude:'claude',codex:'codex',cursor:'cursor',gemini:'gemini'}[kind]||'auto';
   openTerminal(mapped);
  }else{
   const command=text.replace(/^\/run\b/i,'').trim();
   if(!command){alert('Gunakan /run diikuti command.');return;}
   openTerminal('auto').then(()=>runCommand(command));
  }
 },true);

 window.dudidamTerminalUI=Object.freeze({open:openTerminal,run:runCommand,refresh:refreshDetection});
 refreshDetection();
})();
