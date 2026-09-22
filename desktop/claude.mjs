import {validateChat} from './bridge.mjs';
import {dudidamSystemPrompt} from './dudidam-brain.mjs';

const endpoint='https://api.anthropic.com/v1/messages';
const defaultModel='claude-fable-5';

function apiKey(){return (process.env.ANTHROPIC_API_KEY||'').trim();}
function model(){return (process.env.ANTHROPIC_MODEL||defaultModel).trim()||defaultModel;}

export function parseClaudeResponse(data){
 return (Array.isArray(data?.content)?data.content:[]).filter(x=>x?.type==='text'&&typeof x.text==='string').map(x=>x.text).join('\n').trim();
}

export class ClaudeBridge{
 constructor(fetchImpl=globalThis.fetch){this.fetch=fetchImpl;this.pending=false;this.controller=null;}
 async status(){return {configured:Boolean(apiKey()),mode:'anthropic-api',model:model()};}
 async ask(value){
  const data=validateChat(value);
  if(data.image)throw new Error('Foto belum diaktifkan untuk Claude di Dudidam. Pilih OpenAI API, ChatGPT, atau Gemini untuk menjelaskan foto.');
  const key=apiKey();
  if(!key)throw new Error('ANTHROPIC_API_KEY belum diatur. Tambahkan environment variable lalu buka ulang Dudidam.');
  if(this.pending)throw new Error('Tunggu balasan Claude sebelumnya selesai.');
  this.pending=true;this.controller=new AbortController();
  const timeout=setTimeout(()=>this.controller?.abort(),90000);
  try{
   const messages=[...data.history.map(item=>({role:item.role,content:item.content})),{role:'user',content:data.message}];
   const system=dudidamSystemPrompt(data.message,'Jangan mengklaim dapat mengendalikan komputer atau membaca data pribadi.');
   const response=await this.fetch(endpoint,{method:'POST',headers:{'x-api-key':key,'anthropic-version':'2023-06-01','Content-Type':'application/json'},body:JSON.stringify({model:model(),max_tokens:1200,system,messages}),signal:this.controller.signal});
   let payload={};try{payload=await response.json();}catch{}
   if(!response.ok){
    if(response.status===401||response.status===403)throw new Error('Kunci Anthropic ditolak. Periksa ANTHROPIC_API_KEY.');
    if(response.status===429)throw new Error('Batas penggunaan Claude API tercapai. Coba lagi nanti atau periksa kuota Anthropic.');
    throw new Error(payload?.error?.message||'Claude API belum dapat dihubungi.');
   }
   const text=parseClaudeResponse(payload);
   if(!text)throw new Error('Claude tidak memberikan balasan teks.');
   return {text,provider:'claude',model:model()};
  }catch(error){
   if(error?.name==='AbortError')throw new Error('Claude belum merespons dalam 90 detik. Coba lagi.');
   throw error;
  }finally{clearTimeout(timeout);this.controller=null;this.pending=false;}
 }
 stop(){this.controller?.abort();}
}
