import {spawn} from 'node:child_process';
import {access,mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir,homedir} from 'node:os';
const modelName='id_ID-news_tts-medium.onnx';
const modelFolder=join(process.env.LOCALAPPDATA||homedir(),'Dudidam','voice-models','piper','id','id_ID','news_tts','medium');

async function pythonPath(){
 const candidates=[process.env.DUDIDAM_PYTHON_PATH,join(homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','python','python.exe')].filter(Boolean);
 for(const candidate of candidates){try{await access(candidate);return candidate;}catch{}}
 return process.platform==='win32'?'python.exe':'python3';
}
function run(executable,args,timeout=90000,input=''){
 return new Promise((resolve,reject)=>{
  const child=spawn(executable,args,{windowsHide:true,stdio:['pipe','pipe','pipe']});let stderr='',done=false;
  const finish=(error,code)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve({code,stderr});};
  const timer=setTimeout(()=>{child.kill();finish(new Error('Layanan suara Indonesia belum merespons.'));},timeout);
  child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-1000);});
  child.on('error',()=>finish(new Error('Runtime suara Indonesia tidak ditemukan.')));
  child.on('close',code=>finish(null,code));
  child.stdin.on('error',()=>{});child.stdin.end(input);
 });
}
export class IndonesianTts{
 constructor(){this.pending=false;}
 async status(){try{await access(join(modelFolder,modelName));await access(join(modelFolder,modelName+'.json'));const result=await run(await pythonPath(),['-c','import piper'],10000);return {configured:result.code===0,mode:'local-indonesian'};}catch{return {configured:false,mode:'local-indonesian'};}}
 async synthesize(value){
  const text=String(value?.text||'').trim();
  if(!text||text.length>2000)throw new Error('Teks suara harus berisi 1–2000 karakter.');
  if(this.pending)throw new Error('Suara sebelumnya masih dibuat.');
  this.pending=true;let folder;
  try{
   folder=await mkdtemp(join(tmpdir(),'dudidam-suara-'));
   const output=join(folder,'speech.wav');
   const result=await run(await pythonPath(),[join(import.meta.dirname,'speak_id.py'),join(modelFolder,modelName),output],120000,text);
   if(result.code!==0)throw new Error('Suara Indonesia lokal gagal. '+result.stderr.slice(-200));
   const audio=await readFile(output);
   if(!audio.length||audio.length>15000000)throw new Error('Hasil suara kosong atau terlalu besar.');
   return {audio:audio.toString('base64'),mime:'audio/wav'};
  }finally{this.pending=false;if(folder)await rm(folder,{recursive:true,force:true});}
 }
 stop(){}
}
