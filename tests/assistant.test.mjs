import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseCommand} from '../public/commands.js';
import {handleAPI} from '../worker.mjs';
import {validateChat,parseEvents} from '../desktop/bridge.mjs';
import {parseGrokResponse} from '../desktop/grok.mjs';
import {parseGeminiResponse} from '../desktop/gemini.mjs';
import {parseAskCodiResponse} from '../desktop/askcodi.mjs';
import {parseOpenAIResponse} from '../desktop/openai-api.mjs';
import {parseClaudeResponse} from '../desktop/claude.mjs';
import {parseDeepSeekResponse} from '../desktop/deepseek.mjs';
import {agentDefinitions,isCodexLoggedIn,parseCodexJsonOutput,agentTimeoutMs} from '../desktop/agent-hub.mjs';
import {normalizedAudioLevel} from '../public/audio-reactor.js';
import {isExplicitProjectWorkRequest} from '../public/work-intent.js';
import {IndonesianStt} from '../desktop/indonesian-stt.mjs';
import {IndonesianTts} from '../desktop/indonesian-tts.mjs';
import {HUMANALE_CORE_PROMPT,reasoningGuidance,humanaleSystemPrompt} from '../desktop/humanale-brain.mjs';
test('commands do not mistake normal conversation for gestures',()=>{assert.equal(parseCommand('Tolong menggelengkan kepala'),'shake');assert.equal(parseCommand('Coba berkedip!'),'blink');assert.equal(parseCommand('Jelaskan mengapa manusia berkedip'),null);});

test('HumanALE god egine Brain Core uses bounded adaptive logical reasoning',()=>{
 assert.match(HUMANALE_CORE_PROMPT,/Berpikir secara logis/);
 assert.match(HUMANALE_CORE_PROMPT,/pisahkan fakta dari asumsi/);
 assert.match(HUMANALE_CORE_PROMPT,/Jangan menampilkan chain-of-thought/);
 assert.match(HUMANALE_CORE_PROMPT,/koreksi eksplisit/);
 assert.match(HUMANALE_CORE_PROMPT,/tidak boleh mengklaim dapat mengubah model dasarnya/);
 assert.match(reasoningGuidance('halo'),/ringan/);
 assert.match(reasoningGuidance('cek bug dan error secara mendalam lalu analisis risiko dan solusi'),/mendalam/);
 const prompt=humanaleSystemPrompt('mengapa ini error dan bagaimana solusi terbaik?','Jangan akses file.');
 assert.match(prompt,/Mode penalaran:/);
 assert.match(prompt,/Jangan akses file/);
});

test('all HumanALE god egine conversation providers share the Brain Core prompt',async()=>{
 const sources=await Promise.all([
  '../desktop/bridge.mjs','../desktop/copilot.mjs','../desktop/openai-api.mjs','../desktop/claude.mjs',
  '../desktop/grok.mjs','../desktop/gemini.mjs','../desktop/deepseek.mjs','../desktop/askcodi.mjs'
 ].map(url=>readFile(new URL(url,import.meta.url),'utf8')));
 for(const source of sources){
  assert.match(source,/humanaleSystemPrompt/);
  assert.match(source,/humanale-brain\\.mjs/);
 }
});

