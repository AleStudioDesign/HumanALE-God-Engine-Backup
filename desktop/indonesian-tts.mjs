import {spawn} from 'node:child_process';
import {access,mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir,homedir} from 'node:os';
const modelName='id_ID-news_tts-medium.onnx';
const appDataRoot=process.env.LOCALAPPDATA||homedir();
const primaryModelFolder=join(appDataRoot,'HumanALE God Engine','voice-models','piper','id','id_ID','news_tts','medium');
const legacyModelFolder=join(appDataRoot,'Dudidam','voice-models','piper','id','id_ID','news_tts','medium');

async function modelFolder(){
 for(const folder of [primaryModelFolder,legacyModelFolder]){
  try{await access(join(folder,modelName));await access(join(folder,modelName+'.json'));return folder;}catch{}
 }
 return primaryModelFolder;
}

async function pythonPath(){
 const candidates=[process.env.HUMANALE_PYTHON_PATH,process.env.DUDIDAM_PYTHON_PATH,join(homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','python','python.exe')].filter(Boolean);
 for(const candidate of candidates){try{await access(candidate);return candidate;}catch{}}
 return process.platform==='win32'?'python.exe':'python3';
}
function run(executable,args,timeout=90000,input='',children){
 return new Promise((resolve,reject)=>{
  const child=spawn(executable,args,{windowsHide:true,stdio:['pipe','pipe','pipe']});children?.add(child);let stderr='',done=false;
  const finish=(error,code)=>{if(done)return;done=true;clearTimeout(timer);children?.delete(child);error?reject(error):resolve({code,stderr});};
  const timer=setTimeout(()=>{child.kill();finish(new Error('Layanan suara Indonesia belum merespons.'));},timeout);
  child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-1000);});
  child.on('error',()=>finish(new Error('Runtime suara Indonesia tidak ditemukan.')));
  child.on('close',code=>finish(null,code));
  child.stdin.on('error',()=>{});child.stdin.end(input);
 });
}
export class IndonesianTts{
 constructor(){this.pending=false;this.children=new Set();}
 async status(){try{const folder=await modelFolder();await access(join(folder,modelName));await access(join(folder,modelName+'.json'));const result=await run(await pythonPath(),['-c','import piper'],10000,'',this.children);return {configured:result.code===0,mode:'local-indonesian'};}catch{return {configured:false,mode:'local-indonesian'};}}
 async synthesize(value){
  const text=String(value?.text||'').trim();
  if(!text||text.length>2000)throw new Error('Teks suara harus berisi 1–2000 karakter.');
  const style=value?.style==='natural'?'natural':'baby-robot';
  if(this.pending)throw new Error('Suara sebelumnya masih dibuat.');
  this.pending=true;let folder;
  try{
   folder=await mkdtemp(join(tmpdir(),'humanale-suara-'));
   const output=join(folder,'speech.wav');
   const voiceFolder=await modelFolder();
   const result=await run(await pythonPath(),[join(import.meta.dirname,'speak_id.py'),join(voiceFolder,modelName),output,style],120000,text,this.children);
   if(result.code!==0)throw new Error('Suara Indonesia lokal gagal. '+result.stderr.slice(-200));
   const audio=await readFile(output);
   if(!audio.length||audio.length>15000000)throw new Error('Hasil suara kosong atau terlalu besar.');
   return {audio:audio.toString('base64'),mime:'audio/wav'};
  }finally{this.pending=false;if(folder)await rm(folder,{recursive:true,force:true});}
 }
 stop(){for(const child of this.children){try{child.kill();}catch{}}this.children.clear();}
}
