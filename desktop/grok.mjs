import {validateChat} from './bridge.mjs';

const endpoint='https://api.x.ai/v1/responses';
const defaultModel='grok-4.6';

function apiKey(){return (process.env.XAI_API_KEY||'').trim();}
function model(){return (process.env.XAI_MODEL||defaultModel).trim()||defaultModel;}

export function parseGrokResponse(data){
 if(typeof data?.output_text==='string'&&data.output_text.trim())return data.output_text.trim();
 const parts=[];
 for(const item of Array.isArray(data?.output)?data.output:[]){
  for(const content of Array.isArray(item?.content)?item.content:[]){
   if((content?.type==='output_text'||content?.type==='text')&&typeof content.text==='string')parts.push(content.text);
  }
 }
 return parts.join('\n').trim();
}

export class GrokBridge{
 constructor(fetchImpl=globalThis.fetch){this.fetch=fetchImpl;this.pending=false;this.controller=null;}
 async status(){return {configured:Boolean(apiKey()),mode:'xai-api',model:model()};}
 async ask(value){
  const data=validateChat(value);
  if(data.image)throw new Error('Foto belum diaktifkan untuk Grok. Pilih ChatGPT untuk menjelaskan foto.');
  const key=apiKey();
  if(!key)throw new Error('XAI_API_KEY belum diatur. Tambahkan environment variable lalu buka ulang Dudidam.');
  if(this.pending)throw new Error('Tunggu balasan Grok sebelumnya selesai.');
  this.pending=true;this.controller=new AbortController();
  const timeout=setTimeout(()=>this.controller?.abort(),90000);
  try{
   const prompt='Kamu Dudidam, asisten percakapan berbahasa Indonesia dalam avatar manusia biner. Jawab ramah dan ringkas, maksimal 3 paragraf kecuali pengguna meminta detail. Jangan mengklaim dapat mengendalikan komputer, membaca data pribadi, atau melihat kamera langsung. Percakapan sebelumnya dan pesan saat ini diberikan sebagai JSON berikut:\n'+JSON.stringify({history:data.history,message:data.message});
   const response=await this.fetch(endpoint,{method:'POST',headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:model(),input:prompt}),signal:this.controller.signal});
   let body={};try{body=await response.json();}catch{}
   if(!response.ok){
    if(response.status===401||response.status===403)throw new Error('Kunci xAI ditolak. Periksa XAI_API_KEY.');
    if(response.status===429)throw new Error('Batas penggunaan Grok tercapai. Coba lagi nanti atau periksa kredit xAI.');
    throw new Error(body?.error?.message||'Grok belum dapat dihubungi.');
   }
   const text=parseGrokResponse(body);
   if(!text)throw new Error('Grok tidak memberikan balasan teks.');
   return {text,provider:'grok',model:model()};
  }catch(error){
   if(error?.name==='AbortError')throw new Error('Grok belum merespons dalam 90 detik. Coba lagi.');
   throw error;
  }finally{clearTimeout(timeout);this.controller=null;this.pending=false;}
 }
 stop(){this.controller?.abort();}
}
