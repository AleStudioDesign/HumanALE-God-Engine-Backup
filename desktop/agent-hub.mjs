import {spawn} from 'node:child_process';
import {access} from 'node:fs/promises';
import {join} from 'node:path';

const agents=[
 {id:'humanale-orchestrator',name:'HumanALE Orchestrator',method:'Structured Planner → Worker → Reviewer',internal:true,canRun:true,url:'https://github.com/Kmpsnr26/entitashuman'},
 {id:'continue',name:'Continue',method:'CLI + MCP',commands:['cn'],envPath:'CONTINUE_CLI_PATH',canRun:true,url:'https://docs.continue.dev/cli/quickstart'},
 {id:'cody',name:'Sourcegraph Cody',method:'CLI + Sourcegraph MCP',commands:['cody'],envPath:'CODY_CLI_PATH',canRun:true,url:'https://sourcegraph.com/docs/cody/clients/install-cli'},
 {id:'pieces',name:'Pieces for Developers',method:'PiecesOS MCP',commands:['pieces-os','pieces'],envPath:'PIECES_CLI_PATH',configEnv:'PIECES_MCP_URL',url:'https://docs.pieces.app/'},
 {id:'askcodi',name:'AskCodi',method:'API Gateway',configEnv:'ASKCODI_API_KEY',secondaryEnv:'ASKCODI_MODEL',url:'https://www.askcodi.com/gateway'},
 {id:'phind',name:'Phind',method:'External',external:true,url:'https://www.phind.com/'},
 {id:'amazonq',name:'Amazon Q Developer',method:'CLI + MCP',commands:['qchat','q'],envPath:'AMAZON_Q_CLI_PATH',url:'https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/qdev-mcp.html'},
 {id:'windsurf',name:'Windsurf / Codeium',method:'IDE + MCP',commands:['windsurf'],envPath:'WINDSURF_CLI_PATH',url:'https://docs.windsurf.com/'},
 {id:'tabnine',name:'Tabnine',method:'IDE + MCP',commands:['tabnine','TabNine'],envPath:'TABNINE_CLI_PATH',url:'https://docs.tabnine.com/'},
 {id:'replit',name:'Replit AI / Agent',method:'Cloud Agent + MCP',url:'https://docs.replit.com/references/mcp/overview'},
 {id:'cursor',name:'Cursor',method:'CLI + MCP',commands:['agent','cursor-agent'],envPath:'CURSOR_AGENT_PATH',canRun:true,url:'https://prod.cursor.com/docs/cli/overview'},
 {id:'github-copilot',name:'GitHub Copilot',method:'CLI + custom agents',commands:['copilot'],envPath:'GITHUB_COPILOT_CLI_PATH',configEnvs:['COPILOT_GITHUB_TOKEN','GH_TOKEN','GITHUB_TOKEN'],canRun:true,url:'https://docs.github.com/en/copilot/how-tos/copilot-cli'},
 {id:'agent-copilot',name:'Agent / Copilot',method:'GitHub Copilot custom agent',commands:['copilot'],envPath:'GITHUB_COPILOT_CLI_PATH',url:'https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-custom-agents'},
 {id:'codex',name:'OpenAI Codex',method:'CLI + MCP',commands:['codex'],envPath:'CODEX_CLI_PATH',canRun:true,url:'https://developers.openai.com/codex/cli'},
 {id:'openai-api',name:'OpenAI API',method:'HumanALE god egine runtime API provider',runtime:true,configEnvs:['OPENAI_API_KEY'],url:'https://developers.openai.com/api/'},
 {id:'visual-copilot',name:'Visual Copilot',method:'Design-to-code external',external:true,url:'https://www.builder.io/c/docs/visual-copilot'},
 {id:'qodo',name:'Qodo',method:'IDE / review agent',commands:['qodo'],envPath:'QODO_CLI_PATH',url:'https://docs.qodo.ai/'},
 {id:'blackbox',name:'Blackbox AI',method:'IDE / external agent',external:true,url:'https://www.blackbox.ai/'},
 {id:'claude',name:'Claude Code · Fable 5',method:'Claude Code CLI + Fable 5 + HumanALE god egine runtime API',commands:['claude'],envPath:'CLAUDE_CLI_PATH',runtime:true,configEnvs:['ANTHROPIC_API_KEY'],canRun:true,model:'claude-fable-5',url:'https://docs.anthropic.com/en/docs/claude-code/overview'},
 {id:'microsoft-copilot',name:'Microsoft Copilot',method:'External / IDE',external:true,url:'https://learn.microsoft.com/en-us/copilot/'},
 {id:'deepseek-coder',name:'DeepSeek Coder',method:'HumanALE god egine runtime API provider',runtime:true,configEnvs:['DEEPSEEK_API_KEY'],url:'https://api-docs.deepseek.com/'},
 {id:'devin',name:'Devin AI',method:'Cloud software agent',external:true,url:'https://docs.devin.ai/'},
 {id:'codegeex',name:'CodeGeeX',method:'IDE coding assistant',external:true,url:'https://codegeex.cn/'},
 {id:'starcoder',name:'StarCoder',method:'Model / self-hosted endpoint',external:true,url:'https://huggingface.co/bigcode'},
 {id:'tabbyml',name:'TabbyML',method:'Self-hosted coding assistant',commands:['tabby'],envPath:'TABBY_CLI_PATH',url:'https://tabby.tabbyml.com/docs/'},
 {id:'grok',name:'Grok / xAI',method:'HumanALE god egine runtime API provider',runtime:true,configEnvs:['XAI_API_KEY'],url:'https://docs.x.ai/'},
 {id:'gemini',name:'Gemini / Google AI',method:'HumanALE god egine runtime API + CLI',runtime:true,commands:['gemini'],envPath:'GEMINI_CLI_PATH',configEnvs:['GEMINI_API_KEY','GOOGLE_API_KEY'],url:'https://github.com/google-gemini/gemini-cli'}
];

