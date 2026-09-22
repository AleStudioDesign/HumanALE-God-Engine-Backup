import * as pty from 'node-pty';
import {access,readFile} from 'node:fs/promises';
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

function locateCommand(command){
 return new Promise(resolvePromise=>{
  const finder=process.platform==='win32'?'where.exe':'which';
  const child=spawn(finder,[command],{windowsHide:true,stdio:['ignore','pipe','ignore']});
  let out='';child.stdout.on('data',chunk=>out+=chunk);
  child.on('error',()=>resolvePromise(null));
  child.on('close',code=>resolvePromise(code===0?out.split(/\r?\n/).map(x=>x.trim()).find(Boolean)||null:null));
 });
}
async function exists(path){try{await access(path);return true;}catch{return false;}}
async function readHubConfig(){
 const path=join(homedir(),'.dudiddam','cli-hub.json');
 try{const parsed=JSON.parse(await readFile(path,'utf8'));return parsed&&typeof parsed==='object'?parsed:{};}catch{return {};}
}
function cleanTitle(value,fallback){const text=String(value||fallback).replace(/[\r\n\t]/g,' ').trim().slice(0,80);return text||fallback;}
function cleanSize(value,fallback,min,max){const n=Math.round(Number(value));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}

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
 async resolveCwd(cwd){
  const target=cwd?resolve(String(cwd)):this.workspace;
  if(!isAbsolute(target)||!await exists(target))throw new Error('Folder kerja terminal tidak ditemukan.');
  return target;
 }
 async create(options={}){
  const shell=await this.resolveShell(options.shell||'auto');
  const cwd=await this.resolveCwd(options.cwd);
  const cols=cleanSize(options.cols,120,20,400),rows=cleanSize(options.rows,30,5,200);
  const id='term-'+Date.now().toString(36)+'-'+(++this.sequence).toString(36);
  let terminal;
  try{terminal=pty.spawn(shell.executable,[],{name:'xterm-256color',cols,rows,cwd,env:{...process.env,TERM:'xterm-256color'}});}
  catch(error){if((options.shell||'auto')!=='auto')return this.create({...options,shell:'auto'});throw new Error('Terminal PTY tidak dapat dibuat: '+error.message);}
  const session={id,shell:shell.id,shellLabel:shell.label,cwd,pid:terminal.pid,title:cleanTitle(options.title,shell.label),status:'running',terminal,recent:''};
  this.sessions.set(id,session);
  terminal.onData(data=>{session.recent=(session.recent+String(data)).slice(-60000);this.onData(id,String(data));});
  terminal.onExit(({exitCode,signal})=>{session.status='stopped';session.exitCode=Number.isInteger(exitCode)?exitCode:null;session.signal=signal??null;this.sessions.delete(id);this.onExit(id,session.exitCode);});
  if(options.startupCommand){const cmd=String(options.startupCommand).replace(/[\r\n]/g,'').trim();if(cmd)terminal.write(cmd+'\r');}
  return this.publicSession(session);
 }
 publicSession(session){return {id:session.id,shell:session.shell,shellLabel:session.shellLabel,cwd:session.cwd,pid:session.pid,title:session.title,status:session.status,exitCode:session.exitCode??null};}
 list(){return [...this.sessions.values()].map(session=>this.publicSession(session));}
 write(id,data){const session=this.sessions.get(String(id));if(!session)throw new Error('Sesi terminal tidak ditemukan.');const value=String(data??'');if(value.length>32000)throw new Error('Input terminal terlalu besar.');session.terminal.write(value);return {ok:true};}
 resize(id,cols,rows){const session=this.sessions.get(String(id));if(!session)throw new Error('Sesi terminal tidak ditemukan.');session.terminal.resize(cleanSize(cols,120,20,400),cleanSize(rows,30,5,200));return {ok:true};}
 kill(id){const session=this.sessions.get(String(id));if(!session)return {ok:true};try{session.terminal.kill();}finally{this.sessions.delete(String(id));}return {ok:true};}
 async restart(id){const session=this.sessions.get(String(id));if(!session)throw new Error('Sesi terminal tidak ditemukan.');const options={shell:session.shell,cwd:session.cwd,title:session.title};this.kill(id);return this.create(options);}
 clear(id){const session=this.sessions.get(String(id));if(!session)throw new Error('Sesi terminal tidak ditemukan.');session.terminal.write('\x1bc');return {ok:true};}
 setCwd(id,cwd){
  const session=this.sessions.get(String(id));if(!session)throw new Error('Sesi terminal tidak ditemukan.');
  const value=String(cwd||'').replace(/[\r\n"]/g,'').trim();if(!value)throw new Error('Folder kerja tidak valid.');
  const command=session.shell==='cmd'?'cd /d "'+value+'"':'Set-Location -LiteralPath "'+value+'"';
  session.terminal.write(command+'\r');session.cwd=resolve(value);return {ok:true};
 }
 getRecentOutput(id,limit=12000){const session=this.sessions.get(String(id));if(!session)return '';return redactSecrets(session.recent.slice(-Math.max(500,Math.min(30000,Number(limit)||12000))));}
 async detect(){
  const hub=await readHubConfig(),providers=hub?.providers&&typeof hub.providers==='object'?hub.providers:{},registry={};
  for(const [id,defaultCommand] of Object.entries(CLI_DEFAULTS)){
   const configured=providers[id];
   if(configured&&configured.enabled===false){registry[id]={id,command:configured.command||defaultCommand,state:'DISABLED',path:null};continue;}
   const command=String(configured?.command||defaultCommand).trim(),found=command?await locateCommand(command):null;
   registry[id]={id,command,state:found?'READY':'NOT INSTALLED',path:found||null};
  }
  const shells={};
  for(const id of Object.keys(SHELLS)){let found=null;for(const command of SHELLS[id].commands){found=await locateCommand(command);if(found)break;}shells[id]={id,label:SHELLS[id].label,state:found?'READY':'NOT FOUND',path:found};}
  return {workspace:this.workspace,shells,registry};
 }
 killAll(){for(const id of [...this.sessions.keys()])this.kill(id);}
}
