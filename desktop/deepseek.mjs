import {validateChat} from './bridge.mjs';
import {humanaleSystemPrompt} from './humanale-brain.mjs';

const endpoint='https://api.deepseek.com/responses';
const defaultModel='deepseek-flash';

function apiKey(){return (process.env.DEEPSEEK_API_KEY||'').trim();}
function model(){return (process.env.DEEPSEEK_MODEL||defaultModel).trim()||defaultModel;}

export function parseDeepSeekResponse(data){
 if(typeof data?.output_text==='string'&&data.output_text.trim())return data.output_text.trim();
 const parts=[];
 for(const item of Array.isArray(data?.output)?data.output:[]){
  for(const content of Array.isArray(item?.content)?item.content:[]){
   if((content?.type==='output_text'||content?.type==='text')&&typeof content.text==='string')parts.push(content.text);
  }
 }
 return parts.join('\n').trim();
}

export class DeepSeekBridge{
 constructor(fetchImpl=globalThis.fetch){this.fetch=fetchImpl;this.pending=false;this.controller=null;}
 async status(){return {configured:Boolean(apiKey()),mode:'deepseek-api',model:model()};}
 async ask(value){
  const data=validateChat(value);
  if(data.image)throw new Error('Foto belum diaktifkan untuk DeepSeek di HumanALE god egine. Pilih OpenAI API, ChatGPT, atau Gemini untuk menjelaskan foto.');
  const key=apiKey();
  if(!key)throw new Error('DEEPSEEK_API_KEY belum diatur. Tambahkan environment variable lalu buka ulang HumanALE god egine.');
  if(this.pending)throw new Error('Tunggu balasan DeepSeek sebelumnya selesai.');
  this.pending=true;this.controller=new AbortController();
  const timeout=setTimeout(()=>this.controller?.abort(),90000);
  try{
   const instructions=humanaleSystemPrompt(data.message,'Jangan mengklaim dapat mengendalikan komputer atau membaca data pribadi.');
   const input='Percakapan sebelumnya dan pesan saat ini:\n'+JSON.stringify({history:data.history,message:data.message});
   const response=await this.fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:model(),instructions,input}),signal:this.controller.signal});
   let payload={};try{payload=await response.json();}catch{}
   if(!response.ok){
    if(response.status===401||response.status===403)throw new Error('Kunci DeepSeek ditolak. Periksa DEEPSEEK_API_KEY.');
    if(response.status===429)throw new Error('Batas penggunaan DeepSeek tercapai. Coba lagi nanti atau periksa saldo/kuota API.');
    throw new Error(payload?.error?.message||'DeepSeek API belum dapat dihubungi.');
   }
   const text=parseDeepSeekResponse(payload);
   if(!text)throw new Error('DeepSeek tidak memberikan balasan teks.');
   return {text,provider:'deepseek',model:model()};
  }catch(error){
   if(error?.name==='AbortError')throw new Error('DeepSeek belum merespons dalam 90 detik. Coba lagi.');
   throw error;
  }finally{clearTimeout(timeout);this.controller=null;this.pending=false;}
 }
 stop(){this.controller?.abort();}
}
