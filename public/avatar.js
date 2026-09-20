export class BinaryAvatar {
 constructor(canvas,referenceSrc='/reference.png'){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.pointer={x:0,y:0};this.pointerActive=false;this.rotation={x:0,y:0};this.track=true;this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;this.animate=true;this.color='spectrum';this.mode='mixed';this.speaking=false;this.thinking=false;this.speechEnergy=0;this.speechTarget=0;this.speechBeat=0;this.action='';this.actionStart=0;this.blinkStart=-10000;this.nextBlink=performance.now()+3000;this.samples=[];this.last=0;
  this.particles=Array.from({length:220},(_,i)=>({angle:i*2.39996,r:.53+Math.random()*.39,speed:.08+Math.random()*.12,seed:Math.random()*100,x:0,y:0,glyph:Math.random()>.5?'1':'0'}));
  this.neuralNodes=Array.from({length:64},(_,i)=>({angle:i*2.39996,orbit:.28+Math.random()*.34,lift:(Math.random()-.5)*.72,phase:Math.random()*Math.PI*2,speed:.18+Math.random()*.34,glyph:Math.random()>.5?'1':'0'}));
  this.dataFlows=Array.from({length:9},(_,i)=>({phase:i/9*Math.PI*2,tilt:(i%3-1)*.24,speed:.42+Math.random()*.32,glyph:i%2?'1':'0'}));
  new ResizeObserver(()=>this.resize()).observe(canvas);
  const img=new Image();img.onload=()=>{const s=document.createElement('canvas');s.width=110;s.height=142;const c=s.getContext('2d',{willReadFrequently:true});c.drawImage(img,120,0,322,393,0,0,110,142);const data=c.getImageData(0,0,110,142).data;
   for(let y=0;y<142;y+=1.35)for(let x=0;x<110;x+=1.2){const dx=(x-55)/55,dy=(y-69)/70;if(dx*dx+dy*dy>1)continue;const i=(Math.floor(y)*110+Math.floor(x))*4;const lum=(data[i]*.21+data[i+1]*.72+data[i+2]*.07)/255;if(lum>.035)this.samples.push({x:x/110-.5,y:y/142-.5,lum,seed:Math.random(),glyph:Math.random()>.5?'1':'0'});}this.ready=true;};
  img.src=referenceSrc;img.onerror=()=>document.dispatchEvent(new CustomEvent('avatar-error'));requestAnimationFrame(t=>this.frame(t));
 }
 resize(){const r=this.canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;const d=Math.min(devicePixelRatio||1,2);this.canvas.width=this.w*d;this.canvas.height=this.h*d;this.ctx.setTransform(d,0,0,d,0,0);}
 trigger(action){this.action=action;this.actionStart=performance.now();if(action==='blink')this.blinkStart=this.actionStart;}
 setSpeechEnergy(value=.62){this.speechTarget=Math.max(0,Math.min(1,value));this.speechBeat=performance.now();}
 drawNeuralField(c,s,cx,cy,hue,clock){
  const active=this.mode==='neural'?1:this.mode==='abstract'?.88:this.mode==='mixed'?.68:this.mode==='statistics'?.42:.2;
  const response=(this.speaking?1.24:this.thinking?1.13:1)*active;
  const nodes=this.neuralNodes.map((n,i)=>{const spin=n.angle+clock*.000055*n.speed,pulse=.9+.1*Math.sin(clock*.0018+n.phase);let x=cx+Math.cos(spin)*s*n.orbit*pulse,y=cy+(n.lift+Math.sin(spin*1.7+n.phase)*.22)*s*.62;const depth=.62+.38*Math.sin(spin+n.phase);if(this.track&&this.pointerActive){const dx=this.pointer.x*s*.34-(x-cx),dy=this.pointer.y*s*.34-(y-cy),force=Math.max(0,1-Math.hypot(dx,dy)/(s*.42));x+=dx*force*.12;y+=dy*force*.12;}return{x,y,depth,n,i};});
  c.save();c.globalCompositeOperation='lighter';c.lineWidth=.55;
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j],d=Math.hypot(a.x-b.x,a.y-b.y);if(d>s*.145||Math.abs(a.depth-b.depth)>.42)continue;const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,inside=((mx-cx)/(s*.29))**2+((my-cy)/(s*.36))**2<1,signal=.5+.5*Math.sin(clock*.003+i*.71+j*.37),alpha=(1-d/(s*.145))*.16*response*(inside?.28:1);c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.strokeStyle='hsla('+(hue+(i+j)%3*17)+',82%,70%,'+(alpha*(.62+signal*.38))+')';c.stroke();}
  for(const p of nodes){const wave=.5+.5*Math.sin(clock*.0035+p.i*.83),radius=1.1+wave*2.1*response;c.beginPath();c.arc(p.x,p.y,radius,0,Math.PI*2);c.fillStyle='hsla('+(hue+p.i%4*13)+',90%,76%,'+(.08+.2*wave*response)+')';c.fill();if(p.i%5===0){c.font=(5.5+s*.0026)+'px monospace';c.fillStyle='hsla('+(hue+18)+',90%,82%,'+(.14+.22*wave*response)+')';c.fillText(p.n.glyph,p.x,p.y-4);}}
  for(let f=0;f<this.dataFlows.length;f++){const flow=this.dataFlows[f],head=(clock*.00008*flow.speed+flow.phase)%(Math.PI*2);for(let step=0;step<20;step++){const t=head-step*.055,fade=(1-step/20)*response,rad=s*(.32+.055*Math.sin(t*2.3+flow.phase)),x=cx+Math.cos(t)*rad,y=cy+Math.sin(t*1.55+flow.tilt)*s*.29;c.font=(5.2+s*.0024+(step%3))+'px monospace';c.fillStyle='hsla('+(hue+f%3*18)+',88%,74%,'+(.015+fade*.105)+')';c.fillText((step+f)%2?'1':'0',x,y);}}
  c.restore();
 }
 frame(t){requestAnimationFrame(v=>this.frame(v));if(document.hidden||t-this.last<32)return;this.last=t;const c=this.ctx,w=this.w,h=this.h;if(!w||!h)return;c.clearRect(0,0,w,h);
  const auto=this.animate,clock=auto?t:0,s=Math.min(w,h),spectral=this.color==='spectrum',hue=spectral?(clock*.012)%360:this.color==='cyan'?175:this.color==='violet'?272:this.color==='gold'?43:132,fh=s*.67,fw=fh*.8;
  const floatX=auto?Math.sin(t/3700)*5:0,floatY=auto?Math.sin(t/2500)*8:0,cx=w/2+floatX,cy=h/2+floatY;
  const quietTarget=this.speaking?.34:0;if(t-this.speechBeat>170)this.speechTarget=quietTarget;this.speechEnergy+=(this.speechTarget-this.speechEnergy)*(this.reducedMotion?.08:.2);
  this.rotation.x+=((this.track?this.pointer.x:0)-this.rotation.x)*.075;this.rotation.y+=((this.track?this.pointer.y:0)-this.rotation.y)*.075;
  let rx=this.rotation.x*.20,ry=this.rotation.y*.08;if(this.speaking){rx+=Math.sin(t/420)*(.018+this.speechEnergy*.018);ry+=Math.sin(t/235)*(.012+this.speechEnergy*.035);}else if(this.thinking){rx+=Math.sin(t/1250)*.018;ry+=Math.sin(t/920)*.012;}const since=t-this.actionStart;if(since<1500){const env=Math.sin(since/1500*Math.PI);if(this.action==='shake')rx+=Math.sin(since/110)*.29*env;if(this.action==='nod')ry+=Math.sin(since/140)*.18*env;}
  if(auto&&t>this.nextBlink){this.blinkStart=t;this.nextBlink=t+3200+Math.random()*3800;}const bt=t-this.blinkStart,close=bt>=0&&bt<230?Math.sin(bt/230*Math.PI):0;
  const magnet=this.track&&this.pointerActive, mx=w/2+this.pointer.x*w/2,my=h/2+this.pointer.y*h/2;
  c.textAlign='center';
  // A feathered black silhouette keeps the transparent widget readable over bright desktops.
  c.save();const shadow=c.createRadialGradient(cx,cy-s*.025,s*.055,cx,cy,s*.43);shadow.addColorStop(0,'rgba(0,0,0,.48)');shadow.addColorStop(.58,'rgba(0,0,0,.36)');shadow.addColorStop(.84,'rgba(0,0,0,.16)');shadow.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=shadow;c.beginPath();c.ellipse(cx,cy,s*.43,s*.47,0,0,Math.PI*2);c.fill();c.restore();
  this.drawNeuralField(c,s,cx,cy,hue,clock);
  // Free binary particles: matrix streams, orbital noise, or statistical curves.
  for(let i=0;i<this.particles.length;i++){const p=this.particles[i],phase=clock*.0001*p.speed*7+p.angle;let x,y;let kind=this.mode==='mixed'?i%4:this.mode==='matrix'?0:this.mode==='statistics'?1:this.mode==='neural'?3:2;
   if(kind===0){x=cx+Math.sin(p.angle)*s*.46;y=((clock*.018*(.5+p.speed*5)+p.seed*40)%(s*.9))+cy-s*.45;if(Math.abs(x-cx)<fw*.47&&Math.abs(y-cy)<fh*.44)x+=Math.sign(x-cx||1)*fw*.48;}
   else if(kind===1){x=cx+Math.cos(phase)*s*p.r*.51;y=cy+Math.sin(phase*2.1)*s*.25+Math.sin(phase*8)*s*.02;}
   else if(kind===2){x=cx+Math.cos(phase)*s*p.r*.53;y=cy+Math.sin(phase*1.03)*s*p.r*.48;}
   else{x=cx+Math.cos(phase*1.3+p.seed)*s*(.23+p.r*.26);y=cy+Math.sin(phase*1.9+p.seed*.37)*s*(.16+p.r*.2);}
   if(magnet){const dx=mx-x,dy=my-y,dist=Math.hypot(dx,dy);const force=Math.max(0,1-dist/(s*.5));x+=dx*force*.45;y+=dy*force*.45;}
   if(!p.x&&!p.y){p.x=x;p.y=y;}p.x+=(x-p.x)*.12;p.y+=(y-p.y)*.12;
   const distance=Math.hypot((p.x-cx)/(fw*.57),(p.y-cy)/(fh*.59)),fade=distance<.9?(kind===3?.14:.08):.18+Math.sin(phase+p.seed)*.13;
   c.font=(5.5+s*.005+(i%3))+'px monospace';c.fillStyle='hsla('+hue+',80%,72%,'+Math.max(.04,fade)+')';const value=kind===1&&i%9===0?((Math.sin(phase)+1)*.5).toFixed(2):p.glyph;c.fillText(value,p.x,p.y);
  }
  // Thin, generative statistical signals and magnetic field lines.
  c.lineWidth=.6;
  if(this.mode!=='matrix'){for(let ring=0;ring<3;ring++){c.beginPath();for(let i=0;i<=100;i++){const a=i/100*Math.PI*2,r=s*(.31+ring*.037),noise=Math.sin(a*(ring+3)+clock*.0004)*s*.012;const x=cx+Math.cos(a)*(r+noise),y=cy+Math.sin(a)*(r*.94+noise);i?c.lineTo(x,y):c.moveTo(x,y);}c.strokeStyle='hsla('+(hue+ring*9)+',65%,65%,'+(ring===0?.085:.04)+')';c.stroke();}
   if(this.mode==='statistics'||this.mode==='mixed'){for(const sign of [-1,1]){c.beginPath();for(let i=0;i<32;i++){const x=cx+sign*s*.36+i*s*.003,y=cy+s*.08+Math.sin(i*.57+clock*.002)*s*.026*Math.sin(i/32*Math.PI);i?c.lineTo(x,y):c.moveTo(x,y);}c.strokeStyle='hsla('+hue+',80%,75%,.25)';c.stroke();}}
  }
  c.font=Math.max(4,fw/110*1.32)+'px monospace';
  const abstractStrength=this.mode==='abstract'?1:this.mode==='neural'?.58:this.mode==='mixed'?.28:0;
  for(const p of this.samples){let px=p.x,py=p.y,lum=p.lum;if(abstractStrength&&Math.sin(p.seed*91+clock*.0017+py*18)>.93-abstractStrength*.08)continue;
   const eyeL=((px+.196)/.113)**2+((py+.06)/.038)**2,eyeR=((px-.19)/.12)**2+((py+.06)/.038)**2;
   if(eyeL<1||eyeR<1){if(close>.15){py=-.06+(py+.06)*(1-close);lum*=1-close*.42;}else{px+=rx*.015;lum*=1.22;}}
   if(this.speaking&&Math.abs(px)<.2&&py>.245&&py<.32){const viseme=.2+.8*Math.abs(Math.sin(t/(58+Math.abs(px)*120)+p.seed*2.4));const open=viseme*(.42+this.speechEnergy*.78);py+=(py-.245)*open*.28+open*.018;px*=1-open*.045;lum*=.78+open*.16;}
   const depth=Math.sqrt(Math.max(0,1-(px*1.95)**2-(py*1.65)**2));let x=cx+px*fw*Math.cos(rx)+depth*fw*rx*.48,y=cy+py*fh*Math.cos(ry)+depth*fh*ry*.42;const fracture=Math.sin(py*31+clock*.0012+p.seed*7)*abstractStrength;x+=fracture*s*.011*(.35+Math.abs(px)*1.4);y+=Math.sin(px*24-clock*.001+p.seed*11)*s*.004*abstractStrength;
   if(magnet){const dx=mx-x,dy=my-y,dist=Math.hypot(dx,dy),force=Math.max(0,1-dist/(s*.21));x+=dx*force*.07;y+=dy*force*.07;}
   // Dissolving edge fragments float out and settle back into the face.
   const edge=Math.sqrt((px*2)**2+(py*2)**2),wave=Math.max(0,Math.sin(clock*.0007+p.seed*20)-.65);if(auto&&edge>.78){x+=px*wave*32;y+=py*wave*28;}
   const intensity=Math.min(1,lum*1.7),scan=auto?.9+.1*Math.sin(py*7-clock*.0014):1;const glow=this.thinking?1.13:1;
   const alpha=Math.min(.99,intensity*1.85*scan*glow),spectralShift=spectral?Math.sin(p.seed*25+clock*.00023)*72:0;c.fillStyle='hsla('+(hue+spectralShift+abstractStrength*Math.sin(p.seed*19)*24)+','+(48+intensity*34)+'%,'+(24+intensity*68)+'%,'+alpha+')';const glyph=auto&&Math.sin(clock/700+p.seed*90)>.988?(p.glyph==='0'?'1':'0'):p.glyph;c.fillText(glyph,x,y);if(abstractStrength>.5&&Math.abs(fracture)>.72){c.fillStyle='hsla('+(hue+spectralShift+28)+',88%,74%,'+(alpha*.18*abstractStrength)+')';c.fillText(glyph,x+fracture*s*.018,y-fracture*s*.006);}
  }
 }
}
