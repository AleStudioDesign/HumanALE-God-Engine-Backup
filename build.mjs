import {mkdir,copyFile,cp,writeFile,readFile} from 'node:fs/promises';
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});await cp('public','dist/client',{recursive:true});await copyFile('worker.mjs','dist/server/index.js');
try{const hosting=JSON.parse(await readFile('.openai/hosting.json','utf8'));delete hosting.static;await writeFile('dist/.openai/hosting.json',JSON.stringify(hosting,null,2));}catch(error){if(error.code!=='ENOENT')throw error;}
await writeFile('dist/server/wrangler.json',JSON.stringify({name:'dudidam-binary-assistant',main:'index.js',compatibility_date:'2026-09-01',no_bundle:true,assets:{directory:'../client',binding:'ASSETS',run_worker_first:['/api/*']},observability:{enabled:true}},null,2));
console.log('Built dist/client and dist/server.');
