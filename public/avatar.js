const TAU=Math.PI*2;
const PARTICLE_TIME_SCALE=.58;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function cubicPoint(a,b,c,d,t){
 const u=1-t;
 return u*u*u*a+3*u*u*t*b+3*u*t*t*c+t*t*t*d;
}

export class BinaryAvatar {
 constructor(canvas,referenceSrc='/reference.png'){
  this.canvas=canvas;
  this.ctx=canvas.getContext('2d');
  this.pointer={x:0,y:0};
  this.pointerActive=false;
  this.gazePointer={x:0,y:0};
  this.gazeActive=false;
  this.rotation={x:0,y:0};
  this.track=true;
  this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.environmentQuery=matchMedia('(prefers-color-scheme: light)');
  this.environment='auto';
  this.animate=true;
  this.color='green';
  this.persona='chatgpt';
  this.mode='mixed';
  this.allEffects=false;
  this.transitionKind='';
  this.awakeningStart=0;
  this.awakeningDuration=0;
  this.speaking=false;
  this.listening=false;
  this.earSpectrum={low:0,mid:0,high:0};
  this.emotion='neutral';
  this.evolving=false;
  this.evolutionStarted=0;
  this.evolutionCompleteUntil=0;
  this.paused=false;
  this.performanceModeUntil=0;
  this.lastFrameCost=0;
  this.thinking=false;
  this.speechEnergy=0;
  this.speechTarget=0;
  this.speechBeat=0;
  this.viseme=0;
  this.visemeTarget=0;
  this.action='';
  this.actionStart=0;
  this.blinkStart=-10000;
  this.nextBlink=performance.now()+3000;
  this.samples=[];
  this.last=0;
  this.neuralNodes=Array.from({length:42},(_,i)=>({angle:i*2.39996,orbit:.08+Math.random()*.2,lift:(Math.random()-.5)*.42,phase:Math.random()*TAU,speed:.18+Math.random()*.3,glyph:Math.random()>.5?'1':'0'}));
  this.dataFlows=Array.from({length:6},(_,i)=>({phase:i/6*TAU,tilt:(i%3-1)*.1,speed:.32+Math.random()*.28,glyph:i%2?'1':'0'}));
  this.rootStrands=Array.from({length:15},(_,i)=>({side:i%2?-1:1,spread:.22+(i%5)*.075,phase:i/15,speed:.11+(i%4)*.025,bend:(Math.random()-.5)*.18,targetY:-.1-(i%5)*.065,glyph:i%2?'1':'0'}));
  this.neckGlyphs=Array.from({length:96},(_,i)=>({x:(Math.random()-.5)*2,y:(i+Math.random())/96,phase:Math.random()*TAU,glyph:Math.random()>.5?'1':'0'}));
  new ResizeObserver(()=>this.resize()).observe(canvas);
  const img=new Image();
  img.onload=()=>{
   const sampleCanvas=document.createElement('canvas');
   sampleCanvas.width=110;sampleCanvas.height=142;
   const sampleContext=sampleCanvas.getContext('2d',{willReadFrequently:true});
   sampleContext.drawImage(img,120,0,322,393,0,0,110,142);
   const data=sampleContext.getImageData(0,0,110,142).data;
   for(let y=0;y<142;y+=2.05)for(let x=0;x<110;x+=1.85){
    const dx=(x-55)/55,dy=(y-69)/70;
    if(dx*dx+dy*dy>1)continue;
    const index=(Math.floor(y)*110+Math.floor(x))*4;
    const lum=(data[index]*.21+data[index+1]*.72+data[index+2]*.07)/255;
    if(lum>.035)this.samples.push({x:x/110-.5,y:y/142-.5,lum,seed:Math.random(),glyph:Math.random()>.5?'1':'0'});
   }
   this.ready=true;
  };
  img.src=referenceSrc;
  img.onerror=()=>document.dispatchEvent(new CustomEvent('avatar-error'));
  requestAnimationFrame(time=>this.frame(time));
 }

 resize(){
  const rect=this.canvas.getBoundingClientRect();
  this.w=rect.width;this.h=rect.height;
  const density=Math.min(devicePixelRatio||1,2);
  this.canvas.width=this.w*density;this.canvas.height=this.h*density;
  this.ctx.setTransform(density,0,0,density,0,0);
 }

 trigger(action){this.action=action;this.actionStart=performance.now();if(action==='blink')this.blinkStart=this.actionStart;}
 setSpeechEnergy(value=.62){this.speechTarget=clamp(value,0,1);this.speechBeat=performance.now();}
 setListening(value=false){this.listening=Boolean(value);}
 setEarSpectrum(value={}){for(const band of ['low','mid','high'])this.earSpectrum[band]=clamp(Number(value[band])||0,0,1);}
 setEmotion(value='neutral'){this.emotion=['neutral','happy','angry','annoyed','sad'].includes(value)?value:'neutral';}
 setPaused(value=false){this.paused=Boolean(value);}
 setEvolving(value=false){
  const next=Boolean(value);
  if(next&&!this.evolving)this.evolutionStarted=performance.now();
  this.evolving=next;
  if(next)this.evolutionCompleteUntil=0;
 }
 completeEvolution(){
  this.evolving=false;
  this.evolutionCompleteUntil=performance.now()+2200;
 }
 activateAllEffects(value=true){this.allEffects=Boolean(value);if(this.allEffects){this.mode='mixed';this.color='green';this.animate=true;this.track=true;}}
  reveal(){this.transitionKind='';this.awakeningStart=0;this.awakeningDuration=0;}
  awaken(duration=4200){this.activateAllEffects(true);this.transitionKind='assemble';this.awakeningStart=performance.now();this.awakeningDuration=Math.max(1800,Number(duration)||4200);}
  dismiss(duration=3000){this.transitionKind='disassemble';this.awakeningStart=performance.now();this.awakeningDuration=Math.max(1500,Number(duration)||3000);}
  isAwakening(now=performance.now()){return Boolean(this.transitionKind)&&this.awakeningDuration>0&&now-this.awakeningStart>=0&&now-this.awakeningStart<this.awakeningDuration;}
  transitionState(now=performance.now()){
   if(!this.transitionKind)return {active:false,kind:'',raw:1,presence:1};
   const raw=clamp((now-this.awakeningStart)/Math.max(1,this.awakeningDuration),0,1),active=raw<1;
   const eased=raw*raw*(3-2*raw);
   if(this.transitionKind==='assemble'){
    if(!active)this.transitionKind='';
    return {active,kind:'assemble',raw,presence:eased};
   }
   return {active,kind:'disassemble',raw,presence:1-eased};
  }
 setEnvironment(value='auto'){this.environment=['auto','light','dark'].includes(value)?value:'auto';}
 isLightEnvironment(){return this.environment==='light'||(this.environment==='auto'&&this.environmentQuery.matches);}

