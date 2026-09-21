export class BinaryAvatar {
 constructor(canvas){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.pointer={x:0,y:0};this.pointerActive=false;this.rotation={x:0,y:0};this.track=true;this.animate=!matchMedia('(prefers-reduced-motion: reduce)').matches;this.color='green';this.mode='mixed';this.speaking=false;this.thinking=false;this.action='';this.actionStart=0;this.blinkStart=-10000;this.nextBlink=performance.now()+3000;this.samples=[];this.last=0;
  this.particles=Array.from({length:220},(_,i)=>({angle:i*2.39996,r:.53+Math.random()*.39,speed:.08+Math.random()*.12,seed:Math.random()*100,x:0,y:0,glyph:Math.random()>.5?'1':'0'}));
  new ResizeObserver(()=>this.resize()).observe(canvas);
  const img=new Image();img.onload=()=>{const s=document.createElement('canvas');s.width=110;s.height=142;const c=s.getContext('2d',{willReadFrequently:true});c.drawImage(img,120,0,322,393,0,0,110,142);const data=c.getImageData(0,0,110,142).data;
   for(let y=0;y<142;y+=1.35)for(let x=0;x<110;x+=1.2){const dx=(x-55)/55,dy=(y-69)/70;if(dx*dx+dy*dy>1)continue;const i=(Math.floor(y)*110+Math.floor(x))*4;const lum=(data[i]*.21+data[i+1]*.72+data[i+2]*.07)/255;if(lum>.035)this.samples.push({x:x/110-.5,y:y/142-.5,lum,seed:Math.random(),glyph:Math.random()>.5?'1':'0'});}this.ready=true;};
  img.src='/reference.png';img.onerror=()=>document.dispatchEvent(new CustomEvent('avatar-error'));requestAnimationFrame(t=>this.frame(t));
 }
 resize(){const r=this.canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;const d=Math.min(devicePixelRatio||1,2);this.canvas.width=this.w*d;this.canvas.height=this.h*d;this.ctx.setTransform(d,0,0,d,0,0);}
 trigger(action){this.action=action;this.actionStart=performance.now();if(action==='blink')this.blinkStart=this.actionStart;}
 frame(t){requestAnimationFrame(v=>this.frame(v));if(document.hidden||t-this.last<32)return;this.last=t;const c=this.ctx,w=this.w,h=this.h;if(!w||!h)return;c.clearRect(0,0,w,h);
  const hue=this.color==='cyan'?175:this.color==='gold'?43:132,auto=this.animate,clock=auto?t:0,s=Math.min(w,h),fh=s*.67,fw=fh*.8;
  const floatX=auto?Math.sin(t/3700)*5:0,floatY=auto?Math.sin(t/2500)*8:0,cx=w/2+floatX,cy=h/2+floatY;
  this.rotation.x+=((this.track?this.pointer.x:0)-this.rotation.x)*.075;this.rotation.y+=((this.track?this.pointer.y:0)-this.rotation.y)*.075;
  let rx=this.rotation.x*.20,ry=this.rotation.y*.08;const since=t-this.actionStart;if(since<1500){const env=Math.sin(since/1500*Math.PI);if(this.action==='shake')rx+=Math.sin(since/110)*.29*env;if(this.action==='nod')ry+=Math.sin(since/140)*.18*env;}
  if(auto&&t>this.nextBlink){this.blinkStart=t;this.nextBlink=t+3200+Math.random()*3800;}const bt=t-this.blinkStart,close=bt>=0&&bt<230?Math.sin(bt/230*Math.PI):0;
  const magnet=this.track&&this.pointerActive, mx=w/2+this.pointer.x*w/2,my=h/2+this.pointer.y*h/2;
  c.textAlign='center';
  // Free binary particles: matrix streams, orbital noise, or statistical curves.
  for(let i=0;i<this.particles.length;i++){const p=this.particles[i],phase=clock*.0001*p.speed*7+p.angle;let x,y;let kind=this.mode==='mixed'?i%3:this.mode==='matrix'?0:this.mode==='statistics'?1:2;
   if(kind===0){x=cx+Math.sin(p.angle)*s*.46;y=((clock*.018*(.5+p.speed*5)+p.seed*40)%(s*.9))+cy-s*.45;if(Math.abs(x-cx)<fw*.47&&Math.abs(y-cy)<fh*.44)x+=Math.sign(x-cx||1)*fw*.48;}
   else if(kind===1){x=cx+Math.cos(phase)*s*p.r*.51;y=cy+Math.sin(phase*2.1)*s*.25+Math.sin(phase*8)*s*.02;}
   else{x=cx+Math.cos(phase)*s*p.r*.53;y=cy+Math.sin(phase*1.03)*s*p.r*.48;}
   if(magnet){const dx=mx-x,dy=my-y,dist=Math.hypot(dx,dy);const force=Math.max(0,1-dist/(s*.5));x+=dx*force*.45;y+=dy*force*.45;}
   if(!p.x&&!p.y){p.x=x;p.y=y;}p.x+=(x-p.x)*.12;p.y+=(y-p.y)*.12;
   const distance=Math.hypot((p.x-cx)/(fw*.57),(p.y-cy)/(fh*.59)),fade=distance<.9?.08:.18+Math.sin(phase+p.seed)*.13;
   c.font=(5.5+s*.005+(i%3))+'px monospace';c.fillStyle='hsla('+hue+',80%,72%,'+Math.max(.04,fade)+')';const value=kind===1&&i%9===0?((Math.sin(phase)+1)*.5).toFixed(2):p.glyph;c.fillText(value,p.x,p.y);
  }
  // Thin, generative statistical signals and magnetic field lines.
  c.lineWidth=.6;
  if(this.mode!=='matrix'){for(let ring=0;ring<3;ring++){c.beginPath();for(let i=0;i<=100;i++){const a=i/100*Math.PI*2,r=s*(.31+ring*.037),noise=Math.sin(a*(ring+3)+clock*.0004)*s*.012;const x=cx+Math.cos(a)*(r+noise),y=cy+Math.sin(a)*(r*.94+noise);i?c.lineTo(x,y):c.moveTo(x,y);}c.strokeStyle='hsla('+hue+',65%,65%,'+(ring===0?.085:.04)+')';c.stroke();}
   if(this.mode==='statistics'||this.mode==='mixed'){for(const sign of [-1,1]){c.beginPath();for(let i=0;i<32;i++){const x=cx+sign*s*.36+i*s*.003,y=cy+s*.08+Math.sin(i*.57+clock*.002)*s*.026*Math.sin(i/32*Math.PI);i?c.lineTo(x,y):c.moveTo(x,y);}c.strokeStyle='hsla('+hue+',80%,75%,.25)';c.stroke();}}
  }
  c.font=Math.max(4,fw/110*1.32)+'px monospace';
  for(const p of this.samples){let px=p.x,py=p.y,lum=p.lum;
   const eyeL=((px+.196)/.113)**2+((py+.06)/.038)**2,eyeR=((px-.19)/.12)**2+((py+.06)/.038)**2;
   if(eyeL<1||eyeR<1){if(close>.15){py=-.06+(py+.06)*(1-close);lum*=1-close*.42;}else{px+=rx*.015;lum*=1.22;}}
   if(this.speaking&&Math.abs(px)<.19&&py>.255&&py<.31){py+=(Math.sin(t/85)*.5+.5)*.021;lum*=.75;}
   const depth=Math.sqrt(Math.max(0,1-(px*1.95)**2-(py*1.65)**2));let x=cx+px*fw*Math.cos(rx)+depth*fw*rx*.48,y=cy+py*fh*Math.cos(ry)+depth*fh*ry*.42;
   if(magnet){const dx=mx-x,dy=my-y,dist=Math.hypot(dx,dy),force=Math.max(0,1-dist/(s*.21));x+=dx*force*.07;y+=dy*force*.07;}
   // Dissolving edge fragments float out and settle back into the face.
   const edge=Math.sqrt((px*2)**2+(py*2)**2),wave=Math.max(0,Math.sin(clock*.0007+p.seed*20)-.65);if(auto&&edge>.78){x+=px*wave*32;y+=py*wave*28;}
   const intensity=Math.min(1,lum*1.7),scan=auto?.9+.1*Math.sin(py*7-clock*.0014):1;const glow=this.thinking?1.13:1;
   c.fillStyle='hsla('+hue+','+(45+intensity*28)+'%,'+(25+intensity*65)+'%,'+Math.min(.99,intensity*1.85*scan*glow)+')';c.fillText(auto&&Math.sin(clock/700+p.seed*90)>.988?(p.glyph==='0'?'1':'0'):p.glyph,x,y);
  }
 }
}
