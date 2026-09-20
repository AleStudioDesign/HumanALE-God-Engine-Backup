export function normalizedAudioLevel(samples){
 if(!samples?.length)return 0;
 let sum=0;
 for(const sample of samples){const value=(sample-128)/128;sum+=value*value;}
 const rms=Math.sqrt(sum/samples.length);
 return Math.max(0,Math.min(1,(rms-.012)*5.8));
}

export class AudioReactor{
 constructor(onEnergy){this.onEnergy=onEnergy;this.frame=0;this.stream=null;this.source=null;this.element=null;this.elementSource=null;this.level=0;}
 async context(){const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)throw new Error('Analisis audio tidak didukung perangkat ini.');this.audioContext??=new AudioContext();if(this.audioContext.state==='suspended')await this.audioContext.resume();return this.audioContext;}
 async useStream(stream){
  this.stop();
  const context=await this.context();
  this.stream=stream;
  this.source=context.createMediaStreamSource(stream);
  this.connect(context,false);
  for(const track of stream.getAudioTracks())track.addEventListener('ended',()=>this.stop(),{once:true});
 }
 async useElement(element){
  this.stop();
  const context=await this.context();
  this.element=element;
  this.elementSource??=context.createMediaElementSource(element);
  this.source=this.elementSource;
  this.connect(context,true);
 }
 connect(context,monitor){
  this.analyser=context.createAnalyser();
  this.analyser.fftSize=512;
  this.analyser.smoothingTimeConstant=.72;
  this.samples=new Uint8Array(this.analyser.fftSize);
  this.source.connect(this.analyser);
  if(monitor)this.analyser.connect(context.destination);
  const pulse=()=>{this.analyser.getByteTimeDomainData(this.samples);const next=normalizedAudioLevel(this.samples);this.level+=((next>.018?next:0)-this.level)*.32;this.onEnergy(this.level);this.frame=requestAnimationFrame(pulse);};
  pulse();
 }
 stop(){
  cancelAnimationFrame(this.frame);
  this.frame=0;
  try{this.source?.disconnect();}catch{}
  try{this.analyser?.disconnect();}catch{}
  this.stream?.getTracks().forEach(track=>track.stop());
  this.stream=null;this.source=null;this.analyser=null;this.level=0;
  this.onEnergy(0);
 }
}
