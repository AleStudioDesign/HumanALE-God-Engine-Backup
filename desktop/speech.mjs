import {spawn} from 'node:child_process';

const WINDOWS_SPEECH_SCRIPT=`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$text = [Console]::In.ReadToEnd()
$speaker = [System.Speech.Synthesis.SpeechSynthesizer]::new()
try {
  $voice = $speaker.GetInstalledVoices() |
    Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -eq 'id-ID' } |
    Select-Object -First 1
  if ($voice) { $speaker.SelectVoice($voice.VoiceInfo.Name) }
  $speaker.Rate = 0
  $speaker.Volume = 100
  $speaker.Speak($text)
} finally {
  $speaker.Dispose()
}
`;

const encodedScript=Buffer.from(WINDOWS_SPEECH_SCRIPT,'utf16le').toString('base64');

export function prepareSpeechText(value){
 if(typeof value!=='string')throw new TypeError('Teks suara tidak valid.');
 const text=value.trim();
 if(!text)throw new TypeError('Teks suara kosong.');
 if(text.length>12000)throw new RangeError('Teks suara terlalu panjang.');
 return text
  .replace(/```[\s\S]*?```/g,' Blok kode. ')
  .replace(/\[([^\]]+)\]\([^\s)]+\)/g,'$1')
  .replace(/https?:\/\/\S+/g,' tautan ')
  .replace(/(^|\n)\s{0,3}(?:#{1,6}|[-*+] |\d+[.)] )/g,'$1')
  .replace(/[*_`>|]/g,' ')
  .replace(/\s+/g,' ')
  .trim();
}

export class WindowsSpeech {
 constructor({spawnProcess=spawn}={}){this.spawnProcess=spawnProcess;this.child=null;}
 stop(){const child=this.child;this.child=null;if(child&&!child.killed)child.kill();}
 async speak(value){
  const text=prepareSpeechText(value);this.stop();
  return await new Promise((resolve,reject)=>{
   const child=this.spawnProcess('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',encodedScript],{windowsHide:true,stdio:['pipe','ignore','pipe']});
   this.child=child;let stderr='',settled=false,stopped=false;
   const finish=(error,result)=>{if(settled)return;settled=true;if(this.child===child)this.child=null;error?reject(error):resolve(result);};
   const originalKill=child.kill.bind(child);child.kill=(...args)=>{stopped=true;return originalKill(...args);};
   child.stderr.on('data',data=>{stderr=(stderr+data).slice(-4000);});
   child.on('error',()=>finish(new Error('Mesin suara Windows tidak dapat dijalankan.')));
   child.on('close',code=>{if(stopped)return finish(null,{spoken:false,stopped:true});if(code===0)return finish(null,{spoken:true});finish(new Error(stderr.trim()||'Mesin suara Windows gagal membacakan balasan.'));});
   child.stdin.on('error',()=>{});child.stdin.end(text);
  });
 }
}