 adaptiveColors(hue,alpha,_lightEnvironment,saturation=92){
  const evolution=.5+.5*Math.sin(hue*Math.PI/96);
  return {
   edge:`hsla(${hue+10},${Math.max(72,saturation-10)}%,${8+evolution*9}%,${clamp(alpha*1.35+.015,0,1)})`,
   main:`hsla(${hue-8},${saturation}%,${79+evolution*15}%,${clamp(alpha*1.04,0,1)})`
  };
 }

 drawAdaptiveGlyph(context,text,x,y,hue,alpha,lightEnvironment,font,outline=true){
  if(alpha<=.01)return;
  if(font)context.font=font;
  const colors=this.adaptiveColors(hue,alpha,lightEnvironment);
  if(outline){context.lineWidth=.9;context.lineJoin='round';context.strokeStyle=colors.edge;context.strokeText(text,x,y);}
  context.fillStyle=colors.main;context.fillText(text,x,y);
 }

 drawBinarySampler(context,sampler,count,hue,alpha,lightEnvironment,size,seed=0){
  const steps=Math.max(2,Math.round(count));
  const fontSize=Math.max(5.8,size*.016);
  context.save();
  for(let i=0;i<=steps;i++){
   const t=i/steps,point=sampler(t);
   if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))continue;
   const pulse=.72+.28*Math.sin(seed*9.7+t*18.4);
   const fade=(.58+.42*Math.sin(Math.PI*t))*alpha*pulse;
   if(i%3===1){
    const colors=this.adaptiveColors(hue+i*3,fade*.9,lightEnvironment);
    context.beginPath();context.arc(point.x,point.y,Math.max(.55,size*.0017*(1+(i%4)*.16)),0,TAU);
    context.fillStyle=colors.main;context.fill();
   }else{
    context.font=`${fontSize+(i%4===0?1:0)}px monospace`;
    this.drawAdaptiveGlyph(context,(i+Math.round(seed*10))%2?'1':'0',point.x,point.y,hue+i*2.4,fade,lightEnvironment,undefined,false);
   }
  }
  context.restore();
 }

 drawBinaryCubic(context,p0,p1,p2,p3,count,hue,alpha,lightEnvironment,size,seed=0){
  this.drawBinarySampler(context,t=>({
   x:cubicPoint(p0.x,p1.x,p2.x,p3.x,t),
   y:cubicPoint(p0.y,p1.y,p2.y,p3.y,t)
  }),count,hue,alpha,lightEnvironment,size,seed);
 }

 drawBinaryQuadratic(context,p0,p1,p2,count,hue,alpha,lightEnvironment,size,seed=0){
  this.drawBinarySampler(context,t=>{
   const u=1-t;
   return {x:u*u*p0.x+2*u*t*p1.x+t*t*p2.x,y:u*u*p0.y+2*u*t*p1.y+t*t*p2.y};
  },count,hue,alpha,lightEnvironment,size,seed);
 }

 drawBinarySegment(context,p0,p1,count,hue,alpha,lightEnvironment,size,seed=0){
  this.drawBinarySampler(context,t=>({x:p0.x+(p1.x-p0.x)*t,y:p0.y+(p1.y-p0.y)*t}),count,hue,alpha,lightEnvironment,size,seed);
 }

  magneticOffset(x,y,size,clock,seed,strength=1){
  if(!this.track||!this.pointerActive||this.transitionKind)return {x,y,force:0};
  const pointerX=this.w/2+this.pointer.x*this.w/2,pointerY=this.h/2+this.pointer.y*this.h/2;
  const dx=pointerX-x,dy=pointerY-y,distance=Math.max(1,Math.hypot(dx,dy));
  const sigma=size*.24;
  const force=Math.exp(-(distance*distance)/(2*sigma*sigma));
  if(force<.008)return {x,y,force:0};
  const eased=force*force*strength;
  const drift=size*.018*eased;
  const phase=clock*.0014+seed*11.7;
  const flowX=Math.sin(phase+dy*.012)*drift;
  const flowY=Math.cos(phase*.83+dx*.011)*drift;
  const follow=size*.008*eased;
  return {x:x+flowX+dx/distance*follow,y:y+flowY+dy/distance*follow,force};
 }

 drawEvolutionField(context,size,cx,cy,fw,fh,hue,clock,lightEnvironment){
  const now=performance.now(),completing=!this.evolving&&now<this.evolutionCompleteUntil;
  if(!this.evolving&&!completing)return;
  const elapsed=this.evolving?Math.max(0,now-this.evolutionStarted):Math.max(0,2200-(this.evolutionCompleteUntil-now));
  const cycle=clock*.00042;
  const strength=this.evolving?1:clamp(1-(now-(this.evolutionCompleteUntil-2200))/2200,0,1);
  context.save();context.globalCompositeOperation='source-over';
  for(let lane=-1;lane<=1;lane++){
   const phase=(cycle+lane*.173)%1;
   const direction=lane%2?1:-1;
   const sampler=t=>{
    const p=(t+phase)%1,angle=(p*TAU*1.15)+lane*.72;
    const radius=fw*(.28+.13*Math.sin(p*Math.PI));
    const vertical=(p-.5)*fh*.92;
    return {
     x:cx+Math.cos(angle)*radius+lane*fw*.018,
     y:cy+vertical+Math.sin(angle*.8)*fh*.035*direction
    };
   };
   this.drawBinarySampler(context,sampler,12,hue+118+lane*17,(.08+.14*strength),lightEnvironment,size,61+lane);
  }
  const scan=((elapsed*.00028)%1),scanY=cy-fh*.42+scan*fh*.84;
  for(let bit=0;bit<8;bit++){
   const t=bit/7,x=cx-fw*.34+t*fw*.68;
   const lift=Math.sin(t*Math.PI)*fh*.018;
   context.font=`${Math.max(5,size*.014)}px monospace`;
   this.drawAdaptiveGlyph(context,(bit+Math.floor(elapsed/240))%2?'1':'0',x,scanY-lift,hue+150+bit*4,.16+.18*strength,lightEnvironment,undefined,false);
  }
  if(completing){
   const finish=clamp(1-(this.evolutionCompleteUntil-now)/2200,0,1),burst=Math.sin(Math.min(1,finish*1.35)*Math.PI);
   for(let bit=0;bit<12;bit++){
    const angle=bit/12*TAU+clock*.00018,radius=fw*(.34+burst*.18),x=cx+Math.cos(angle)*radius,y=cy+Math.sin(angle)*fh*(.34+burst*.08);
    context.font=`${Math.max(5,size*.014)}px monospace`;
    this.drawAdaptiveGlyph(context,bit%2?'1':'0',x,y,hue+180+bit*5,.18*burst,lightEnvironment,undefined,false);
   }
  }
  context.restore();
 }

 drawMagneticField(){
  // Pointer interaction is intentionally invisible.
  // Nearby particles deform softly through magneticOffset() without rings,
  // halos, cursor circles, or orbiting pointer glyphs.
 }

 drawNeuralRoots(context,size,cx,cy,fw,fh,hue,clock,lightEnvironment,yaw){
  const active=this.allEffects?1:this.mode==='neural'?1:this.mode==='abstract'? .86:this.mode==='mixed'? .7:.42;
  const yawShift=Math.sin(yaw)*fw*.18;
  context.save();context.globalCompositeOperation='source-over';
  for(let index=0;index<this.rootStrands.length;index++){
   const root=this.rootStrands[index];
   const baseX=cx+yawShift*.3+root.side*fw*(.1+root.spread*.14),baseY=cy+fh*.64;
   const convergence=.035+(index%5)*.022,endX=cx+yawShift+root.side*fw*convergence,endY=cy-fh*(.045+(index%5)*.045);
   const control1X=baseX+root.side*fw*(.08+root.bend),control1Y=cy+fh*.34;
   const control2X=cx+yawShift*.8+root.side*fw*(.08+convergence),control2Y=cy+fh*.045;
   const wave=Math.sin(clock*.0014+root.phase*TAU)*fw*.012;
   this.drawBinaryCubic(context,
    {x:baseX,y:baseY},{x:control1X+wave,y:control1Y},{x:control2X-wave,y:control2Y},{x:endX,y:endY},
    20,hue+index%4*15,(.16+(index%3)*.04)*active,lightEnvironment,size,root.phase+index*.13);
   const rawProgress=(clock*.000115*(1+root.speed)+root.phase)%1;
   for(let tail=4;tail>=0;tail--){
    const delayed=rawProgress-tail*.028;if(delayed<=0)continue;
    const progress=delayed*delayed*(3-2*delayed);
    const px=cubicPoint(baseX,control1X+wave,control2X-wave,endX,progress),py=cubicPoint(baseY,control1Y,control2Y,endY,progress);
    const envelope=Math.sin(delayed*Math.PI),fade=Math.exp(-tail*.58)*envelope*active;
    const colors=this.adaptiveColors(hue+38+index%3*18,.2+.56*fade,lightEnvironment);
    context.save();context.shadowColor=colors.main;context.shadowBlur=(3.5+envelope*5.5)*(1-tail*.12);
    context.beginPath();context.arc(px,py,Math.max(.7,size*(.0028-tail*.00028)),0,TAU);context.fillStyle=colors.main;context.fill();context.restore();
    if(tail===0&&index%3===0){context.font=`${Math.max(5.2,size*.015+envelope)}px monospace`;this.drawAdaptiveGlyph(context,root.glyph,px,py-2,hue+54,.25+.36*fade,lightEnvironment,undefined,false);}
   }
  }
  for(let lane=-2;lane<=2;lane++){
   this.drawBinarySampler(context,progress=>{
    const y=cy+fh*.54-progress*fh*.79,envelope=Math.sin(progress*Math.PI);
    const x=cx+yawShift*progress+lane*fw*.038+Math.sin(progress*TAU*(2.4+Math.abs(lane)*.25)-clock*.003+lane)*fw*.028*envelope;
    return {x,y};
   },28,hue+58+lane*8,.23*active,lightEnvironment,size,lane+7.2);
  }
  this.drawBrainCorePulse(context,size,cx,cy,fw,fh,hue,clock,lightEnvironment,yawShift,active);
  context.restore();
 }

  drawBrainCorePulse(context,size,cx,cy,fw,fh,hue,clock,lightEnvironment,yawShift,active){
  const raw=.5+.5*Math.sin(clock*.00135),pulse=raw*raw*(3-2*raw),coreX=cx+yawShift*.82,coreY=cy-fh*.095;
  context.save();context.globalCompositeOperation='source-over';
  const rotation=yawShift/fw*.45;
  for(let ring=0;ring<3;ring++){
   const rx=fw*(.028+ring*.022+pulse*.004),ry=fh*(.018+ring*.014+pulse*.003),start=clock*.00018+ring*.7,arc=TAU*.78;
   this.drawBinarySampler(context,t=>{
    const angle=start+arc*t,cos=Math.cos(angle),sin=Math.sin(angle);
    return {x:coreX+cos*rx*Math.cos(rotation)-sin*ry*Math.sin(rotation),y:coreY+cos*rx*Math.sin(rotation)+sin*ry*Math.cos(rotation)};
   },12+ring*3,hue+66+ring*12,(.12+.16*pulse)*(1-ring*.16)*active,lightEnvironment,size,ring+4.4);
  }
  context.font=`${Math.max(6,size*.019+pulse*1.2)}px monospace`;
  this.drawAdaptiveGlyph(context,pulse>.5?'1':'0',coreX,coreY+2,hue+92,(.28+.4*pulse)*active,lightEnvironment,undefined,false);
  context.restore();
 }

  drawNeck(context,size,cx,cy,fw,fh,hue,clock,lightEnvironment,yaw){
  const top=cy+fh*.37,bottom=cy+fh*.66,yawShift=Math.sin(yaw)*fw*.15;
  context.save();context.globalCompositeOperation='source-over';
  for(const point of this.neckGlyphs){
   const taper=.19+point.y*.075,x=cx+yawShift*(1-point.y*.28)+point.x*fw*taper+Math.sin(clock*.0018+point.phase)*size*.0025,y=top+(bottom-top)*point.y;
   const alpha=.18+.42*(1-Math.abs(point.x))*(.65+.35*Math.sin(clock*.002+point.phase));
   context.font=`${Math.max(5.5,size*.018)}px monospace`;
   this.drawAdaptiveGlyph(context,point.glyph,x,y,hue+point.y*34,alpha,lightEnvironment);
  }
  for(const side of [-1,1]){
   this.drawBinaryCubic(context,
    {x:cx+yawShift+side*fw*.18,y:top},
    {x:cx+yawShift*.75+side*fw*.2,y:cy+fh*.46},
    {x:cx+yawShift*.35+side*fw*.27,y:cy+fh*.58},
    {x:cx+yawShift*.2+side*fw*.27,y:bottom},
    15,hue+24,.32,lightEnvironment,size,side+12);
  }
  context.restore();
 }

  drawNeuralField(context,size,cx,cy,hue,clock,lightEnvironment){
  const active=this.allEffects?1:this.mode==='neural'?1:this.mode==='abstract'? .88:this.mode==='mixed'? .68:this.mode==='statistics'? .42:.2;
  const response=(this.speaking?1.24:this.thinking?1.13:1)*active;
  const nodes=this.neuralNodes.map((node,index)=>{
   const spin=node.angle+clock*.000055*node.speed,pulse=.9+.1*Math.sin(clock*.0018+node.phase);
   let x=cx+Math.cos(spin)*size*node.orbit*pulse,y=cy-size*.055+(node.lift+Math.sin(spin*1.7+node.phase)*.11)*size*.43;
   const depth=.62+.38*Math.sin(spin+node.phase),magnetic=this.magneticOffset(x,y,size,clock,node.phase,1.18);
   x=magnetic.x;y=magnetic.y;return {x,y,depth,node,index,magnetic:magnetic.force};
  });
  context.save();context.globalCompositeOperation='source-over';
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
   const a=nodes[i],b=nodes[j],distance=Math.hypot(a.x-b.x,a.y-b.y);
   if(distance>size*.118||Math.abs(a.depth-b.depth)>.42)continue;
   const signal=.5+.5*Math.sin(clock*.003+i*.71+j*.37),alpha=(1-distance/(size*.118))*(.06+.1*signal)*response*(1+(a.magnetic+b.magnetic)*.7);
   this.drawBinarySegment(context,{x:a.x,y:a.y},{x:b.x,y:b.y},3+(i+j)%3,hue+(i+j)%3*17,alpha,lightEnvironment,size,(i*13+j)*.07);
  }
  for(const point of nodes){
   const wave=.5+.5*Math.sin(clock*.0035+point.index*.83),radius=.75+wave*1.45*response+point.magnetic*2.1;
   context.beginPath();context.arc(point.x,point.y,radius,0,TAU);
   const colors=this.adaptiveColors(hue+point.index%4*13,Math.min(.72,.08+.2*wave*response+point.magnetic*.22),lightEnvironment);
   context.fillStyle=colors.main;context.fill();
   if(point.index%6===0){context.font=`${5.3+size*.0022}px monospace`;this.drawAdaptiveGlyph(context,point.node.glyph,point.x,point.y-3,hue+18,.16+.22*wave*response,lightEnvironment);}
  }
  for(let flowIndex=0;flowIndex<this.dataFlows.length;flowIndex++){
   const flow=this.dataFlows[flowIndex],head=(clock*.00008*flow.speed+flow.phase)%TAU;
   for(let step=0;step<12;step++){
    const angle=head-step*.07,fade=(1-step/12)*response,radius=size*(.13+.045*Math.sin(angle*2.3+flow.phase));
    const x=cx+Math.cos(angle)*radius,y=cy-size*.05+Math.sin(angle*1.55+flow.tilt)*size*.16;
    context.font=`${5.2+size*.0024+(step%3)}px monospace`;this.drawAdaptiveGlyph(context,(step+flowIndex)%2?'1':'0',x,y,hue+flowIndex%3*18,.025+fade*.11,lightEnvironment);
   }
  }
  context.restore();
 }

  drawTransitionRibbons(context,size,cx,cy,hue,clock,lightEnvironment,transition){
  if(!transition.active)return;
  const direction=transition.kind==='assemble'?1:-1;
  const phase=transition.kind==='assemble'?transition.raw:1-transition.raw;
  const envelope=Math.sin(transition.raw*Math.PI);
  const fluidStrength=.35+.65*envelope;
  context.save();context.globalCompositeOperation='source-over';
  for(let lane=-2;lane<=2;lane++){
   this.drawBinarySampler(context,progress=>{
    const travel=direction*(progress-phase),coil=travel*TAU*1.5+lane*.72;
    const radius=size*(.04+Math.abs(travel)*.34);
    return {x:cx+Math.sin(coil)*radius+lane*size*.012,y:cy+travel*size*.54+Math.cos(coil*.72)*size*.028*fluidStrength};
   },26,hue+76+lane*11,.14+.32*envelope,lightEnvironment,size,lane+20.5);
   for(let bit=0;bit<5;bit++){
    const progress=(bit/5+clock*.000035*(lane+3))%1,travel=direction*(progress-phase),coil=travel*TAU*1.5+lane*.72;
    const radius=size*(.04+Math.abs(travel)*.34),x=cx+Math.sin(coil)*radius+lane*size*.012,y=cy+travel*size*.54+Math.cos(coil*.72)*size*.028*fluidStrength;
    context.font=`${Math.max(5.2,size*.016)}px monospace`;
    this.drawAdaptiveGlyph(context,(bit+lane)%2?'1':'0',x,y,hue+96+bit*9,.22+.58*envelope,lightEnvironment,undefined,false);
   }
  }
  context.restore();
 }

  drawEarFrequencyWaves(context,size,rootX,midY,fw,fh,hue,lightEnvironment,side,visibility,clock){
  const bands=this.earSpectrum;
  if(!this.listening&&Math.max(bands.low,bands.mid,bands.high)<.025)return;
  const pulse=.5+.5*Math.sin(clock*.0105+side*.7);
  for(let wave=0;wave<3;wave++){
   const energy=[bands.low,bands.mid,bands.high][wave];
   const travel=(clock*.00042+wave*.29)%1;
   const reach=fw*(.07+travel*.16+energy*.11),height=fh*(.035+travel*.07+energy*.035);
   const alpha=(1-travel)*(.08+.12*pulse+energy*.58)*visibility;
   const start={x:rootX+side*fw*.055,y:midY};
   const end={x:rootX+side*(fw*.055+reach),y:midY};
   this.drawBinaryQuadratic(context,start,{x:rootX+side*(fw*.07+reach*.58),y:midY-height},end,6,hue+92+wave*12,alpha,lightEnvironment,size,40+wave+side);
   this.drawBinaryQuadratic(context,start,{x:rootX+side*(fw*.07+reach*.58),y:midY+height},end,6,hue+108+wave*10,alpha*.78,lightEnvironment,size,44+wave+side);
  }
 }

  drawEars(context,size,cx,cy,fw,fh,hue,lightEnvironment,yaw,clock){
  const profile=Math.max(.58,Math.cos(yaw)),yawShift=Math.sin(yaw)*fw*.19;
  context.save();context.globalCompositeOperation='source-over';
  for(const side of [-1,1]){
   const visibility=clamp(.78+side*Math.sin(yaw)*.34,.42,1);
   const rootX=cx+yawShift*.66+side*fw*.57*profile;
   const topY=cy-fh*.045,bottomY=cy+fh*.235,midY=cy+fh*.095;
   const outerX=rootX+side*fw*(.13+.025*visibility);
   const top={x:rootX,y:topY},bottom={x:rootX-side*fw*.008,y:bottomY};
   this.drawBinaryCubic(context,top,{x:outerX,y:cy-fh*.018},{x:outerX+side*fw*.018,y:cy+fh*.16},bottom,16,hue+30,.62*visibility,lightEnvironment,size,side+31.1);
   this.drawBinaryCubic(context,bottom,{x:rootX+side*fw*.035,y:cy+fh*.2},{x:rootX+side*fw*.037,y:cy+fh*.012},top,12,hue+47,.45*visibility,lightEnvironment,size,side+32.1);
   this.drawBinaryCubic(context,
    {x:rootX+side*fw*.018,y:cy+fh*.012},
    {x:rootX+side*fw*.068,y:midY-fh*.05},
    {x:rootX+side*fw*.058,y:midY+fh*.065},
    {x:rootX+side*fw*.012,y:cy+fh*.18},
    10,hue+64,.22*visibility,lightEnvironment,size,side+33.1);
   this.drawBinaryQuadratic(context,
    {x:rootX+side*fw*.018,y:midY-fh*.012},
    {x:rootX+side*fw*.052,y:midY+fh*.008},
    {x:rootX+side*fw*.022,y:midY+fh*.052},
    6,hue+82,.18*visibility,lightEnvironment,size,side+34.1);
   context.font=`${Math.max(6.2,size*.017)}px monospace`;
   this.drawAdaptiveGlyph(context,side>0?'1':'0',outerX,midY,hue+76,.22*visibility,lightEnvironment,undefined,false);
   this.drawAdaptiveGlyph(context,side>0?'0':'1',rootX+side*fw*.03,bottomY-fh*.025,hue+58,.16*visibility,lightEnvironment,undefined,false);
   this.drawEarFrequencyWaves(context,size,rootX,midY,fw,fh,hue,lightEnvironment,side,visibility,clock);
  }
  context.restore();
 }

  drawHeadStructure(context,size,cx,cy,fw,fh,hue,clock,lightEnvironment,yaw,pitch,blink){
  const yawShift=Math.sin(yaw)*fw*.19,profile=Math.cos(yaw),centerX=cx+yawShift*.42;
  context.save();context.globalCompositeOperation='source-over';

  const top={x:centerX,y:cy-fh*.49};
  const rightJaw={x:cx+yawShift*.72+fw*.29*profile,y:cy+fh*.39};
  const chin={x:centerX,y:cy+fh*.53};
  const leftJaw={x:cx+yawShift*.72-fw*.29*profile,y:cy+fh*.39};
  this.drawBinaryCubic(context,top,{x:cx+yawShift*.18+fw*.48*profile,y:cy-fh*.43},{x:cx+yawShift*.68+fw*.5*profile,y:cy+fh*.15},rightJaw,13,hue+18,.27,lightEnvironment,size,1.1);
  this.drawBinaryCubic(context,rightJaw,{x:cx+yawShift*.58+fw*.18*profile,y:cy+fh*.5},{x:centerX+fw*.07*profile,y:cy+fh*.53},chin,8,hue+22,.24,lightEnvironment,size,2.1);
  this.drawBinaryCubic(context,chin,{x:centerX-fw*.07*profile,y:cy+fh*.53},{x:cx+yawShift*.58-fw*.18*profile,y:cy+fh*.5},leftJaw,8,hue+22,.24,lightEnvironment,size,3.1);
  this.drawBinaryCubic(context,leftJaw,{x:cx+yawShift*.68-fw*.5*profile,y:cy+fh*.15},{x:cx+yawShift*.18-fw*.48*profile,y:cy-fh*.43},top,13,hue+18,.27,lightEnvironment,size,4.1);

  const depthShift=fw*(.018+.012*Math.abs(Math.sin(yaw)));
  this.drawBinaryCubic(context,
   {x:centerX-depthShift,y:cy-fh*.39},
   {x:centerX-fw*.3*profile,y:cy-fh*.29},
   {x:centerX-fw*.31*profile,y:cy+fh*.19},
   {x:centerX-fw*.18*profile,y:cy+fh*.36},
   11,hue+112,.11,lightEnvironment,size,15.1);
  this.drawBinaryCubic(context,
   {x:centerX+depthShift,y:cy-fh*.4},
   {x:centerX+fw*.31*profile,y:cy-fh*.27},
   {x:centerX+fw*.3*profile,y:cy+fh*.17},
   {x:centerX+fw*.18*profile,y:cy+fh*.35},
   11,hue+72,.15,lightEnvironment,size,16.1);
  this.drawBinaryQuadratic(context,
   {x:centerX-fw*.25*profile,y:cy+fh*.12},
   {x:centerX,y:cy+fh*.19+pitch*fh*.018},
   {x:centerX+fw*.25*profile,y:cy+fh*.12},
   9,hue+94,.09,lightEnvironment,size,17.1);

  this.drawBinaryCubic(context,
   {x:centerX,y:cy-fh*.4},{x:centerX+yawShift*.72,y:cy-fh*.18},{x:centerX+yawShift*.76,y:cy+fh*.18},{x:centerX+yawShift*.52,y:cy+fh*.43},
   14,hue+42,.16,lightEnvironment,size,5.2);

  const sad=this.emotion==='sad',angry=this.emotion==='angry',annoyed=this.emotion==='annoyed',happy=this.emotion==='happy';
  const eyeY=cy-fh*.065+pitch*fh*.09+(sad?fh*.012:0),eyeOpen=fh*.018*(happy?.72:angry?.82:1)*(1-blink);
  for(const side of [-1,1]){
   const visibility=clamp(1-side*Math.sin(yaw)*.42,.55,1),eyeX=centerX+side*fw*.19*profile+yawShift*.12,eyeWidth=fw*.105*profile;
   const left={x:eyeX-eyeWidth,y:eyeY},right={x:eyeX+eyeWidth,y:eyeY};
   this.drawBinaryQuadratic(context,left,{x:eyeX,y:eyeY-eyeOpen},right,7,hue+55,.3*visibility,lightEnvironment,size,side+6.1);
   this.drawBinaryQuadratic(context,right,{x:eyeX,y:eyeY+eyeOpen*.72},left,7,hue+62,.27*visibility,lightEnvironment,size,side+7.1);
   const browTilt=angry?-side*fh*.045:annoyed?-side*fh*.023:sad?side*fh*.032:happy?fh*.012:0;
   this.drawBinaryQuadratic(context,
    {x:eyeX-side*eyeWidth*.92,y:cy-fh*.125+browTilt},{x:eyeX,y:cy-fh*(.145+visibility*.008)+(happy?-fh*.015:0)},{x:eyeX+side*eyeWidth*.86,y:cy-fh*.12-browTilt},
    7,hue+38,.18*visibility,lightEnvironment,size,side+8.1);
  }

  const noseX=centerX+yawShift*.62;
  const noseMid={x:noseX+yawShift*.06,y:cy+fh*.205};
  this.drawBinaryCubic(context,
   {x:noseX,y:cy-fh*.015},{x:noseX+yawShift*.18,y:cy+fh*.07},{x:noseX+yawShift*.12+fw*.018,y:cy+fh*.16},noseMid,
   9,hue+68,.3,lightEnvironment,size,9.3);
  this.drawBinaryQuadratic(context,noseMid,{x:noseX-fw*.055*profile,y:cy+fh*.225},{x:noseX-fw*.09*profile,y:cy+fh*.2},6,hue+74,.25,lightEnvironment,size,10.3);

  for(const side of [-1,1]){
   this.drawBinaryCubic(context,
    {x:centerX+side*fw*.32*profile,y:cy+fh*.08},
    {x:centerX+side*fw*.29*profile+yawShift*.22,y:cy+fh*.19},
    {x:centerX+side*fw*.23*profile+yawShift*.3,y:cy+fh*.29},
    {x:centerX+side*fw*.17*profile+yawShift*.38,y:cy+fh*.35},
    8,hue+side*9,.14,lightEnvironment,size,side+11.4);
  }

  const facePulse=.5+.5*Math.sin(clock*.0011);
  context.font=`${Math.max(5,size*.014)}px monospace`;
  this.drawAdaptiveGlyph(context,facePulse>.5?'1':'0',centerX+yawShift*.28,cy-fh*.31,hue+88,.12+.12*facePulse,lightEnvironment,undefined,false);
  context.restore();
 }

  drawMouthSignal(context,size,cx,cy,fw,fh,hue,clock,lightEnvironment,yaw,pitch){
  const energy=this.speaking?clamp(this.speechEnergy,0,1):0,viseme=this.speaking?this.viseme:0;
  const open=fh*(.0028+energy*(.005+viseme*.038)),width=fw*(.17+viseme*.015)*Math.cos(yaw),centerX=cx+Math.sin(yaw)*fw*.12,centerY=cy+fh*.262+pitch*fh*.045;
  const expression=this.speaking?0:this.emotion==='happy'?1:this.emotion==='sad'?-1:this.emotion==='angry'?.32:this.emotion==='annoyed'?-.38:0;
  const cornerLift=expression*fh*.028;
  context.save();context.globalCompositeOperation='source-over';

  const left={x:centerX-width,y:centerY-cornerLift},midTop={x:centerX,y:centerY-open*.32+cornerLift*.22},right={x:centerX+width,y:centerY-cornerLift},midBottom={x:centerX,y:centerY+open*.86+cornerLift*.32};
  this.drawBinaryCubic(context,left,{x:centerX-width*.52,y:centerY-open*.34},{x:centerX-width*.24,y:centerY-open*.52},midTop,7,hue+16,.48+energy*.34,lightEnvironment,size,21.1);
  this.drawBinaryCubic(context,midTop,{x:centerX+width*.24,y:centerY-open*.52},{x:centerX+width*.52,y:centerY-open*.34},right,7,hue+22,.48+energy*.34,lightEnvironment,size,22.1);
  this.drawBinaryCubic(context,left,{x:centerX-width*.5,y:centerY+open*.72},{x:centerX-width*.24,y:centerY+open*.92},midBottom,7,hue-12,.5+energy*.36,lightEnvironment,size,23.1);
  this.drawBinaryCubic(context,midBottom,{x:centerX+width*.24,y:centerY+open*.92},{x:centerX+width*.5,y:centerY+open*.72},right,7,hue-6,.5+energy*.36,lightEnvironment,size,24.1);

  const lipDepth=fh*(.007+viseme*.009);
  this.drawBinaryCubic(context,
   {x:centerX-width*.88,y:centerY-lipDepth},
   {x:centerX-width*.38,y:centerY-open*.62-lipDepth},
   {x:centerX+width*.38,y:centerY-open*.62-lipDepth},
   {x:centerX+width*.88,y:centerY-lipDepth},
   7,hue+78,.2+energy*.12,lightEnvironment,size,25.1);
  this.drawBinaryCubic(context,
   {x:centerX-width*.84,y:centerY+lipDepth},
   {x:centerX-width*.34,y:centerY+open*.9+lipDepth},
   {x:centerX+width*.34,y:centerY+open*.9+lipDepth},
   {x:centerX+width*.84,y:centerY+lipDepth},
   7,hue-46,.16+energy*.14,lightEnvironment,size,26.1);

  context.font=`${Math.max(5.5,fw*.018)}px monospace`;
  for(let i=0;i<10;i++){
   const progress=i/9,x=centerX-width+progress*width*2,arch=Math.sin(progress*Math.PI),lower=i%2===1;
   const shimmer=.72+.28*Math.sin(clock*.004+i);
   const y=centerY+(lower ? .78 : -.34)*open*arch;
   this.drawAdaptiveGlyph(context,lower?'1':'0',x,y,hue+i*5,(.24+energy*.38)*shimmer,lightEnvironment,undefined,false);
  }
  context.restore();
 }

 drawEmotionOverlay(context,size,cx,cy,fw,fh,hue,lightEnvironment,yaw){
  if(this.emotion==='neutral')return;
  const happy=this.emotion==='happy',sad=this.emotion==='sad',angry=this.emotion==='angry',annoyed=this.emotion==='annoyed';
  const centerX=cx+Math.sin(yaw)*fw*.08,profile=Math.cos(yaw);
  for(const side of [-1,1]){
   const x=centerX+side*fw*.19*profile,y=cy-fh*.15,width=fw*.11*profile;
   const innerY=y+(angry?fh*.035:sad?-fh*.032:annoyed&&side===1?fh*.018:0);
   const outerY=y+(angry?-fh*.023:sad?fh*.015:annoyed&&side===-1?-fh*.025:happy?-fh*.014:0);
   this.drawBinaryQuadratic(context,{x:x-side*width,y:innerY},{x,y:y-(happy?fh*.024:0)},{x:x+side*width,y:outerY},10,hue+(angry?-30:sad?36:60),.78,lightEnvironment,size,side+70);
  }
  if(this.speaking)return;
  const y=cy+fh*.265,width=fw*.18*profile;
  const edge=happy?-fh*.035:sad?fh*.022:annoyed?fh*.012:0;
  const middle=happy?fh*.038:sad?-fh*.02:angry?-fh*.008:annoyed?-fh*.003:0;
  this.drawBinaryQuadratic(context,{x:centerX-width,y:y+edge},{x:centerX,y:y+middle},{x:centerX+width,y:y+(annoyed?edge*.25:edge)},15,hue+(sad?35:happy?85:0),.88,lightEnvironment,size,77);
 }

  frame(time){
  requestAnimationFrame(next=>this.frame(next));
  if(this.paused||document.hidden)return;
  const frameInterval=(this.evolving||performance.now()<this.performanceModeUntil)?48:32;
  if(time-this.last<frameInterval)return;
  const frameStarted=performance.now();
  this.last=time;
  const context=this.ctx,width=this.w,height=this.h;if(!width||!height)return;
  const lowCost=this.evolving||performance.now()<this.performanceModeUntil;
  context.clearRect(0,0,width,height);
  const auto=this.animate,clock=auto?time:0,motionClock=auto?time*PARTICLE_TIME_SCALE:0,size=Math.min(width,height),spectral=this.color==='spectrum';
  const hue=spectral?(motionClock*.012)%360:this.color==='cyan'?175:this.color==='violet'?272:this.color==='gold'?43:132,lightEnvironment=this.isLightEnvironment();
  const faceHeight=size*.62,faceWidth=faceHeight*.79,floatX=auto?Math.sin(motionClock/3700)*4:0,floatY=auto?Math.sin(motionClock/2500)*6:0;
  const cx=width/2+floatX,cy=height/2-size*.045+floatY;
  const quietTarget=this.speaking? .34:0;if(time-this.speechBeat>170)this.speechTarget=quietTarget;
  this.speechEnergy+=(this.speechTarget-this.speechEnergy)*(this.reducedMotion? .08:.2);
  const syllable=.5+.5*Math.sin(time*.0076+Math.sin(time*.0019)*.72);
  this.visemeTarget=this.speaking?clamp((.12+this.speechEnergy*.88)*(.48+syllable*.52),0,1):0;
  const visemeEase=this.visemeTarget>this.viseme ? .14 : .085;
  this.viseme+=(this.visemeTarget-this.viseme)*visemeEase;
  if(!this.speaking&&this.viseme<.002)this.viseme=0;
  const gaze=this.gazeActive?this.gazePointer:this.pointer,gazeEase=this.reducedMotion?.11:.055;
  this.rotation.x+=((this.track?gaze.x:0)-this.rotation.x)*gazeEase;this.rotation.y+=((this.track?gaze.y:0)-this.rotation.y)*gazeEase;
  const maxYaw=Math.PI/6;
  let rx=this.rotation.x*maxYaw,ry=this.rotation.y*.13;
  if(this.speaking){rx+=Math.sin(time/420)*(.012+this.speechEnergy*.016);ry+=Math.sin(time/235)*(.01+this.speechEnergy*.024);}else if(this.evolving){rx+=Math.sin(time/780)*.022;ry+=Math.sin(time/510)*.014;}else if(this.thinking){rx+=Math.sin(time/1250)*.016;ry+=Math.sin(time/920)*.01;}
  const since=time-this.actionStart;
  if(since<1500){const envelope=Math.sin(since/1500*Math.PI);if(this.action==='shake')rx+=Math.sin(since/110)*.24*envelope;if(this.action==='nod')ry+=Math.sin(since/140)*.16*envelope;}
  rx=clamp(rx,-maxYaw,maxYaw);ry=clamp(ry,-.18,.18);
  if(auto&&time>this.nextBlink){this.blinkStart=time;this.nextBlink=time+3200+Math.random()*3800;}
  const blinkTime=time-this.blinkStart,close=blinkTime>=0&&blinkTime<230?Math.sin(blinkTime/230*Math.PI):0;
  context.textAlign='center';
  const transition=this.transitionState(time),awakening=transition.active;
  const rawAssembly=transition.kind==='disassemble'?1-transition.raw:transition.raw;
  const assembly=transition.presence;
  context.save();
  if(transition.kind){
   context.globalAlpha=transition.active?.18+.82*assembly:Math.max(.001,assembly);
   context.translate(cx,cy);
   const scale=.68+.32*assembly+Math.sin(assembly*Math.PI)*.035;
   context.scale(scale,scale);
   context.rotate((1-assembly)*Math.sin(time*.0028)*.04);
   context.translate(-cx,-cy);
  }
  this.drawNeuralRoots(context,size,cx,cy,faceWidth,faceHeight,hue,motionClock,lightEnvironment,rx);
  this.drawNeck(context,size,cx,cy,faceWidth,faceHeight,hue,motionClock,lightEnvironment,rx);
  this.drawNeuralField(context,size,cx,cy,hue,motionClock,lightEnvironment);
  this.drawHeadStructure(context,size,cx,cy,faceWidth,faceHeight,hue,motionClock,lightEnvironment,rx,ry,close);
  this.drawEvolutionField(context,size,cx,cy,faceWidth,faceHeight,hue,motionClock,lightEnvironment);
  this.drawTransitionRibbons(context,size,cx,cy,hue,motionClock,lightEnvironment,transition);

  context.font=`${Math.max(6.6,faceWidth/110*3.15)}px monospace`;
  const abstractStrength=this.allEffects? .62:this.mode==='abstract'?1:this.mode==='neural'? .58:this.mode==='mixed'? .28:0;
  for(let sampleIndex=0;sampleIndex<this.samples.length;sampleIndex++){
   if(lowCost&&sampleIndex%2===1)continue;
   const point=this.samples[sampleIndex];
   let px=point.x,py=point.y,lum=point.lum;
   if(abstractStrength&&Math.sin(point.seed*91+motionClock*.0017+py*18)>.93-abstractStrength*.08)continue;
   const leftEye=((px+.196)/.113)**2+((py+.06)/.038)**2,rightEye=((px-.19)/.12)**2+((py+.06)/.038)**2;
   if(leftEye<1||rightEye<1){if(close>.15){py=-.06+(py+.06)*(1-close);lum*=1-close*.42;}else{px+=rx*.026;py+=ry*.045;lum*=1.22;}}
   const mouthCenter=.265;
   if(this.speaking&&Math.abs(px)<.205&&Math.abs(py-mouthCenter)<.074){const open=this.viseme*(.3+this.speechEnergy*.7)*(1-Math.abs(px)/.205);py+=Math.sign(py-mouthCenter||1)*open*(py>mouthCenter? .04:.018);px*=1-open*.03;lum*=.82+open*.18;}
   if(this.speaking&&py>mouthCenter-.01){const jawWeight=clamp((py-mouthCenter+.01)/.24,0,1);py+=this.viseme*this.speechEnergy*.021*jawWeight;}
   const depth=Math.sqrt(Math.max(0,1-(px*1.95)**2-(py*1.65)**2));
   const modelX=px*faceWidth,modelY=py*faceHeight,modelZ=depth*faceWidth*.38;
   const rotatedX=modelX*Math.cos(rx)+modelZ*Math.sin(rx),yawDepth=modelZ*Math.cos(rx)-modelX*Math.sin(rx);
   const rotatedY=modelY*Math.cos(ry)-yawDepth*Math.sin(ry)*.38,rotatedDepth=yawDepth*Math.cos(ry)+modelY*Math.sin(ry)*.18;
   const perspective=clamp(1+rotatedDepth/(faceWidth*3.7),.84,1.18);
   let x=cx+rotatedX*perspective,y=cy+rotatedY*perspective;
   const fracture=Math.sin(py*31+motionClock*.0012+point.seed*7)*abstractStrength;x+=fracture*size*.01*(.35+Math.abs(px)*1.4);y+=Math.sin(px*24-motionClock*.001+point.seed*11)*size*.004*abstractStrength;
   if(this.evolving){
    const repairPhase=(motionClock*.00105+point.seed*TAU*2),repairBand=.5+.5*Math.sin(py*42-motionClock*.0026);
    const snap=.35+.65*repairBand;
    x+=Math.sin(repairPhase+py*21)*size*.008*snap;
    y+=Math.cos(repairPhase*.82+px*19)*size*.006*snap;
    if(point.seed>.82){x+=(cx-x)*.035*Math.sin(repairPhase);y+=(cy-y)*.028*Math.cos(repairPhase);}
   }
   const magnetic=this.magneticOffset(x,y,size,motionClock,point.seed,.48);x=magnetic.x;y=magnetic.y;
   let localPresence=1;
   if(transition.kind){
    const delay=(point.seed*.62+(py+.5)*.38)*.42;
    const local=clamp((rawAssembly-delay)/Math.max(.01,1-delay),0,1);
    const soft=local*local*(3-2*local);
    const spiral=point.seed*TAU*3+(1-soft)*TAU*1.35;
    const streamSide=point.seed>.5?1:-1;
    const sourceX=cx+streamSide*size*(.14+(1-soft)*.34)+Math.sin(spiral)*size*.09;
    const sourceY=cy+((point.seed-.5)*1.08+(1-soft)*streamSide*.12)*size+Math.cos(spiral*.78)*size*.045;
    const fluidStrength=(1-soft)*Math.sin(motionClock*.00135+point.seed*17)*size*.026;
    x=sourceX+(x-sourceX)*soft+Math.cos(spiral)*fluidStrength;
    y=sourceY+(y-sourceY)*soft+Math.sin(spiral)*fluidStrength;
    localPresence=soft;
    if(localPresence<=.01)continue;
   }
   const edge=Math.sqrt((px*2)**2+(py*2)**2),wave=Math.max(0,Math.sin(motionClock*.0007+point.seed*20)-.65);if(auto&&edge>.78){x+=px*wave*24;y+=py*wave*21;}
   const depthLight=clamp(.68+rotatedDepth/(faceWidth*.72),.38,1.14),intensity=Math.min(1,lum*1.7),scan=auto? .9+.1*Math.sin(py*7-motionClock*.0014):1,evolutionLight=this.evolving?(1.08+.18*Math.max(0,Math.sin(py*38-motionClock*.0028))):1,alpha=Math.min(.99,intensity*1.9*scan*depthLight*(this.thinking?1.13:1)*evolutionLight)*localPresence;
   const spectralShift=Math.sin(point.seed*25+motionClock*.00023)*(spectral?72:18),glyph=auto&&Math.sin(motionClock/700+point.seed*90)>.988?(point.glyph==='0'?'1':'0'):point.glyph;
   const livingHue=hue+spectralShift+abstractStrength*Math.sin(point.seed*19)*24+magnetic.force*48+rotatedDepth/faceWidth*18;
   this.drawAdaptiveGlyph(context,glyph,x,y,livingHue,alpha,lightEnvironment,undefined,sampleIndex%3===0||alpha>.9);
   if(abstractStrength>.5&&Math.abs(fracture)>.72)this.drawAdaptiveGlyph(context,glyph,x+fracture*size*.018,y-fracture*size*.006,hue+spectralShift+28,alpha*.18*abstractStrength,lightEnvironment);
  }
  if(assembly>.08){
   this.drawEars(context,size,cx,cy,faceWidth,faceHeight,hue,lightEnvironment,rx,motionClock);
   this.drawMouthSignal(context,size,cx,cy,faceWidth,faceHeight,hue,clock,lightEnvironment,rx,ry);
   this.drawEmotionOverlay(context,size,cx,cy,faceWidth,faceHeight,hue,lightEnvironment,rx);
  }
  this.drawMagneticField(context,size,hue,clock,lightEnvironment);
  context.restore();
  this.lastFrameCost=performance.now()-frameStarted;
  if(this.lastFrameCost>85)this.performanceModeUntil=performance.now()+3000;
 }
}
