import './neural/face-rig.js';
import './neural/neural-core.js';
import './neural/renderer.js';

const runtime=typeof window==='undefined'?globalThis:window;
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const COLORS={green:'emerald',cyan:'cyan',violet:'violet',gold:'amber',black:'black',spectrum:'adaptive'};
const MODES={mixed:'hybrid',matrix:'binary',statistics:'binary',abstract:'cubes',neural:'neural'};

// Keep the existing Dudidam conversation, audio, panel, gestures and drag API.
// The reference image supplies a particle distribution, never a flat bitmap layer.
export class BinaryAvatar {
 constructor(canvas){
  this.canvas=canvas;
  this.pointer={x:0,y:0};this.pointerActive=false;
  this.gazePointer={x:0,y:0};this.gazeActive=false;
  this.track=true;this.animate=true;this.color='green';this.mode='mixed';
  this.persona='chatgpt';this.emotion='neutral';this.speaking=false;
  this.listening=false;this.thinking=false;this.evolving=false;this.paused=false;
  this.state='idle';this.speechTarget=0;this.audioLevel=0;
  this.earSpectrum={low:0,mid:0,high:0};
  this.action='';this.actionStart=0;this.transitionKind='';
  this.awakeningStart=0;this.awakeningDuration=0;this.allEffects=false;
  this.engine=new runtime.NeuralAvatar(canvas,{
   popup:Boolean(runtime.dudidamDesktop)||new URLSearchParams(location.search).get('popup')==='1',
   referenceSrc:new URL('./neural/assets/reference-face.png',import.meta.url).href,
   bindPointer:false
  });
  this.referencePromise=this.engine.referencePromise;
  const update=this.engine.update.bind(this.engine);
  this.engine.update=(time,dt)=>{
   this.syncRenderer(time);
   update(time,dt);
  };
  this.engine.onRender=(ctx,time)=>{this.drawEarFrequencyWaves(ctx,time);this.drawStatisticalCode(ctx,time);};
  this.abort=new AbortController();
  canvas.addEventListener('wheel',event=>{
   event.preventDefault();this.setZoom(this.engine.zoomTarget*Math.exp(-clamp(event.deltaY,-120,120)*.0018));
  },{passive:false,signal:this.abort.signal});
  this.engine.onZoom=value=>this.onZoom?.(value);
 }
 syncRenderer(time){
  const engine=this.engine;
  const color=COLORS[this.color]||'emerald';
  if(engine.accent!==color)engine.setAccent(color);
  const material=MODES[this.mode]||'hybrid';
  if(engine.material!==material)engine.setMaterial(material);
  const emotion=['neutral','happy','angry','annoyed','sad','thinking','surprised'].includes(this.emotion)?this.emotion:'neutral';
  if(engine.emotionName!==emotion)engine.setEmotion(emotion);
  engine.animate=this.animate;engine.flow=this.animate;
  engine.flowEnergy=this.evolving?1.7:this.thinking||this.state==='processing'?1.4:this.listening?1.15:1;
  const idleCycle=this.animate&&!engine.reducedMotion?Math.max(0,Math.sin(time*.00027-1))**4:0;
  const ambientEvolution=this.animate?0.08+idleCycle*0.42:0;
  engine.evolutionTarget=this.evolving?1:this.evolutionCompleteUntil>time?0.58:ambientEvolution;
  engine.earSpectrum=this.earSpectrum;
  engine.externalSpeech=this.speaking?Math.max(this.speechTarget,this.audioLevel):0;
  const pointer=this.pointerActive?this.pointer:this.gazePointer;
  engine.setPointer(pointer.x,pointer.y,this.track&&(this.pointerActive||this.gazeActive),this.pointerActive&&!this.dragging);
  engine.gestureYaw=0;engine.gesturePitch=0;
  const age=(time-this.actionStart)/1000;
  if(age>=0&&age<1.5){
   const fade=Math.sin(Math.PI*age/1.5);
   if(this.action==='nod')engine.gesturePitch=Math.sin(age*Math.PI*3)*.075*fade;
   if(this.action==='shake')engine.gestureYaw=Math.sin(age*Math.PI*4)*.11*fade;
  }
 }
 resize(){this.engine.resize();}
 setZoom(value){this.engine.setZoom(value);}
 setSpeechEnergy(value=.62){this.speechTarget=clamp(value);}
 setAudioLevel(value=0){this.audioLevel=clamp(value);this.setSpeechEnergy(value);}
 setTalking(value=false){this.speaking=Boolean(value);}
 setListening(value=false){this.listening=Boolean(value);}
 setEarSpectrum(value={}){for(const band of ['low','mid','high'])this.earSpectrum[band]=clamp(value[band]);}
 setEmotion(value='neutral'){this.emotion=['neutral','happy','angry','annoyed','sad','thinking','surprised'].includes(value)?value:value==='focused'?'thinking':value==='curious'?'surprised':'neutral';}
 setState(value='idle'){if(['idle','listening','thinking','speaking','processing','error'].includes(value))this.state=value;}
 setTheme(value='auto'){if(!runtime.dudidamDesktop)this.setEnvironment(value);}
 setEnvironment(value='auto'){
  this.engine.setEnvironment(['auto','light','dark'].includes(value)?value:'auto');
  runtime.dudidamDesktop?.setAvatarEnvironment?.(this.engine.environment);
 }
 setBackdrop(grid){
  if(!grid||grid.values?.length!==grid.columns*grid.rows)return;
  const rect=this.canvas.getBoundingClientRect();
  const values=[];
  for(let row=0;row<grid.rows;row++)for(let col=0;col<grid.columns;col++){
   const x=clamp(Math.floor((rect.left+(col+.5)/grid.columns*rect.width)/innerWidth*grid.columns),0,grid.columns-1);
   const y=clamp(Math.floor((rect.top+(row+.5)/grid.rows*rect.height)/innerHeight*grid.rows),0,grid.rows-1);
   values.push(grid.values[y*grid.columns+x]);
  }
  this.engine.setBackdrop({...grid,values});
 }
 setPaused(value=false){this.paused=Boolean(value);this.engine.setPaused(this.paused);}
 setEvolving(value=false){this.evolving=Boolean(value);if(this.evolving)this.evolutionStarted=performance.now();}
 completeEvolution(){this.evolving=false;this.evolutionCompleteUntil=performance.now()+2200;this.pulse();}
 activateAllEffects(value=true){this.allEffects=Boolean(value);if(value){this.mode='mixed';this.animate=true;this.track=true;}}
 trigger(action){
  this.action=action;this.actionStart=performance.now();
  if(action==='blink')this.engine.blinkStart=this.actionStart;
 }
 reveal(){this.transitionKind='assemble';this.awakeningStart=performance.now();this.awakeningDuration=1300;return this.engine.setVisible(true,{initial:true,duration:1300});}
 awaken(duration=4200){
  this.activateAllEffects(true);this.transitionKind='assemble';this.awakeningStart=performance.now();
  this.awakeningDuration=Math.max(700,Number(duration)||4200);
  return this.engine.setVisible(true,{initial:true,duration:this.awakeningDuration});
 }
 dismiss(duration=3000){
  this.transitionKind='disassemble';this.awakeningStart=performance.now();
  this.awakeningDuration=Math.max(700,Number(duration)||3000);
  return this.engine.setVisible(false,{duration:this.awakeningDuration});
 }
 isAwakening(now=performance.now()){return Boolean(this.transitionKind)&&now-this.awakeningStart<this.awakeningDuration;}
 transitionState(now=performance.now()){
  const raw=clamp((now-this.awakeningStart)/Math.max(1,this.awakeningDuration));
  return {active:raw<1,kind:this.transitionKind,raw,presence:this.engine.presence};
 }
 pulse(){this.engine.presence=Math.min(this.engine.presence,.90);this.engine.setVisible(true,{duration:900});}
 triggerGlitch(){this.engine.presence=.78;this.engine.setVisible(true,{duration:1100});}
 drawStatisticalCode(c,time){
  if(this.mode!=='statistics')return;
  const e=this.engine,shell=1-runtime.FaceRig.smooth(1.3,2.65,e.zoom);
  c.font='7px "Cascadia Mono", monospace';
  for(let i=0;i<16;i++){
   const phase=((this.animate?time*.000021:0)+i/16)%1;
   const p=e.project((i%2?1:-1)*(.44+(i%3)*.035),.55-phase*.95,.1,time,true);
   const colors=e.glyphCache[e.lightAt(p.x,p.y)?'light':'dark'].colors;
   c.fillStyle=colors[12];c.globalAlpha=.30*e.presence*shell*Math.sin(phase*Math.PI);
   c.fillText((.5+Math.sin(i*2.39+time*.00013)*.5).toFixed(2),p.x,p.y);
  }
  c.globalAlpha=1;
 }
 drawEarFrequencyWaves(c,time){
  const bands=this.earSpectrum;
  if(!this.listening&&Math.max(bands.low,bands.mid,bands.high)<.025)return;
  const engine=this.engine,glyphs=engine.glyphCache;
  const shell=1-runtime.FaceRig.smooth(1.3,2.65,engine.zoom);
  if(!glyphs||shell<.01)return;
  for(const side of [-1,1])for(let band=0;band<3;band++)for(let i=0;i<13;i++){
   const energy=bands[['low','mid','high'][band]]||.025;
   const phase=i/12,spread=(time*.00015+phase)%1;
   const p=engine.project(side*(.405+spread*.07),-.01+(band-1)*.034+Math.sin(phase*Math.PI*2)*.01,.14,time,true);
   const glyph=glyphs[engine.lightAt(p.x,p.y)?'light':'dark'];
   const size=4+energy*3;
   c.globalAlpha=(1-spread)*(.10+energy*.38)*engine.presence*shell;
   c.drawImage(glyph.atlas,12*24,(i%2)*32,24,32,p.x-size*.375,p.y-size/2,size*.75,size);
  }
  c.globalAlpha=1;
 }
 destroy(){this.abort.abort();this.engine.destroy();}
 get ready(){return this.engine.referenceReady;}
}
