import {BinaryAvatar} from './avatar.js';
import {parseCommand} from './commands.js';
import {AudioReactor} from './audio-reactor.js';
import {containsAleWakeWord,HOLD_TO_SUMMON_MS} from './wake-utils.js';
const $=s=>document.querySelector(s),desktop=window.dudidamDesktop,popup=new URLSearchParams(location.search).get('popup')==='1',avatar=new BinaryAvatar($('#avatar'));
const apiProviders=['openai','grok','gemini','claude','deepseek','askcodi'];
const SUMMON_DURATION_MS=4200;
let aiReady=false,savedProvider=desktop?localStorage.getItem('dudidam-provider'):'',aiProvider=apiProviders.includes(savedProvider)?savedProvider:'chatgpt',busy=false,voice=true,listening=false,recognition,cameraStream,cameraPending=false,history=[],toastTimer,bubbleTimer,speechTimer,drag,offset={x:0,y:0},ttsActive=false,ttsEnergy=0,audioEnergy=0,audioMode='',musicUrl='',wakeRecognition,wakeListening=false,wakeEnabled=true,wakeRestartTimer,wakeHealthVerified=false,wakeRetryBlocked=false,wakeNetworkFailures=0,summoning=false,hold5Timer,hold5Fired=false;
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const audioReactor=new AudioReactor(level=>{audioEnergy=level;syncFaceAudio();});
if(desktop){document.body.classList.add('desktop');$('.desktop-actions').hidden=false;$('#providerRow').hidden=false;$('#provider').value=aiProvider;$('#popup').hidden=true;}else $('#systemAudio').hidden=true;
if(popup){document.body.classList.add('popup-widget');$('#popup').hidden=true;}
function applyAvatarSize(value){
 const size=Math.max(220,Math.min(390,Number(value)||380));
 document.documentElement.style.setProperty('--avatar-size',size+'px');
 const slider=$('#avatarSize'),output=$('#avatarSizeValue');
 if(slider)slider.value=String(size);
 if(output)output.textContent=size+' px';
 if(desktop)localStorage.setItem('dudidam-avatar-size',String(size));
 avatar.resize();
}
applyAvatarSize(desktop?localStorage.getItem('dudidam-avatar-size')||380:380);
function applyPanelZoom(value){
 const zoom=Math.max(75,Math.min(145,Number(value)||100));
 document.documentElement.style.setProperty('--panel-zoom',String(zoom/100));
 const slider=$('#panelZoom'),output=$('#panelZoomValue');
 if(slider)slider.value=String(zoom);
 if(output)output.textContent=zoom+'%';
 if(desktop)localStorage.setItem('dudidam-panel-zoom',String(zoom));
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
function setWakeStatus(text,active=false){const el=$('#wakeIndicator');if(el){el.textContent=text;el.dataset.active=active?'true':'false';}const toggle=$('#wakeToggle');if(toggle)toggle.checked=wakeEnabled;}
let passthroughRequested, passthroughSentAt=0;
function setPassthrough(ignore){if(!desktop)return;const now=performance.now();if(passthroughRequested===ignore&&now-passthroughSentAt<500)return;passthroughRequested=ignore;passthroughSentAt=now;desktop.passthrough(ignore);}
function pointInElement(element,x,y){if(!element||element.hidden)return false;const rect=element.getBoundingClientRect();return x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom;}
function pointInAvatarFace(x,y){const canvas=$('#avatar');if(!canvas)return false;const rect=canvas.getBoundingClientRect(),rx=rect.width*.36,ry=rect.height*.43;if(!rx||!ry)return false;const dx=(x-(rect.left+rect.width/2))/rx,dy=(y-(rect.top+rect.height/2))/ry;return dx*dx+dy*dy<=1;}
function syncPassthrough(event){if(!desktop)return;if(summoning){setPassthrough(true);return;}if(document.querySelector('dialog[open]')){setPassthrough(false);return;}const x=event?.clientX,y=event?.clientY;if(!Number.isFinite(x)||!Number.isFinite(y)){setPassthrough(true);return;}const interactive=pointInAvatarFace(x,y)||['#reveal','#bubble','#toast'].some(selector=>pointInElement($(selector),x,y));setPassthrough(!interactive);}
function showDialog(id){if(summoning)return;setPassthrough(false);document.querySelectorAll('dialog[open]').forEach(d=>d.close());$(id).showModal();if(id==='#chatDialog')$('#prompt').focus();}
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
function syncFaceAudio(){const level=Math.max(ttsActive?ttsEnergy:0,audioEnergy);avatar.speaking=level>.025;avatar.setSpeechEnergy(level);}
function stopSpeech(resumeWake=true){clearTimeout(speechTimer);window.speechSynthesis?.cancel();ttsActive=false;ttsEnergy=0;syncFaceAudio();if(!busy&&!listening&&!audioMode)state();if(resumeWake)resumeWakeSoon();}
function speak(text){stopSpeech(false);if(!voice||!window.speechSynthesis){resumeWakeSoon();return;}stopListening(false);suspendWakeListening('ALE · wake mic dijeda saat berbicara');const u=new SpeechSynthesisUtterance(text);u.lang='id-ID';u.rate=1;const v=speechSynthesis.getVoices().find(v=>v.lang.startsWith('id'));if(v)u.voice=v;u.onstart=()=>{ttsActive=true;ttsEnergy=.7;syncFaceAudio();avatar.trigger('nod');state('Berbicara');};u.onboundary=e=>{const ch=text.charCodeAt(Math.min(text.length-1,e.charIndex||0))||80;ttsEnergy=.35+(ch%61)/100;syncFaceAudio();};u.onend=u.onerror=()=>{ttsActive=false;ttsEnergy=0;syncFaceAudio();if(!busy&&!audioMode)state();resumeWakeSoon(700);};speechSynthesis.speak(u);speechTimer=setTimeout(stopSpeech,90000);}
function updateAudioUi(mode='',label='Tidak aktif'){audioMode=mode;$('#audioStatus').textContent=label;$('#audioMic').setAttribute('aria-pressed',String(mode==='microphone'));$('#systemAudio').setAttribute('aria-pressed',String(mode==='system'));$('#stopAudio').disabled=!mode;if(!busy&&!ttsActive)state(mode?'Audio aktif':'');}
function stopReactiveAudio(){audioReactor.stop();audioEnergy=0;syncFaceAudio();const player=$('#musicPlayer');player.pause();if(musicUrl){URL.revokeObjectURL(musicUrl);musicUrl='';player.removeAttribute('src');player.load();}player.hidden=true;$('#musicFile').value='';updateAudioUi();}
async function startMicrophoneVisual(){if(audioMode==='microphone'){stopReactiveAudio();return;}stopReactiveAudio();try{const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});await audioReactor.useStream(stream);updateAudioUi('microphone','Mikrofon bereaksi');}catch(error){stopReactiveAudio();toast(error?.name==='NotAllowedError'?'Izin mikrofon belum diberikan.':'Mikrofon tidak dapat dianalisis.');}}
async function startSystemAudio(){if(audioMode==='system'){stopReactiveAudio();return;}stopReactiveAudio();if(!desktop||!navigator.mediaDevices?.getDisplayMedia){toast('Audio perangkat tersedia pada Dudidam Desktop Windows.');return;}try{const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});stream.getVideoTracks().forEach(track=>track.stop());if(!stream.getAudioTracks().length)throw new Error('no-audio');await audioReactor.useStream(stream);for(const track of stream.getAudioTracks())track.addEventListener('ended',()=>updateAudioUi(),{once:true});updateAudioUi('system','Audio perangkat bereaksi');}catch{stopReactiveAudio();toast('Audio perangkat tidak tersedia. Putar musik dari file atau gunakan mikrofon visual.');}}
async function playMusic(file){if(!file)return;stopReactiveAudio();const player=$('#musicPlayer');try{musicUrl=URL.createObjectURL(file);player.src=musicUrl;player.hidden=false;await audioReactor.useElement(player);await player.play();updateAudioUi('music','Musik bereaksi');}catch{stopReactiveAudio();toast('File audio tidak dapat diputar. Pilih MP3, WAV, atau format yang didukung.');}}
function message(text,role='assistant',say=true){const a=document.createElement('article');a.className='message '+role;const b=document.createElement('b');b.textContent=role==='assistant'?'DUDIDAM':'KAMU';const p=document.createElement('p');p.textContent=text;a.append(b,p);$('#messages').append(a);$('#messages').scrollTop=$('#messages').scrollHeight;if(role==='assistant'){$('#bubble').textContent=text;$('#bubble').hidden=$('#chatDialog').open;clearTimeout(bubbleTimer);bubbleTimer=setTimeout(()=>$('#bubble').hidden=true,15000);if(say)speak(text);}}
async function submit(text,image){text=text.trim();if(!text||busy)return;message(text,'user',false);const cmd=!image&&parseCommand(text);if(cmd){let answer='';if(['blink','nod','shake'].includes(cmd)){avatar.trigger(cmd);answer={blink:'Saya berkedip.',nod:'Baik, saya mengangguk.',shake:'Saya menggelengkan kepala.'}[cmd];}if(cmd==='stop'){stopSpeech();stopListening();answer='Baik. Suara dihentikan.';}if(cmd==='hello'){avatar.trigger('nod');answer='Halo, saya Dudidam. Saya mendengarkan.';}if(cmd==='help')answer='Klik kanan atau tekan H untuk kontrol, Enter untuk percakapan. B berkedip, N mengangguk, G menggeleng, M mikrofon, R tengahkan. Tombol 1 sampai 5 mengganti gaya biner dan neural. Ukuran avatar dapat diatur dari kontrol. Seret wajah untuk memindahkan.';if(cmd==='time')answer='Sekarang pukul '+new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})+'.';if(cmd==='date')answer='Hari ini '+new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+'.';if(cmd==='pet'){document.querySelectorAll('dialog[open]').forEach(d=>d.close());answer='Panel disembunyikan.';}message(answer,'assistant',cmd!=='stop');return;}
 if(!desktop){message('Login Sites hanya mengenali akun. Untuk percakapan model gunakan Dudidam Desktop.','assistant',false);return;}
 if(!aiReady){const missing={openai:'OpenAI API belum aktif. Atur OPENAI_API_KEY pada environment Windows, buka ulang Dudidam, lalu tekan Periksa lagi.',grok:'Grok belum aktif. Atur XAI_API_KEY pada environment Windows, buka ulang Dudidam, lalu tekan Periksa lagi.',gemini:'Gemini belum aktif. Atur GEMINI_API_KEY atau GOOGLE_API_KEY pada environment Windows, buka ulang Dudidam, lalu tekan Periksa lagi.',claude:'Claude belum aktif. Atur ANTHROPIC_API_KEY pada environment Windows, buka ulang Dudidam, lalu tekan Periksa lagi.',deepseek:'DeepSeek belum aktif. Atur DEEPSEEK_API_KEY pada environment Windows, buka ulang Dudidam, lalu tekan Periksa lagi.',askcodi:'AskCodi belum aktif. Atur ASKCODI_API_KEY dan ASKCODI_MODEL, buka ulang Dudidam, lalu tekan Periksa lagi.'}[aiProvider]||'Silakan pilih Login ChatGPT pada kontrol avatar, selesaikan login di browser, lalu Periksa lagi.';message(missing,'assistant',false);return;}
 busy=true;stopSpeech();$('#send').disabled=true;$('#look').disabled=true;state('Berpikir…');const providerName={openai:'OpenAI API',grok:'Grok',gemini:'Gemini',claude:'Claude',deepseek:'DeepSeek',askcodi:'AskCodi'}[aiProvider]||'ChatGPT';$('#liveText').textContent=providerName+' sedang merespons…';
 try{const result=await desktop.ask({provider:aiProvider,message:text,history:history.slice(-10),image});if(result.error)throw new Error(result.error);history.push({role:'user',content:text},{role:'assistant',content:result.text});history=history.slice(-10);message(result.text);}
 catch(e){message(e.message||('Koneksi '+providerName+' gagal. Coba lagi.'),'assistant',false);}finally{busy=false;avatar.thinking=false;$('#send').disabled=false;$('#look').disabled=false;$('#liveText').textContent='';if(!avatar.speaking&&!listening)state();}
}
async function checkAI(){
 try{
  const data=desktop?await desktop.status(aiProvider):await (await fetch('/api/status',{cache:'no-store'})).json();
  aiReady=!!data.configured&&!!desktop;
  const external=desktop&&aiProvider!=='chatgpt';
  const noImage=['grok','claude','deepseek','askcodi'].includes(aiProvider);
  $('#login').hidden=external;$('#chatgptLink').hidden=external;$('#camera').disabled=noImage;
  if(noImage&&cameraStream)stopCamera();
  const details={
   openai:{label:'OpenAI API',missing:'OPENAI_API_KEY diperlukan',ready:'Percakapan dan foto dikirim dari proses desktop langsung ke OpenAI Responses API. API key tidak dikirim ke renderer.',setup:'Atur OPENAI_API_KEY pada environment Windows lalu buka ulang Dudidam. Model default: gpt-5.4-mini.',note:'OpenAI Responses API · riwayat percakapan di memori aplikasi · foto kamera didukung.'},
   grok:{label:'Grok',missing:'XAI_API_KEY diperlukan',ready:'Percakapan dikirim dari proses desktop langsung ke xAI API. XAI_API_KEY tidak dikirim ke renderer.',setup:'Atur XAI_API_KEY pada environment Windows lalu buka ulang Dudidam. Model default: grok-4.6.',note:'Grok via xAI API · riwayat percakapan di memori aplikasi · foto belum diaktifkan.'},
   gemini:{label:'Gemini',missing:'GEMINI_API_KEY diperlukan',ready:'Percakapan dan foto dikirim dari proses desktop langsung ke Gemini API. API key tidak dikirim ke renderer.',setup:'Atur GEMINI_API_KEY atau GOOGLE_API_KEY pada environment Windows lalu buka ulang Dudidam. Model default: gemini-3.6-flash.',note:'Gemini via Google AI · riwayat percakapan di memori aplikasi · foto kamera didukung.'},
   claude:{label:'Claude',missing:'ANTHROPIC_API_KEY diperlukan',ready:'Percakapan dikirim dari proses desktop langsung ke Anthropic Messages API. API key tidak dikirim ke renderer.',setup:'Atur ANTHROPIC_API_KEY pada environment Windows lalu buka ulang Dudidam. Model default: claude-sonnet-4-6.',note:'Claude via Anthropic API · riwayat percakapan di memori aplikasi · foto belum diaktifkan.'},
   deepseek:{label:'DeepSeek',missing:'DEEPSEEK_API_KEY diperlukan',ready:'Percakapan dikirim dari proses desktop langsung ke DeepSeek Responses API. API key tidak dikirim ke renderer.',setup:'Atur DEEPSEEK_API_KEY pada environment Windows lalu buka ulang Dudidam. Model default: deepseek-flash.',note:'DeepSeek API · riwayat percakapan di memori aplikasi · foto belum diaktifkan.'},
   askcodi:{label:'AskCodi',missing:'key/model diperlukan',ready:'Percakapan dikirim dari proses desktop ke AskCodi API Gateway. Kredensial tidak dikirim ke renderer.',setup:'Atur ASKCODI_API_KEY dan ASKCODI_MODEL pada environment Windows lalu buka ulang Dudidam.',note:'AskCodi API Gateway · riwayat percakapan di memori aplikasi · foto belum diaktifkan.'}
  };
  const meta=details[aiProvider];
  if(meta){
   $('#aiStatus').textContent=aiReady?meta.label+' · '+(data.model||'aktif'):meta.label+' · '+meta.missing;
   $('#apiDetail').textContent=aiReady?meta.ready:meta.setup;
   $('#chatNote').textContent=meta.note;
  }else{
   $('#aiStatus').textContent=aiReady?'ChatGPT · login aktif · tanpa API key':desktop?'Login ChatGPT diperlukan':data.signedIn?'Login Sites aktif':'Login Sites';
   $('#apiDetail').textContent=desktop?(aiReady?'Percakapan memakai login ChatGPT melalui Codex CLI lokal dan mengikuti batas penggunaan akun. Riwayat chatgpt.com tidak diimpor.':'Klik Login ChatGPT untuk membuka alur resmi. Setelah selesai, tekan Periksa lagi. Tidak perlu API key.'):'Versi Sites menampilkan avatar dan mengenali login. Percakapan model tersedia pada aplikasi Dudidam Desktop lokal.';
   $('#chatNote').textContent=desktop?'ChatGPT via Codex CLI · riwayat percakapan di memori aplikasi.':'Versi web: perintah dasar. Percakapan model langsung tersedia di desktop.';
  }
 }catch{$('#aiStatus').textContent='Status belum tersedia';$('#apiDetail').textContent='Periksa koneksi lalu coba lagi.';aiReady=false;}
}
async function loadAgents(){if(!desktop)return;const list=$('#agentList'),select=$('#agentSelect');list.replaceChildren();select.replaceChildren();$('#agentOutput').hidden=true;$('#agentRun').disabled=true;const data=await desktop.agents();if(data?.error){$('#agentProject').textContent=data.error;return;}$('#agentProject').textContent='Project root: '+data.projectRoot;for(const item of data.agents||[]){const card=document.createElement('article');card.className='agent-card';card.setAttribute('role','listitem');const head=document.createElement('div');head.className='agent-card-head';const title=document.createElement('strong');title.textContent=item.name;const state=document.createElement('span');state.className='agent-state';state.textContent=item.state;head.append(title,state);const method=document.createElement('small');method.textContent=item.method;const detail=document.createElement('p');detail.textContent=item.detail;const actions=document.createElement('div');actions.className='actions';const open=document.createElement('button');open.type='button';open.textContent='Dokumentasi ↗';open.onclick=async()=>{const result=await desktop.openAgent(item.id);if(result?.error)toast(result.error);};actions.append(open);card.append(head,method,detail,actions);list.append(card);if(item.canRun){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;select.append(option);}}$('#agentRun').disabled=!select.options.length;if(!select.options.length){const option=document.createElement('option');option.textContent='Tidak ada CLI agent terdeteksi';option.disabled=true;select.append(option);}syncAgentMode();}
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
 if(!wakeEnabled||wakeRetryBlocked||!desktop||!SR||wakeRecognition||wakeListening||summoning||listening||ttsActive||document.hidden)return;
 if(!wakeHealthVerified){const health=await checkMicrophoneHealth();if(!health.ok){setWakeStatus(wakeReasonText(health.reason),false);return;}wakeHealthVerified=true;}
 const current=new SR();wakeRecognition=current;current.lang='id-ID';current.interimResults=true;current.continuous=true;
 current.onstart=()=>{if(wakeRecognition!==current)return;wakeListening=true;setWakeStatus('ALE · wake mic aktif',true);};
 current.onresult=event=>{wakeNetworkFailures=0;let heard='';for(let i=event.resultIndex;i<event.results.length;i++)heard+=' '+event.results[i][0].transcript;if(containsAleWakeWord(heard))summonAle('voice');};
 current.onerror=event=>{
  if(wakeRecognition===current)wakeRecognition=null;
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
    setMicStatus('Mikrofon terdeteksi, tetapi layanan SpeechRecognition Electron gagal terhubung. Wake ALE dijeda; tahan tombol 5 untuk memanggil ALE.');
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
 current.onend=()=>{if(wakeRecognition===current)wakeRecognition=null;wakeListening=false;if(wakeEnabled&&!wakeRetryBlocked&&!summoning&&!listening&&!ttsActive)resumeWakeSoon(1200);};
 try{current.start();}catch{if(wakeRecognition===current)wakeRecognition=null;wakeListening=false;setWakeStatus('ALE · wake mic gagal dimulai',false);resumeWakeSoon(1800);}
}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function activateAllEffects(){
 avatar.activateAllEffects?.(true);avatar.animate=true;avatar.track=true;avatar.color='spectrum';
 $('#animate').checked=true;$('#track').checked=true;$('#color').value='spectrum';
 document.querySelectorAll('[data-mode]').forEach(button=>button.setAttribute('aria-pressed','true'));
}
async function summonAle(source='voice'){
 if(summoning)return;
 summoning=true;suspendWakeListening('ALE · dipanggil');stopListening(false);stopSpeech(false);stopReactiveAudio();
 document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
 document.body.classList.add('summoning');desktop?.center();setPassthrough(true);activateAllEffects();avatar.awaken?.(SUMMON_DURATION_MS);
 state(source==='keyboard'?'ALE · menyusun diri dari pusat layar…':'ALE · panggilan diterima · menyusun diri…');
 await wait(SUMMON_DURATION_MS);
 document.body.classList.remove('summoning');summoning=false;state('ALE siap · mendengarkan…');setPassthrough(true);
 await wait(180);await toggleMic({fromWake:true});
}
function stopListening(resumeWake=true){listening=false;const current=recognition;recognition=null;if(current){try{current.abort();}catch{}}$('#mic').setAttribute('aria-pressed','false');$('#chatMic').textContent='Dikte suara';$('#liveText').textContent='';if(!busy&&!avatar.speaking)state();if(resumeWake)resumeWakeSoon();}
async function toggleMic(options={}){
 if(listening){stopListening();return;}
 suspendWakeListening(options.fromWake?'ALE · perintah suara aktif':'ALE · wake mic dijeda untuk dikte');stopSpeech(false);state('Memeriksa mikrofon…');setMicStatus('Memeriksa perangkat dan izin mikrofon…');
 const health=await checkMicrophoneHealth();
 if(!health.ok){
  const message={denied:'Izin mikrofon ditolak. Izinkan Dudidam di pengaturan privasi Windows.',missing:'Perangkat mikrofon tidak ditemukan.',unsupported:'Akses mikrofon tidak didukung oleh runtime ini.',unavailable:'Mikrofon ada tetapi sedang dipakai atau tidak dapat dibuka.'}[health.reason];
  setMicStatus(message);state();toast(message);resumeWakeSoon();return;
 }
 if(!SR){const message='Mikrofon terdeteksi, tetapi pengenal ucapan tidak tersedia di Electron. Gunakan teks atau dikte Windows (Win+H).';setMicStatus(message);state();toast(message);resumeWakeSoon();return;}
 setMicStatus('Mikrofon siap · pengenal ucapan Indonesia dimulai.');
 recognition=new SR();recognition.lang='id-ID';recognition.interimResults=true;recognition.continuous=false;recognition.onstart=()=>{listening=true;$('#mic').setAttribute('aria-pressed','true');$('#chatMic').textContent='Hentikan dikte';state('Mendengarkan…');};recognition.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal){const text=e.results[i][0].transcript;setMicStatus('Ucapan dikenali.');stopListening();submit(text);return;}interim+=e.results[i][0].transcript;}$('#liveText').textContent=interim;};recognition.onerror=e=>{const error=e.error;stopListening();if(error==='aborted')return;const message=error==='not-allowed'?'Izin pengenal ucapan ditolak.':error==='network'?'Mikrofon sehat, tetapi layanan pengenal ucapan tidak dapat dijangkau. Gunakan teks atau Win+H.':error==='audio-capture'?'Pengenal ucapan tidak dapat mengambil audio dari mikrofon.':'Suara belum dapat dikenali. Coba lagi.';setMicStatus(message);toast(message);};recognition.onend=()=>{if(listening)stopListening();};try{recognition.start();}catch{stopListening();const message='Pengenal ucapan gagal dimulai. Gunakan teks atau dikte Windows (Win+H).';setMicStatus(message);toast(message);resumeWakeSoon();}
}
function stopCamera(){cameraStream?.getTracks().forEach(t=>t.stop());cameraStream=null;$('#cameraVideo').srcObject=null;$('#cameraPreview').hidden=true;$('#camera').setAttribute('aria-pressed','false');}
async function toggleCamera(){if(cameraPending)return;if(cameraStream){stopCamera();return;}cameraPending=true;$('#camera').disabled=true;try{cameraStream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480}},audio:false});if(document.hidden){stopCamera();return;}$('#cameraVideo').srcObject=cameraStream;await $('#cameraVideo').play();$('#cameraPreview').hidden=false;$('#camera').setAttribute('aria-pressed','true');}catch{stopCamera();toast('Kamera tidak tersedia atau izin ditolak.');}finally{cameraPending=false;$('#camera').disabled=false;}}
$('#look').onclick=()=>{if(['grok','claude','deepseek','askcodi'].includes(aiProvider)){toast('Foto belum diaktifkan untuk provider ini. Pilih ChatGPT, OpenAI API, atau Gemini untuk menjelaskan foto.');return;}if(!aiReady){toast('Provider AI yang dipilih belum terhubung.');return;}const v=$('#cameraVideo');if(!v.videoWidth)return;const c=document.createElement('canvas');c.width=640;c.height=Math.round(640*v.videoHeight/v.videoWidth);c.getContext('2d').drawImage(v,0,0,c.width,c.height);submit('Jelaskan foto kamera ini dalam bahasa Indonesia.',c.toDataURL('image/jpeg',.75));};
function setMode(mode){avatar.activateAllEffects?.(false);avatar.mode=mode;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));}
function center(){offset={x:0,y:0};$('#avatarArea').style.translate='0px 0px';desktop?.center();}
const area=$('#avatarArea');
area.onpointerdown=e=>{if(summoning||e.button!==0)return;area.setPointerCapture(e.pointerId);drag={x:e.screenX,y:e.screenY,ox:offset.x,oy:offset.y,moved:false,lastX:e.screenX,lastY:e.screenY};};
area.onpointermove=e=>{const r=area.getBoundingClientRect();avatar.pointer={x:Math.max(-1,Math.min(1,(e.clientX-r.left)/r.width*2-1)),y:Math.max(-1,Math.min(1,(e.clientY-r.top)/r.height*2-1))};avatar.pointerActive=true;if(drag){if(Math.hypot(e.screenX-drag.x,e.screenY-drag.y)>4)drag.moved=true;if(drag.moved){if(desktop){desktop.move({dx:e.screenX-drag.lastX,dy:e.screenY-drag.lastY});}else{offset={x:Math.max(-innerWidth*.35,Math.min(innerWidth*.35,drag.ox+e.screenX-drag.x)),y:Math.max(-innerHeight*.35,Math.min(innerHeight*.35,drag.oy+e.screenY-drag.y))};area.style.translate=offset.x+'px '+offset.y+'px';}drag.lastX=e.screenX;drag.lastY=e.screenY;}}};
area.onpointerup=e=>{if(drag&&!drag.moved)avatar.trigger('blink');drag=null;if(area.hasPointerCapture(e.pointerId))area.releasePointerCapture(e.pointerId);};area.onpointercancel=()=>drag=null;area.onpointerleave=()=>{if(!drag){avatar.pointerActive=false;avatar.pointer={x:0,y:0};}};area.oncontextmenu=e=>{e.preventDefault();showDialog('#controls');};area.ondblclick=()=>showDialog('#controls');
$('#reveal').onclick=()=>showDialog('#controls');$('#chat').onclick=()=>showDialog('#chatDialog');document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>avatar.trigger(b.dataset.action));document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('#avatarSize').oninput=e=>applyAvatarSize(e.target.value);$('#panelZoom').oninput=e=>applyPanelZoom(e.target.value);$('#panelOpacity').oninput=e=>applyPanelTransparency(e.target.value);$('#track').onchange=e=>avatar.track=e.target.checked;$('#animate').checked=avatar.animate;$('#animate').onchange=e=>avatar.animate=e.target.checked;$('#color').onchange=e=>avatar.color=e.target.value;$('#environment').onchange=e=>avatar.setEnvironment(e.target.value);$('#speakSetting').onchange=e=>{voice=e.target.checked;if(!voice)stopSpeech();};
$('#mic').onclick=$('#chatMic').onclick=()=>toggleMic();$('#wakeToggle').onchange=e=>{wakeEnabled=e.target.checked;if(wakeEnabled){wakeRetryBlocked=false;wakeNetworkFailures=0;wakeHealthVerified=false;setWakeStatus('ALE · menyalakan wake mic…',false);startWakeListening();}else suspendWakeListening('ALE · wake mic nonaktif');};$('#camera').onclick=toggleCamera;$('#center').onclick=center;$('#refreshStatus').onclick=checkAI;$('#provider').onchange=e=>{aiProvider=apiProviders.includes(e.target.value)?e.target.value:'chatgpt';localStorage.setItem('dudidam-provider',aiProvider);history=[];stopCamera();checkAI();};$('#agentHub').onclick=async()=>{if(!desktop)return;showDialog('#agentDialog');await loadAgents();};$('#agentRefresh').onclick=loadAgents;$('#agentSelect').onchange=syncAgentMode;$('#agentForm').onsubmit=runDeveloperAgent;
$('#audioMic').onclick=startMicrophoneVisual;$('#systemAudio').onclick=startSystemAudio;$('#stopAudio').onclick=stopReactiveAudio;$('#musicFile').onchange=e=>playMusic(e.target.files?.[0]);$('#musicPlayer').onended=stopReactiveAudio;
$('#popup').onclick=()=>{const pop=window.open(location.origin+'/?popup=1','dudidam-presence','popup=yes,width=420,height=480,left='+Math.round((screen.width-420)/2)+',top='+Math.round((screen.height-480)/2));if(!pop)toast('Browser memblokir pop-up. Izinkan pop-up untuk situs ini.');else toast('Widget pop-up dibuka dengan permukaan transparan. Transparansi hingga menembus desktop tersedia di Dudidam Desktop.');};
$('#login').onclick=async()=>{if(!desktop){location.href='/signin-with-chatgpt?return_to=%2F';return;}$('#login').disabled=true;try{const r=await desktop.login();if(r.error)toast(r.error);else toast('Login selesai.');await checkAI();}catch{toast('Login belum selesai. Coba lagi.');}finally{$('#login').disabled=false;}};
$('#clickThrough').onclick=()=>{document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());desktop?.passthroughLock(true);toast('Tembus klik penuh aktif. Matikan dari ikon Dudidam di tray Windows.');};$('#minimize').onclick=()=>desktop?.minimize();$('#closeApp').onclick=()=>desktop?.close();
$('#chatForm').onsubmit=e=>{e.preventDefault();const text=$('#prompt').value.trim();if(text&&!busy){$('#prompt').value='';submit(text);}};$('#prompt').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#chatForm').requestSubmit();}};$('#clear').onclick=()=>{if(busy)return;history=[];$('#messages').replaceChildren();$('#bubble').hidden=true;stopSpeech();};
$('#chatDialog').addEventListener('close',()=>{stopCamera();setPassthrough(true);});
$('#controls').addEventListener('close',()=>setPassthrough(true));
$('#agentDialog').addEventListener('close',()=>setPassthrough(true));
document.addEventListener('mousemove',syncPassthrough,{passive:true});
document.addEventListener('mouseleave',()=>setPassthrough(true));
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){stopSpeech();stopListening();$('#bubble').hidden=true;return;}
 if(e.target.matches('input,textarea,select')||e.ctrlKey||e.metaKey||e.altKey)return;
 const key=e.key.toLowerCase();
 if(key==='5'){e.preventDefault();if(e.repeat||hold5Timer||summoning)return;hold5Fired=false;hold5Timer=setTimeout(()=>{hold5Timer=null;hold5Fired=true;summonAle('keyboard');},HOLD_TO_SUMMON_MS);return;}
 if(e.repeat||document.querySelector('dialog[open]')||summoning)return;
 const actions={b:'blink',n:'nod',g:'shake'};if(actions[key])avatar.trigger(actions[key]);else if(key==='h'){e.preventDefault();showDialog('#controls');}else if(key==='enter'){e.preventDefault();showDialog('#chatDialog');}else if(key==='m')toggleMic();else if(key==='r')center();else if(['1','2','3','4'].includes(key))setMode(['mixed','matrix','statistics','abstract'][Number(key)-1]);
});
document.addEventListener('keyup',e=>{if(e.key!=='5'||!hold5Timer&&!hold5Fired)return;clearTimeout(hold5Timer);hold5Timer=null;if(!hold5Fired&&!summoning)setMode('neural');hold5Fired=false;});
function cancelHold5(){clearTimeout(hold5Timer);hold5Timer=null;hold5Fired=false;}
window.addEventListener('blur',cancelHold5);
desktop?.onSummon?.(()=>summonAle('global-hotkey'));
document.querySelectorAll('dialog').forEach(enableDialogDrag);window.addEventListener('resize',()=>document.querySelectorAll('dialog[open]').forEach(clampDialog));
document.addEventListener('visibilitychange',()=>{if(document.hidden){setPassthrough(true);suspendWakeListening('ALE · wake mic dijeda');stopListening(false);stopSpeech(false);stopCamera();stopReactiveAudio();}else resumeWakeSoon(500);});
window.addEventListener('pagehide',()=>{setPassthrough(true);wakeEnabled=false;suspendWakeListening('ALE · wake mic berhenti');stopListening(false);stopSpeech(false);stopCamera();stopReactiveAudio();});
document.addEventListener('avatar-error',()=>toast('Gambar avatar gagal dimuat. Muat ulang aplikasi.'));if(desktop)setPassthrough(true);checkAI();if(desktop){setWakeStatus(SR?'ALE · menyalakan wake mic…':'ALE · SpeechRecognition tidak tersedia',false);startWakeListening();}
