import {spawn} from 'node:child_process';
import {access,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir,homedir} from 'node:os';

async function pythonPath(){
 const candidates=[process.env.HUMANALE_PYTHON_PATH,process.env.DUDIDAM_PYTHON_PATH,join(homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','python','python.exe')].filter(Boolean);
 for(const candidate of candidates){try{await access(candidate);return candidate;}catch{}}
 return process.platform==='win32'?'python.exe':'python3';
}

function run(executable,args,{timeout=120000,children}={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(executable,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});
  children?.add(child);
  let stdout='',stderr='',done=false;
  const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);children?.delete(child);error?reject(error):resolve(result);};
  const timer=setTimeout(()=>{child.kill();finish(new Error('Dikte Indonesia melewati batas waktu.'));},timeout);
  child.stdout.on('data',chunk=>{stdout+=chunk;if(stdout.length>100000){child.kill();finish(new Error('Hasil dikte terlalu besar.'));}});
  child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-5000);});
  child.on('error',()=>finish(new Error('Python untuk dikte lokal tidak ditemukan.')));
  child.on('close',code=>finish(null,{code,stdout,stderr}));
 });
}

export class IndonesianStt{
 constructor(){this.pending=false;this.children=new Set();}
 async status(){
  try{const result=await run(await pythonPath(),['-c','import faster_whisper; print("ready")'],{timeout:12000,children:this.children});return {configured:result.code===0,mode:'local-whisper',language:'id-ID'};}
  catch{return {configured:false,mode:'local-whisper',language:'id-ID'};}
 }
 async transcribe(value){
  if(this.pending)throw new Error('Dikte sebelumnya masih diproses.');
  if(typeof value?.audio!=='string'||value.audio.length>3500000||!/^data:audio\/(?:webm|ogg|mp4)(?:;codecs=[a-z0-9._-]+)?;base64,[A-Za-z0-9+/=]+$/i.test(value.audio))throw new Error('Rekaman suara tidak valid atau terlalu besar.');
  this.pending=true;let folder;
  try{
   folder=await mkdtemp(join(tmpdir(),'dudidam-dikte-'));
   const ext=value.audio.startsWith('data:audio/ogg')?'ogg':value.audio.startsWith('data:audio/mp4')?'mp4':'webm';
   const audioPath=join(folder,'voice.'+ext);
   await writeFile(audioPath,Buffer.from(value.audio.split(',')[1],'base64'));
   const result=await run(await pythonPath(),[join(import.meta.dirname,'transcribe_id.py'),audioPath],{timeout:120000,children:this.children});
   if(result.code!==0)throw new Error('Dikte Indonesia lokal gagal. '+result.stderr.slice(-300));
   const data=JSON.parse(result.stdout);
   if(!data.text)throw new Error('Ucapan belum dikenali. Coba bicara lebih dekat ke mikrofon.');
   return {text:data.text,language:data.language};
  }finally{this.pending=false;if(folder)await rm(folder,{recursive:true,force:true});}
 }
 stop(){for(const child of this.children){try{child.kill();}catch{}}this.children.clear();}
}