async function exists(path){try{await access(path);return true;}catch{return false;}}
function locateCommand(command){
 return new Promise(resolve=>{
  const finder=process.platform==='win32'?'where.exe':'which';
  const child=spawn(finder,[command],{windowsHide:true,stdio:['ignore','pipe','ignore']});
  let out='';child.stdout.on('data',d=>out+=d);
  child.on('error',()=>resolve(null));
  child.on('close',code=>resolve(code===0?out.split(/\r?\n/).map(x=>x.trim()).find(Boolean)||null:null));
 });
}
async function locate(agent){
 const override=agent.envPath&&(process.env[agent.envPath]||'').trim();
 if(override&&await exists(override))return override;
 if(['github-copilot','agent-copilot'].includes(agent.id)&&process.platform==='win32'&&process.env.LOCALAPPDATA){
  const winget=join(process.env.LOCALAPPDATA,'Microsoft','WinGet','Links','copilot.exe');
  if(await exists(winget))return winget;
 }
 for(const command of agent.commands||[]){const found=await locateCommand(command);if(found)return found;}
 return null;
}

export function isCodexLoggedIn(text=''){
 const value=String(text);
 return !/\bnot logged in\b/i.test(value)&&/\blogged in\b/i.test(value);
}
export function parseCodexJsonOutput(stdout=''){
 let text='',failure=false;
 for(const line of String(stdout).split(/\r?\n/)){
  try{
   const event=JSON.parse(line);
   if(event.type==='item.completed'&&event.item?.type==='agent_message'&&typeof event.item.text==='string')text=event.item.text;
   if(event.type==='turn.failed'||event.type==='error')failure=true;
  }catch{}
 }
 return {text:text.trim(),failure};
}
export function agentTimeoutMs(mode='analyze',env=process.env){
 const fallback=mode==='work'?600000:120000;
 const raw=Number(env.HUMANALE_AGENT_TIMEOUT_MS??env.DUDIDAM_AGENT_TIMEOUT_MS);
 if(!Number.isFinite(raw)||raw<=0)return fallback;
 return Math.max(30000,Math.min(900000,Math.round(raw)));
}
function runProcess(executable,args,{cwd,timeout=12000}={}){
 return new Promise(resolve=>{
  const child=spawn(executable,args,{cwd,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NO_COLOR:'1'}});
  let stdout='',stderr='',settled=false;
  const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value);};
  const timer=setTimeout(()=>{child.kill();finish({code:null,stdout,stderr,timedOut:true});},timeout);
  child.stdout.on('data',data=>stdout+=data);
  child.stderr.on('data',data=>stderr=(stderr+data).slice(-16000));
  child.on('error',error=>finish({code:null,stdout,stderr,error}));
  child.on('close',code=>finish({code,stdout,stderr}));
 });
}
async function codexLoginStatus(executable,cwd){
 const result=await runProcess(executable,['login','status'],{cwd,timeout:12000});
 return {ready:result.code===0&&isCodexLoggedIn(result.stdout+'\n'+result.stderr),...result};
}
export function agentDefinitions(){return agents.map(({commands,envPath,configEnv,configEnvs,secondaryEnv,...agent})=>({...agent}));}

