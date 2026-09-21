const TAU=Math.PI*2;
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
  this.color='spectrum';
  this.mode='mixed';
  this.allEffects=false;
  this.transitionKind='';
  this.awakeningStart=0;
  this.awakeningDuration=0;
  this.speaking=false;
  this.thinking=false;
  this.speechEnergy=0;
  this.speechTarget=0;
  this.speechBeat=0;
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
 activateAllEffects(value=true){this.allEffects=Boolean(value);if(this.allEffects){this.mode='mixed';this.color='spectrum';this.animate=true;this.track=true;}}
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

 strokeAdaptivePath(context,hue,alpha,lightEnvironment,width=.7){
  const colors=this.adaptiveColors(hue,alpha,lightEnvironment,86);
  context.lineWidth=width+1.55;context.strokeStyle=colors.edge;context.stroke();
  context.lineWidth=width;context.strokeStyle=colors.main;context.stroke();
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
   context.beginPath();context.moveTo(baseX,baseY);context.bezierCurveTo(control1X+wave,control1Y,control2X-wave,control2Y,endX,endY);
   this.strokeAdaptivePath(context,hue+index%4*15,(.1+(index%3)*.035)*active,lightEnvironment,.48+(index%3)*.1);
   const rawProgress=(clock*.000115*(1+root.speed)+root.phase)%1;
   for(let tail=4;tail>=0;tail--){
    const delayed=rawProgress-tail*.028;
    if(delayed<=0)continue;
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
   context.beginPath();
   for(let step=0;step<=42;step++){
    const progress=step/42,y=cy+fh*.54-progress*fh*.79,envelope=Math.sin(progress*Math.PI);
    const x=cx+yawShift*progress+lane*fw*.038+Math.sin(progress*TAU*(2.4+Math.abs(lane)*.25)-clock*.003+lane)*fw*.028*envelope;
    step?context.lineTo(x,y):context.moveTo(x,y);
   }
   this.strokeAdaptivePath(context,hue+58+lane*8,.2*active,lightEnvironment,.54);
  }
  this.drawBrainCorePulse(context,size,cx,cy,fw,fh,hue,clock,lightEnvironment,yawShift,active);
  context.restore();
 }

 drawBrainCorePulse(context,size,cx,cy,fw,fh,hue,clock,lightEnvironment,yawShift,active){
  const raw=.5+.5*Math.sin(clock*.00135),pulse=raw*raw*(3-2*raw),coreX=cx+yawShift*.82,coreY=cy-fh*.095;
  context.save();context.globalCompositeOperation='source-over';
  const colors=this.adaptiveColors(hue+72,.28+.44*pulse,lightEnvironment);
  context.shadowColor=colors.main;context.shadowBlur=4+pulse*8;
  for(let ring=0;ring<3;ring++){
   context.beginPath();context.ellipse(coreX,coreY,fw*(.028+ring*.022+pulse*.004),fh*(.018+ring*.014+pulse*.003),yawShift/fw*.45,clock*.00018+ring*.7,clock*.00018+ring*.7+TAU*.78);
   this.strokeAdaptivePath(context,hue+66+ring*12,(.08+.12*pulse)*(1-ring*.18)*active,lightEnvironment,.42+ring*.08);
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
   context.beginPath();context.moveTo(cx+yawShift+side*fw*.18,top);
   context.bezierCurveTo(cx+yawShift*.75+side*fw*.2,cy+fh*.46,cx+yawShift*.35+side*fw*.27,cy+fh*.58,cx+yawShift*.2+side*fw*.27,bottom);
   this.strokeAdaptivePath(context,hue+24,.28,lightEnvironment,.72);
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
   const signal=.5+.5*Math.sin(clock*.003+i*.71+j*.37),alpha=(1-distance/(size*.118))*(.035+.07*signal)*response*(1+(a.magnetic+b.magnetic)*.7);
   context.beginPath();context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);this.strokeAdaptivePath(context,hue+(i+j)%3*17,alpha,lightEnvironment,.48);
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
   context.beginPath();
   for(let step=0;step<=36;step++){
    const progress=step/36,travel=direction*(progress-phase),coil=travel*TAU*1.5+lane*.72;
    const radius=size*(.04+Math.abs(travel)*.34),x=cx+Math.sin(coil)*radius+lane*size*.012,y=cy+travel*size*.54+Math.cos(coil*.72)*size*.028*fluidStrength;
    step?context.lineTo(x,y):context.moveTo(x,y);
   }
   this.strokeAdaptivePath(context,hue+76+lane*11,.08+.22*envelope,lightEnvironment,.45);
   for(let bit=0;bit<5;bit++){
    const progress=(bit/5+clock*.000035*(lane+3))%1,travel=direction*(progress-phase),coil=travel*TAU*1.5+lane*.72;
    const radius=size*(.04+Math.abs(travel)*.34),x=cx+Math.sin(coil)*radius+lane*size*.012,y=cy+travel*size*.54+Math.cos(coil*.72)*size*.028*fluidStrength;
    context.font=`${Math.max(5.2,size*.016)}px monospace`;
    this.drawAdaptiveGlyph(context,(bit+lane)%2?'1':'0',x,y,hue+96+bit*9,.22+.58*envelope,lightEnvironment,undefined,false);
   }
  }
  context.restore();
 }

 drawMouthSignal(context,cx,cy,fw,fh,hue,lightEnvironment,yaw,clock){
  const energy=this.speaking?clamp(this.speechEnergy,0,1):0,viseme=this.speaking? .35+.65*Math.abs(Math.sin(clock*.011)):0;
  const open=fh*(.005+energy*viseme*.026),width=fw*.18*Math.cos(yaw),centerX=cx+Math.sin(yaw)*fw*.12,centerY=cy+fh*.262;
  context.save();context.globalCompositeOperation='source-over';
  for(const side of [-1,1]){context.beginPath();context.moveTo(centerX-width,centerY);context.quadraticCurveTo(centerX,centerY+side*open*1.35,centerX+width,centerY);this.strokeAdaptivePath(context,hue+side*14,.4+energy*.35,lightEnvironment,.75+energy*.45);}
  context.font=`${Math.max(5.5,fw*.018)}px monospace`;
  for(let i=0;i<9;i++){const progress=i/8,x=centerX-width+progress*width*2,arch=Math.sin(progress*Math.PI),y=centerY+(i%2?-1:1)*open*arch;this.drawAdaptiveGlyph(context,i%2?'1':'0',x,y,hue+i*5,.24+energy*.34,lightEnvironment);}
  context.restore();
 }

 frame(time){
  requestAnimationFrame(next=>this.frame(next));
  if(document.hidden||time-this.last<32)return;
  this.last=time;
  const context=this.ctx,width=this.w,height=this.h;if(!width||!height)return;
  context.clearRect(0,0,width,height);
  const auto=this.animate,clock=auto?time:0,size=Math.min(width,height),spectral=this.color==='spectrum';
  const hue=spectral?(clock*.012)%360:this.color==='cyan'?175:this.color==='violet'?272:this.color==='gold'?43:132,lightEnvironment=this.isLightEnvironment();
  const faceHeight=size*.62,faceWidth=faceHeight*.79,floatX=auto?Math.sin(time/3700)*4:0,floatY=auto?Math.sin(time/2500)*6:0;
  const cx=width/2+floatX,cy=height/2-size*.045+floatY;
  const quietTarget=this.speaking? .34:0;if(time-this.speechBeat>170)this.speechTarget=quietTarget;
  this.speechEnergy+=(this.speechTarget-this.speechEnergy)*(this.reducedMotion? .08:.2);
  const gaze=this.gazeActive?this.gazePointer:this.pointer,gazeEase=this.reducedMotion?.11:.055;
  this.rotation.x+=((this.track?gaze.x:0)-this.rotation.x)*gazeEase;this.rotation.y+=((this.track?gaze.y:0)-this.rotation.y)*gazeEase;
  const maxYaw=Math.PI/6;
  let rx=this.rotation.x*maxYaw,ry=this.rotation.y*.13;
  if(this.speaking){rx+=Math.sin(time/420)*(.012+this.speechEnergy*.016);ry+=Math.sin(time/235)*(.01+this.speechEnergy*.024);}else if(this.thinking){rx+=Math.sin(time/1250)*.016;ry+=Math.sin(time/920)*.01;}
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
  this.drawNeuralRoots(context,size,cx,cy,faceWidth,faceHeight,hue,clock,lightEnvironment,rx);
  this.drawNeck(context,size,cx,cy,faceWidth,faceHeight,hue,clock,lightEnvironment,rx);
  this.drawNeuralField(context,size,cx,cy,hue,clock,lightEnvironment);
  this.drawTransitionRibbons(context,size,cx,cy,hue,clock,lightEnvironment,transition);

  context.font=`${Math.max(4,faceWidth/110*1.28)}px monospace`;
  const abstractStrength=this.allEffects? .62:this.mode==='abstract'?1:this.mode==='neural'? .58:this.mode==='mixed'? .28:0;
  for(let sampleIndex=0;sampleIndex<this.samples.length;sampleIndex++){
   const point=this.samples[sampleIndex];
   let px=point.x,py=point.y,lum=point.lum;
   if(abstractStrength&&Math.sin(point.seed*91+clock*.0017+py*18)>.93-abstractStrength*.08)continue;
   const leftEye=((px+.196)/.113)**2+((py+.06)/.038)**2,rightEye=((px-.19)/.12)**2+((py+.06)/.038)**2;
   if(leftEye<1||rightEye<1){if(close>.15){py=-.06+(py+.06)*(1-close);lum*=1-close*.42;}else{px+=rx*.026;py+=ry*.045;lum*=1.22;}}
   const mouthCenter=.265;
   if(this.speaking&&Math.abs(px)<.205&&Math.abs(py-mouthCenter)<.068){const viseme=.22+.78*Math.abs(Math.sin(time/(60+Math.abs(px)*105)+point.seed*2.4)),open=viseme*(.34+this.speechEnergy*.88)*(1-Math.abs(px)/.205);py+=Math.sign(py-mouthCenter||1)*open*(py>mouthCenter? .034:.016);px*=1-open*.035;lum*=.8+open*.2;}
   const depth=Math.sqrt(Math.max(0,1-(px*1.95)**2-(py*1.65)**2));
   let x=cx+px*faceWidth*Math.cos(rx)+depth*faceWidth*Math.sin(rx)*.38,y=cy+py*faceHeight*Math.cos(ry)+depth*faceHeight*ry*.4;
   const fracture=Math.sin(py*31+clock*.0012+point.seed*7)*abstractStrength;x+=fracture*size*.01*(.35+Math.abs(px)*1.4);y+=Math.sin(px*24-clock*.001+point.seed*11)*size*.004*abstractStrength;
   const magnetic=this.magneticOffset(x,y,size,clock,point.seed,.48);x=magnetic.x;y=magnetic.y;
   let localPresence=1;
   if(transition.kind){
    const delay=(point.seed*.62+(py+.5)*.38)*.42;
    const local=clamp((rawAssembly-delay)/Math.max(.01,1-delay),0,1);
    const soft=local*local*(3-2*local);
    const spiral=point.seed*TAU*3+(1-soft)*TAU*1.35;
    const streamSide=point.seed>.5?1:-1;
    const sourceX=cx+streamSide*size*(.14+(1-soft)*.34)+Math.sin(spiral)*size*.09;
    const sourceY=cy+((point.seed-.5)*1.08+(1-soft)*streamSide*.12)*size+Math.cos(spiral*.78)*size*.045;
    const fluidStrength=(1-soft)*Math.sin(clock*.00135+point.seed*17)*size*.026;
    x=sourceX+(x-sourceX)*soft+Math.cos(spiral)*fluidStrength;
    y=sourceY+(y-sourceY)*soft+Math.sin(spiral)*fluidStrength;
    localPresence=soft;
    if(localPresence<=.01)continue;
   }
   const edge=Math.sqrt((px*2)**2+(py*2)**2),wave=Math.max(0,Math.sin(clock*.0007+point.seed*20)-.65);if(auto&&edge>.78){x+=px*wave*24;y+=py*wave*21;}
   const intensity=Math.min(1,lum*1.7),scan=auto? .9+.1*Math.sin(py*7-clock*.0014):1,alpha=Math.min(.99,intensity*1.9*scan*(this.thinking?1.13:1))*localPresence;
   const spectralShift=Math.sin(point.seed*25+clock*.00023)*(spectral?72:18),glyph=auto&&Math.sin(clock/700+point.seed*90)>.988?(point.glyph==='0'?'1':'0'):point.glyph;
   const livingHue=hue+spectralShift+abstractStrength*Math.sin(point.seed*19)*24+magnetic.force*48;
   this.drawAdaptiveGlyph(context,glyph,x,y,livingHue,alpha,lightEnvironment,undefined,sampleIndex%3===0||alpha>.9);
   if(abstractStrength>.5&&Math.abs(fracture)>.72)this.drawAdaptiveGlyph(context,glyph,x+fracture*size*.018,y-fracture*size*.006,hue+spectralShift+28,alpha*.18*abstractStrength,lightEnvironment);
  }
  if(assembly>.08)this.drawMouthSignal(context,cx,cy,faceWidth,faceHeight,hue,lightEnvironment,rx,clock);
  this.drawMagneticField(context,size,hue,clock,lightEnvironment);
  context.restore();
 }
}
