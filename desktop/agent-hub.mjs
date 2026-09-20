import {spawn} from 'node:child_process';
import {access} from 'node:fs/promises';

const agents=[
 {id:'continue',name:'Continue',method:'CLI + MCP',commands:['cn'],envPath:'CONTINUE_CLI_PATH',canRun:true,url:'https://docs.continue.dev/cli/quickstart'},
 {id:'cody',name:'Sourcegraph Cody',method:'CLI + Sourcegraph MCP',commands:['cody'],envPath:'CODY_CLI_PATH',canRun:true,url:'https://sourcegraph.com/docs/cody/clients/install-cli'},
 {id:'pieces',name:'Pieces for Developers',method:'PiecesOS MCP',commands:['pieces-os','pieces'],envPath:'PIECES_CLI_PATH',configEnv:'PIECES_MCP_URL',url:'https://docs.pieces.app/'},
 {id:'askcodi',name:'AskCodi',method:'API Gateway',configEnv:'ASKCODI_API_KEY',secondaryEnv:'ASKCODI_MODEL',url:'https://www.askcodi.com/gateway'},
 {id:'phind',name:'Phind',method:'External',url:'https://www.phind.com/'},
 {id:'amazonq',name:'Amazon Q Developer',method:'CLI + MCP',commands:['qchat','q'],envPath:'AMAZON_Q_CLI_PATH',url:'https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/qdev-mcp.html'},
 {id:'windsurf',name:'Windsurf / Codeium',method:'IDE + MCP',commands:['windsurf'],envPath:'WINDSURF_CLI_PATH',url:'https://docs.windsurf.com/'},
 {id:'tabnine',name:'Tabnine',method:'IDE + MCP',commands:['tabnine','TabNine'],envPath:'TABNINE_CLI_PATH',url:'https://docs.tabnine.com/'},
 {id:'replit',name:'Replit AI / Agent',method:'Cloud Agent + MCP',url:'https://docs.replit.com/references/mcp/overview'},
 {id:'cursor',name:'Cursor',method:'CLI + MCP',commands:['agent','cursor-agent'],envPath:'CURSOR_AGENT_PATH',canRun:true,url:'https://prod.cursor.com/docs/cli/overview'}
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
export function agentDefinitions(){return agents.map(({commands,envPath,...agent})=>({...agent}));}
export class DeveloperAgentHub{
 constructor(){this.child=null;this.pending=false;}
 async status(){
  const projectRoot=(process.env.DUDIDAM_PROJECT_ROOT||process.cwd()).trim();
  const rows=await Promise.all(agents.map(async agent=>{
   const executable=await locate(agent);
   const configured=agent.configEnv?Boolean((process.env[agent.configEnv]||'').trim()&&(!agent.secondaryEnv||(process.env[agent.secondaryEnv]||'').trim())):false;
   let state='available',detail='';
   if(agent.id==='phind'){state='external';detail='Belum ada API/MCP publik resmi yang dipakai Dudidam; dibuka sebagai layanan eksternal.';}
   else if(agent.id==='replit'){state='mcp-client';detail='Replit Agent menerima remote MCP dari halaman Integrations.';}
   else if(agent.id==='pieces'){state=configured?'configured':executable?'installed':'setup';detail=configured?'PIECES_MCP_URL terdeteksi.':executable?'PiecesOS terdeteksi; salin URL MCP ke PIECES_MCP_URL bila ingin dipakai lintas agent.':'Install PiecesOS lalu ambil URL MCP lokal.';}
   else if(agent.id==='askcodi'){state=configured?'configured':'setup';detail=configured?'AskCodi API siap dipakai dari provider Dudidam.':'Atur ASKCODI_API_KEY dan ASKCODI_MODEL.';}
   else if(executable){state='installed';detail='CLI/aplikasi lokal terdeteksi.';}
   else{state='setup';detail=agent.method.includes('MCP')?'Belum terdeteksi lokal; integrasi MCP tetap didukung oleh produknya.':'Belum dikonfigurasi.';}
   return {id:agent.id,name:agent.name,method:agent.method,state,detail,canRun:Boolean(agent.canRun&&executable),url:agent.url,executable:executable?true:false};
  }));
  return {projectRoot,agents:rows};
 }
 async run(value){
  if(this.pending)throw new Error('Tunggu agent sebelumnya selesai.');
  const id=String(value?.id||''),prompt=String(value?.prompt||'').trim();
  if(!prompt||prompt.length>4000)throw new Error('Prompt agent harus berisi 1–4000 karakter.');
  const agent=agents.find(item=>item.id===id&&item.canRun);
  if(!agent)throw new Error('Agent ini belum mendukung pemanggilan langsung dari Dudidam.');
  const executable=await locate(agent);
  if(!executable)throw new Error(agent.name+' belum ditemukan di PATH atau environment path khusus.');
  const args=id==='continue'?['-p',prompt,'--readonly']:id==='cody'?['chat','-m',prompt]:['-p',prompt,'--mode=ask','--output-format','text'];
  const cwd=(process.env.DUDIDAM_PROJECT_ROOT||process.cwd()).trim();
  this.pending=true;
  try{
   return await new Promise((resolve,reject)=>{
    const child=spawn(executable,args,{cwd,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NO_COLOR:'1'}});
    this.child=child;let stdout='',stderr='',settled=false;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);if(this.child===child)this.child=null;error?reject(error):resolve(value);};
    const timer=setTimeout(()=>{child.kill();finish(new Error(agent.name+' belum selesai dalam 120 detik.'));},120000);
    child.stdout.on('data',data=>{stdout+=data;if(stdout.length>400000){child.kill();finish(new Error('Output agent terlalu besar.'));}});
    child.stderr.on('data',data=>{stderr=(stderr+data).slice(-16000);});
    child.on('error',()=>finish(new Error(agent.name+' tidak dapat dijalankan.')));
    child.on('close',code=>code===0?finish(null,{id,name:agent.name,text:stdout.trim()||'Agent selesai tanpa output teks.'}):finish(new Error((stderr||stdout||agent.name+' gagal dijalankan.').trim())));
   });
  }finally{this.pending=false;}
 }
 stop(){this.child?.kill();}
}
