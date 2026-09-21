import {BinaryAvatar} from './avatar.js';
import {parseCommand} from './commands.js';
import {AudioReactor} from './audio-reactor.js';
import {containsAleWakeWord,HOLD_TO_SUMMON_MS} from './wake-utils.js';
const $=s=>document.querySelector(s),desktop=window.dudidamDesktop,params=new URLSearchParams(location.search),popup=params.get('popup')==='1',panelOnly=Boolean(desktop&&params.has('panel')),avatar=new BinaryAvatar($('#avatar'));
const panelChannel=desktop?new BroadcastChannel('dudidam-avatar-panel'):null;
const apiProviders=['copilot','openai','grok','gemini','claude','deepseek','askcodi'];
const SUMMON_DURATION_MS=4200;
const DISMISS_DURATION_MS=3000;
const DEFAULT_AVATAR_SIZE=420;
let panelZoomFactor=1;
let aiReady=false,savedProvider=desktop?localStorage.getItem('dudidam-provider'):'',aiProvider=apiProviders.includes(savedProvider)?savedProvider:'chatgpt',busy=false,voice=true,selectedVoiceURI=desktop?(localStorage.getItem('dudidam-voice-uri')||''):'',listening=false,recognition,cameraStream,cameraPending=false,history=[],toastTimer,bubbleTimer,speechTimer,drag,offset={x:0,y:0},ttsActive=false,ttsEnergy=0,audioEnergy=0,audioMode='',musicUrl='',wakeRecognition,wakeListening=false,wakeEnabled=desktop?localStorage.getItem('dudidam-wake-enabled')==='true':false,wakeRestartTimer,wakeHealthVerified=false,wakeRetryBlocked=false,wakeNetworkFailures=0,summoning=false,dismissing=false,transitionSerial=0,hold5Timer,hold5Fired=false;
let wakeStartGeneration=0;
let micProbeGeneration=0,micChecking=false;
let remoteSpeechEnergy=0;
let localRecorder,localStream,localChunks=[],localTimer,localCaptureGeneration=0;
let onlineSpeech,onlineSpeechUrl,speechGeneration=0,localTtsConfigured=false;
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const audioReactor=new AudioReactor(level=>{audioEnergy=level;syncFaceAudio();});
if(desktop){document.body.classList.add('desktop');$('.desktop-actions').hidden=false;$('#providerRow').hidden=false;$('#provider').value=aiProvider;$('#popup').hidden=true;if(panelOnly)document.body.classList.add('detached-panel');}else $('#systemAudio').hidden=true;
if(popup){document.body.classList.add('popup-widget');$('#popup').hidden=true;}
function applyAvatarSize(value){
 const size=Math.max(180,Math.min(540,Number(value)||DEFAULT_AVATAR_SIZE));
 document.documentElement.style.setProperty('--avatar-size',size+'px');
 const slider=$('#avatarSize'),output=$('#avatarSizeValue');
 if(slider)slider.value=String(size);
 if(output)output.textContent=size+' px';
 if(desktop)localStorage.setItem('dudidam-avatar-size',String(size));
 if(!panelOnly)desktop?.avatarViewport?.({size});
 if(panelOnly)panelChannel?.postMessage({type:'avatar-size',size});
 requestAnimationFrame(()=>avatar.resize());
}
const storedAvatarSize=desktop?Number(localStorage.getItem('dudidam-avatar-size')):0;
const initialAvatarSize=!storedAvatarSize||storedAvatarSize===380?DEFAULT_AVATAR_SIZE:storedAvatarSize;
applyAvatarSize(initialAvatarSize);
function applyPanelZoom(value){
 const zoom=Math.max(75,Math.min(145,Number(value)||100));
 panelZoomFactor=zoom/100;
 document.documentElement.style.setProperty('--panel-zoom',String(panelZoomFactor));
 const slider=$('#panelZoom'),output=$('#panelZoomValue');
 if(slider)slider.value=String(zoom);
 if(output)output.textContent=zoom+'%';
 if(desktop)localStorage.setItem('dudidam-panel-zoom',String(zoom));
 if(!panelOnly)desktop?.panelViewport?.({zoom:panelZoomFactor,open:Boolean(document.querySelector('dialog[open]'))});
 requestAnimationFrame(()=>document.querySelectorAll('dialog[open]').forEach(clampDialog));
}
function applyPanelTransparency(value){
 const transparency=Math.max(0,Math.min(80,Number(value)||0));
 const alpha=Math.max(.2,1-transparency/100);
 document.documentElement.style.setProperty('--panel-alpha',alpha.toFixed(2));
 const slider=$('#panelOpacity'),output=$('#panelOpacityValue');
 if(slider)slider.value=String(transparency);
 if(output)output.textContent=transparency+'%';
 if(desktop)localStorage.setItem('dudidam-panel-transparency',String(transparency));
}
applyPanelZoom(desktop?localStorage.getItem('dudidam-panel-zoom')||100:100);
applyPanelTransparency(desktop?localStorage.getItem('dudidam-panel-transparency')||5:5);
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,6000);}
function state(text=''){$('#state').textContent=text;$('#state').hidden=!text;avatar.thinking=busy;}
function setWakeStatus(text,active=false){const el=$('#wakeIndicator');if(el){el.textContent=text;el.dataset.active=active?'true':'false';}const toggle=$('#wakeToggle');if(toggle)toggle.checked=wakeEnabled;if(!panelOnly)panelChannel?.postMessage({type:'wake-status',text,active,enabled:wakeEnabled});}
let passthroughRequested, passthroughSentAt=0;
function setPassthrough(ignore){if(!desktop||panelOnly)return;const now=performance.now();if(passthroughRequested===ignore&&now-passthroughSentAt<500)return;passthroughRequested=ignore;passthroughSentAt=now;desktop.passthrough(ignore);}
function pointInElement(element,x,y){if(!element||element.hidden)return false;const rect=element.getBoundingClientRect();return x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom;}
function pointInAvatarFace(x,y){const canvas=$('#avatar');if(!canvas)return false;const rect=canvas.getBoundingClientRect(),rx=rect.width*.36,ry=rect.height*.43;if(!rx||!ry)return false;const dx=(x-(rect.left+rect.width/2))/rx,dy=(y-(rect.top+rect.height/2))/ry;return dx*dx+dy*dy<=1;}
const transitioning=()=>summoning||dismissing;
function syncPassthrough(event){if(!desktop||panelOnly)return;if(transitioning()){setPassthrough(true);return;}if(document.querySelector('dialog[open]')){setPassthrough(false);return;}const x=event?.clientX,y=event?.clientY;if(!Number.isFinite(x)||!Number.isFinite(y)){setPassthrough(true);return;}const interactive=pointInAvatarFace(x,y)||['#reveal','#bubble','#toast'].some(selector=>pointInElement($(selector),x,y));setPassthrough(!interactive);}
function syncPanelViewportFromDialogs(){if(!panelOnly)requestAnimationFrame(()=>desktop?.panelViewport?.({zoom:panelZoomFactor,open:Boolean(document.querySelector('dialog[open]'))}));}
function showDialog(id){if(transitioning())return;if(desktop&&!panelOnly){desktop.openPanel(id.slice(1));return;}setPassthrough(false);document.querySelectorAll('dialog[open]').forEach(d=>d.close());$(id).showModal();if(!panelOnly)desktop?.panelViewport?.({zoom:panelZoomFactor,open:true});requestAnimationFrame(()=>clampDialog($(id)));if(id==='#chatDialog')$('#prompt').focus();}
function clampDialog(dialog){
 const rect=dialog.getBoundingClientRect(),left=Math.max(0,Math.min(innerWidth-rect.width,rect.left)),top=Math.max(0,Math.min(innerHeight-rect.height,rect.top));
 dialog.style.left=left+'px';dialog.style.top=top+'px';
}
function enableDialogDrag(dialog){
 const handle=dialog.querySelector('.dialog-top');if(!handle)return;
 handle.classList.add('drag-handle');
 let moving=null;
 handle.addEventListener('pointerdown',event=>{
  if(event.button!==0||event.target.closest('button,input,textarea,select,a,label'))return;
  const rect=dialog.getBoundingClientRect();
  moving={id:event.pointerId,startX:event.clientX,startY:event.clientY,left:rect.left,top:rect.top};
  dialog.classList.add('dialog-movable');dialog.style.left=rect.left+'px';dialog.style.top=rect.top+'px';dialog.style.right='auto';dialog.style.bottom='auto';dialog.style.margin='0';
  handle.setPointerCapture(event.pointerId);event.preventDefault();
 });
 handle.addEventListener('pointermove',event=>{if(!moving||event.pointerId!==moving.id)return;const rect=dialog.getBoundingClientRect();dialog.style.left=Math.max(0,Math.min(innerWidth-rect.width,moving.left+event.clientX-moving.startX))+'px';dialog.style.top=Math.max(0,Math.min(innerHeight-rect.height,moving.top+event.clientY-moving.startY))+'px';});
 const stop=event=>{if(!moving||event.pointerId!==moving.id)return;moving=null;try{handle.releasePointerCapture(event.pointerId);}catch{}clampDialog(dialog);};
 handle.addEventListener('pointerup',stop);handle.addEventListener('pointercancel',stop);
}
function syncFaceAudio(){const level=Math.max(ttsActive?ttsEnergy:0,audioEnergy,remoteSpeechEnergy);avatar.speaking=level>.025;avatar.setSpeechEnergy(level);if(panelOnly)panelChannel?.postMessage({type:'speech-level',level});}
function setPersona(provider=aiProvider){
 const persona=provider==='copilot'?'copilot':provider==='chatgpt'?'chatgpt':'dudidam';
 document.body.dataset.persona=persona;avatar.persona=persona;
 if(persona==='copilot')avatar.color='cyan';else if(persona==='chatgpt')avatar.color='spectrum';
 $('#personaBadge').textContent=persona==='copilot'?'DUDIDAM · GITHUB COPILOT':persona==='chatgpt'?'DUDIDAM · CHATGPT':'DUDIDAM · '+provider.toUpperCase();
 if(panelOnly)panelChannel?.postMessage({type:'persona',provider});
}
function getIndonesianVoices(){
 if(!window.speechSynthesis)return [];
 return speechSynthesis.getVoices().filter(item=>/^id(?:-|$)/i.test(item.lang||'')||/indonesia|bahasa/i.test(item.name||''));
}
function refreshIndonesianVoices(){
 const select=$('#voiceSelect'),status=$('#voiceStatus');if(!select)return;
 const voices=getIndonesianVoices(),previous=selectedVoiceURI;
 select.replaceChildren();
 const automatic=document.createElement('option');automatic.value='';automatic.textContent='Otomatis · id-ID';select.append(automatic);
 for(const item of voices){const option=document.createElement('option');option.value=item.voiceURI;option.textContent=item.name+' · '+item.lang;select.append(option);}
 const savedExists=previous&&voices.some(item=>item.voiceURI===previous);
 selectedVoiceURI=savedExists?previous:'';
 select.value=selectedVoiceURI;
 if(desktop&&!savedExists&&previous)localStorage.removeItem('dudidam-voice-uri');
 if(status)status.textContent=voices.length?voices.length+' voice Bahasa Indonesia lokal tersedia.':'Mencari suara Indonesia lokal…';
 if(desktop?.ttsStatus)desktop.ttsStatus().then(result=>{localTtsConfigured=Boolean(result.configured);if(status)status.textContent=localTtsConfigured?'Suara lokal Dudidam siap. Setiap balasan teks akan otomatis dibacakan.':voices.length?voices.length+' voice Bahasa Indonesia lokal tersedia.':'Voice Indonesia belum tersedia. Pasang paket suara Windows atau model Piper Indonesia.';}).catch(()=>{localTtsConfigured=false;});
}
function stopSpeech(resumeWake=true){speechGeneration++;clearTimeout(speechTimer);window.speechSynthesis?.cancel();onlineSpeech?.pause();onlineSpeech=null;if(onlineSpeechUrl){URL.revokeObjectURL(onlineSpeechUrl);onlineSpeechUrl=null;}ttsActive=false;ttsEnergy=0;syncFaceAudio();if(!busy&&!listening&&!audioMode)state();if(resumeWake)resumeWakeSoon();}
async function speakLocal(text){
 const generation=speechGeneration;
 if(!desktop?.synthesize){setMicStatus('Voice Bahasa Indonesia belum tersedia. Balasan tampil sebagai teks.');resumeWakeSoon();return;}
 state('Menyiapkan suara Indonesia…');
 try{
  const result=await desktop.synthesize({text:text.slice(0,2000)});
  if(generation!==speechGeneration)return;
  if(result.error)throw new Error(result.error);
  const bytes=Uint8Array.from(atob(result.audio),character=>character.charCodeAt(0));
  onlineSpeechUrl=URL.createObjectURL(new Blob([bytes],{type:result.mime||'audio/wav'}));
  const player=new Audio(onlineSpeechUrl);onlineSpeech=player;
  player.onplay=()=>{ttsActive=true;ttsEnergy=.55;syncFaceAudio();avatar.trigger('nod');state('Berbicara · Bahasa Indonesia lokal');};
  player.ontimeupdate=()=>{ttsEnergy=.35+.25*Math.abs(Math.sin(player.currentTime*9));syncFaceAudio();};
  player.onended=()=>stopSpeech();player.onerror=()=>{setMicStatus('Audio suara Indonesia gagal diputar.');stopSpeech();};
  await player.play();
 }catch(error){
  if(generation!==speechGeneration)return;
  localTtsConfigured=false;
  const message=error.message||'Suara Indonesia lokal gagal.';
  setMicStatus(message+' Mencoba voice Windows Indonesia…');
  if(speakNativeIndonesian(text))return;
  setMicStatus(message+' Voice Windows Indonesia juga tidak tersedia.');
  stopSpeech();
 }
}
function speakNativeIndonesian(text){
 const voices=window.speechSynthesis?.getVoices()||[];
 const selected=voices.find(item=>item.voiceURI===selectedVoiceURI);
 const fallback=getIndonesianVoices()[0];
 const chosen=selected&&/^id(?:-|$)/i.test(selected.lang||'')?selected:fallback;
 if(!chosen)return false;
 const u=new SpeechSynthesisUtterance(text);
 u.lang=chosen.lang;u.rate=1;u.voice=chosen;
 u.onstart=()=>{ttsActive=true;ttsEnergy=.7;syncFaceAudio();avatar.trigger('nod');state('Berbicara · '+(chosen?.name||'Bahasa Indonesia'));};
 u.onboundary=e=>{const ch=text.charCodeAt(Math.min(text.length-1,e.charIndex||0))||80;ttsEnergy=.35+(ch%61)/100;syncFaceAudio();};
 u.onend=u.onerror=()=>{ttsActive=false;ttsEnergy=0;syncFaceAudio();if(!busy&&!audioMode)state();resumeWakeSoon(700);};
 speechSynthesis.speak(u);speechTimer=setTimeout(stopSpeech,90000);
 return true;
}
function speak(text){
 stopSpeech(false);
 if(!voice){resumeWakeSoon();return;}
 stopListening(false);suspendWakeListening('ALE · wake mic dijeda saat berbicara');
 if(localTtsConfigured&&desktop?.synthesize){speakLocal(text);return;}
 if(speakNativeIndonesian(text))return;
 if(desktop?.synthesize){speakLocal(text);return;}
 setMicStatus('Voice Bahasa Indonesia belum tersedia. Balasan tampil sebagai teks.');
 resumeWakeSoon();
}
function updateAudioUi(mode='',label='Tidak aktif'){audioMode=mode;$('#audioStatus').textContent=label;$('#audioMic').setAttribute('aria-pressed',String(mode==='microphone'));$('#systemAudio').setAttribute('aria-pressed',String(mode==='system'));$('#stopAudio').disabled=!mode;if(!busy&&!ttsActive)state(mode?'Audio aktif':'');}
function stopReactiveAudio(){audioReactor.stop();audioEnergy=0;syncFaceAudio();const player=$('#musicPlayer');player.pause();if(musicUrl){URL.revokeObjectURL(musicUrl);musicUrl='';player.removeAttribute('src');player.load();}player.hidden=true;$('#musicFile').value='';updateAudioUi();}
async function startMicrophoneVisual(){if(audioMode==='microphone'){stopReactiveAudio();return;}stopReactiveAudio();try{const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});await audioReactor.useStream(stream);updateAudioUi('microphone','Mikrofon bereaksi');}catch(error){stopReactiveAudio();toast(error?.name==='NotAllowedError'?'Izin mikrofon belum diberikan.':'Mikrofon tidak dapat dianalisis.');}}
async function startSystemAudio(){if(audioMode==='system'){stopReactiveAudio();return;}stopReactiveAudio();if(!desktop||!navigator.mediaDevices?.getDisplayMedia){toast('Audio perangkat tersedia pada Dudidam Desktop Windows.');return;}try{const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});stream.getVideoTracks().forEach(track=>track.stop());if(!stream.getAudioTracks().length)throw new Error('no-audio');await audioReactor.useStream(stream);for(const track of stream.getAudioTracks())track.addEventListener('ended',()=>updateAudioUi(),{once:true});updateAudioUi('system','Audio perangkat bereaksi');}catch{stopReactiveAudio();toast('Audio perangkat tidak tersedia. Putar musik dari file atau gunakan mikrofon visual.');}}
async function playMusic(file){if(!file)return;stopReactiveAudio();const player=$('#musicPlayer');try{musicUrl=URL.createObjectURL(file);player.src=musicUrl;player.hidden=false;await audioReactor.useElement(player);await player.play();updateAudioUi('music','Musik bereaksi');}catch{stopReactiveAudio();toast('File audio tidak dapat diputar. Pilih MP3, WAV, atau format yang didukung.');}}
function message(text,role='assistant',say=true,broadcast=true){const a=document.createElement('article');a.className='message '+role;const b=document.createElement('b');b.textContent=role==='assistant'?'DUDIDAM':'KAMU';const p=document.createElement('p');p.textContent=text;a.append(b,p);$('#messages').append(a);$('#messages').scrollTop=$('#messages').scrollHeight;if(role==='assistant'){$('#bubble').textContent=text;$('#bubble').hidden=!panelOnly&&$('#chatDialog').open;clearTimeout(bubbleTimer);bubbleTimer=setTimeout(()=>$('#bubble').hidden=true,15000);if(say)speak(text);}if(broadcast)panelChannel?.postMessage({type:'message',text,role});}
async function submit(text,image){text=text.trim();if(!text||busy)return;message(text,'user',false);const cmd=!image&&parseCommand(text);if(cmd){let answer='';if(['blink','nod','shake'].includes(cmd)){avatar.trigger(cmd);answer={blink:'Saya berkedip.',nod:'Baik, saya mengangguk.',shake:'Saya menggelengkan kepala.'}[cmd];}if(cmd==='stop'){stopSpeech();stopListening();answer='Baik. Suara dihentikan.';}if(cmd==='hello'){avatar.trigger('nod');answer='Halo, saya Dudidam. Saya mendengarkan.';}if(cmd==='help')answer='Klik kanan atau tekan H untuk kontrol, Enter untuk percakapan. B berkedip, N mengangguk, G menggeleng, M mikrofon, R tengahkan. Tombol 1 sampai 5 mengganti gaya biner dan neural. Ukuran avatar dapat diatur dari kontrol. Seret wajah untuk memindahkan.';if(cmd==='time')answer='Sekarang pukul '+new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})+'.';if(cmd==='date')answer='Hari ini '+new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+'.';if(cmd==='pet'){document.querySelectorAll('dialog[open]').forEach(d=>d.close());answer='Panel disembunyikan.';}message(answer,'assistant',cmd!=='stop');return;}
 if(!desktop){message('Login Sites hanya mengenali akun. Untuk percakapan model gunakan Dudidam Desktop.','assistant',false);return;}
 if(aiProvider==='copilot'&&!image&&isExplicitProjectWorkRequest(text)){
  busy=true;stopSpeech();$('#send').disabled=true;$('#look').disabled=true;state('GitHub Copilot mengerjakan proyek…');$('#liveText').textContent='Copilot Work mode sedang mengedit checkout proyek…';
  try{
   const result=await runCopilotProjectWork(text);
   if(result?.error)throw new Error(result.error);
   const answer=result?.text||'Copilot selesai tanpa output teks.';
   history.push({role:'user',content:text},{role:'assistant',content:answer});history=history.slice(-10);panelChannel?.postMessage({type:'history',history});message(answer);
  }catch(error){message(error?.message||'Copilot Work mode gagal menjalankan tugas.','assistant',false);}
  finally{busy=false;avatar.thinking=false;$('#send').disabled=false;$('#look').disabled=false;$('#liveText').textContent='';if(!avatar.speaking&&!listening)state();}
  return;
 }
 if(!aiReady){const missing={copilot:'GitHub Copilot CLI belum tersedia. Pasang dan login Copilot, lalu tekan Periksa lagi.',openai:'OpenAI API belum aktif. Atur OPENAI_API_KEY pada environment Windows, buka ulang Dudidam, lalu tekan Periksa lagi.',grok:'Grok belum aktif. Atur XAI_API_KEY pada environment Windows, buka ulang Dudidam, lalu tekan Periksa lagi.',gemini:'Gemini belum aktif. Atur GEMINI_API_KEY atau GOOGLE_API_KEY pada environment Windows, buka ulang Dudidam, lalu tekan Periksa lagi.',claude:'Claude belum aktif. Atur ANTHROPIC_API_KEY pada environment Windows, buka ulang Dudidam, lalu tekan Periksa lagi.',deepseek:'DeepSeek belum aktif. Atur DEEPSEEK_API_KEY pada environment Windows, buka ulang Dudidam, lalu tekan Periksa lagi.',askcodi:'AskCodi belum aktif. Atur ASKCODI_API_KEY dan ASKCODI_MODEL, buka ulang Dudidam, lalu tekan Periksa lagi.'}[aiProvider]||'Silakan pilih Login ChatGPT pada kontrol avatar, selesaikan login di browser, lalu Periksa lagi.';message(missing,'assistant',false);return;}
 busy=true;stopSpeech();$('#send').disabled=true;$('#look').disabled=true;state('Berpikir…');const providerName={copilot:'GitHub Copilot',openai:'OpenAI API',grok:'Grok',gemini:'Gemini',claude:'Claude',deepseek:'DeepSeek',askcodi:'AskCodi'}[aiProvider]||'ChatGPT';$('#liveText').textContent=providerName+' sedang merespons…';
 try{const result=await desktop.ask({provider:aiProvider,message:text,history:history.slice(-10),image});if(result.error)throw new Error(result.error);history.push({role:'user',content:text},{role:'assistant',content:result.text});history=history.slice(-10);panelChannel?.postMessage({type:'history',history});message(result.text);}
 catch(e){message(e.message||('Koneksi '+providerName+' gagal. Coba lagi.'),'assistant',false);}finally{busy=false;avatar.thinking=false;$('#send').disabled=false;$('#look').disabled=false;$('#liveText').textContent='';if(!avatar.speaking&&!listening)state();}
}
async function checkAI(){
 try{
  const data=desktop?await desktop.status(aiProvider):await (await fetch('/api/status',{cache:'no-store'})).json();
  aiReady=!!data.configured&&!!desktop;
 const hasLogin=aiProvider==='chatgpt'||aiProvider==='copilot';
 const noImage=['copilot','grok','claude','deepseek','askcodi'].includes(aiProvider);
 $('#login').hidden=desktop&&!hasLogin;$('#login').textContent=aiProvider==='copilot'?'Login Copilot':'Login ChatGPT';$('#chatgptLink').hidden=desktop&&aiProvider!=='chatgpt';$('#camera').disabled=noImage;
  if(noImage&&cameraStream)stopCamera();
 const details={
  copilot:{label:'GitHub Copilot',missing:'CLI belum terpasang',ready:'Percakapan memakai GitHub Copilot CLI lokal. Login dan akses Copilot diperiksa saat pesan pertama dikirim.',setup:'Pasang GitHub Copilot CLI resmi, login sebagai akun GitHub yang memiliki akses Copilot, lalu Periksa lagi.',note:'GitHub Copilot CLI · riwayat percakapan hanya di memori aplikasi · foto belum didukung.'},
   openai:{label:'OpenAI API',missing:'OPENAI_API_KEY diperlukan',ready:'Percakapan dan foto dikirim dari proses desktop langsung ke OpenAI Responses API. API key tidak dikirim ke renderer.',setup:'Atur OPENAI_API_KEY pada environment Windows lalu buka ulang Dudidam. Model default: gpt-5.4-mini.',note:'OpenAI Responses API · riwayat percakapan di memori aplikasi · foto kamera didukung.'},
   grok:{label:'Grok',missing:'XAI_API_KEY diperlukan',ready:'Percakapan dikirim dari proses desktop langsung ke xAI API. XAI_API_KEY tidak dikirim ke renderer.',setup:'Atur XAI_API_KEY pada environment Windows lalu buka ulang Dudidam. Model default: grok-4.6.',note:'Grok via xAI API · riwayat percakapan di memori aplikasi · foto belum diaktifkan.'},
   gemini:{label:'Gemini',missing:'GEMINI_API_KEY diperlukan',ready:'Percakapan dan foto dikirim dari proses desktop langsung ke Gemini API. API key tidak dikirim ke renderer.',setup:'Atur GEMINI_API_KEY atau GOOGLE_API_KEY pada environment Windows lalu buka ulang Dudidam. Model default: gemini-3.6-flash.',note:'Gemini via Google AI · riwayat percakapan di memori aplikasi · foto kamera didukung.'},
   claude:{label:'Claude',missing:'ANTHROPIC_API_KEY diperlukan',ready:'Percakapan dikirim dari proses desktop langsung ke Anthropic Messages API. API key tidak dikirim ke renderer.',setup:'Atur ANTHROPIC_API_KEY pada environment Windows lalu buka ulang Dudidam. Model default: claude-sonnet-4-6.',note:'Claude via Anthropic API · riwayat percakapan di memori aplikasi · foto belum diaktifkan.'},
   deepseek:{label:'DeepSeek',missing:'DEEPSEEK_API_KEY diperlukan',ready:'Percakapan dikirim dari proses desktop langsung ke DeepSeek Responses API. API key tidak dikirim ke renderer.',setup:'Atur DEEPSEEK_API_KEY pada environment Windows lalu buka ulang Dudidam. Model default: deepseek-flash.',note:'DeepSeek API · riwayat percakapan di memori aplikasi · foto belum diaktifkan.'},
   askcodi:{label:'AskCodi',missing:'key/model diperlukan',ready:'Percakapan dikirim dari proses desktop ke AskCodi API Gateway. Kredensial tidak dikirim ke renderer.',setup:'Atur ASKCODI_API_KEY dan ASKCODI_MODEL pada environment Windows lalu buka ulang Dudidam.',note:'AskCodi API Gateway · riwayat percakapan di memori aplikasi · foto belum diaktifkan.'}
  };
  const meta=details[aiProvider];
  if(meta){
   $('#aiStatus').textContent=aiReady?meta.label+' · '+(data.verified?'terhubung':data.model||'siap diuji'):meta.label+' · '+meta.missing;
   $('#apiDetail').textContent=aiReady?meta.ready:meta.setup;
   $('#chatNote').textContent=meta.note;
  }else{
   $('#aiStatus').textContent=aiReady?'ChatGPT · login aktif · tanpa API key':desktop?'Login ChatGPT diperlukan':data.signedIn?'Login Sites aktif':'Login Sites';
   $('#apiDetail').textContent=desktop?(aiReady?'Percakapan memakai login ChatGPT melalui Codex CLI lokal dan mengikuti batas penggunaan akun. Riwayat chatgpt.com tidak diimpor.':'Klik Login ChatGPT untuk membuka alur resmi. Setelah selesai, tekan Periksa lagi. Tidak perlu API key.'):'Versi Sites menampilkan avatar dan mengenali login. Percakapan model tersedia pada aplikasi Dudidam Desktop lokal.';
   $('#chatNote').textContent=desktop?'ChatGPT via Codex CLI · riwayat percakapan di memori aplikasi.':'Versi web: perintah dasar. Percakapan model langsung tersedia di desktop.';
  }
 }catch{$('#aiStatus').textContent='Status belum tersedia';$('#apiDetail').textContent='Periksa koneksi lalu coba lagi.';aiReady=false;}
}
async function loadAgents(){if(!desktop)return;const list=$('#agentList'),select=$('#agentSelect');list.replaceChildren();select.replaceChildren();$('#agentOutput').hidden=true;$('#agentRun').disabled=true;const data=await desktop.agents();if(data?.error){$('#agentProject').textContent=data.error;return;}$('#agentProject').textContent=(data.projectRootReady?'Project checkout siap: ':'Folder kerja belum siap: ')+data.projectRoot;for(const item of data.agents||[]){const card=document.createElement('article');card.className='agent-card';card.setAttribute('role','listitem');const head=document.createElement('div');head.className='agent-card-head';const title=document.createElement('strong');title.textContent=item.name;const state=document.createElement('span');state.className='agent-state';state.textContent=item.state;head.append(title,state);const method=document.createElement('small');method.textContent=item.method;const detail=document.createElement('p');detail.textContent=item.detail;const actions=document.createElement('div');actions.className='actions';const open=document.createElement('button');open.type='button';open.textContent='Dokumentasi ↗';open.onclick=async()=>{const result=await desktop.openAgent(item.id);if(result?.error)toast(result.error);};actions.append(open);card.append(head,method,detail,actions);list.append(card);if(item.canRun){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;select.append(option);}}$('#agentRun').disabled=!select.options.length;if(!select.options.length){const option=document.createElement('option');option.textContent='Tidak ada CLI agent terdeteksi';option.disabled=true;select.append(option);}syncAgentMode();}
function syncAgentMode(){
 const id=$('#agentSelect').value,mode=$('#agentMode'),work=mode?.querySelector('option[value="work"]');
 const allowed=id==='github-copilot'||id==='codex';
 if(work)work.disabled=!allowed;
 if(mode&&!allowed&&mode.value==='work')mode.value='analyze';
}
async function runDeveloperAgent(event){
 event.preventDefault();if(!desktop)return;
 const id=$('#agentSelect').value,prompt=$('#agentPrompt').value.trim(),mode=$('#agentMode').value;
 if(!id||!prompt)return;
 if(mode==='work'&&!['github-copilot','codex'].includes(id)){toast('Mode Kerja hanya tersedia untuk GitHub Copilot atau OpenAI Codex.');return;}
 $('#agentRun').disabled=true;$('#agentOutput').hidden=false;
 $('#agentOutput').textContent=mode==='work'?'Agent sedang melanjutkan pekerjaan proyek…':'Agent sedang menganalisis…';
 try{const result=await desktop.runAgent({id,prompt,mode});$('#agentOutput').textContent=result?.error||result?.text||'Agent selesai tanpa output.';}
 catch(error){$('#agentOutput').textContent=error?.message||'Agent gagal dijalankan.';}
 finally{$('#agentRun').disabled=false;}
}
async function chooseProjectFolder(){
 if(!desktop?.chooseProjectRoot)return;
 const button=$('#projectPick');button.disabled=true;
 try{
  const result=await desktop.chooseProjectRoot();
  if(result?.error){toast(result.error);return;}
  if(result?.canceled)return;
  toast(result?.projectRootReady?'Folder proyek siap untuk Mode Kerja.':'Folder dipilih, tetapi bukan checkout Git. Pilih folder repo yang memiliki .git.');
  await loadAgents();
 }catch(error){toast(error?.message||'Folder proyek belum dapat dipilih.');}
 finally{button.disabled=false;}
}
function isExplicitProjectWorkRequest(text=''){
 const value=String(text).toLowerCase().replace(/\s+/g,' ').trim();
 return /^(?:ok[,. ]+)?(?:(?:tolong|bantu|coba)\s+)?(?:kerjakan(?:\s+langsung)?|lakukan(?:\s+(?:sekarang|langsung))?|perbaiki(?:\s+(?:kode|proyek|project|avatar|fitur))?|ubah(?:\s+(?:kode|proyek|project|avatar|fitur))|implementasikan|terapkan(?:\s+(?:perubahan|perbaikan|ini))?|lanjutkan\s+(?:proyek|project|tugas|pekerjaan)|edit\s+(?:kode|proyek|project|file))\b/.test(value);
}
function buildProjectWorkPrompt(text){
 const context=history.slice(-6).map(item=>(item.role==='assistant'?'DUDIDAM':'PENGGUNA')+': '+item.content).join('\n');
 const prompt='Pengguna secara eksplisit meminta perubahan proyek dari percakapan Dudidam. Gunakan konteks berikut untuk memahami target visual/bug, lalu benar-benar edit file yang relevan di checkout proyek. Jangan hanya memberi rencana.\n\n'+(context?context+'\n':'')+'PENGGUNA SEKARANG: '+text+'\n\nSetelah mengedit, jalankan test yang relevan dan laporkan file yang diubah serta hasilnya.';
 return prompt.slice(-3900);
}
async function runCopilotProjectWork(text){
 const status=await desktop.agents();
 if(status?.error)throw new Error(status.error);
 if(!status?.projectRootReady){
  desktop.openPanel?.('agentDialog');
  throw new Error('Folder checkout proyek belum dipilih. Buka Developer agents → Pilih folder proyek, pilih folder repo entitashuman yang memiliki .git, lalu kirim perintah kerja lagi.');
 }
 const copilot=(status.agents||[]).find(item=>item.id==='github-copilot');
 if(!copilot?.canRun)throw new Error('GitHub Copilot Work mode belum siap. Pastikan Copilot CLI terpasang dan login, lalu Periksa koneksi di Developer agents.');
 return await desktop.runAgent({id:'github-copilot',mode:'work',prompt:buildProjectWorkPrompt(text)});
}
function setMicStatus(text){$('#micStatus').textContent=text;}
async function checkMicrophoneHealth(){
 if(!navigator.mediaDevices?.getUserMedia)return {ok:false,reason:'unsupported'};
 let stream;
 try{
  stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
  const track=stream.getAudioTracks()[0];
  if(!track||track.readyState!=='live')return {ok:false,reason:'unavailable'};
  const settings=track.getSettings?.()||{};
  return {ok:true,label:track.label||'Mikrofon Windows',sampleRate:settings.sampleRate};
 }catch(error){
  const name=error?.name||'';
  if(name==='NotAllowedError'||name==='SecurityError')return {ok:false,reason:'denied'};
  if(name==='NotFoundError'||name==='DevicesNotFoundError')return {ok:false,reason:'missing'};
  return {ok:false,reason:'unavailable'};
 }finally{stream?.getTracks().forEach(track=>track.stop());}
}
function wakeReasonText(reason){return {denied:'ALE · izin mikrofon ditolak',missing:'ALE · mikrofon tidak ditemukan',unsupported:'ALE · wake mic tidak didukung',unavailable:'ALE · mikrofon tidak tersedia'}[reason]||'ALE · wake mic tidak tersedia';}
function suspendWakeListening(status='ALE · wake mic dijeda'){
 wakeStartGeneration++;
 clearTimeout(wakeRestartTimer);wakeRestartTimer=null;
 const current=wakeRecognition;wakeRecognition=null;wakeListening=false;
 if(current){try{current.abort();}catch{}}
 setWakeStatus(status,false);
}
function resumeWakeSoon(delay=900){
 clearTimeout(wakeRestartTimer);
 if(!wakeEnabled||wakeRetryBlocked||summoning||listening||ttsActive||document.hidden)return;
 wakeRestartTimer=setTimeout(()=>startWakeListening(),delay);
}
async function startWakeListening(){
 if(!wakeEnabled||wakeRetryBlocked||wakeRecognition||wakeListening||summoning||listening||ttsActive||document.hidden)return;
 if(!desktop){setWakeStatus('ALE · wake mic tersedia di Desktop',false);return;}
 if(!SR){setWakeStatus('ALE · SpeechRecognition tidak tersedia',false);return;}
 const generation=++wakeStartGeneration;
 if(!wakeHealthVerified){
  const health=await checkMicrophoneHealth();
  if(generation!==wakeStartGeneration||!wakeEnabled||wakeRetryBlocked||summoning||listening||ttsActive||document.hidden)return;
  if(!health.ok){setWakeStatus(wakeReasonText(health.reason),false);return;}
  wakeHealthVerified=true;
 }
 const current=new SR();wakeRecognition=current;current.lang='id-ID';current.interimResults=true;current.continuous=true;
 current.onstart=()=>{if(wakeRecognition!==current)return;wakeListening=true;setWakeStatus('ALE · wake mic aktif',true);};
 current.onresult=event=>{if(wakeRecognition!==current||!wakeEnabled)return;wakeNetworkFailures=0;let heard='';for(let i=event.resultIndex;i<event.results.length;i++)heard+=' '+event.results[i][0].transcript;if(containsAleWakeWord(heard))summonAle('voice');};
 current.onerror=event=>{
  if(wakeRecognition!==current)return;
  wakeRecognition=null;
  wakeListening=false;
  const error=event.error;
  if(error==='aborted')return;
  if(error==='not-allowed'||error==='service-not-allowed'){
   wakeRetryBlocked=true;
   setWakeStatus('ALE · izin wake mic ditolak',false);
   return;
  }
  if(error==='network'){
   wakeNetworkFailures++;
   if(wakeNetworkFailures>=2){
    wakeRetryBlocked=true;
    setWakeStatus('ALE · layanan wake tidak tersedia · tahan tombol 5',false);
    setMicStatus('Mikrofon terdeteksi, tetapi layanan SpeechRecognition Electron gagal terhubung. Wake ALE dijeda; gunakan Ctrl+Alt+5 dari aplikasi mana pun, atau tahan tombol 5 saat Dudidam fokus.');
    return;
   }
   setWakeStatus('ALE · layanan wake gagal · mencoba sekali lagi…',false);
   resumeWakeSoon(5000);
   return;
  }
  if(error==='audio-capture'){
   wakeRetryBlocked=true;
   setWakeStatus('ALE · pengenal suara tidak dapat menangkap mikrofon',false);
   return;
  }
  setWakeStatus('ALE · wake mic mengulang…',false);
  resumeWakeSoon(error==='no-speech'?1800:5000);
 };
 current.onend=()=>{if(wakeRecognition!==current)return;wakeRecognition=null;wakeListening=false;if(wakeEnabled&&!wakeRetryBlocked&&!summoning&&!listening&&!ttsActive)resumeWakeSoon(1200);};
 try{current.start();}catch{if(wakeRecognition===current)wakeRecognition=null;wakeListening=false;setWakeStatus('ALE · wake mic gagal dimulai',false);resumeWakeSoon(1800);}
}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function activateAllEffects(){
 avatar.activateAllEffects?.(true);avatar.animate=true;avatar.track=true;avatar.color='spectrum';
 $('#animate').checked=true;$('#track').checked=true;$('#color').value='spectrum';
 document.querySelectorAll('[data-mode]').forEach(button=>button.setAttribute('aria-pressed','true'));
}
function showAle(){
 if(panelOnly)return;
 ++transitionSerial;summoning=false;dismissing=false;
 document.body.classList.remove('summoning','dismissing');
 avatar.reveal?.();
 state('');
 setPassthrough(true);
 resumeWakeSoon(500);
}
async function summonAle(source='voice'){
 if(panelOnly){suspendWakeListening('ALE · dipanggil');panelChannel?.postMessage({type:'summon',source});return;}
 if(summoning)return;
 const transition=++transitionSerial;
 summoning=true;dismissing=false;
 document.body.classList.remove('dismissing');
 suspendWakeListening('ALE · dipanggil');stopListening(false);stopSpeech(false);stopReactiveAudio();
 document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
 document.body.classList.add('summoning');desktop?.center();setPassthrough(true);activateAllEffects();avatar.awaken?.(SUMMON_DURATION_MS);
 state(source==='keyboard'?'ALE · menyusun diri dari pusat layar…':'ALE · panggilan diterima · menyusun diri…');
 await wait(SUMMON_DURATION_MS);
 if(transition!==transitionSerial||!summoning)return;
 document.body.classList.remove('summoning');summoning=false;state('ALE siap · mendengarkan…');setPassthrough(true);
 await wait(180);
 if(transition!==transitionSerial||dismissing)return;
 await toggleMic({fromWake:true});
}
async function dismissAle(reason='hide'){
 if(dismissing)return;
 const transition=++transitionSerial;
 dismissing=true;summoning=false;
 document.body.classList.remove('summoning');
 suspendWakeListening('ALE · transisi penutupan');stopListening(false);stopSpeech(false);stopCamera();stopReactiveAudio();
 document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
 document.body.classList.add('dismissing');setPassthrough(true);avatar.dismiss?.(DISMISS_DURATION_MS);
 state('ALE · melebur menjadi aliran biner…');
 await wait(DISMISS_DURATION_MS);
 if(transition!==transitionSerial||!dismissing)return;
 document.body.classList.remove('dismissing');dismissing=false;state('');
 desktop?.finishDismiss?.(reason);
}
function stopListening(resumeWake=true){micProbeGeneration++;localCaptureGeneration++;micChecking=false;listening=false;const current=recognition;recognition=null;if(current){try{current.abort();}catch{}}if(localRecorder?.state==='recording'){try{localRecorder.stop();}catch{}}localRecorder=null;localStream?.getTracks().forEach(track=>track.stop());localStream=null;clearTimeout(localTimer);localChunks=[];$('#mic').setAttribute('aria-pressed','false');$('#chatMic').textContent='Dikte suara';$('#liveText').textContent='';if(!busy&&!avatar.speaking)state();if(resumeWake)resumeWakeSoon();}
async function startLocalDictation(){
 localStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
 const mime=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
 if(!mime)throw new Error('Format rekaman lokal tidak tersedia.');
 const current=new MediaRecorder(localStream,{mimeType:mime}),generation=++localCaptureGeneration;
 localRecorder=current;localChunks=[];
 current.ondataavailable=event=>{if(generation===localCaptureGeneration&&event.data?.size)localChunks.push(event.data);};
 current.onstart=()=>{if(generation!==localCaptureGeneration)return;listening=true;$('#mic').setAttribute('aria-pressed','true');$('#chatMic').textContent='Hentikan & kirim';setMicStatus('Mendengarkan Bahasa Indonesia secara lokal. Bicara hingga 12 detik.');state('Mendengarkan…');};
 current.onstop=async()=>{
  clearTimeout(localTimer);localStream?.getTracks().forEach(track=>track.stop());localStream=null;
  if(generation!==localCaptureGeneration)return;
  localRecorder=null;listening=false;$('#mic').setAttribute('aria-pressed','false');$('#chatMic').textContent='Dikte suara';state('Mengenali ucapan Indonesia…');
  try{
   const blob=new Blob(localChunks,{type:mime});localChunks=[];
   if(!blob.size||blob.size>2600000)throw new Error('Rekaman kosong atau terlalu besar.');
   const audio=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Rekaman gagal dibaca.'));reader.readAsDataURL(blob);});
   if(generation!==localCaptureGeneration)return;
   const result=await desktop.transcribe({audio});
   if(generation!==localCaptureGeneration)return;
   if(result.error)throw new Error(result.error);
   setMicStatus('Ucapan Bahasa Indonesia dikenali secara lokal.');
   if(result.text)submit(result.text);
  }catch(error){const text=error.message||'Dikte lokal gagal.';setMicStatus(text);toast(text);resumeWakeSoon();}
  finally{if(generation===localCaptureGeneration&&!busy&&!avatar.speaking)state();}
 };
 current.start();localTimer=setTimeout(()=>{if(current.state==='recording')current.stop();},12000);
}
async function toggleMic(options={}){
 if(localRecorder?.state==='recording'){localRecorder.stop();return;}
 if(listening||micChecking||recognition){stopListening();return;}
 suspendWakeListening(options.fromWake?'ALE · perintah suara aktif':'ALE · wake mic dijeda untuk dikte');stopSpeech(false);state('Memeriksa mikrofon…');setMicStatus('Memeriksa perangkat dan izin mikrofon…');
 micChecking=true;const generation=++micProbeGeneration;
 const health=await checkMicrophoneHealth();
 if(generation!==micProbeGeneration)return;
 micChecking=false;
 if(document.hidden){stopListening(false);return;}
 if(!health.ok){
  const message={denied:'Izin mikrofon ditolak. Izinkan Dudidam di pengaturan privasi Windows.',missing:'Perangkat mikrofon tidak ditemukan.',unsupported:'Akses mikrofon tidak didukung oleh runtime ini.',unavailable:'Mikrofon ada tetapi sedang dipakai atau tidak dapat dibuka.'}[health.reason];
  setMicStatus(message);state();toast(message);resumeWakeSoon();return;
 }
 if(desktop&&typeof MediaRecorder!=='undefined'){
  const local=await desktop.sttStatus();
  if(generation!==micProbeGeneration)return;
  if(local.configured){
   try{await startLocalDictation();return;}
   catch(error){stopListening(false);setMicStatus(error.message||'Dikte lokal gagal dimulai.');}
  }
 }
 if(!SR){const message='Mikrofon tersedia, tetapi pengenal ucapan belum siap. Pasang runtime dikte lokal atau gunakan teks.';setMicStatus(message);state();toast(message);resumeWakeSoon();return;}
 setMicStatus('Mikrofon siap · pengenal ucapan Indonesia dimulai.');
 const current=new SR();recognition=current;current.lang='id-ID';current.interimResults=true;current.continuous=false;
 current.onstart=()=>{if(recognition!==current)return;listening=true;$('#mic').setAttribute('aria-pressed','true');$('#chatMic').textContent='Hentikan dikte';state('Mendengarkan…');};
 current.onresult=e=>{if(recognition!==current)return;let interim='';for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal){const text=e.results[i][0].transcript;setMicStatus('Ucapan dikenali.');stopListening();submit(text);return;}interim+=e.results[i][0].transcript;}$('#liveText').textContent=interim;};
 current.onerror=e=>{if(recognition!==current)return;const error=e.error;stopListening();if(error==='aborted')return;const message=error==='not-allowed'?'Izin pengenal ucapan ditolak.':error==='network'?'Mikrofon sehat, tetapi layanan pengenal ucapan tidak dapat dijangkau. Gunakan runtime dikte lokal atau teks.':error==='audio-capture'?'Pengenal ucapan tidak dapat mengambil audio dari mikrofon.':'Suara belum dapat dikenali. Coba lagi.';setMicStatus(message);toast(message);};
 current.onend=()=>{if(recognition===current)stopListening();};
 try{current.start();}catch{stopListening();const message='Pengenal ucapan gagal dimulai. Gunakan runtime dikte lokal atau teks.';setMicStatus(message);toast(message);resumeWakeSoon();}
}
function stopCamera(){cameraStream?.getTracks().forEach(t=>t.stop());cameraStream=null;$('#cameraVideo').srcObject=null;$('#cameraPreview').hidden=true;$('#camera').setAttribute('aria-pressed','false');}
async function toggleCamera(){if(cameraPending)return;if(cameraStream){stopCamera();return;}cameraPending=true;$('#camera').disabled=true;try{cameraStream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480}},audio:false});if(document.hidden){stopCamera();return;}$('#cameraVideo').srcObject=cameraStream;await $('#cameraVideo').play();$('#cameraPreview').hidden=false;$('#camera').setAttribute('aria-pressed','true');}catch{stopCamera();toast('Kamera tidak tersedia atau izin ditolak.');}finally{cameraPending=false;$('#camera').disabled=false;}}
$('#look').onclick=()=>{if(['copilot','grok','claude','deepseek','askcodi'].includes(aiProvider)){toast('Foto belum diaktifkan untuk provider ini. Pilih ChatGPT, OpenAI API, atau Gemini untuk menjelaskan foto.');return;}if(!aiReady){toast('Provider AI yang dipilih belum terhubung.');return;}const v=$('#cameraVideo');if(!v.videoWidth)return;const c=document.createElement('canvas');c.width=640;c.height=Math.round(640*v.videoHeight/v.videoWidth);c.getContext('2d').drawImage(v,0,0,c.width,c.height);submit('Jelaskan foto kamera ini dalam bahasa Indonesia.',c.toDataURL('image/jpeg',.75));};
function setMode(mode){avatar.activateAllEffects?.(false);avatar.mode=mode;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));if(panelOnly)panelChannel?.postMessage({type:'mode',mode});}
function center(){offset={x:0,y:0};$('#avatarArea').style.translate='0px 0px';desktop?.center();}
const area=$('#avatarArea');
area.onpointerdown=e=>{if(transitioning()||e.button!==0)return;area.setPointerCapture(e.pointerId);drag={x:e.screenX,y:e.screenY,ox:offset.x,oy:offset.y,moved:false,lastX:e.screenX,lastY:e.screenY};};
area.onpointermove=e=>{const r=area.getBoundingClientRect(),pointer={x:Math.max(-1,Math.min(1,(e.clientX-r.left)/r.width*2-1)),y:Math.max(-1,Math.min(1,(e.clientY-r.top)/r.height*2-1))};avatar.pointer=pointer;avatar.pointerActive=true;avatar.gazePointer=pointer;avatar.gazeActive=true;if(drag){if(Math.hypot(e.screenX-drag.x,e.screenY-drag.y)>4)drag.moved=true;if(drag.moved){if(desktop){desktop.move({dx:e.screenX-drag.lastX,dy:e.screenY-drag.lastY});}else{offset={x:Math.max(-innerWidth*.35,Math.min(innerWidth*.35,drag.ox+e.screenX-drag.x)),y:Math.max(-innerHeight*.35,Math.min(innerHeight*.35,drag.oy+e.screenY-drag.y))};area.style.translate=offset.x+'px '+offset.y+'px';}drag.lastX=e.screenX;drag.lastY=e.screenY;}}};
area.onpointerup=e=>{if(drag&&!drag.moved)avatar.trigger('blink');drag=null;if(area.hasPointerCapture(e.pointerId))area.releasePointerCapture(e.pointerId);};area.onpointercancel=()=>drag=null;area.onpointerleave=()=>{if(!drag){avatar.pointerActive=false;avatar.pointer={x:0,y:0};if(!desktop){avatar.gazeActive=false;avatar.gazePointer={x:0,y:0};}}};area.oncontextmenu=e=>{e.preventDefault();showDialog('#controls');};area.ondblclick=()=>showDialog('#controls');
$('#reveal').onclick=()=>showDialog('#controls');$('#chat').onclick=()=>showDialog('#chatDialog');document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>panelOnly?desktop.closePanel():b.closest('dialog').close());document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{avatar.trigger(b.dataset.action);if(panelOnly)panelChannel?.postMessage({type:'action',action:b.dataset.action});});document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('#avatarSize').oninput=e=>applyAvatarSize(e.target.value);
$('#panelZoom').oninput=e=>applyPanelZoom(e.target.value);
$('#panelOpacity').oninput=e=>applyPanelTransparency(e.target.value);
$('#track').onchange=e=>{avatar.track=e.target.checked;if(panelOnly)panelChannel?.postMessage({type:'setting',name:'track',value:avatar.track});};
$('#animate').checked=avatar.animate;
$('#animate').onchange=e=>{avatar.animate=e.target.checked;if(panelOnly)panelChannel?.postMessage({type:'setting',name:'animate',value:avatar.animate});};
$('#color').onchange=e=>{avatar.color=e.target.value;if(panelOnly)panelChannel?.postMessage({type:'setting',name:'color',value:avatar.color});};
$('#environment').onchange=e=>{avatar.setEnvironment(e.target.value);if(panelOnly)panelChannel?.postMessage({type:'setting',name:'environment',value:e.target.value});};
$('#speakSetting').onchange=e=>{voice=e.target.checked;if(!voice)stopSpeech();};
$('#voiceSelect').onchange=e=>{selectedVoiceURI=e.target.value||'';if(desktop){if(selectedVoiceURI)localStorage.setItem('dudidam-voice-uri',selectedVoiceURI);else localStorage.removeItem('dudidam-voice-uri');}};
$('#mic').onclick=$('#chatMic').onclick=()=>toggleMic();
function changeWakeEnabled(enabled){wakeEnabled=Boolean(enabled);if(desktop&&!panelOnly)localStorage.setItem('dudidam-wake-enabled',String(wakeEnabled));if(wakeEnabled){wakeRetryBlocked=false;wakeNetworkFailures=0;wakeHealthVerified=false;setWakeStatus('ALE · menyalakan wake mic…',false);startWakeListening();}else suspendWakeListening('ALE · wake mic nonaktif');}
$('#wakeToggle').onchange=e=>{if(panelOnly){panelChannel?.postMessage({type:'wake-toggle',enabled:e.target.checked});return;}changeWakeEnabled(e.target.checked);};
$('#camera').onclick=toggleCamera;
$('#center').onclick=center;
$('#refreshStatus').onclick=checkAI;
$('#provider').onchange=e=>{aiProvider=['chatgpt',...apiProviders].includes(e.target.value)?e.target.value:'chatgpt';localStorage.setItem('dudidam-provider',aiProvider);history=[];stopCamera();setPersona(aiProvider);checkAI();};
$('#agentHub').onclick=async()=>{if(!desktop)return;showDialog('#agentDialog');await loadAgents();};
$('#agentRefresh').onclick=loadAgents;
$('#projectPick').onclick=chooseProjectFolder;
$('#agentSelect').onchange=syncAgentMode;
$('#agentForm').onsubmit=runDeveloperAgent;
$('#audioMic').onclick=startMicrophoneVisual;$('#systemAudio').onclick=startSystemAudio;$('#stopAudio').onclick=stopReactiveAudio;$('#musicFile').onchange=e=>playMusic(e.target.files?.[0]);$('#musicPlayer').onended=stopReactiveAudio;
$('#popup').onclick=()=>{const pop=window.open(location.origin+'/?popup=1','dudidam-presence','popup=yes,width=420,height=480,left='+Math.round((screen.width-420)/2)+',top='+Math.round((screen.height-480)/2));if(!pop)toast('Browser memblokir pop-up. Izinkan pop-up untuk situs ini.');else toast('Widget pop-up dibuka dengan permukaan transparan. Transparansi hingga menembus desktop tersedia di Dudidam Desktop.');};
$('#login').onclick=async()=>{if(!desktop){location.href='/signin-with-chatgpt?return_to=%2F';return;}$('#login').disabled=true;try{const r=await (aiProvider==='copilot'?desktop.loginCopilot():desktop.login());if(r.error)toast(r.error);else toast('Login selesai.');await checkAI();}catch{toast('Login belum selesai. Coba lagi.');}finally{$('#login').disabled=false;}};
$('#clickThrough').onclick=()=>{document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());desktop?.passthroughLock(true);toast('Tembus klik penuh aktif. Matikan dari ikon Dudidam di tray Windows.');};$('#minimize').onclick=()=>panelOnly?desktop.closePanel():dismissAle('hide');$('#closeApp').onclick=()=>panelOnly?desktop.closePanel():dismissAle('hide');
$('#chatForm').onsubmit=e=>{e.preventDefault();const text=$('#prompt').value.trim();if(text&&!busy){$('#prompt').value='';submit(text);}};$('#prompt').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#chatForm').requestSubmit();}};$('#clear').onclick=()=>{if(busy)return;history=[];$('#messages').replaceChildren();$('#bubble').hidden=true;stopSpeech();};
$('#chatDialog').addEventListener('close',()=>{stopCamera();setPassthrough(true);syncPanelViewportFromDialogs();});
$('#controls').addEventListener('close',()=>{setPassthrough(true);syncPanelViewportFromDialogs();});
$('#agentDialog').addEventListener('close',()=>{setPassthrough(true);syncPanelViewportFromDialogs();});
document.addEventListener('mousemove',syncPassthrough,{passive:true});
document.addEventListener('mouseleave',()=>setPassthrough(true));
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){stopSpeech();stopListening();$('#bubble').hidden=true;return;}
 if(e.target.matches('input,textarea,select')||e.ctrlKey||e.metaKey||e.altKey)return;
 const key=e.key.toLowerCase();
 if(key==='5'){e.preventDefault();if(e.repeat||hold5Timer||transitioning())return;hold5Fired=false;hold5Timer=setTimeout(()=>{hold5Timer=null;hold5Fired=true;summonAle('keyboard');},HOLD_TO_SUMMON_MS);return;}
 if(e.repeat||document.querySelector('dialog[open]')||transitioning())return;
 const actions={b:'blink',n:'nod',g:'shake'};if(actions[key])avatar.trigger(actions[key]);else if(key==='h'){e.preventDefault();showDialog('#controls');}else if(key==='enter'){e.preventDefault();showDialog('#chatDialog');}else if(key==='m')toggleMic();else if(key==='r')center();else if(['1','2','3','4'].includes(key))setMode(['mixed','matrix','statistics','abstract'][Number(key)-1]);
});
document.addEventListener('keyup',e=>{if(e.key!=='5'||!hold5Timer&&!hold5Fired)return;clearTimeout(hold5Timer);hold5Timer=null;if(!hold5Fired&&!transitioning())setMode('neural');hold5Fired=false;});
function cancelHold5(){clearTimeout(hold5Timer);hold5Timer=null;hold5Fired=false;}
window.addEventListener('blur',cancelHold5);
if(panelChannel)panelChannel.onmessage=event=>{
 const data=event.data||{};
 if(data.type==='message'){message(String(data.text||''),data.role==='user'?'user':'assistant',false,false);return;}
 if(data.type==='history'){history=Array.isArray(data.history)?data.history.slice(-10):[];return;}
 if(data.type==='persona'&&!panelOnly){aiProvider=data.provider;setPersona(aiProvider);$('#provider').value=aiProvider;return;}
 if(data.type==='speech-level'&&!panelOnly){remoteSpeechEnergy=Number(data.level)||0;syncFaceAudio();return;}
 if(data.type==='wake-status'&&panelOnly){wakeEnabled=Boolean(data.enabled);setWakeStatus(String(data.text||''),Boolean(data.active));return;}
 if(data.type==='panel-ready'&&!panelOnly){setWakeStatus($('#wakeIndicator').textContent,$('#wakeIndicator').dataset.active==='true');setPersona(aiProvider);return;}
 if(panelOnly)return;
 if(data.type==='avatar-size'){applyAvatarSize(data.size);return;}
 if(data.type==='mode'){setMode(data.mode);return;}
 if(data.type==='action'){avatar.trigger(data.action);return;}
 if(data.type==='summon'){summonAle(data.source);return;}
 if(data.type==='wake-toggle'){changeWakeEnabled(data.enabled);return;}
 if(data.type==='setting'){
  if(data.name==='track')avatar.track=Boolean(data.value);
  if(data.name==='animate')avatar.animate=Boolean(data.value);
  if(data.name==='color'&&typeof data.value==='string')avatar.color=data.value;
  if(data.name==='environment'&&typeof data.value==='string')avatar.setEnvironment(data.value);
 }
};
if(!panelOnly){
 desktop?.onShow?.(showAle);
 desktop?.onSummon?.(()=>summonAle('global-hotkey'));
 desktop?.onDismiss?.(reason=>dismissAle(reason));
 desktop?.onGlobalPointer?.(point=>{if(!point||drag)return;avatar.gazePointer={x:Math.max(-1,Math.min(1,Number(point.x)||0)),y:Math.max(-1,Math.min(1,Number(point.y)||0))};avatar.gazeActive=true;});
}
if(panelOnly){
 desktop.onPanelView?.(async view=>{showDialog('#'+view);if(view==='agentDialog')await loadAgents();});
 panelChannel?.postMessage({type:'panel-ready'});
 const initial=params.get('panel');
 if(['controls','chatDialog','agentDialog'].includes(initial))requestAnimationFrame(()=>showDialog('#'+initial));
}
document.querySelectorAll('dialog').forEach(enableDialogDrag);window.addEventListener('resize',()=>document.querySelectorAll('dialog[open]').forEach(clampDialog));
document.addEventListener('visibilitychange',()=>{if(document.hidden){setPassthrough(true);suspendWakeListening('ALE · wake mic dijeda');stopListening(false);stopSpeech(false);stopCamera();stopReactiveAudio();}else resumeWakeSoon(500);});
window.addEventListener('pagehide',()=>{setPassthrough(true);wakeEnabled=false;suspendWakeListening('ALE · wake mic berhenti');stopListening(false);stopSpeech(false);stopCamera();stopReactiveAudio();});
document.addEventListener('avatar-error',()=>toast('Gambar avatar gagal dimuat. Muat ulang aplikasi.'));if(window.speechSynthesis){refreshIndonesianVoices();speechSynthesis.addEventListener?.('voiceschanged',refreshIndonesianVoices);}if(desktop)setPassthrough(true);setPersona(aiProvider);checkAI();if(desktop){setWakeStatus(!SR?'ALE · SpeechRecognition tidak tersedia':wakeEnabled?'ALE · menyalakan wake mic…':'ALE · wake mic nonaktif',false);if(wakeEnabled)startWakeListening();}
