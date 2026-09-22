import {validateChat} from './bridge.mjs';
import {humanaleSystemPrompt} from './humanale-brain.mjs';

const baseURL='https://api.askcodi.com/v1';

function apiKey(){return (process.env.ASKCODI_API_KEY||'').trim();}
function model(){return (process.env.ASKCODI_MODEL||'').trim();}

export function parseAskCodiResponse(data){
 const content=data?.choices?.[0]?.message?.content;
 if(typeof content==='string')return content.trim();
 if(Array.isArray(content))return content.filter(x=>x&&typeof x.text==='string').map(x=>x.text).join('\n').trim();
 return '';
}

export class AskCodiBridge{
 constructor(fetchImpl=globalThis.fetch){this.fetch=fetchImpl;this.pending=false;this.controller=null;}
 async status(){return {configured:Boolean(apiKey()&&model()),mode:'askcodi-api',model:model()||null};}
 async ask(value){
  const data=validateChat(value);
  if(data.image)throw new Error('Foto belum diaktifkan untuk AskCodi. Pilih ChatGPT atau Gemini untuk menjelaskan foto.');
  const key=apiKey(),selectedModel=model();
  if(!key)throw new Error('ASKCODI_API_KEY belum diatur. Tambahkan environment variable lalu buka ulang HumanALE God Engine.');
  if(!selectedModel)throw new Error('ASKCODI_MODEL belum diatur. Isi model AskCodi yang tersedia untuk workspace kamu.');
  if(this.pending)throw new Error('Tunggu balasan AskCodi sebelumnya selesai.');
  this.pending=true;this.controller=new AbortController();
  const timeout=setTimeout(()=>this.controller?.abort(),90000);
  try{
   const messages=[
    {role:'system',content:humanaleSystemPrompt(data.message,'Jangan mengklaim dapat mengendalikan komputer atau membaca data pribadi.')},
    ...data.history.map(item=>({role:item.role,content:item.content})),
    {role:'user',content:data.message}
   ];
   const response=await this.fetch(baseURL+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:selectedModel,messages}),signal:this.controller.signal});
   let payload={};try{payload=await response.json();}catch{}
   if(!response.ok){
    if(response.status===401||response.status===403)throw new Error('Kunci AskCodi ditolak. Periksa ASKCODI_API_KEY.');
    if(response.status===429)throw new Error('Batas penggunaan AskCodi tercapai. Coba lagi nanti atau periksa kuota workspace.');
    throw new Error(payload?.error?.message||'AskCodi belum dapat dihubungi.');
   }
   const text=parseAskCodiResponse(payload);
   if(!text)throw new Error('AskCodi tidak memberikan balasan teks.');
   return {text,provider:'askcodi',model:selectedModel};
  }catch(error){
   if(error?.name==='AbortError')throw new Error('AskCodi belum merespons dalam 90 detik. Coba lagi.');
   throw error;
  }finally{clearTimeout(timeout);this.controller=null;this.pending=false;}
 }
 stop(){this.controller?.abort();}
}
