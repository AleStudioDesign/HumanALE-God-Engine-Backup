import * as pty from 'node-pty';
import {readFile,stat} from 'node:fs/promises';
import {homedir} from 'node:os';
import {isAbsolute,join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {redactSecrets} from './terminal-policy.mjs';

const SHELLS={
 pwsh:{label:'PowerShell 7',commands:['pwsh.exe','pwsh']},
 powershell:{label:'Windows PowerShell',commands:['powershell.exe','powershell']},
 cmd:{label:'Command Prompt',commands:['cmd.exe','cmd']}
};
const CLI_DEFAULTS={claude:'claude',codex:'codex',cursor:'agent',gemini:'gemini',git:'git',gh:'gh',node:'node',npm:'npm',npx:'npx',python:'python',pip:'pip'};
const CLI_LABELS={claude:'Claude Code',codex:'OpenAI Codex',cursor:'Cursor',gemini:'Gemini CLI',git:'Git',gh:'GitHub CLI',node:'Node.js',npm:'npm',npx:'npx',python:'Python',pip:'pip'};

function locateCommand(command){
 return new Promise(resolvePromise=>{
  const finder=process.platform==='win32'?'where.exe':'which';
  const child=spawn(finder,[command],{windowsHide:true,stdio:['ignore','pipe','ignore']});
  let out='';child.stdout.on('data',chunk=>out+=chunk);
  child.on('error',()=>resolvePromise(null));
  child.on('close',code=>resolvePromise(code===0?out.split(/\r?\n/).map(x=>x.trim()).find(Boolean)||null:null));
 });
}
async function isDirectory(path){try{return (await stat(path)).isDirectory();}catch{return false;}}
async function readHubConfig(){
 const candidates=[join(homedir(),'.humanale','cli-hub.json'),join(homedir(),'.dudiddam','cli-hub.json')];
 for(const path of candidates){
  try{const parsed=JSON.parse(await readFile(path,'utf8'));if(parsed&&typeof parsed==='object')return parsed;}catch{}
 }
 return {};
}
function cleanTitle(value,fallback){const text=String(value||fallback).replace(/[\r\n\t]/g,' ').trim().slice(0,80);return text||fallback;}
function cleanSize(value,fallback,min,max){const n=Math.round(Number(value));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function executableLine(shell,executable){
 const value=String(executable||'');
 if(shell==='cmd')return '"'+value.replace(/"/g,'')+'"';
 return "& '"+value.replace(/'/g,"''")+"'";
}
function powershellLiteral(value){return "'"+String(value).replace(/'/g,"''")+"'";}

export class TerminalManager{
 constructor({workspace=process.cwd(),onData=()=>{},onExit=()=>{}}={}){
  this.workspace=resolve(workspace||process.cwd());this.onData=onData;this.onExit=onExit;this.sessions=new Map();this.sequence=0;
 }
 setWorkspace(value){if(value)this.workspace=resolve(String(value));}
 async resolveShell(shell='auto'){
  const order=shell==='auto'?['pwsh','powershell','cmd']:[shell];
  for(const id of order){
   const def=SHELLS[id];if(!def)continue;
   for(const command of def.commands){const found=await locateCommand(command);if(found)return {id,label:def.label,executable:found};}
  }
  if(shell!=='auto')return this.resolveShell('auto');
  throw new Error('No supported Windows shell detected.');
 }
 async resolveProfile(profile){
  const id=String(profile||'').trim().toLowerCase();
  if(!Object.hasOwn(CLI_DEFAULTS,id))throw new Error('Profil CLI terminal tidak dikenali.');
  const hub=await readHubConfig(),providers=hub?.providers&&typeof hub.providers==='object'?hub.providers:{},configured=providers[id];
  if(configured?.enabled===false)throw new Error((CLI_LABELS[id]||id)+' dinonaktifkan di CLI Hub.');
  const command=String(configured?.command||CLI_DEFAULTS[id]).trim();
  const executable=command?await locateCommand(command):null;
  if(!executable)throw new Error((CLI_LABELS[id]||id)+' belum terpasang atau tidak ditemukan di PATH.');
  return {id,label:CLI_LABELS[id]||id,executable};
 }
 async resolveCwd(cwd){
  const target=cwd?resolve(String(cwd)):this.workspace;
  if(!isAbsolute(target)||!await isDirectory(target))throw new Error('Folder kerja terminal tidak ditemukan.');
  return target;
 }
 async create(options={}){
  const shell=await this.resolveShell(options.shell||'auto');
  const profile=options.profile?await this.resolveProfile(options.profile):null;
  const cwd=await this.resolveCwd(options.cwd);
  const cols=cleanSize(options.cols,120,20,400),rows=cleanSize(options.rows,30,5,200);
  const id='term-'+Date.now().toString(36)+'-'+(++this.sequence).toString(36);
  let terminal;
  try{terminal=pty.spawn(shell.executable,[],{name:'xterm-256color',cols,rows,cwd,env:{...process.env,TERM:'xterm-256color'}});}
  catch(error){if((options.shell||'auto')!=='auto')return this.create({...options,shell:'auto'});throw new Error('Terminal PTY tidak dapat dibuat: '+error.message);}
  const session={id,shell:shell.id,shellLabel:shell.label,cwd,pid:terminal.pid,title:cleanTitle(options.title,profile?.label||shell.label),profile:profile?.id||null,status:'running',terminal,recent:''};
  this.sessions.set(id,session);
  terminal.onData(data=>{session.recent=(session.recent+String(data)).slice(-60000);this.onData(id,String(data));});
  terminal.onExit(({exitCode,signal})=>{session.status='stopped';session.exitCode=Number.isInteger(exitCode)?exitCode:null;session.signal=signal??null;this.onExit(id,session.exitCode);});
  if(profile)terminal.write(executableLine(shell.id,profile.executable)+'\r');
  return this.publicSession(session);
 }
 publicSession(session){return {id:session.id,shell:session.shell,shellLabel:session.shellLabel,cwd:session.cwd,pid:session.pid,title:session.title,profile:session.profile||null,status:session.status,exitCode:session.exitCode??null};}
 list(){return [...this.sessions.values()].map(session=>this.publicSession(session));}
 write(id,data){const session=this.sessions.get(String(id));if(!session)throw new Error('Sesi terminal tidak ditemukan.');if(session.status!=='running')throw new Error('Sesi terminal sudah berhenti. Gunakan Restart untuk menjalankannya kembali.');const value=String(data??'');if(value.length>32000)throw new Error('Input terminal terlalu besar.');session.terminal.write(value);return {ok:true};}
 resize(id,cols,rows){const session=this.sessions.get(String(id));if(!session)throw new Error('Sesi terminal tidak ditemukan.');if(session.status!=='running')return {ok:true,stopped:true};session.terminal.resize(cleanSize(cols,120,20,400),cleanSize(rows,30,5,200));return {ok:true};}
 kill(id){const key=String(id),session=this.sessions.get(key);if(!session)return {ok:true};try{if(session.status==='running')session.terminal.kill();}finally{this.sessions.delete(key);}return {ok:true};}
 async restart(id){const key=String(id),session=this.sessions.get(key);if(!session)throw new Error('Sesi terminal tidak ditemukan.');const options={shell:session.shell,cwd:session.cwd,title:session.title,profile:session.profile||undefined};this.kill(key);return this.create(options);}
 clear(id){const session=this.sessions.get(String(id));if(!session)throw new Error('Sesi terminal tidak ditemukan.');if(session.status==='running')session.terminal.write('\x1bc');session.recent='';return {ok:true};}
 async setCwd(id,cwd){
  const session=this.sessions.get(String(id));if(!session)throw new Error('Sesi terminal tidak ditemukan.');if(session.status!=='running')throw new Error('Sesi terminal sudah berhenti.');
  const raw=String(cwd||'').replace(/[\r\n]/g,'').trim();if(!raw)throw new Error('Folder kerja tidak valid.');
  const target=isAbsolute(raw)?resolve(raw):resolve(session.cwd,raw);
  if(!await isDirectory(target))throw new Error('Folder kerja terminal tidak ditemukan.');
  const command=session.shell==='cmd'?'cd /d "'+target.replace(/"/g,'')+'"':'Set-Location -LiteralPath '+powershellLiteral(target);
  session.terminal.write(command+'\r');session.cwd=target;return {ok:true,cwd:target};
 }
 getRecentOutput(id,limit=12000){const session=this.sessions.get(String(id));if(!session)return '';return redactSecrets(session.recent.slice(-Math.max(500,Math.min(30000,Number(limit)||12000))));}
 async detect(){
  const hub=await readHubConfig(),providers=hub?.providers&&typeof hub.providers==='object'?hub.providers:{},registry={};
  for(const [id,defaultCommand] of Object.entries(CLI_DEFAULTS)){
   const configured=providers[id];
   if(configured&&configured.enabled===false){registry[id]={id,label:CLI_LABELS[id]||id,command:configured.command||defaultCommand,state:'DISABLED',path:null};continue;}
   const command=String(configured?.command||defaultCommand).trim(),found=command?await locateCommand(command):null;
   registry[id]={id,label:CLI_LABELS[id]||id,command,state:found?'READY':'NOT INSTALLED',path:found||null};
  }
  const shells={};
  for(const id of Object.keys(SHELLS)){let found=null;for(const command of SHELLS[id].commands){found=await locateCommand(command);if(found)break;}shells[id]={id,label:SHELLS[id].label,state:found?'READY':'NOT FOUND',path:found};}
  return {workspace:this.workspace,shells,registry};
 }
 killAll(){for(const id of [...this.sessions.keys()])this.kill(id);}
}