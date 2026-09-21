import {spawn} from 'node:child_process';
import {access} from 'node:fs/promises';

const agents=[
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
 {id:'openai-api',name:'OpenAI API',method:'Dudidam runtime API provider',runtime:true,configEnvs:['OPENAI_API_KEY'],url:'https://developers.openai.com/api/'},
 {id:'visual-copilot',name:'Visual Copilot',method:'Design-to-code external',external:true,url:'https://www.builder.io/c/docs/visual-copilot'},
 {id:'qodo',name:'Qodo',method:'IDE / review agent',commands:['qodo'],envPath:'QODO_CLI_PATH',url:'https://docs.qodo.ai/'},
 {id:'blackbox',name:'Blackbox AI',method:'IDE / external agent',external:true,url:'https://www.blackbox.ai/'},
 {id:'claude',name:'Claude / Claude Code',method:'CLI + Dudidam runtime API',commands:['claude'],envPath:'CLAUDE_CLI_PATH',runtime:true,configEnvs:['ANTHROPIC_API_KEY'],url:'https://docs.anthropic.com/en/docs/claude-code/overview'},
 {id:'microsoft-copilot',name:'Microsoft Copilot',method:'External / IDE',external:true,url:'https://learn.microsoft.com/en-us/copilot/'},
 {id:'deepseek-coder',name:'DeepSeek Coder',method:'Dudidam runtime API provider',runtime:true,configEnvs:['DEEPSEEK_API_KEY'],url:'https://api-docs.deepseek.com/'},
 {id:'devin',name:'Devin AI',method:'Cloud software agent',external:true,url:'https://docs.devin.ai/'},
 {id:'codegeex',name:'CodeGeeX',method:'IDE coding assistant',external:true,url:'https://codegeex.cn/'},
 {id:'starcoder',name:'StarCoder',method:'Model / self-hosted endpoint',external:true,url:'https://huggingface.co/bigcode'},
 {id:'tabbyml',name:'TabbyML',method:'Self-hosted coding assistant',commands:['tabby'],envPath:'TABBY_CLI_PATH',url:'https://tabby.tabbyml.com/docs/'},
 {id:'grok',name:'Grok / xAI',method:'Dudidam runtime API provider',runtime:true,configEnvs:['XAI_API_KEY'],url:'https://docs.x.ai/'},
 {id:'gemini',name:'Gemini / Google AI',method:'Dudidam runtime API + CLI',runtime:true,commands:['gemini'],envPath:'GEMINI_CLI_PATH',configEnvs:['GEMINI_API_KEY','GOOGLE_API_KEY'],url:'https://github.com/google-gemini/gemini-cli'}
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
 for(const command of agent.commands||[]){const found=await locateCommand(command);if(found)return found;}
 return null;
}

