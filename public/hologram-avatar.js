const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const hash=(x,y=0,s=0)=>{
  const n=Math.sin(x*12.9898+y*78.233+s*37.719)*43758.5453123;
  return n-Math.floor(n);
};

const VALID_STATES=new Set(['idle','listening','thinking','speaking','processing','error']);
const VALID_EMOTIONS=new Set(['neutral','focused','happy','curious']);

function roundedRect(ctx,x,y,w,h,r){
  const radius=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+radius,y);
  ctx.lineTo(x+w-radius,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+radius);
  ctx.lineTo(x+w,y+h-radius);
  ctx.quadraticCurveTo(x+w,y+h,x+w-radius,y+h);
  ctx.lineTo(x+radius,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-radius);
  ctx.lineTo(x,y+radius);
  ctx.quadraticCurveTo(x,y,x+radius,y);
  ctx.closePath();
}

export class HologramAvatar{
  constructor(canvas){
    if(!canvas)throw new Error('Canvas avatar Dudidam tidak ditemukan.');
    this.canvas=canvas;
    this.ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});
    if(!this.ctx)throw new Error('Canvas 2D tidak tersedia.');

    this.pointer={x:0,y:0};
    this.pointerActive=false;
    this.gazePointer={x:0,y:0};
    this.gazeActive=false;
    this.rotation={x:0,y:0};
    this.track=true;
    this.animate=true;
    this.paused=false;
    this.color='cyan';
    this.persona='dudidam';
    this.mode='hologram';
    this.environment='auto';

    this.state='idle';
    this.emotion='neutral';
    this.speaking=false;
    this.listening=false;
    this.thinking=false;
    this.evolving=false;
    this.audioLevel=0;
    this.audioTarget=0;
    this.earSpectrum={low:0,mid:0,high:0};

    this.action='';
    this.actionStart=0;
    this.blinkStart=-10000;
    this.nextBlink=performance.now()+2200+Math.random()*2600;
    this.pulseUntil=0;
    this.glitchUntil=0;
    this.transitionKind='';
    this.transitionStart=0;
    this.transitionDuration=0;
    this.lastFrame=0;
    this.frameCost=0;
    this.lowPowerUntil=0;
    this.destroyed=false;

    this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.coarsePointer=matchMedia('(pointer: coarse)').matches;
    this.themeQuery=matchMedia('(prefers-color-scheme: light)');
    this.theme='auto';

    this.voxels=this.buildFaceVoxels();
    this.floaters=this.buildFloaters(72);
    this.dust=this.buildDust(46);
    this.flow=this.buildFlow(34);

    this.resizeObserver=new ResizeObserver(()=>this.resize());
    this.resizeObserver.observe(canvas);
    this.themeListener=()=>this.canvas.dispatchEvent(new CustomEvent('dudidam-theme-change'));
    this.themeQuery.addEventListener?.('change',this.themeListener);

    this.resize();
    this.raf=requestAnimationFrame(t=>this.frame(t));
  }

  buildFaceVoxels(){
    const voxels=[];
    for(let gy=-16;gy<=17;gy++){
      for(let gx=-12;gx<=12;gx++){
        const nx=gx/12;
        const ny=(gy+.5)/17.5;
        const jawTaper=ny>0?1-ny*.18:1;
        const domeTaper=ny<-.45?1-(Math.abs(ny)-.45)*.34:1;
        const sx=jawTaper*domeTaper;
        if((nx*nx)/(sx*sx)+ny*ny>1)continue;

        const eyeL=((nx+.34)/.235)**2+((ny+.18)/.105)**2<1;
        const eyeR=((nx-.34)/.235)**2+((ny+.18)/.105)**2<1;
        const mouth=Math.abs(nx)<.34&&Math.abs(ny-.43)<.05;
        if(eyeL||eyeR||mouth)continue;

        const edge=Math.sqrt(nx*nx+ny*ny);
        const keep=hash(gx,gy,3);
        if(edge>.78&&keep<.34)continue;
        if(edge<=.78&&keep<.075)continue;

        const zone=ny<-.34?'forehead':ny<.08?'upper':ny<.34?'cheek':'jaw';
        voxels.push({
          nx,ny,zone,
          seed:hash(gx,gy,1),
          phase:hash(gx,gy,2)*TAU,
          depth:hash(gx,gy,4)
        });
      }
    }
    return voxels;
  }

  buildFloaters(count){
    return Array.from({length:count},(_,i)=>({
      seed:hash(i,3,9),phase:hash(i,7,11)*TAU,speed:.35+hash(i,5,13)*.9,
      side:i%2?-1:1,band:i%5
    }));
  }

  buildDust(count){
    return Array.from({length:count},(_,i)=>({
      x:hash(i,2,21),y:hash(i,4,22),seed:hash(i,6,23),speed:.05+hash(i,8,24)*.12
    }));
  }

  buildFlow(count){
    return Array.from({length:count},(_,i)=>({
      lane:(i%7-3)/3,seed:hash(i,9,30),phase:hash(i,11,31),speed:.18+hash(i,13,32)*.36
    }));
  }

  resize(){
    const rect=this.canvas.getBoundingClientRect();
    const dpr=Math.min(window.devicePixelRatio||1,2);
    this.w=Math.max(1,rect.width);
    this.h=Math.max(1,rect.height);
    this.canvas.width=Math.round(this.w*dpr);
    this.canvas.height=Math.round(this.h*dpr);
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
    this.detail=this.w<310||this.h<310?.62:this.w<430||this.h<430?.82:1;
  }

  resolvedTheme(){
    if(this.theme==='dark'||this.theme==='light')return this.theme;
    return this.themeQuery.matches?'light':'dark';
  }

  setTheme(value='auto'){
    this.theme=['auto','dark','light'].includes(value)?value:'auto';
    this.environment=this.theme;
  }

  setEnvironment(value='auto'){this.setTheme(value);}

  setState(value='idle'){
    const next=VALID_STATES.has(value)?value:'idle';
    if(next===this.state)return;
    this.state=next;
    this.listening=next==='listening';
    this.thinking=next==='thinking'||next==='processing';
    if(next==='speaking')this.speaking=true;
    else if(this.audioTarget<.025)this.speaking=false;
    if(next==='error')this.triggerGlitch(900);
    if(next==='processing')this.pulse();
  }

  setEmotion(value='neutral'){
    const aliases={angry:'focused',annoyed:'focused',sad:'curious'};
    const mapped=aliases[value]||value;
    this.emotion=VALID_EMOTIONS.has(mapped)?mapped:'neutral';
  }

  setTalking(active=false){this.speaking=Boolean(active);if(this.speaking)this.setState('speaking');}
  setAudioLevel(level=0){this.audioTarget=clamp(Number(level)||0,0,1);}
  setSpeechEnergy(level=.62){this.setAudioLevel(level);this.speaking=this.audioTarget>.025;if(this.speaking)this.setState('speaking');}
  setListening(value=false){this.listening=Boolean(value);if(this.listening)this.setState('listening');else if(this.state==='listening')this.setState('idle');}
  setEarSpectrum(value={}){for(const band of ['low','mid','high'])this.earSpectrum[band]=clamp(Number(value[band])||0,0,1);}
  setPaused(value=false){this.paused=Boolean(value);}
  setEvolving(value=false){this.evolving=Boolean(value);if(this.evolving)this.setState('processing');else if(this.state==='processing')this.setState('idle');}
  completeEvolution(){this.evolving=false;this.pulse(1500);this.setState('processing');setTimeout(()=>{if(!this.destroyed&&this.state==='processing')this.setState('idle');},1300);}
  activateAllEffects(value=true){if(value)this.pulse(1200);}
  setAvatarVariant(){/* legacy no-op: Dudidam now has one code-rendered hologram avatar. */}

  pulse(duration=950){this.pulseUntil=Math.max(this.pulseUntil,performance.now()+duration);}
  pulseAvatar(duration=950){this.pulse(duration);}
  triggerGlitch(duration=620){this.glitchUntil=Math.max(this.glitchUntil,performance.now()+duration);}

  trigger(action=''){
    this.action=action;
    this.actionStart=performance.now();
    if(action==='blink')this.blinkStart=this.actionStart;
    if(action==='pulse')this.pulse();
    if(action==='glitch')this.triggerGlitch();
  }

  reveal(){this.transitionKind='';this.transitionStart=0;this.transitionDuration=0;}
  awaken(duration=4200){this.transitionKind='assemble';this.transitionStart=performance.now();this.transitionDuration=Math.max(900,Number(duration)||4200);this.pulse(duration);}
  dismiss(duration=3000){this.transitionKind='disassemble';this.transitionStart=performance.now();this.transitionDuration=Math.max(700,Number(duration)||3000);}
  isAwakening(now=performance.now()){return Boolean(this.transitionKind)&&now-this.transitionStart<this.transitionDuration;}

  transition(now){
    if(!this.transitionKind)return {presence:1,active:false};
    const raw=clamp((now-this.transitionStart)/Math.max(1,this.transitionDuration),0,1);
    const eased=raw*raw*(3-2*raw);
    const presence=this.transitionKind==='assemble'?eased:1-eased;
    if(raw>=1)this.transitionKind='';
    return {presence,active:raw<1};
  }

  style(){
    const light=this.resolvedTheme()==='light';
    const state=this.state;
    const error=state==='error';
    return {
      light,
      glow:light?.48:.92,
      alpha:light?.68:.9,
      line:light?'rgba(25,105,158,.44)':'rgba(132,225,255,.56)',
      cyan:error?'255,92,151':'63,207,255',
      blue:error?'180,74,255':'77,132,255',
      violet:error?'255,101,190':'157,105,255',
      dark:light?'rgba(239,248,252,.78)':'rgba(0,8,16,.76)'
    };
  }

  stateEnergy(time){
    const pulse=performance.now()<this.pulseUntil?.32+.68*(.5+.5*Math.sin(time*.006)):0;
    const map={idle:.16,listening:.42,thinking:.56,speaking:.62,processing:.72,error:.84};
    return clamp((map[this.state]||.16)+pulse*.36+this.audioLevel*.38,0,1);
  }

  cubePalette(seed,alpha,style){
    const rgb=seed>.72?style.cyan:seed>.34?style.blue:style.violet;
    return {
      fill:`rgba(${rgb},${alpha})`,
      edge:`rgba(219,247,255,${alpha*(style.light?.54:.82)})`,
      shadow:`rgba(${rgb},${alpha*style.glow})`
    };
  }

  drawCube(ctx,x,y,size,seed,alpha,depth,rot=0){
    if(alpha<.012||size<.5)return;
    const style=this.style();
    const p=this.cubePalette(seed,alpha,style);
    const off=Math.max(.4,size*(.12+.2*depth));

    ctx.save();
    ctx.translate(x,y);
    if(rot)ctx.rotate(rot);
    ctx.shadowColor=p.shadow;
    ctx.shadowBlur=size*(style.light?.65:1.55);
    ctx.fillStyle=p.fill;
    ctx.fillRect(-size/2,-size/2,size,size);

    if(this.detail>.72&&size>3){
      ctx.fillStyle=`rgba(225,248,255,${alpha*.17})`;
      ctx.fillRect(-size/2+off*.25,-size/2+off*.2,size*.78,Math.max(.6,size*.12));
      ctx.fillStyle=`rgba(16,64,118,${alpha*.18})`;
      ctx.fillRect(size/2-off,-size/2+off*.25,off,size*.8);
    }

    ctx.strokeStyle=p.edge;
    ctx.lineWidth=Math.max(.45,size*.055);
    ctx.strokeRect(-size/2,-size/2,size,size);
    ctx.restore();
  }

  drawBackdrop(ctx,cx,cy,fw,fh,time,energy,style){
    ctx.save();

    const aura=ctx.createRadialGradient(cx,cy,fw*.06,cx,cy,fw*.76);
    aura.addColorStop(0,`rgba(${style.cyan},${.11*style.glow+.08*energy})`);
    aura.addColorStop(.48,`rgba(${style.blue},${.05*style.glow})`);
    aura.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=aura;
    ctx.beginPath();ctx.arc(cx,cy,fw*.78,0,TAU);ctx.fill();

    const ringPulse=.5+.5*Math.sin(time*.0012);
    for(let ring=0;ring<3;ring++){
      const radius=fw*(.49+ring*.085+ringPulse*.008);
      ctx.beginPath();
      ctx.arc(cx,cy-fh*.015,radius,(-.18+ring*.08)*Math.PI,1.48*Math.PI);
      ctx.strokeStyle=`rgba(${ring===2?style.violet:style.cyan},${(.08+energy*.06)*(style.light?.7:1)})`;
      ctx.lineWidth=Math.max(.6,fw*.0023);
      ctx.setLineDash([fw*.035,fw*.022+ring*2]);
      ctx.lineDashOffset=-time*.012*(ring%2?1:-1);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    for(const d of this.dust){
      const y=((d.y+time*.00002*d.speed)%1)*this.h;
      const x=d.x*this.w+Math.sin(time*.00035+d.seed*TAU)*fw*.025;
      const a=(.035+d.seed*.075)*(style.light?.55:1);
      ctx.fillStyle=`rgba(${d.seed>.62?style.cyan:style.violet},${a})`;
      ctx.fillRect(x,y,1+d.seed*1.3,1+d.seed*1.3);
    }

    // Very subtle scan line/noise field.
    const scan=(time*.035)%Math.max(20,this.h);
    ctx.fillStyle=`rgba(${style.cyan},${style.light?.025:.045})`;
    for(let y=-scan;y<this.h;y+=22)ctx.fillRect(0,y,this.w,.55);
    ctx.restore();
  }

  drawEyes(ctx,cx,cy,fw,fh,blink,energy,style){
    const eyeY=cy-fh*.11;
    const eyeW=fw*.205;
    const open=Math.max(1.4,fh*.018*(1-blink*.92));
    const focused=this.emotion==='focused'||this.state==='thinking';
    for(const side of [-1,1]){
      const eyeX=cx+side*fw*.205;
      ctx.save();
      ctx.shadowColor=`rgba(${style.cyan},${.35+.35*style.glow})`;
      ctx.shadowBlur=fw*(style.light?.025:.055);
      roundedRect(ctx,eyeX-eyeW/2,eyeY-open/2,eyeW,open,open/2);
      ctx.fillStyle=`rgba(${style.cyan},${.55+.22*energy})`;
      ctx.fill();
      ctx.shadowBlur=0;
      ctx.strokeStyle=`rgba(225,250,255,${style.light?.42:.72})`;
      ctx.lineWidth=Math.max(.7,fw*.003);
      ctx.stroke();
      if(focused){
        ctx.fillStyle=`rgba(${style.violet},${.18+.18*energy})`;
        ctx.fillRect(eyeX-eyeW*.36,eyeY-open*.9,eyeW*.72,Math.max(1,open*.18));
      }
      ctx.restore();
    }
  }

  drawMouth(ctx,cx,cy,fw,fh,time,energy,style){
    const speaking=this.state==='speaking'||this.speaking;
    const level=speaking?clamp(this.audioLevel,0,1):0;
    const width=fw*(.23+level*.025);
    const y=cy+fh*.255;
    const curve=this.emotion==='happy'?-fh*.012:this.emotion==='curious'?fh*.005:0;
    const open=fh*(.005+level*.045);
    ctx.save();
    ctx.shadowColor=`rgba(${style.cyan},${.28+.34*level})`;
    ctx.shadowBlur=fw*(style.light?.018:.038);
    ctx.strokeStyle=`rgba(${style.cyan},${.52+.3*energy})`;
    ctx.lineWidth=Math.max(1.2,fw*.012);
    ctx.beginPath();
    ctx.moveTo(cx-width,y+curve);
    ctx.quadraticCurveTo(cx,y+open+curve,cx+width,y+curve);
    ctx.stroke();
    if(level>.08){
      ctx.strokeStyle=`rgba(${style.violet},${.32+.34*level})`;
      ctx.lineWidth=Math.max(.9,fw*.007);
      ctx.beginPath();
      ctx.moveTo(cx-width*.78,y+curve);
      ctx.quadraticCurveTo(cx,y-open*.7+curve,cx+width*.78,y+curve);
      ctx.stroke();
    }
    ctx.restore();

    // Jaw voxels react to audio level.
    if(level>.03){
      for(let i=0;i<7;i++){
        const u=i/6;
        const x=cx+(u-.5)*fw*.44;
        const arch=Math.sin(u*Math.PI);
        this.drawCube(ctx,x,y+open*.85*arch,Math.max(2,fw*.025),.28+u*.55,.22+.42*level,arch,.05*Math.sin(time*.009+i));
      }
    }
  }

  drawEars(ctx,cx,cy,fw,fh,time,energy,style){
    const band=Math.max(this.earSpectrum.low,this.earSpectrum.mid,this.earSpectrum.high,this.state==='listening'?.22:0);
    for(const side of [-1,1]){
      const ex=cx+side*fw*.555;
      const ey=cy+fh*.02;
      const cube=Math.max(2.1,fw*.028);
      for(let i=0;i<8;i++){
        const a=-1.95+i/7*3.9;
        this.drawCube(ctx,ex+side*Math.cos(a)*fw*.047,ey+Math.sin(a)*fh*.095,cube,.35+i*.07,.34+energy*.13,.35);
      }
      if(band>.02){
        for(let w=0;w<3;w++){
          const travel=(time*.00035+w*.24)%1;
          ctx.beginPath();
          ctx.arc(ex,ey,fw*(.07+travel*.14),side<0?Math.PI*.55:-Math.PI*.45,side<0?Math.PI*1.45:Math.PI*.45,side>0);
          ctx.strokeStyle=`rgba(${style.cyan},${(1-travel)*(.12+band*.38)})`;
          ctx.lineWidth=Math.max(.7,fw*.003);
          ctx.stroke();
        }
      }
    }
  }

  drawFlow(ctx,cx,cy,fw,fh,time,energy,style){
    for(let i=0;i<this.flow.length;i++){
      if(this.detail<.75&&i%2)continue;
      const p=this.flow[i];
      const progress=(p.phase+time*.00008*p.speed)%1;
      const y=cy+fh*.43-progress*fh*.88;
      const envelope=Math.sin(progress*Math.PI);
      const x=cx+p.lane*fw*.36*envelope+Math.sin(time*.0012+p.seed*TAU)*fw*.012;
      const alpha=(.07+.13*energy)*envelope*(style.light?.7:1);
      ctx.fillStyle=`rgba(${p.seed>.54?style.cyan:style.violet},${alpha})`;
      const len=fh*(.018+.035*p.seed);
      ctx.fillRect(x,y,Math.max(.65,fw*.002),len);
    }
  }

  drawProcessingOrbit(ctx,cx,cy,fw,fh,time,energy,style){
    if(this.state!=='processing'&&!this.evolving)return;
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    for(let i=0;i<18;i++){
      if(this.detail<.75&&i%2)continue;
      const a=time*.00065+i/18*TAU;
      const radius=fw*(.55+.035*Math.sin(time*.001+i));
      const x=cx+Math.cos(a)*radius;
      const y=cy+Math.sin(a)*fh*.49;
      this.drawCube(ctx,x,y,Math.max(1.8,fw*.019),i/18,.18+.26*energy,.55,.2*Math.sin(a));
    }
    ctx.restore();
  }

  drawFace(ctx,cx,cy,fw,fh,time,energy,style,blink,presence){
    const thought=this.state==='thinking'||this.state==='processing'||this.evolving;
    const speaking=this.state==='speaking'||this.speaking;
    const error=this.state==='error'||performance.now()<this.glitchUntil;
    const pulseY=cy+fh*.5-((time*.00016)%1)*fh;
    const popStrength=(thought?.75:.28)+(speaking?this.audioLevel*.9:0);

    for(let i=0;i<this.voxels.length;i++){
      if(this.detail<.7&&i%2)continue;
      const p=this.voxels[i];
      const zoneActive=p.zone==='forehead'&&thought||p.zone==='cheek'&&speaking||p.zone==='jaw'&&speaking;
      const wave=.5+.5*Math.sin(time*.001*(.65+p.seed)+p.phase);
      const pop=(zoneActive?popStrength:.12)*wave*(2+18*p.seed);
      const radialX=p.nx||.001;
      const radialY=p.ny||.001;
      const norm=Math.max(.25,Math.hypot(radialX,radialY));
      let x=cx+p.nx*fw*.49+(radialX/norm)*pop;
      let y=cy+p.ny*fh*.48+(radialY/norm)*pop*.55;

      x+=Math.sin(time*.0011+p.phase)*fw*.0025*(1+energy);
      y+=Math.cos(time*.0009+p.phase)*fh*.0018*(1+energy);

      if(error&&hash(i,Math.floor(time/75),44)>.84){
        x+=(hash(i,2,45)-.5)*fw*.1;
        y+=(hash(i,3,46)-.5)*fh*.035;
      }

      const distanceToPulse=Math.abs(y-pulseY);
      const pulseBoost=Math.exp(-(distanceToPulse*distanceToPulse)/(2*(fh*.045)**2));
      const nose=Math.abs(p.nx)<.095&&p.ny>-.16&&p.ny<.25;
      const base=Math.max(1.8,Math.min(fw,fh)*(.022+(nose?.003:0))*(.72+p.depth*.32));
      const alpha=clamp((.22+p.depth*.32+energy*.1+pulseBoost*.19)*presence,0,.82);
      this.drawCube(ctx,x,y,base,p.seed,alpha,p.depth,(wave-.5)*.11*popStrength);
    }

    // Geometric nose bridge and tip.
    const nc=Math.max(2.2,fw*.029);
    for(let i=-2;i<=2;i++)this.drawCube(ctx,cx,cy+fh*(.015+i*.045),nc*(.9+Math.abs(i)*.035),.64+i*.055,.44+.08*energy,.75);
    this.drawCube(ctx,cx-fw*.036,cy+fh*.22,nc*.7,.48,.38,.58);
    this.drawCube(ctx,cx+fw*.036,cy+fh*.22,nc*.7,.78,.38,.58);
  }

  drawFloaters(ctx,cx,cy,fw,fh,time,energy,style){
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    for(let i=0;i<this.floaters.length;i++){
      if(this.detail<.78&&i%2)continue;
      const p=this.floaters[i];
      const upper=p.band<2;
      const baseY=upper?cy-fh*(.26+p.band*.18):cy+fh*(-.02+(p.band-2)*.19);
      const pulse=.5+.5*Math.sin(time*.001*(.7+p.speed)+p.phase);
      const approach=.18+.34*(.5+.5*Math.sin(time*.00055+p.phase*1.4));
      let x=cx+p.side*fw*(upper?.43:.46)*(1-approach*.3);
      let y=baseY;
      const orbit=fw*(.025+.045*p.seed)*(1+energy*.28);
      x+=Math.sin(time*.001*p.speed+p.phase)*orbit*p.side;
      y+=Math.cos(time*.00078*p.speed+p.phase)*orbit*.65;
      const size=Math.max(1.5,fw*(.015+.018*p.seed));
      this.drawCube(ctx,x,y,size,.3+p.seed*.65,(.08+.25*pulse+.1*energy)*(style.light?.7:1),p.seed,.2*Math.sin(time*.001+p.phase));
    }
    ctx.restore();
  }

  frame(time){
    if(this.destroyed)return;
    this.raf=requestAnimationFrame(t=>this.frame(t));
    if(this.paused||document.hidden)return;

    const targetInterval=performance.now()<this.lowPowerUntil?33:16;
    if(time-this.lastFrame<targetInterval)return;
    const started=performance.now();
    this.lastFrame=time;

    this.audioLevel=lerp(this.audioLevel,this.audioTarget,this.reducedMotion?.08:.18);
    if(!this.speaking&&this.audioTarget<.01)this.audioTarget=0;

    if(time>this.nextBlink){
      this.blinkStart=time;
      this.nextBlink=time+2300+Math.random()*4100;
    }
    const blinkAge=time-this.blinkStart;
    const blink=blinkAge>=0&&blinkAge<210?Math.sin(blinkAge/210*Math.PI):0;

    const ctx=this.ctx,w=this.w,h=this.h;
    if(!w||!h)return;
    ctx.clearRect(0,0,w,h);

    const size=Math.min(w,h);
    const scale=clamp(size/500,.58,1.22);
    const fw=size*.53*scale;
    const fh=fw*1.28;
    const breathing=this.animate&&!this.reducedMotion?Math.sin(time*.0011)*fh*.006:0;
    const float=this.animate&&!this.reducedMotion?Math.sin(time*.00074)*fh*.009:0;

    const target=this.coarsePointer||!this.track?{x:0,y:0}:(this.gazeActive?this.gazePointer:this.pointer);
    const ease=this.reducedMotion?.12:.045;
    this.rotation.x=lerp(this.rotation.x,clamp(target.x,-1,1),ease);
    this.rotation.y=lerp(this.rotation.y,clamp(target.y,-1,1),ease);
    let px=this.rotation.x*fw*.055;
    let py=this.rotation.y*fh*.025;

    const actionAge=time-this.actionStart;
    if(actionAge<1200){
      const e=Math.sin(actionAge/1200*Math.PI);
      if(this.action==='shake')px+=Math.sin(actionAge*.025)*fw*.045*e;
      if(this.action==='nod')py+=Math.sin(actionAge*.018)*fh*.035*e;
    }

    const transition=this.transition(time);
    const presence=transition.presence;
    const style=this.style();
    const energy=this.stateEnergy(time);
    const cx=w/2+px;
    const cy=h/2+float+breathing+py;

    ctx.save();
    if(presence<1){
      ctx.globalAlpha=Math.max(.001,presence);
      ctx.translate(cx,cy);
      const s=.76+.24*presence;
      ctx.scale(s,s);
      ctx.translate(-cx,-cy);
    }

    this.drawBackdrop(ctx,cx,cy,fw,fh,time,energy,style);
    this.drawFlow(ctx,cx,cy,fw,fh,time,energy,style);
    this.drawFace(ctx,cx,cy,fw,fh,time,energy,style,blink,presence);
    this.drawEars(ctx,cx,cy,fw,fh,time,energy,style);
    this.drawEyes(ctx,cx,cy,fw,fh,blink,energy,style);
    this.drawMouth(ctx,cx,cy,fw,fh,time,energy,style);
    this.drawProcessingOrbit(ctx,cx,cy,fw,fh,time,energy,style);
    this.drawFloaters(ctx,cx,cy,fw,fh,time,energy,style);

    ctx.restore();

    this.frameCost=performance.now()-started;
    if(this.frameCost>24)this.lowPowerUntil=performance.now()+2200;
  }

  destroy(){
    this.destroyed=true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    this.themeQuery.removeEventListener?.('change',this.themeListener);
  }
}

// Compatibility alias for older Dudidam integrations.
export const BinaryAvatar=HologramAvatar;