export function classifyTaskDifficulty(prompt=''){
 const text=String(prompt||'').trim();
 let score=0;
 if(text.length>500)score++;
 if(/\b(refactor|migrat|arsitektur|architecture|integrat|debug|security|keamanan|release|deploy|runtime|database|android|electron|multi-agent|agent)\b/i.test(text))score++;
 if(/\b(lalu|kemudian|setelah|sekaligus|and then|after that|before|depends on|dependency)\b/i.test(text))score++;
 if(/\b(test|verify|build|audit|review|cek|perbaiki|fix|implement|ubah|edit)\b/i.test(text))score++;
 return score>=3?'high':score>=1?'medium':'low';
}
export function reviewVerdict(text=''){
 const value=String(text||'').toUpperCase();
 if(/\bVERDICT\s*:\s*NEEDS_FIX\b/.test(value))return 'needs_fix';
 if(/\bVERDICT\s*:\s*PASS\b/.test(value))return 'pass';
 return 'unknown';
}
function looksLikeCopilotTrustPrompt(text=''){
 const value=String(text).replace(/\s+/g,' ').toLowerCase();
 return value.includes('trust the files in')||
  value.includes('trust this folder')||
  value.includes('trust this directory')||
  value.includes('confirm that you trust');
}
export class DeveloperAgentHub{
 constructor(){this.child=null;this.pending=false;this.projectRoot='';}
 setProjectRoot(value=''){this.projectRoot=String(value||'').trim();}
 getProjectRoot(){return (this.projectRoot||process.env.HUMANALE_PROJECT_ROOT||process.env.DUDIDAM_PROJECT_ROOT||process.cwd()).trim();}
 async projectRootReady(){
  const root=this.getProjectRoot();
  try{await access(root);await access(join(root,'.git'));return true;}catch{return false;}
 }
 async status(){
  const projectRoot=this.getProjectRoot(),projectRootReady=await this.projectRootReady();
  const rows=await Promise.all(agents.map(async agent=>{
   if(agent.internal)return {id:agent.id,name:agent.name,method:agent.method,state:'setup',detail:'Menunggu executor lokal yang aman.',canRun:false,url:agent.url,executable:true};
   const executable=await locate(agent);
   const configNames=[agent.configEnv,...(agent.configEnvs||[])].filter(Boolean);
   const configured=configNames.length?Boolean(configNames.some(name=>(process.env[name]||'').trim())&&(!agent.secondaryEnv||(process.env[agent.secondaryEnv]||'').trim())):false;
   const codexAuth=agent.id==='codex'&&executable?await codexLoginStatus(executable,projectRoot):null;
   let state='available',detail='';
   if(agent.external){state='external';detail='Terdaftar di Agent Hub sebagai konektor eksternal; HumanALE god egine tidak menjalankannya langsung.';}
   else if(agent.runtime){state=configured?'configured':executable?'installed':'setup';detail=configured?'Kredensial provider runtime terdeteksi dari environment.':executable?'CLI lokal terdeteksi; provider runtime masih memerlukan kredensial environment.':'Provider tersedia di HumanALE god egine tetapi belum dikonfigurasi di environment.';}
   else if(agent.id==='replit'){state='mcp-client';detail='Replit Agent menerima remote MCP dari halaman Integrations.';}
   else if(agent.id==='pieces'){state=configured?'configured':executable?'installed':'setup';detail=configured?'PIECES_MCP_URL terdeteksi.':executable?'PiecesOS terdeteksi; salin URL MCP ke PIECES_MCP_URL bila ingin dipakai lintas agent.':'Install PiecesOS lalu ambil URL MCP lokal.';}
   else if(agent.id==='askcodi'){state=configured?'configured':'setup';detail=configured?'AskCodi API siap dipakai dari provider HumanALE god egine.':'Atur ASKCODI_API_KEY dan ASKCODI_MODEL.';}
   else if(agent.id==='codex'&&executable){state=codexAuth?.ready?'configured':'installed';detail=codexAuth?.ready?'Codex CLI terdeteksi dan login aktif.':'Codex CLI terdeteksi tetapi belum login. Jalankan codex login lalu coba lagi.';}
   else if(executable){state='installed';detail='CLI/aplikasi lokal terdeteksi.';}
   else{state='setup';detail=agent.method.includes('MCP')?'Belum terdeteksi lokal; integrasi MCP tetap didukung oleh produknya.':'Belum dikonfigurasi.';}
   return {id:agent.id,name:agent.name,method:agent.method,state,detail,canRun:Boolean(agent.canRun&&executable&&(agent.id!=='codex'||codexAuth?.ready)),url:agent.url,executable:executable?true:false};
  }));
  const structuredExecutors=rows.filter(row=>['github-copilot','codex','cursor','claude'].includes(row.id)&&row.canRun);
  const orchestrator=rows.find(row=>row.id==='humanale-orchestrator');
  if(orchestrator){
   orchestrator.state=structuredExecutors.length?'configured':'setup';
   orchestrator.canRun=structuredExecutors.length>0;
   orchestrator.detail=structuredExecutors.length
    ?'Pipeline terstruktur siap: Planner membaca, Worker mengerjakan dengan izin terbatas, Reviewer memeriksa ulang. Executor: '+structuredExecutors.map(row=>row.name).join(', ')+'.'
    :'Pasang/login minimal satu executor: GitHub Copilot, OpenAI Codex, Cursor, atau Claude Code.';
  }
  return {projectRoot,projectRootReady,agents:rows};
 }
 async availableStructuredExecutors(){
  const cwd=this.getProjectRoot(),result=[];
  for(const id of ['codex','github-copilot','cursor','claude']){
   const agent=agents.find(item=>item.id===id);
   const executable=await locate(agent);
   if(!executable)continue;
   if(id==='codex'){
    const auth=await codexLoginStatus(executable,cwd);
    if(!auth.ready)continue;
   }
   result.push(id);
  }
  return result;
 }
 async runDirect(id,prompt,mode='analyze'){
  const agent=agents.find(item=>item.id===id&&item.canRun&&!item.internal);
  if(!agent)throw new Error('Executor agent tidak tersedia.');
  if(mode==='work'&&!['github-copilot','codex','cursor','claude'].includes(id))throw new Error('Mode Kerja executor tidak didukung.');
  const executable=await locate(agent);
  if(!executable)throw new Error(agent.name+' belum ditemukan di PATH atau environment path khusus.');
  const cwd=this.getProjectRoot();
  if(mode==='work'&&!await this.projectRootReady())throw new Error('Folder proyek belum dipilih atau bukan checkout Git. Buka Developer agents → Pilih folder proyek, lalu pilih folder repo entitashuman.');
  if(id==='codex'){
   const auth=await codexLoginStatus(executable,cwd);
   if(!auth.ready){
    if(auth.timedOut)throw new Error('Pemeriksaan login Codex melewati batas waktu. Jalankan codex login status di terminal.');
    throw new Error('Codex CLI terpasang tetapi belum login. Jalankan codex login di terminal lalu coba lagi.');
   }
  }
  const safeWorkPrompt='Kerjakan hanya di folder proyek ini. Jangan git push, git merge, publish, mengganti branch, mengubah kredensial, atau mengakses data di luar proyek. Boleh membaca dan mengedit file di folder proyek menggunakan tool yang diizinkan. Buat perubahan sekecil yang diperlukan, jalankan test yang relevan bila tersedia, lalu jelaskan file yang diubah dan hasil test. Tugas: '+prompt;
  const args=id==='continue'?['-p',prompt,'--readonly']
   :id==='cody'?['chat','-m',prompt]
   :id==='github-copilot'&&mode==='work'?['-p',safeWorkPrompt,'-s','--available-tools=view,grep,glob,edit,create,apply_patch','--allow-tool=write','--disable-builtin-mcps','--no-ask-user','--no-auto-update','--disallow-temp-dir']
   :id==='github-copilot'?['-p',prompt,'-s','--available-tools=view,grep,glob','--disable-builtin-mcps','--no-ask-user','--no-auto-update','--disallow-temp-dir']
   :id==='codex'&&mode==='work'?['exec','--json','--sandbox','workspace-write','--ephemeral','--ignore-user-config',safeWorkPrompt]
   :id==='codex'?['exec','--json','--sandbox','read-only','--ephemeral','--ignore-user-config',prompt]
   :id==='cursor'&&mode==='work'?['-p',safeWorkPrompt,'--sandbox','enabled','--output-format','text']
   :id==='cursor'?['-p',prompt,'--mode=ask','--sandbox','enabled','--output-format','text']
   :id==='claude'&&mode==='work'?['-p',safeWorkPrompt,'--model','claude-fable-5','--permission-mode','dontAsk','--tools','Read,Glob,Grep,Edit,Write,Bash','--allowedTools','Read,Glob,Grep,Edit,Write,Bash(npm test:*),Bash(npm run verify:*)','--output-format','text','--no-session-persistence']
   :id==='claude'?['-p',prompt,'--model','claude-fable-5','--permission-mode','plan','--tools','Read,Glob,Grep','--output-format','text','--no-session-persistence']
   :['-p',prompt,'--mode=ask','--output-format','text'];
  const timeoutMs=agentTimeoutMs(mode);
  return await new Promise((resolve,reject)=>{
   const child=spawn(executable,args,{cwd,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NO_COLOR:'1'}});
   this.child=child;let stdout='',stderr='',settled=false;
   const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);if(this.child===child)this.child=null;error?reject(error):resolve(value);};
   const timer=setTimeout(()=>{child.kill();finish(new Error(agent.name+' belum selesai dalam '+Math.round(timeoutMs/1000)+' detik.'));},timeoutMs);
   child.stdout.on('data',data=>{
    stdout+=data;
    if(id==='github-copilot'&&looksLikeCopilotTrustPrompt(stdout)){
     child.kill();
     finish(new Error('GitHub Copilot meminta konfirmasi trust folder. Buka terminal di folder proyek, jalankan copilot sekali, trust folder tersebut, lalu jalankan lagi dari HumanALE god egine.'));
     return;
    }
    if(stdout.length>400000){child.kill();finish(new Error('Output agent terlalu besar.'));}
   });
   child.stderr.on('data',data=>{
    stderr=(stderr+data).slice(-16000);
    if(id==='github-copilot'&&looksLikeCopilotTrustPrompt(stderr)){
     child.kill();
     finish(new Error('GitHub Copilot meminta konfirmasi trust folder. Buka terminal di folder proyek, jalankan copilot sekali, trust folder tersebut, lalu jalankan lagi dari HumanALE god egine.'));
    }
   });
   child.on('error',()=>finish(new Error(agent.name+' tidak dapat dijalankan.')));
   child.on('close',code=>{
    if(id==='codex'){
     const parsed=parseCodexJsonOutput(stdout);
     const combined=(stderr+'\n'+stdout).trim();
     if(/not logged in|login required|authentication|unauthorized/i.test(combined))return finish(new Error('Login Codex tidak aktif. Jalankan codex login lalu coba lagi.'));
     if(code===0&&!parsed.failure)return finish(null,{id,name:agent.name,mode,text:parsed.text||'Codex selesai tanpa pesan teks.'});
     return finish(new Error((stderr||parsed.text||'Codex gagal dijalankan.').trim()));
    }
    return code===0?finish(null,{id,name:agent.name,mode,text:stdout.trim()||'Agent selesai tanpa output teks.'}):finish(new Error((stderr||stdout||agent.name+' gagal dijalankan.').trim()));
   });
  });
 }
 async runStructured(prompt,mode){
  if(mode==='work'&&!await this.projectRootReady())throw new Error('Folder proyek belum dipilih atau bukan checkout Git.');
  const available=await this.availableStructuredExecutors();
  if(!available.length)throw new Error('HumanALE Orchestrator memerlukan minimal satu executor lokal yang siap: Codex, GitHub Copilot, Cursor, atau Claude Code.');
  const difficulty=classifyTaskDifficulty(prompt);
  const planner=available.includes('codex')?'codex':available[0];
  const worker=available.includes('github-copilot')?'github-copilot':available[0];
  const reviewer=available.includes('codex')?'codex':available.at(-1);
  const planPrompt='Kamu adalah Planner HumanALE. Analisis tugas berikut secara read-only. Pecah menjadi langkah berurutan, dependensi, file/area yang mungkin terdampak, risiko, dan kriteria selesai. Jangan edit file. Jangan menjalankan publish/push/merge. Tugas: '+prompt;
  const plan=await this.runDirect(planner,planPrompt,'analyze');
  const workPrompt='Kamu adalah Worker HumanALE. Ikuti rencana Planner berikut dan fokus menyelesaikan tugas pengguna. Jika mode ini read-only, berikan implementasi/rencana konkret tanpa edit. Jika mode kerja, edit hanya yang perlu, jalankan test relevan, dan jangan push/merge/publish. TASK:\n'+prompt+'\n\nPLAN:\n'+plan.text;
  const work=await this.runDirect(worker,workPrompt,mode);
  const reviewPrompt='Kamu adalah Reviewer HumanALE. Periksa tugas, rencana, dan hasil Worker. Dalam mode read-only, inspeksi proyek bila tersedia tetapi jangan edit. Fokus pada correctness, regression, security, test coverage, dan apakah permintaan benar-benar selesai. Akhiri tepat dengan salah satu baris: VERDICT: PASS atau VERDICT: NEEDS_FIX.\n\nTASK:\n'+prompt+'\n\nPLAN:\n'+plan.text+'\n\nWORKER RESULT:\n'+work.text;
  let review=await this.runDirect(reviewer,reviewPrompt,'analyze'),repair=null;
  if(mode==='work'&&reviewVerdict(review.text)==='needs_fix'){
   const repairPrompt='Kamu adalah Repair Worker HumanALE. Perbaiki hanya masalah konkret yang disebut Reviewer, tetap di folder proyek, tanpa push/merge/publish atau perubahan kredensial. Jalankan test relevan. TASK:\n'+prompt+'\n\nREVIEW:\n'+review.text;
   repair=await this.runDirect(worker,repairPrompt,'work');
   const finalPrompt='Kamu adalah Final Reviewer HumanALE. Periksa ulang tugas setelah repair. Jangan edit. Akhiri tepat dengan VERDICT: PASS atau VERDICT: NEEDS_FIX.\n\nTASK:\n'+prompt+'\n\nREPAIR RESULT:\n'+repair.text;
   review=await this.runDirect(reviewer,finalPrompt,'analyze');
  }
  const stages=[
   {role:'planner',agent:planner,text:plan.text},
   {role:'worker',agent:worker,text:work.text},
   ...(repair?[{role:'repair',agent:worker,text:repair.text}]:[]),
   {role:'reviewer',agent:reviewer,text:review.text}
  ];
  const summary=[
   'HumanALE Orchestrator · '+difficulty.toUpperCase()+' · '+mode.toUpperCase(),
   'Planner: '+planner+' · Worker: '+worker+' · Reviewer: '+reviewer,
   '',
   '[PLAN]',
   plan.text,
   '',
   '[WORK]',
   work.text,
   ...(repair?['','[REPAIR]',repair.text]:[]),
   '',
   '[REVIEW]',
   review.text
  ].join('\n');
  return {id:'humanale-orchestrator',name:'HumanALE Orchestrator',mode,difficulty,stages,text:summary};
 }
 async run(value){
  if(this.pending)throw new Error('Tunggu agent sebelumnya selesai.');
  const id=String(value?.id||''),prompt=String(value?.prompt||'').trim(),mode=value?.mode==='work'?'work':'analyze';
  if(!prompt||prompt.length>4000)throw new Error('Prompt agent harus berisi 1–4000 karakter.');
  this.pending=true;
  try{
   if(id==='humanale-orchestrator')return await this.runStructured(prompt,mode);
   return await this.runDirect(id,prompt,mode);
  }finally{this.pending=false;}
 }
 stop(){this.child?.kill();}
}
