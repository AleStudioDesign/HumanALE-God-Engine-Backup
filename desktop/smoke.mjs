import {ChatGPTBridge} from './bridge.mjs';
const bridge=new ChatGPTBridge();console.log(await bridge.status());
const result=await bridge.ask({message:'Jawab satu kalimat bahasa Indonesia: apakah 17 ditambah 25 sama dengan 42?'});console.log(result);