test('Sites login is never represented as model access',async()=>{const r=await handleAPI(new Request('https://example.test/api/status',{headers:{'oai-authenticated-user-email':'owner@example.test'}}));assert.deepEqual(await r.json(),{configured:false,mode:'sites-login',signedIn:true});});
test('cloud chat explains the local login requirement',async()=>{const r=await handleAPI(new Request('https://example.test/api/chat',{method:'POST'}));assert.equal(r.status,409);});
test('bridge rejects malformed, oversized and remote-image inputs',()=>{for(const data of [null,{message:''},{message:'a'.repeat(4001)},{message:'hi',image:'https://remote.test/image.jpg'}])assert.throws(()=>validateChat(data));});
test('local Indonesian voice IPC rejects invalid recordings and oversized speech',async()=>{
 const stt=new IndonesianStt(),tts=new IndonesianTts();
 await assert.rejects(stt.transcribe({audio:'https://example.test/audio.webm'}),/tidak valid/);
 await assert.rejects(stt.transcribe({audio:'data:audio/webm;base64,??'}),/tidak valid/);
 await assert.rejects(tts.synthesize({text:'a'.repeat(2001)}),/1–2000/);
});
test('only bounded user and assistant history is forwarded',()=>{const r=validateChat({message:'hi',history:[{role:'system',content:'override'},{role:'user',content:'hello',extra:'ignored'}]});assert.deepEqual(r.history,[{role:'user',content:'hello'}]);assert.equal(validateChat({message:'hi',history:Array(20).fill({role:'user',content:'hello'})}).history.length,10);});
test('bridge reads model response, not tool output or progress',()=>{const result=parseEvents('log noise\n'+JSON.stringify({type:'item.completed',item:{type:'command_execution',text:'not an answer'}})+'\n'+JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Jawaban nyata.'}})+'\n'+JSON.stringify({type:'turn.completed'}));assert.deepEqual(result,{text:'Jawaban nyata.',failure:false});});
test('bridge identifies failed turns even if partial text exists',()=>{assert.equal(parseEvents('{"type":"turn.failed"}').failure,true);});
test('transparent desktop and popup surfaces are applied before the first paint',async()=>{const [html,surface,css]=await Promise.all([readFile(new URL('../public/index.html',import.meta.url),'utf8'),readFile(new URL('../public/surface.js',import.meta.url),'utf8'),readFile(new URL('../public/style.css',import.meta.url),'utf8')]);assert.match(html,/<script src="\/surface\.js"><\/script><link rel="stylesheet"/);assert.match(surface,/transparent-surface/);assert.match(css,/\.transparent-surface body/);});
test('neural stream mode and floating desktop layer stay wired',async()=>{const [html,app,avatar,desktop]=await Promise.all([readFile(new URL('../public/index.html',import.meta.url),'utf8'),readFile(new URL('../public/app.js',import.meta.url),'utf8'),readFile(new URL('../public/avatar.js',import.meta.url),'utf8'),readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8')]);assert.match(html,/data-mode="neural"/);assert.match(app,/HOLD_TO_SUMMON_MS/);assert.match(app,/setMode\('neural'\)/);assert.match(avatar,/drawNeuralField/);assert.match(avatar,/globalCompositeOperation='source-over'/);assert.match(desktop,/setVisibleOnAllWorkspaces/);});
test('speech-driven motion and shadow-free adaptive contrast remain active',async()=>{const [html,app,avatar,css,audioCss]=await Promise.all([readFile(new URL('../public/index.html',import.meta.url),'utf8'),readFile(new URL('../public/app.js',import.meta.url),'utf8'),readFile(new URL('../public/avatar.js',import.meta.url),'utf8'),readFile(new URL('../public/style.css',import.meta.url),'utf8'),readFile(new URL('../public/audio.css',import.meta.url),'utf8')]);assert.match(html,/value="spectrum" selected/);assert.match(html,/id="environment"/);assert.match(app,/onboundary/);assert.match(app,/setSpeechEnergy/);assert.match(app,/setEnvironment/);assert.match(avatar,/prefers-color-scheme: light/);assert.match(avatar,/adaptiveColors/);assert.doesNotMatch(avatar,/createRadialGradient/);assert.doesNotMatch(audioCss,/drop-shadow/);assert.match(css,/#avatar\{filter:none\}/);assert.match(avatar,/if\(this\.speaking\)\{/);assert.match(avatar,/this\.viseme/);});
test('real audio energy is normalized for mouth and head motion',()=>{assert.equal(normalizedAudioLevel(new Uint8Array(32).fill(128)),0);assert.ok(normalizedAudioLevel(Uint8Array.from({length:32},(_,i)=>i%2?208:48))>.5);});
test('microphone, music and Windows loopback controls remain wired',async()=>{const [html,app,audio,desktop]=await Promise.all([readFile(new URL('../public/index.html',import.meta.url),'utf8'),readFile(new URL('../public/app.js',import.meta.url),'utf8'),readFile(new URL('../public/audio-reactor.js',import.meta.url),'utf8'),readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8')]);assert.match(html,/id="audioMic"/);assert.match(html,/id="musicFile"/);assert.match(app,/getDisplayMedia/);assert.match(audio,/createAnalyser/);assert.match(desktop,/audio:'loopback'/);});
test('speech dictation checks microphone health and always stops probe tracks',async()=>{const [html,app]=await Promise.all([readFile(new URL('../public/index.html',import.meta.url),'utf8'),readFile(new URL('../public/app.js',import.meta.url),'utf8')]);assert.match(html,/id="micStatus"/);assert.match(html,/Dikte suara/);assert.match(app,/getUserMedia\(\{audio:true,video:false\}\)/);assert.match(app,/stream\?\.getTracks\(\)\.forEach\(track=>track\.stop\(\)\)/);for(const reason of ['denied','missing','unsupported','unavailable'])assert.match(app,new RegExp(reason));assert.match(app,/layanan pengenal ucapan tidak dapat dijangkau/);});
test('desktop popup is recoverable and preserves position without overwriting the repository',async()=>{const [desktop,preload]=await Promise.all([readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8'),readFile(new URL('../desktop/preload.cjs',import.meta.url),'utf8')]);assert.match(desktop,/new Tray/);assert.match(desktop,/window-state\.json/);assert.match(desktop,/skipTaskbar:true/);assert.match(desktop,/setIgnoreMouseEvents/);assert.match(desktop,/getDisplayNearestPoint/);assert.match(preload,/passthrough/);});
test('compact window, automatic transparent hit testing and media permission checks stay wired',async()=>{const [desktop,preload,app,css,html]=await Promise.all([readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8'),readFile(new URL('../desktop/preload.cjs',import.meta.url),'utf8'),readFile(new URL('../public/app.js',import.meta.url),'utf8'),readFile(new URL('../public/style.css',import.meta.url),'utf8'),readFile(new URL('../public/index.html',import.meta.url),'utf8')]);assert.match(desktop,/width=Math\.min\(420/);assert.match(desktop,/height=Math\.min\(480/);assert.match(desktop,/setPermissionCheckHandler/);assert.match(desktop,/passthroughLocked/);assert.match(preload,/passthroughLock/);assert.match(app,/pointInAvatarFace/);assert.match(app,/document\.addEventListener\('mousemove',syncPassthrough/);assert.match(css,/--avatar-size:420px/);assert.match(css,/#avatarArea\{width:min\(var\(--avatar-size\)/);assert.match(css,/dialog\{width:min\(330px/);assert.match(html,/Tembus klik penuh/);});
test('detached panel does not duplicate the heavy avatar evolution renderer',async()=>{
 const [avatar,app]=await Promise.all([
  readFile(new URL('../public/avatar.js',import.meta.url),'utf8'),
  readFile(new URL('../public/app.js',import.meta.url),'utf8')
 ]);
 assert.match(avatar,/setPaused\(value=false\)/);
 assert.match(avatar,/if\(this\.paused\|\|document\.hidden\)return/);
 assert.match(avatar,/performanceModeUntil/);
 assert.match(avatar,/if\(lowCost&&sampleIndex%2===1\)continue/);
 assert.match(app,/if\(panelOnly\)avatar\.setPaused\?\.\(true\)/);
 assert.match(app,/if\(panelOnly\)\{panelChannel\?\.postMessage\(\{type:'evolution',mode\}\);return;\}/);
});

test('developer work visibly drives particle self-repair evolution',async()=>{
 const [avatar,app]=await Promise.all([
  readFile(new URL('../public/avatar.js',import.meta.url),'utf8'),
  readFile(new URL('../public/app.js',import.meta.url),'utf8')
 ]);
 assert.match(avatar,/this\.evolving=false/);
 assert.match(avatar,/setEvolving\(value=false\)/);
 assert.match(avatar,/completeEvolution\(\)/);
 assert.match(avatar,/drawEvolutionField/);
 assert.match(avatar,/if\(!this\.evolving&&!completing\)return/);
 assert.match(avatar,/repairBand/);
 assert.match(avatar,/evolutionLight/);
 assert.match(app,/function setEvolutionVisual/);
 assert.match(app,/EVOLVING · memperbaiki diri/);
 assert.match(app,/EVOLUTION COMPLETE/);
 assert.match(app,/type:'evolution'/);
 assert.match(app,/setEvolutionVisual\('start'\)/);
 assert.match(app,/setEvolutionVisual\(workSucceeded\?'complete':'stop'\)/);
 assert.doesNotMatch(avatar,/context\.stroke\(\)/);
 assert.doesNotMatch(avatar,/\.lineTo\(/);
});

test('avatar adds particle depth and listening ear frequency waves',async()=>{
 const [avatar,app,html]=await Promise.all([
  readFile(new URL('../public/avatar.js',import.meta.url),'utf8'),
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/index.html',import.meta.url),'utf8')
 ]);
 assert.match(avatar,/this\.listening=false/);
 assert.match(avatar,/setListening\(value=false\)/);
 assert.match(avatar,/drawEarFrequencyWaves/);
 assert.match(avatar,/if\(!this\.listening&&Math\.max\(bands\.low,bands\.mid,bands\.high\)<\.025\)return/);
 assert.match(avatar,/const depthShift=fw\*/);
 assert.match(avatar,/const lipDepth=fh\*/);
 assert.match(app,/function syncListeningVisual/);
 assert.match(app,/avatar\.setListening/);
 assert.match(app,/wakeListening=false;syncListeningVisual\(\)/);
 assert.match(html,/telinga mengirim riak biner sesuai frekuensi rendah, menengah, dan tinggi saat audio diterima/);
 assert.doesNotMatch(avatar,/context\.stroke\(\)/);
 assert.doesNotMatch(avatar,/\.lineTo\(/);
});

test('avatar structure uses binary and neural particles instead of continuous lines',async()=>{
 const avatar=await readFile(new URL('../public/avatar.js',import.meta.url),'utf8');
 for(const feature of ['drawNeuralRoots','drawNeck','drawEars','drawMagneticField','drawMouthSignal','magneticOffset','rootStrands','neckGlyphs','livingHue','adaptiveColors','drawBinarySampler','drawBinaryCubic','drawBinaryQuadratic','drawBinarySegment'])assert.match(avatar,new RegExp(feature));
 assert.match(avatar,/strokeText/);
 assert.match(avatar,/const maxYaw=Math\.PI\/6/);
 assert.match(avatar,/rx=clamp\(rx,-maxYaw,maxYaw\)/);
 assert.doesNotMatch(avatar,/strokeAdaptivePath/);
 assert.doesNotMatch(avatar,/context\.stroke\(\)/);
 assert.doesNotMatch(avatar,/\.lineTo\(/);
 assert.doesNotMatch(avatar,/bezierCurveTo/);
 assert.doesNotMatch(avatar,/quadraticCurveTo/);
 assert.doesNotMatch(avatar,/context\.ellipse/);
});
test('build keeps private Sites identity optional in GitHub checkouts',async()=>{const build=await readFile(new URL('../build.mjs',import.meta.url),'utf8');assert.match(build,/error\.code!==['"]ENOENT['"]/);});
test('windows packaging and CI verification stay wired',async()=>{const [pkgText,pack,workflow,builder,desktop]=await Promise.all([readFile(new URL('../package.json',import.meta.url),'utf8'),readFile(new URL('../package-desktop.mjs',import.meta.url),'utf8'),readFile(new URL('../.github/workflows/verify.yml',import.meta.url),'utf8'),readFile(new URL('../electron-builder.yml',import.meta.url),'utf8'),readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8')]);const pkg=JSON.parse(pkgText);assert.equal(pkg.name,'humanale-god-engine');assert.equal(pkg.version,'2.4.0');assert.equal(pkg.main,'desktop/main.cjs');assert.equal(pkg.scripts.verify,'npm test && npm run build');assert.equal(pkg.scripts['package:desktop'],'install-electron --no && node package-desktop.mjs');assert.match(pkg.scripts['package:installer'],/electron-builder@26\.16\.1/);assert.match(pkg.scripts['package:installer'],/--publish never/);assert.match(pack,/HumanALE-God-Engine\.exe/);assert.match(pack,/path\.resolve\('node_modules','electron','dist'\)/);assert.match(builder,/productName: HumanALE god egine/);assert.match(builder,/HumanALE-God-Engine-Setup/);assert.match(builder,/target: nsis/);assert.match(builder,/oneClick: false/);assert.match(builder,/allowToChangeInstallationDirectory: true/);assert.match(workflow,/npm run package:installer/);assert.match(workflow,/gh release upload/);assert.doesNotMatch(workflow,/actions\/upload-artifact/);assert.match(desktop,/app\.setAppUserModelId\('id\.my\.aleprinting\.dudidam'\)/);});
test('safe launcher starts only the packaged HumanALE god egine application',async()=>{const launcher=await readFile(new URL('../Jalankan-entitasale170925-SAFE.bat',import.meta.url),'utf8');assert.match(launcher,/HumanALE-God-Engine-Desktop\\HumanALE-God-Engine\.exe/);assert.match(launcher,/if not exist/);assert.doesNotMatch(launcher,/runas|powershell|reg add|taskkill/i);});
test('desktop CI smoke mode verifies the packaged renderer',async()=>{const [desktop,workflow]=await Promise.all([readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8'),readFile(new URL('../.github/workflows/verify.yml',import.meta.url),'utf8')]);assert.match(desktop,/--ci-smoke/);assert.match(desktop,/HumanALE god egine CI smoke passed/);assert.match(desktop,/executeJavaScript/);assert.match(desktop,/app\.exit\(1\)/);assert.match(workflow,/HumanALE-God-Engine\.exe --ci-smoke/);});
test('avatar surface stays transparent and the detached panel is opaque',async()=>{const [css,surface,main,preload]=await Promise.all([readFile(new URL('../public/style.css',import.meta.url),'utf8'),readFile(new URL('../public/surface.js',import.meta.url),'utf8'),readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8'),readFile(new URL('../desktop/preload.cjs',import.meta.url),'utf8')]);assert.match(css,/body\.desktop,body\.popup-widget\{background:transparent!important\}/);assert.match(css,/html\.panel-surface,html\.panel-surface body\{background:#081610!important/);assert.match(surface,/\(isDesktop && !isPanel\) \|\| isPopup/);assert.match(main,/panelWin=new BrowserWindow/);assert.match(preload,/openPanel:view/);});
test('Grok provider is wired through the xAI Responses API without renderer secrets',async()=>{const [grok,desktop,preload,html,app]=await Promise.all([readFile(new URL('../desktop/grok.mjs',import.meta.url),'utf8'),readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8'),readFile(new URL('../desktop/preload.cjs',import.meta.url),'utf8'),readFile(new URL('../public/index.html',import.meta.url),'utf8'),readFile(new URL('../public/app.js',import.meta.url),'utf8')]);assert.equal(parseGrokResponse({output_text:' Halo '}),'Halo');assert.equal(parseGrokResponse({output:[{content:[{type:'output_text',text:'Hai'}]}]}),'Hai');assert.match(grok,/https:\/\/api\.x\.ai\/v1\/responses/);assert.match(grok,/XAI_API_KEY/);assert.match(grok,/Authorization':'Bearer '/);assert.match(desktop,/GrokBridge/);assert.match(preload,/dudidam:status/);assert.match(html,/value="grok"/);assert.match(app,/provider:aiProvider/);assert.doesNotMatch(html,/XAI_API_KEY\s*=/);});
test('Gemini provider is wired securely with text and camera-image support',async()=>{const [gemini,desktop,html,app]=await Promise.all([readFile(new URL('../desktop/gemini.mjs',import.meta.url),'utf8'),readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8'),readFile(new URL('../public/index.html',import.meta.url),'utf8'),readFile(new URL('../public/app.js',import.meta.url),'utf8')]);assert.equal(parseGeminiResponse({candidates:[{content:{parts:[{text:' Halo '},{text:'Gemini'}]}}]}),'Halo \nGemini');assert.match(gemini,/generativelanguage\.googleapis\.com\/v1beta\/models/);assert.match(gemini,/x-goog-api-key/);assert.match(gemini,/GEMINI_API_KEY/);assert.match(gemini,/GOOGLE_API_KEY/);assert.match(gemini,/inline_data/);assert.match(gemini,/mime_type:'image\/jpeg'/);assert.match(desktop,/GeminiBridge/);assert.match(html,/value="gemini"/);assert.match(app,/gemini:\{label:'Gemini'/);assert.doesNotMatch(html,/GEMINI_API_KEY\s*=/);assert.doesNotMatch(html,/GOOGLE_API_KEY\s*=/);});
test('AskCodi provider uses its official OpenAI-compatible gateway without renderer secrets',async()=>{const [askcodi,desktop,html,app]=await Promise.all([readFile(new URL('../desktop/askcodi.mjs',import.meta.url),'utf8'),readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8'),readFile(new URL('../public/index.html',import.meta.url),'utf8'),readFile(new URL('../public/app.js',import.meta.url),'utf8')]);assert.equal(parseAskCodiResponse({choices:[{message:{content:' Halo AskCodi '}}]}),'Halo AskCodi');assert.match(askcodi,/https:\/\/api\.askcodi\.com\/v1/);assert.match(askcodi,/ASKCODI_API_KEY/);assert.match(askcodi,/ASKCODI_MODEL/);assert.match(desktop,/AskCodiBridge/);assert.match(html,/value="askcodi"/);assert.match(app,/askcodi:\{label:'AskCodi'/);assert.doesNotMatch(html,/ASKCODI_API_KEY\s*=/);});
test('OpenAI, Claude and DeepSeek API providers are wired without renderer secrets',async()=>{
 const [openai,claude,deepseek,desktop,html,app,env]=await Promise.all([
  readFile(new URL('../desktop/openai-api.mjs',import.meta.url),'utf8'),
  readFile(new URL('../desktop/claude.mjs',import.meta.url),'utf8'),
  readFile(new URL('../desktop/deepseek.mjs',import.meta.url),'utf8'),
  readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8'),
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../.env.example',import.meta.url),'utf8')
 ]);
 assert.equal(parseOpenAIResponse({output_text:' Halo OpenAI '}),'Halo OpenAI');
 assert.equal(parseClaudeResponse({content:[{type:'text',text:' Halo Claude '}]}),'Halo Claude');
 assert.equal(parseDeepSeekResponse({output:[{content:[{type:'output_text',text:' Halo DeepSeek '}]}]}),'Halo DeepSeek');
 assert.match(openai,/api\.openai\.com\/v1\/responses/);assert.match(openai,/OPENAI_API_KEY/);
 assert.match(claude,/api\.anthropic\.com\/v1\/messages/);assert.match(claude,/ANTHROPIC_API_KEY/);assert.match(claude,/claude-fable-5/);assert.match(env,/ANTHROPIC_MODEL=claude-fable-5/);
 assert.match(deepseek,/api\.deepseek\.com\/responses/);assert.match(deepseek,/DEEPSEEK_API_KEY/);
 for(const id of ['openai','claude','deepseek'])assert.match(html,new RegExp('value="'+id+'"'));
 assert.match(desktop,/OpenAIBridge/);assert.match(desktop,/ClaudeBridge/);assert.match(desktop,/DeepSeekBridge/);
 assert.match(app,/OPENAI_API_KEY/);assert.match(app,/ANTHROPIC_API_KEY/);assert.match(app,/DEEPSEEK_API_KEY/);
 assert.doesNotMatch(html,/sk-[A-Za-z0-9_-]{12,}/);assert.doesNotMatch(env,/=sk-[A-Za-z0-9_-]+/);
});

test('Copilot chat distinguishes conversation from explicit project work',()=>{
 for(const text of ['ok kerjakan','kerjakan langsung','bantu perbaiki avatar','lanjutkan proyek entitashuman','implementasikan','edit kode'])assert.equal(isExplicitProjectWorkRequest(text),true,text);
 for(const text of ['hay','apa kabar','bagaimana bentuk avatar','jelaskan rencana','bisa bantu?'])assert.equal(isExplicitProjectWorkRequest(text),false,text);
});

test('HumanALE god egine project work requires a selected Git checkout and exposes a folder picker',async()=>{
 const [hub,desktop,preload,html,app]=await Promise.all([
  readFile(new URL('../desktop/agent-hub.mjs',import.meta.url),'utf8'),
  readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8'),
  readFile(new URL('../desktop/preload.cjs',import.meta.url),'utf8'),
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  readFile(new URL('../public/app.js',import.meta.url),'utf8')
 ]);
 assert.match(hub,/setProjectRoot/);
 assert.match(hub,/projectRootReady/);
 assert.match(hub,/access\(join\(root,'\.git'\)\)/);
 assert.match(hub,/Jangan git push, git merge, publish/);
 assert.match(desktop,/project-root\.txt/);
 assert.match(desktop,/dudidam:project-root-choose/);
 assert.match(desktop,/showOpenDialog/);
 assert.match(preload,/chooseProjectRoot/);
 assert.match(html,/id="projectPick"/);
 assert.match(app,/runCopilotProjectWork/);
 assert.match(app,/id:'github-copilot',mode:'work'/);
 assert.match(app,/isExplicitProjectWorkRequest\(text\)/);
});

test('developer agent hub registers requested tools and exposes read-only CLI adapters only',async()=>{const defs=agentDefinitions();const ids=defs.map(x=>x.id);for(const id of ['continue','cody','pieces','askcodi','phind','amazonq','windsurf','tabnine','replit','cursor','github-copilot','agent-copilot','codex','openai-api','visual-copilot','qodo','blackbox','claude','microsoft-copilot','deepseek-coder','devin','codegeex','starcoder','tabbyml','grok','gemini'])assert.ok(ids.includes(id));const runnable=defs.filter(x=>x.canRun).map(x=>x.id).sort();assert.deepEqual(runnable,['claude','codex','cody','continue','cursor','github-copilot']);const [hub,desktop,preload,html,app]=await Promise.all([readFile(new URL('../desktop/agent-hub.mjs',import.meta.url),'utf8'),readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8'),readFile(new URL('../desktop/preload.cjs',import.meta.url),'utf8'),readFile(new URL('../public/index.html',import.meta.url),'utf8'),readFile(new URL('../public/app.js',import.meta.url),'utf8')]);assert.match(hub,/--readonly/);assert.match(hub,/--mode=ask/);assert.match(hub,/--available-tools=view,grep,glob/);assert.match(hub,/read-only/);assert.match(hub,/--ignore-user-config/);assert.doesNotMatch(hub,/--force/);assert.match(desktop,/dudidam:agent-run/);assert.match(preload,/runAgent/);assert.match(html,/id="agentDialog"/);assert.match(app,/desktop\.agents\(\)/);assert.match(app,/desktop\.runAgent/);});


test('Cursor and Claude work modes are bounded and use current model ids',async()=>{
 const [hub,sandbox]=await Promise.all([
  readFile(new URL('../desktop/agent-hub.mjs',import.meta.url),'utf8'),
  readFile(new URL('../.cursor/sandbox.json',import.meta.url),'utf8')
 ]);
 assert.match(hub,/\['github-copilot','codex','cursor','claude'\]/);
 assert.match(hub,/id==='cursor'&&mode==='work'/);
 assert.match(hub,/id==='cursor'\?\['-p',prompt,'--mode=ask','--sandbox','enabled'/);
 assert.match(hub,/claude-fable-5/);
 assert.match(hub,/--permission-mode','plan/);
 assert.match(hub,/--permission-mode','dontAsk/);
 assert.match(hub,/--tools','Read,Glob,Grep'/);
 assert.match(hub,/Bash\(npm test:\*\)/);
 assert.match(hub,/--no-session-persistence/);
 assert.doesNotMatch(hub,/dangerously-skip-permissions|bypassPermissions/);
 const policy=JSON.parse(sandbox);
 assert.equal(policy.type,'workspace_readwrite');
 assert.equal(policy.disableTmpWrite,true);
 assert.equal(policy.networkPolicy.default,'deny');
});


test('Codex agent requires login, parses JSON events and uses bounded work timeout',async()=>{
 assert.equal(isCodexLoggedIn('Logged in using ChatGPT'),true);
 assert.equal(isCodexLoggedIn('Not logged in'),false);
 assert.deepEqual(parseCodexJsonOutput(
  JSON.stringify({type:'item.completed',item:{type:'command_execution',text:'ignore'}})+'\n'+
  JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Selesai.'}})+'\n'+
  JSON.stringify({type:'turn.completed'})
 ),{text:'Selesai.',failure:false});
 assert.equal(parseCodexJsonOutput(JSON.stringify({type:'turn.failed'})).failure,true);
 assert.equal(agentTimeoutMs('analyze',{}),120000);
 assert.equal(agentTimeoutMs('work',{}),600000);
 assert.equal(agentTimeoutMs('work',{HUMANALE_AGENT_TIMEOUT_MS:'1000'}),30000);
 assert.equal(agentTimeoutMs('work',{DUDIDAM_AGENT_TIMEOUT_MS:'1000'}),30000);
 assert.equal(agentTimeoutMs('work',{DUDIDAM_AGENT_TIMEOUT_MS:'9999999'}),900000);
 const hub=await readFile(new URL('../desktop/agent-hub.mjs',import.meta.url),'utf8');
 assert.match(hub,/codexLoginStatus/);
 assert.match(hub,/\['login','status'\]/);
 assert.match(hub,/Codex CLI terpasang tetapi belum login/);
 assert.match(hub,/--json/);
 assert.match(hub,/HUMANALE_AGENT_TIMEOUT_MS/);
 assert.match(hub,/HUMANALE_PROJECT_ROOT/);
 assert.match(hub,/agentTimeoutMs\(mode\)/);
 assert.match(hub,/workspace-write/);
 assert.match(hub,/read-only/);
});



test('global ALE summon shortcut works without a keylogger',async()=>{const [desktop,preload,app]=await Promise.all([readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8'),readFile(new URL('../desktop/preload.cjs',import.meta.url),'utf8'),readFile(new URL('../public/app.js',import.meta.url),'utf8')]);assert.match(desktop,/globalShortcut/);assert.match(desktop,/CommandOrControl\+Alt\+5/);assert.match(desktop,/dudidam:summon/);assert.match(desktop,/unregisterAll/);assert.match(preload,/onSummon/);assert.match(app,/global-hotkey/);});

test('ALE wake microphone is explicit opt-in and permission copy is accurate',async()=>{
 const [app,html,desktop]=await Promise.all([
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8')
 ]);
 assert.match(app,/dudidam-wake-enabled/);
 assert.match(app,/if\(wakeEnabled\)startWakeListening\(\)/);
 assert.doesNotMatch(html,/id="wakeToggle" checked/);
 assert.match(html,/Tahan 5 sekitar 1,5 detik saat HumanALE god egine fokus/);
 assert.match(html,/Ctrl\+Alt\+5/);
 assert.match(desktop,/Wake ALE, dikte, atau reaksi suara/);
});


test('custom avatar size, soft summon and bounded project work mode stay wired',async()=>{
 const [html,app,avatar,css,hub]=await Promise.all([
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/avatar.js',import.meta.url),'utf8'),
  readFile(new URL('../public/style.css',import.meta.url),'utf8'),
  readFile(new URL('../desktop/agent-hub.mjs',import.meta.url),'utf8')
 ]);
 assert.match(html,/id="avatarSize"/);
 assert.match(html,/id="agentMode"/);
 assert.match(app,/dudidam-avatar-size/);
 assert.match(app,/SUMMON_DURATION_MS=4200/);
 assert.match(css,/--avatar-size:420px/);
 assert.match(avatar,/awaken\(duration=4200\)/);
 assert.match(avatar,/fluidStrength/);
 assert.match(avatar,/rawAssembly-delay/);
 assert.match(hub,/workspace-write/);
 assert.match(hub,/available-tools=view,grep,glob,edit,create,apply_patch/);
 assert.match(hub,/--allow-tool=write/);
 assert.match(hub,/Jangan git push/);
 assert.doesNotMatch(hub,/--allow-all/);
});

test('avatar size, full-desktop gaze and smooth brain-bound light pulses stay wired',async()=>{
 const [html,app,avatar,desktop,preload]=await Promise.all([
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/avatar.js',import.meta.url),'utf8'),
  readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8'),
  readFile(new URL('../desktop/preload.cjs',import.meta.url),'utf8')
 ]);
 assert.match(html,/id="avatarSize" type="range" min="180" max="540"/);
 assert.match(app,/Math\.max\(180,Math\.min\(540/);
 assert.match(app,/avatarViewport/);
 assert.match(desktop,/resizeForAvatar/);
 assert.match(desktop,/getCursorScreenPoint/);
 assert.match(desktop,/getAllDisplays/);
 assert.match(desktop,/dudidam:global-pointer/);
 assert.match(preload,/onGlobalPointer/);
 assert.match(avatar,/gazePointer/);
 assert.match(avatar,/gazeEase/);
 assert.match(avatar,/drawBrainCorePulse/);
 assert.match(avatar,/shadowBlur/);
 assert.match(avatar,/rawProgress/);
 assert.doesNotMatch(desktop,/globalHook|keylogger/i);
});

test('larger avatar default and slow-motion particle clock stay wired',async()=>{
 const [html,app,avatar,css,desktop]=await Promise.all([
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/avatar.js',import.meta.url),'utf8'),
  readFile(new URL('../public/style.css',import.meta.url),'utf8'),
  readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8')
 ]);
 assert.match(app,/DEFAULT_AVATAR_SIZE=420/);
 assert.match(app,/storedAvatarSize===380\?DEFAULT_AVATAR_SIZE/);
 assert.match(html,/avatarSizeValue">420 px/);
 assert.match(html,/id="avatarSize" type="range" min="180" max="540" step="10" value="420"/);
 assert.match(css,/--avatar-size:420px/);
 assert.match(css,/#avatarArea\{[^}]*width:min\(var\(--avatar-size\),94vw\)/);
 assert.match(desktop,/resizeForAvatar\(value=420\)/);
 assert.match(avatar,/PARTICLE_TIME_SCALE=\.58/);
 assert.match(avatar,/motionClock=auto\?time\*PARTICLE_TIME_SCALE:0/);
 assert.match(avatar,/drawNeuralRoots\([^\n]*motionClock/);
 assert.match(avatar,/drawNeuralField\([^\n]*motionClock/);
 assert.match(avatar,/drawMouthSignal\([^\n]*hue,clock,/);
});

test('particle ears follow head yaw without continuous strokes',async()=>{
 const avatar=await readFile(new URL('../public/avatar.js',import.meta.url),'utf8');
 assert.match(avatar,/drawEars\(context,size,cx,cy,fw,fh,hue,lightEnvironment,yaw,clock\)/);
 assert.match(avatar,/visibility=clamp\(\.78\+side\*Math\.sin\(yaw\)\*\.34/);
 assert.match(avatar,/this\.drawEars\(context,size,cx,cy,faceWidth,faceHeight,hue,lightEnvironment,rx,motionClock\)/);
 assert.doesNotMatch(avatar,/context\.stroke\(\)/);
 assert.doesNotMatch(avatar,/context\.ellipse/);
});

test('human head uses 3D perspective and a single smoothed speech viseme',async()=>{
 const avatar=await readFile(new URL('../public/avatar.js',import.meta.url),'utf8');
 assert.match(avatar,/drawHeadStructure/);
 assert.match(avatar,/const perspective=clamp/);
 assert.match(avatar,/rotatedDepth/);
 assert.match(avatar,/depthLight/);
 assert.match(avatar,/this\.visemeTarget/);
 assert.match(avatar,/visemeEase/);
 assert.match(avatar,/this\.viseme\+=/);
 assert.match(avatar,/jawWeight/);
 assert.doesNotMatch(avatar,/time\/\(60\+Math\.abs\(px\)/);
 assert.doesNotMatch(avatar,/Math\.abs\(Math\.sin\(clock\*\.011\)\)/);
});

test('summon and dismiss transitions cannot lose the latest window command',async()=>{
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(app,/transitionSerial=0/);
 assert.match(app,/const transition=\+\+transitionSerial/);
 assert.match(app,/transition!==transitionSerial/);
 assert.match(app,/summoning=true;dismissing=false/);
 assert.match(app,/dismissing=true;summoning=false/);
 assert.doesNotMatch(app,/async function summonAle[\s\S]{0,100}if\(transitioning\(\)\)return/);
 assert.doesNotMatch(app,/async function dismissAle[\s\S]{0,100}if\(transitioning\(\)\)return/);
});

test('tray show restores avatar without triggering summon or microphone',async()=>{
 const [desktop,preload,app,avatar]=await Promise.all([
  readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8'),
  readFile(new URL('../desktop/preload.cjs',import.meta.url),'utf8'),
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/avatar.js',import.meta.url),'utf8')
 ]);
 const showStart=desktop.indexOf('function showAvatar()');
 const summonStart=desktop.indexOf('function summonAvatar()',showStart);
 const showBlock=desktop.slice(showStart,summonStart);
 assert.match(showBlock,/dudidam:show/);
 assert.doesNotMatch(showBlock,/dudidam:summon/);
 assert.match(preload,/onShow/);
 assert.match(app,/function showAle/);
 assert.match(app,/desktop\?\.onShow\?\.\(showAle\)/);
 assert.match(avatar,/reveal\(\)\{this\.transitionKind=''/);
});

test('Copilot chat uses a valid minimal tool allowlist',async()=>{
 const copilot=await readFile(new URL('../desktop/copilot.mjs',import.meta.url),'utf8');
 assert.match(copilot,/--available-tools=view/);
 assert.doesNotMatch(copilot,/['"]--available-tools['"]\s*\]/);
 assert.match(copilot,/--disable-builtin-mcps/);
});

test('failed Piper synthesis falls back to native Indonesian voice',async()=>{
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(app,/localTtsConfigured=false/);
 assert.match(app,/Mencoba voice Windows Indonesia/);
 assert.match(app,/if\(speakNativeIndonesian\(text\)\)return/);
 assert.match(app,/Voice Windows Indonesia juga tidak tersedia/);
});

test('external Copilot and Indonesian voice child processes are stoppable',async()=>{
 const [copilot,stt,tts]=await Promise.all([
  readFile(new URL('../desktop/copilot.mjs',import.meta.url),'utf8'),
  readFile(new URL('../desktop/indonesian-stt.mjs',import.meta.url),'utf8'),
  readFile(new URL('../desktop/indonesian-tts.mjs',import.meta.url),'utf8')
 ]);
 for(const source of [copilot,stt,tts]){
  assert.match(source,/this\.children=new Set\(\)/);
  assert.match(source,/children\?\.add\(child\)/);
  assert.match(source,/children\?\.delete\(child\)/);
  assert.match(source,/for\(const child of this\.children\)/);
  assert.match(source,/child\.kill\(\)/);
 }
});

test('cinematic avatar assembles and dissolves without a permanent particle swarm',async()=>{
 const [avatar,app,desktop,preload]=await Promise.all([
  readFile(new URL('../public/avatar.js',import.meta.url),'utf8'),
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8'),
  readFile(new URL('../desktop/preload.cjs',import.meta.url),'utf8')
 ]);
 assert.match(avatar,/dismiss\(duration=3000\)/);
 assert.match(avatar,/drawTransitionRibbons/);
 assert.match(avatar,/transition\.kind==='disassemble'/);
 assert.doesNotMatch(avatar,/this\.particles=Array/);
 assert.doesNotMatch(avatar,/drawElectronOrbits/);
 assert.match(app,/DISMISS_DURATION_MS=3000/);
 assert.match(app,/dismissAle/);
 assert.match(desktop,/dudidam:dismiss/);
 assert.match(preload,/onDismiss/);
 assert.match(preload,/finishDismiss/);
});


test('pointer magnet stays visually ring-free',async()=>{
 const avatar=await readFile(new URL('../public/avatar.js',import.meta.url),'utf8');
 const start=avatar.indexOf('drawMagneticField');
 const end=avatar.indexOf('drawNeuralRoots',start);
 const block=avatar.slice(start,end);
 assert.match(avatar,/Math\.exp\(\-\(distance\*distance\)/);
 assert.doesNotMatch(block,/context\.arc/);
 assert.doesNotMatch(block,/drawAdaptiveGlyph/);
 assert.doesNotMatch(block,/radius=size/);
});


test('custom panel zoom and transparency persist',async()=>{
 const [html,app,css]=await Promise.all([
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/style.css',import.meta.url),'utf8')
 ]);
 assert.match(html,/id="panelZoom"/);
 assert.match(html,/id="panelOpacity"/);
 assert.match(html,/max="145"/);
 assert.match(html,/max="80"/);
 assert.match(app,/dudidam-panel-zoom/);
 assert.match(app,/dudidam-panel-transparency/);
 assert.match(app,/applyPanelZoom/);
 assert.match(app,/applyPanelTransparency/);
 assert.match(css,/--panel-zoom:1/);
 assert.match(css,/--panel-alpha:\.95/);
 assert.match(css,/zoom:var\(--panel-zoom\)/);
 assert.match(css,/background:rgba\(7,19,14,var\(--panel-alpha\)\)/);
});


test('zoomed panel resizes Electron viewport safely',async()=>{
 const [desktop,preload,app]=await Promise.all([
  readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8'),
  readFile(new URL('../desktop/preload.cjs',import.meta.url),'utf8'),
  readFile(new URL('../public/app.js',import.meta.url),'utf8')
 ]);
 assert.match(desktop,/resizeForPanel/);
 assert.match(desktop,/dudidam:panel-viewport/);
 assert.match(desktop,/setBounds/);
 assert.match(preload,/panelViewport/);
 assert.match(app,/panelZoomFactor/);
 assert.match(app,/panelViewport\?\.\(\{zoom:panelZoomFactor,open:true\}\)/);
 assert.match(app,/syncPanelViewportFromDialogs/);assert.match(app,/open:Boolean\(document\.querySelector\('dialog\[open\]'\)\)/);
});

test('Copilot trust-folder prompt fails fast instead of hanging',async()=>{
 const hub=await readFile(new URL('../desktop/agent-hub.mjs',import.meta.url),'utf8');
 assert.match(hub,/looksLikeCopilotTrustPrompt/);
 assert.match(hub,/trust folder/);
 assert.match(hub,/child\.kill\(\)/);
 assert.match(hub,/GitHub Copilot meminta konfirmasi trust folder/);
});


test('temporary panel resize does not corrupt saved position',async()=>{
 const desktop=await readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8');
 assert.match(desktop,/panelViewportOpen/);
 assert.match(desktop,/if\(!panelViewportOpen\)savePositionSoon\(\)/);
});

test('Copilot programmatic run is hardened without broad permissions',async()=>{
 const hub=await readFile(new URL('../desktop/agent-hub.mjs',import.meta.url),'utf8');
 assert.match(hub,/--no-auto-update/);
 assert.match(hub,/--disallow-temp-dir/);
 assert.match(hub,/--available-tools=view,grep,glob,edit,create,apply_patch/);
 assert.match(hub,/--allow-tool=write/);
 assert.doesNotMatch(hub,/--allow-all/);
 assert.doesNotMatch(hub,/--allow-all-paths/);
 assert.match(hub,/trust the files in/);
});


test('Indonesian TTS prefers Piper only when configured and falls back to Windows voice',async()=>{
 const [html,app]=await Promise.all([
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  readFile(new URL('../public/app.js',import.meta.url),'utf8')
 ]);
 assert.match(html,/id="voiceSelect"/);
 assert.match(html,/Voice Indonesia/);
 assert.match(app,/getIndonesianVoices/);
 assert.match(app,/localTtsConfigured=false/);
 assert.match(app,/localTtsConfigured=Boolean\(result\.configured\)/);
 assert.match(app,/function speakNativeIndonesian/);
 assert.match(app,/if\(localTtsConfigured&&desktop\?\.synthesize\)\{speakLocal\(text\);return;\}/);
 assert.match(app,/if\(speakNativeIndonesian\(text\)\)return/);
 assert.match(app,/if\(desktop\?\.synthesize\)\{speakLocal\(text\);return;\}/);
 assert.match(app,/u\.lang=chosen\.lang/);
 assert.match(app,/dudidam-voice-uri/);
 assert.match(app,/voiceschanged/);
 assert.match(app,/current\.lang='id-ID'/);
});