export function isCodexLoggedIn(text=''){
 return /logged in/i.test(String(text));
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
 const raw=Number(env.DUDIDAM_AGENT_TIMEOUT_MS);
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
function looksLikeCopilotTrustPrompt(text=''){
 const value=String(text).replace(/\s+/g,' ').toLowerCase();
 return value.includes('trust the files in')||
  value.includes('trust this folder')||
  value.includes('trust this directory')||
  value.includes('confirm that you trust');
}
export class DeveloperAgentHub{
 constructor(){this.child=null;this.pending=false;}
 async status(){
  const projectRoot=(process.env.DUDIDAM_PROJECT_ROOT||process.cwd()).trim();
  const rows=await Promise.all(agents.map(async agent=>{
   const executable=await locate(agent);
   const configNames=[agent.configEnv,...(agent.configEnvs||[])].filter(Boolean);
   const configured=configNames.length?Boolean(configNames.some(name=>(process.env[name]||'').trim())&&(!agent.secondaryEnv||(process.env[agent.secondaryEnv]||'').trim())):false;
   const codexAuth=agent.id==='codex'&&executable?await codexLoginStatus(executable,projectRoot):null;
   let state='available',detail='';
   if(agent.external){state='external';detail='Terdaftar di Agent Hub sebagai konektor eksternal; Dudidam tidak menjalankannya langsung.';}
   else if(agent.runtime){state=configured?'configured':executable?'installed':'setup';detail=configured?'Kredensial provider runtime terdeteksi dari environment.':executable?'CLI lokal terdeteksi; provider runtime masih memerlukan kredensial environment.':'Provider tersedia di Dudidam tetapi belum dikonfigurasi di environment.';}
   else if(agent.id==='replit'){state='mcp-client';detail='Replit Agent menerima remote MCP dari halaman Integrations.';}
   else if(agent.id==='pieces'){state=configured?'configured':executable?'installed':'setup';detail=configured?'PIECES_MCP_URL terdeteksi.':executable?'PiecesOS terdeteksi; salin URL MCP ke PIECES_MCP_URL bila ingin dipakai lintas agent.':'Install PiecesOS lalu ambil URL MCP lokal.';}
   else if(agent.id==='askcodi'){state=configured?'configured':'setup';detail=configured?'AskCodi API siap dipakai dari provider Dudidam.':'Atur ASKCODI_API_KEY dan ASKCODI_MODEL.';}
   else if(agent.id==='codex'&&executable){state=codexAuth?.ready?'configured':'installed';detail=codexAuth?.ready?'Codex CLI terdeteksi dan login aktif.':'Codex CLI terdeteksi tetapi belum login. Jalankan codex login lalu coba lagi.';}
   else if(executable){state='installed';detail='CLI/aplikasi lokal terdeteksi.';}
   else{state='setup';detail=agent.method.includes('MCP')?'Belum terdeteksi lokal; integrasi MCP tetap didukung oleh produknya.':'Belum dikonfigurasi.';}
   return {id:agent.id,name:agent.name,method:agent.method,state,detail,canRun:Boolean(agent.canRun&&executable&&(agent.id!=='codex'||codexAuth?.ready)),url:agent.url,executable:executable?true:false};
  }));
  return {projectRoot,agents:rows};
 }
 async run(value){
  if(this.pending)throw new Error('Tunggu agent sebelumnya selesai.');
  const id=String(value?.id||''),prompt=String(value?.prompt||'').trim(),mode=value?.mode==='work'?'work':'analyze';
  if(!prompt||prompt.length>4000)throw new Error('Prompt agent harus berisi 1–4000 karakter.');
  const agent=agents.find(item=>item.id===id&&item.canRun);
  if(!agent)throw new Error('Agent ini belum mendukung pemanggilan langsung dari Dudidam.');
  if(mode==='work'&&!['github-copilot','codex'].includes(id))throw new Error('Mode Kerja hanya tersedia untuk GitHub Copilot atau OpenAI Codex.');
  const executable=await locate(agent);
  if(!executable)throw new Error(agent.name+' belum ditemukan di PATH atau environment path khusus.');
  const cwd=(process.env.DUDIDAM_PROJECT_ROOT||process.cwd()).trim();
  if(id==='codex'){
   const auth=await codexLoginStatus(executable,cwd);
   if(!auth.ready){
    if(auth.timedOut)throw new Error('Pemeriksaan login Codex melewati batas waktu. Jalankan codex login status di terminal.');
    throw new Error('Codex CLI terpasang tetapi belum login. Jalankan codex login di terminal lalu coba lagi.');
   }
  }
  const safeWorkPrompt='Kerjakan hanya di folder proyek ini. Jangan git push, publish, mengubah kredensial, atau mengakses data di luar proyek. Buat perubahan sekecil yang diperlukan dan jelaskan file yang diubah. Tugas: '+prompt;
  const args=id==='continue'?['-p',prompt,'--readonly']
   :id==='cody'?['chat','-m',prompt]
   :id==='github-copilot'&&mode==='work'?['-p',safeWorkPrompt,'-s','--available-tools=view,grep,glob,edit,create,apply_patch','--allow-tool=write','--disable-builtin-mcps','--no-ask-user','--no-auto-update','--disallow-temp-dir']
   :id==='github-copilot'?['-p',prompt,'-s','--available-tools=view,grep,glob','--disable-builtin-mcps','--no-ask-user','--no-auto-update','--disallow-temp-dir']
   :id==='codex'&&mode==='work'?['exec','--json','--sandbox','workspace-write','--ephemeral','--ignore-user-config',safeWorkPrompt]
   :id==='codex'?['exec','--json','--sandbox','read-only','--ephemeral','--ignore-user-config',prompt]
   :['-p',prompt,'--mode=ask','--output-format','text'];
  const timeoutMs=agentTimeoutMs(mode);
  this.pending=true;
  try{
   return await new Promise((resolve,reject)=>{
    const child=spawn(executable,args,{cwd,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NO_COLOR:'1'}});
    this.child=child;let stdout='',stderr='',settled=false;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);if(this.child===child)this.child=null;error?reject(error):resolve(value);};
    const timer=setTimeout(()=>{child.kill();finish(new Error(agent.name+' belum selesai dalam '+Math.round(timeoutMs/1000)+' detik.'));},timeoutMs);
    child.stdout.on('data',data=>{
     stdout+=data;
     if(id==='github-copilot'&&looksLikeCopilotTrustPrompt(stdout)){
      child.kill();
      finish(new Error('GitHub Copilot meminta konfirmasi trust folder. Buka terminal di folder proyek, jalankan copilot sekali, trust folder tersebut, lalu jalankan lagi dari Dudidam.'));
      return;
     }
     if(stdout.length>400000){child.kill();finish(new Error('Output agent terlalu besar.'));}
    });
    child.stderr.on('data',data=>{
     stderr=(stderr+data).slice(-16000);
     if(id==='github-copilot'&&looksLikeCopilotTrustPrompt(stderr)){
      child.kill();
      finish(new Error('GitHub Copilot meminta konfirmasi trust folder. Buka terminal di folder proyek, jalankan copilot sekali, trust folder tersebut, lalu jalankan lagi dari Dudidam.'));
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
  }finally{this.pending=false;}
 }
 stop(){this.child?.kill();}
}
