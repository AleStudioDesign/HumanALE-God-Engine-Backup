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
    this.nextBlink=performance.now()+2100+Math.random()*3200;
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

    this.faceTiles=this.buildFaceTiles();
    this.neckTiles=this.buildNeckTiles();
    this.shoulderTiles=this.buildShoulderTiles();
    this.floaters=this.buildFloaters(104);
    this.dust=this.buildDust(64);
    this.flow=this.buildFlow(38);

    this.resizeObserver=new ResizeObserver(()=>this.resize());
    this.resizeObserver.observe(canvas);
    this.themeListener=()=>this.canvas.dispatchEvent(new CustomEvent('dudidam-theme-change'));
    this.themeQuery.addEventListener?.('change',this.themeListener);

    this.resize();
    this.raf=requestAnimationFrame(t=>this.frame(t));
  }

  buildFaceTiles(){
    const tiles=[];
    for(let gy=-18;gy<=18;gy++){
      for(let gx=-13;gx<=13;gx++){
        const nx=gx/13;
        const ny=gy/18;
        const jaw=ny>0?1-ny*.23:1;
        const crown=ny<-.5?1-(Math.abs(ny)-.5)*.22:1;
        const sx=jaw*crown;
        if((nx*nx)/(sx*sx)+ny*ny>1)continue;

        const eyeL=((nx+.34)/.25)**2+((ny+.17)/.105)**2<1;
        const eyeR=((nx-.34)/.25)**2+((ny+.17)/.105)**2<1;
        const lipGap=Math.abs(nx)<.29&&Math.abs(ny-.43)<.038;
        if(eyeL||eyeR||lipGap)continue;

        const edge=Math.sqrt(nx*nx+ny*ny);
        const seed=hash(gx,gy,1);
        if(edge>.83&&seed<.18)continue;

        tiles.push({
          nx,ny,seed,
          phase:hash(gx,gy,2)*TAU,
          depth:hash(gx,gy,3),
          zone:ny<-.44?'crown':ny<-.19?'forehead':ny<.13?'mid':ny<.38?'cheek':'jaw'
        });
      }
    }
    return tiles;
  }

  buildNeckTiles(){
    const tiles=[];
    for(let gy=0;gy<13;gy++){
      for(let gx=-6;gx<=6;gx++){
        const y=gy/12;
        const maxX=.62+y*.23;
        const nx=gx/6;
        if(Math.abs(nx)>maxX)continue;
        tiles.push({nx,ny:y,seed:hash(gx,gy,9),phase:hash(gx,gy,10)*TAU,depth:hash(gx,gy,11)});
      }
    }
    return tiles;
  }

  buildShoulderTiles(){
    const tiles=[];
    for(let gy=0;gy<8;gy++){
      for(let gx=-16;gx<=16;gx++){
        const nx=gx/16;
        const ny=gy/7;
        const edge=1-Math.abs(nx);
        if(ny>.32+edge*.75)continue;
        if(hash(gx,gy,17)<.08)continue;
        tiles.push({nx,ny,seed:hash(gx,gy,18),phase:hash(gx,gy,19)*TAU,depth:hash(gx,gy,20)});
      }
    }
    return tiles;
  }

  buildFloaters(count){
    return Array.from({length:count},(_,i)=>({
      seed:hash(i,3,27),
      phase:hash(i,7,28)*TAU,
      speed:.28+hash(i,5,29)*.7,
      side:i%2?-1:1,
      zone:i%4
    }));
  }

  buildDust(count){
    return Array.from({length:count},(_,i)=>({
      x:hash(i,2,31),y:hash(i,4,32),seed:hash(i,6,33),speed:.04+hash(i,8,34)*.1
    }));
  }

  buildFlow(count){
    return Array.from({length:count},(_,i)=>({
      lane:(i%9-4)/4,seed:hash(i,9,35),phase:hash(i,11,36),speed:.14+hash(i,13,37)*.28
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
    this.detail=this.w<310||this.h<310?.58:this.w<430||this.h<430?.8:1;
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
    if(next==='processing')this.pulse(1200);
  }

  setEmotion(value='neutral'){
    const aliases={angry:'focused',annoyed:'focused',sad:'curious'};
    const next=aliases[value]||value;
    this.emotion=VALID_EMOTIONS.has(next)?next:'neutral';
  }

  setTalking(active=false){
    this.speaking=Boolean(active);
    if(this.speaking)this.setState('speaking');
    else if(this.state==='speaking')this.setState('idle');
  }

  setAudioLevel(level=0){this.audioTarget=clamp(Number(level)||0,0,1);}
  setSpeechEnergy(level=.62){this.setAudioLevel(level);this.speaking=this.audioTarget>.025;if(this.speaking)this.setState('speaking');}
  setListening(value=false){this.listening=Boolean(value);if(this.listening)this.setState('listening');else if(this.state==='listening')this.setState('idle');}
  setEarSpectrum(value={}){for(const band of ['low','mid','high'])this.earSpectrum[band]=clamp(Number(value[band])||0,0,1);}
  setPaused(value=false){this.paused=Boolean(value);}
  setEvolving(value=false){this.evolving=Boolean(value);if(this.evolving)this.setState('processing');else if(this.state==='processing')this.setState('idle');}
  completeEvolution(){this.evolving=false;this.pulse(1600);this.setState('processing');setTimeout(()=>{if(!this.destroyed&&this.state==='processing')this.setState('idle');},1350);}
  activateAllEffects(value=true){if(value)this.pulse(1350);}
  setAvatarVariant(){/* Compatibility: hologram is now the primary avatar renderer. */}

  pulse(duration=1000){this.pulseUntil=Math.max(this.pulseUntil,performance.now()+duration);}
  pulseAvatar(duration=1000){this.pulse(duration);}
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

  visualStyle(){
    const light=this.resolvedTheme()==='light';
    const error=this.state==='error';
    return {
      light,
      glow:light?.52:1,
      faceFill:light?'rgba(34,80,122,.62)':'rgba(3,24,47,.88)',
      tileFill:light?'46,106,158':'14,57,96',
      tileDark:light?'24,69,109':'3,27,53',
      cyan:error?'255,99,156':'80,218,255',
      white:error?'255,183,211':'224,251,255',
      blue:error?'215,91,255':'72,139,255',
      violet:error?'255,111,210':'144,98,255',
      outline:light?'rgba(28,110,170,.4)':'rgba(116,224,255,.5)',
      halo:light?.15:.25
    };
  }

  stateEnergy(time){
    const activePulse=performance.now()<this.pulseUntil?.32+.68*(.5+.5*Math.sin(time*.006)):0;
    const values={idle:.16,listening:.42,thinking:.56,speaking:.64,processing:.74,error:.82};
    return clamp((values[this.state]||.16)+activePulse*.34+this.audioLevel*.36,0,1);
  }

  drawGlassCube(ctx,x,y,size,seed,alpha,style,rot=0){
    if(alpha<.01||size<.7)return;
    const rgb=seed>.7?style.cyan:seed>.4?style.blue:style.violet;
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(rot);
    ctx.shadowColor=`rgba(${rgb},${alpha*style.glow})`;
    ctx.shadowBlur=size*(style.light?.65:1.7);
    ctx.fillStyle=`rgba(${rgb},${alpha*(style.light?.13:.18)})`;
    ctx.fillRect(-size/2,-size/2,size,size);
    ctx.strokeStyle=`rgba(${style.white},${alpha*(style.light?.58:.82)})`;
    ctx.lineWidth=Math.max(.55,size*.055);
    ctx.strokeRect(-size/2,-size/2,size,size);
    if(size>5&&this.detail>.65){
      ctx.strokeStyle=`rgba(${rgb},${alpha*.36})`;
      ctx.beginPath();
      ctx.moveTo(-size/2,-size/2);
      ctx.lineTo(-size*.24,-size*.73);
      ctx.lineTo(size*.76,-size*.73);
      ctx.lineTo(size/2,-size/2);
      ctx.moveTo(size/2,-size/2);
      ctx.lineTo(size*.76,-size*.73);
      ctx.lineTo(size*.76,size*.27);
      ctx.lineTo(size/2,size/2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawBackdrop(ctx,cx,cy,fw,fh,time,energy,style){
    ctx.save();

    const aura=ctx.createRadialGradient(cx,cy-fh*.03,fw*.08,cx,cy-fh*.03,fw*.83);
    aura.addColorStop(0,`rgba(${style.cyan},${.08+.06*energy})`);
    aura.addColorStop(.5,`rgba(${style.blue},${.025+.035*energy})`);
    aura.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=aura;
    ctx.beginPath();ctx.arc(cx,cy-fh*.03,fw*.82,0,TAU);ctx.fill();

    const pulse=.5+.5*Math.sin(time*.00115);
    for(let ring=0;ring<3;ring++){
      const radius=fw*(.58+ring*.08+pulse*.004);
      ctx.beginPath();
      ctx.arc(cx,cy-fh*.035,radius,(-.06+ring*.05)*Math.PI,1.56*Math.PI);
      ctx.strokeStyle=`rgba(${ring===2?style.violet:style.cyan},${style.halo*(1-ring*.2)})`;
      ctx.lineWidth=Math.max(.65,fw*.0023);
      ctx.setLineDash([fw*.025+ring*2,fw*.017+ring*3]);
      ctx.lineDashOffset=-time*.012*(ring%2?1:-1);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Crosshair lines visible in the reference, kept subtle for UI use.
    ctx.strokeStyle=`rgba(${style.cyan},${style.light?.07:.1})`;
    ctx.lineWidth=Math.max(.45,fw*.0014);
    ctx.beginPath();
    ctx.moveTo(cx-fw*.9,cy-fh*.12);ctx.lineTo(cx+fw*.9,cy-fh*.12);
    ctx.moveTo(cx,cy-fh*.85);ctx.lineTo(cx,Math.min(this.h,cy+fh*1.35));
    ctx.stroke();

    for(const d of this.dust){
      const yy=((d.y+time*.000018*d.speed)%1)*this.h;
      const xx=d.x*this.w+Math.sin(time*.00033+d.seed*TAU)*fw*.02;
      const alpha=(.04+d.seed*.08)*(style.light?.55:1);
      ctx.fillStyle=`rgba(${d.seed>.58?style.cyan:style.violet},${alpha})`;
      ctx.fillRect(xx,yy,1+d.seed*1.2,1+d.seed*1.2);
    }
    ctx.restore();
  }

  drawShoulders(ctx,cx,cy,fw,fh,time,energy,style,presence){
    const baseY=cy+fh*.53;
    const width=fw*1.65;
    const shoulderH=fh*.48;

    // Dark translucent bust volume.
    ctx.save();
    const grad=ctx.createLinearGradient(cx,baseY,cx,baseY+shoulderH);
    grad.addColorStop(0,style.faceFill);
    grad.addColorStop(1,style.light?'rgba(65,124,169,.26)':'rgba(2,17,35,.36)');
    ctx.fillStyle=grad;
    ctx.beginPath();
    ctx.moveTo(cx-fw*.23,baseY);
    ctx.quadraticCurveTo(cx-fw*.45,baseY+fh*.08,cx-width,baseY+shoulderH*.62);
    ctx.lineTo(cx-width,baseY+shoulderH);
    ctx.lineTo(cx+width,baseY+shoulderH);
    ctx.lineTo(cx+width,baseY+shoulderH*.62);
    ctx.quadraticCurveTo(cx+fw*.45,baseY+fh*.08,cx+fw*.23,baseY);
    ctx.closePath();
    ctx.fill();

    const tile=Math.max(3,fw*.035);
    for(const p of this.shoulderTiles){
      if(this.detail<.7&&hash(p.nx,p.ny,51)<.4)continue;
      const x=cx+p.nx*width;
      const y=baseY+fh*.05+p.ny*shoulderH*.76;
      const sideFall=1-Math.abs(p.nx)*.42;
      const wave=.5+.5*Math.sin(time*.001+p.phase);
      const s=tile*(.76+p.depth*.4);
      const rgb=p.seed>.7?style.cyan:p.seed>.35?style.blue:style.tileFill;
      const alpha=clamp((.1+.24*p.depth+.05*energy)*sideFall*presence,0,.44);
      ctx.fillStyle=`rgba(${rgb},${alpha})`;
      ctx.fillRect(x-s/2,y-s/2,s,s);
      ctx.strokeStyle=`rgba(${style.cyan},${alpha*.35})`;
      ctx.lineWidth=.45;
      ctx.strokeRect(x-s/2,y-s/2,s,s);
      if(p.seed>.91)this.drawGlassCube(ctx,x,y,s*1.25,p.seed,.22+.2*wave,style,.08*Math.sin(time*.001+p.phase));
    }
    ctx.restore();
  }

  drawNeck(ctx,cx,cy,fw,fh,time,energy,style,presence){
    const top=cy+fh*.42;
    const height=fh*.66;
    const half=fw*.22;
    ctx.save();
    ctx.fillStyle=style.faceFill;
    ctx.beginPath();
    ctx.moveTo(cx-half,top);
    ctx.lineTo(cx-half*.78,top+height);
    ctx.lineTo(cx+half*.78,top+height);
    ctx.lineTo(cx+half,top);
    ctx.closePath();
    ctx.fill();

    const tile=Math.max(2.6,fw*.031);
    for(const p of this.neckTiles){
      const y=top+p.ny*height;
      const x=cx+p.nx*half*(1+p.ny*.18);
      const pulse=.5+.5*Math.sin(time*.0012+p.phase);
      const s=tile*(.82+p.depth*.28);
      const alpha=(.2+p.depth*.3+.07*energy)*presence;
      ctx.fillStyle=`rgba(${p.seed>.7?style.cyan:p.seed>.4?style.blue:style.tileFill},${alpha})`;
      ctx.fillRect(x-s/2,y-s/2,s,s);
      ctx.strokeStyle=`rgba(${style.cyan},${alpha*.28})`;
      ctx.lineWidth=.4;ctx.strokeRect(x-s/2,y-s/2,s,s);
      if(p.seed>.94)this.drawGlassCube(ctx,x,y,s*1.15,p.seed,.16+.2*pulse,style);
    }
    ctx.restore();
  }

  drawFaceBase(ctx,cx,cy,fw,fh,style){
    ctx.save();
    ctx.fillStyle=style.faceFill;
    ctx.beginPath();
    ctx.moveTo(cx,cy-fh*.51);
    ctx.bezierCurveTo(cx+fw*.49,cy-fh*.49,cx+fw*.5,cy-fh*.11,cx+fw*.39,cy+fh*.27);
    ctx.bezierCurveTo(cx+fw*.31,cy+fh*.47,cx+fw*.14,cy+fh*.54,cx,cy+fh*.57);
    ctx.bezierCurveTo(cx-fw*.14,cy+fh*.54,cx-fw*.31,cy+fh*.47,cx-fw*.39,cy+fh*.27);
    ctx.bezierCurveTo(cx-fw*.5,cy-fh*.11,cx-fw*.49,cy-fh*.49,cx,cy-fh*.51);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle=style.outline;
    ctx.lineWidth=Math.max(.7,fw*.003);
    ctx.stroke();
    ctx.restore();
  }

  drawFaceTiles(ctx,cx,cy,fw,fh,time,energy,style,presence){
    const error=performance.now()<this.glitchUntil||this.state==='error';
    const thinking=this.state==='thinking'||this.state==='processing'||this.evolving;
    const speaking=this.state==='speaking'||this.speaking;
    const tile=Math.max(2.6,fw*.034);
    const energyY=cy+fh*.56-((time*.00017)%1)*fh*1.12;

    for(let i=0;i<this.faceTiles.length;i++){
      if(this.detail<.68&&i%2)continue;
      const p=this.faceTiles[i];
      const zoneBoost=(p.zone==='crown'||p.zone==='forehead')&&thinking?.85:
        (p.zone==='cheek'||p.zone==='jaw')&&speaking?.75:.18;
      const pulse=.5+.5*Math.sin(time*.0011*(.7+p.seed)+p.phase);
      const protrude=zoneBoost*pulse*(2+14*p.seed);
      const radial=Math.max(.18,Math.hypot(p.nx,p.ny));
      let x=cx+p.nx*fw*.47+(p.nx/radial)*protrude;
      let y=cy+p.ny*fh*.49+(p.ny/radial)*protrude*.45;

      if(error&&hash(i,Math.floor(time/70),62)>.87){
        x+=(hash(i,2,63)-.5)*fw*.1;
        y+=(hash(i,3,64)-.5)*fh*.03;
      }

      const scan=Math.exp(-((y-energyY)**2)/(2*(fh*.04)**2));
      const s=tile*(.72+p.depth*.42);
      const dark=p.seed<.38;
      const rgb=dark?style.tileDark:p.seed>.82?style.cyan:p.seed>.58?style.blue:style.tileFill;
      const alpha=clamp((.17+p.depth*.34+energy*.055+scan*.18)*presence,0,.74);

      ctx.save();
      ctx.translate(x,y);
      ctx.rotate((pulse-.5)*.035*zoneBoost);
      ctx.fillStyle=`rgba(${rgb},${alpha})`;
      ctx.fillRect(-s/2,-s/2,s,s);
      ctx.strokeStyle=`rgba(${style.cyan},${alpha*(style.light?.2:.3)})`;
      ctx.lineWidth=Math.max(.32,s*.035);
      ctx.strokeRect(-s/2,-s/2,s,s);
      if(p.depth>.84){
        ctx.fillStyle=`rgba(${style.white},${alpha*.08})`;
        ctx.fillRect(-s*.34,-s*.34,s*.62,s*.1);
      }
      ctx.restore();
    }
  }

  drawEyes(ctx,cx,cy,fw,fh,blink,energy,style){
    const y=cy-fh*.105;
    const width=fw*.215;
    const close=clamp(blink,0,1);
    const height=Math.max(1.2,fh*.042*(1-close*.94));
    const focused=this.emotion==='focused'||this.state==='thinking';

    for(const side of [-1,1]){
      const x=cx+side*fw*.205;
      ctx.save();
      ctx.globalCompositeOperation='lighter';
      ctx.shadowColor=`rgba(${style.cyan},${.78*style.glow})`;
      ctx.shadowBlur=fw*(style.light?.035:.075);

      // Almond/slit light from the reference — no iris, no eyeball.
      const g=ctx.createLinearGradient(x-width,y,x+width,y);
      g.addColorStop(0,`rgba(${style.cyan},.08)`);
      g.addColorStop(.25,`rgba(${style.cyan},${.48+.2*energy})`);
      g.addColorStop(.5,`rgba(${style.white},${.88+.08*energy})`);
      g.addColorStop(.75,`rgba(${style.cyan},${.5+.2*energy})`);
      g.addColorStop(1,`rgba(${style.cyan},.06)`);
      ctx.fillStyle=g;

      ctx.beginPath();
      ctx.moveTo(x-width,y);
      ctx.quadraticCurveTo(x,y-height*1.45,x+width,y);
      ctx.quadraticCurveTo(x,y+height*.66,x-width,y);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur=0;
      ctx.strokeStyle=`rgba(${style.white},${style.light?.35:.64})`;
      ctx.lineWidth=Math.max(.7,fw*.003);
      ctx.stroke();

      if(focused){
        ctx.strokeStyle=`rgba(${style.violet},${.26+.18*energy})`;
        ctx.beginPath();
        ctx.moveTo(x-width*.95,y-height*1.7);
        ctx.quadraticCurveTo(x,y-height*2.15,x+width*.95,y-height*1.68);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawEars(ctx,cx,cy,fw,fh,time,energy,style){
    const level=Math.max(this.earSpectrum.low,this.earSpectrum.mid,this.earSpectrum.high,this.state==='listening'?.22:0);
    for(const side of [-1,1]){
      const ex=cx+side*fw*.515;
      const ey=cy+fh*.02;
      ctx.save();
      ctx.strokeStyle=`rgba(${style.cyan},${style.light?.25:.42})`;
      ctx.lineWidth=Math.max(1,fw*.009);
      ctx.beginPath();
      ctx.ellipse(ex,ey,fw*.075,fh*.135,0,0,TAU);
      ctx.stroke();
      ctx.strokeStyle=`rgba(${style.blue},${style.light?.18:.3})`;
      ctx.lineWidth=Math.max(.7,fw*.004);
      ctx.beginPath();
      ctx.ellipse(ex,ey+fh*.005,fw*.035,fh*.078,0,0,TAU);
      ctx.stroke();

      for(let i=0;i<8;i++){
        const a=-1.95+i/7*3.9;
        const x=ex+Math.cos(a)*fw*.066;
        const y=ey+Math.sin(a)*fh*.125;
        this.drawGlassCube(ctx,x,y,Math.max(2,fw*.024),.35+i*.08,.26+.08*energy,style,.08*Math.sin(time*.001+i));
      }

      if(level>.02){
        for(let wave=0;wave<3;wave++){
          const travel=(time*.00038+wave*.25)%1;
          ctx.beginPath();
          ctx.arc(ex,ey,fw*(.08+travel*.15),side<0?Math.PI*.55:-Math.PI*.45,side<0?Math.PI*1.45:Math.PI*.45,side>0);
          ctx.strokeStyle=`rgba(${style.cyan},${(1-travel)*(.14+level*.4)})`;
          ctx.lineWidth=Math.max(.65,fw*.003);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  drawNoseMouth(ctx,cx,cy,fw,fh,time,energy,style){
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    ctx.shadowColor=`rgba(${style.cyan},${.3*style.glow})`;
    ctx.shadowBlur=fw*(style.light?.012:.025);

    // Geometric luminous nose bridge.
    ctx.strokeStyle=`rgba(${style.cyan},${style.light?.36:.62})`;
    ctx.lineWidth=Math.max(.75,fw*.004);
    ctx.beginPath();
    ctx.moveTo(cx,cy-fh*.045);
    ctx.lineTo(cx-fw*.005,cy+fh*.17);
    ctx.quadraticCurveTo(cx-fw*.055,cy+fh*.205,cx-fw*.075,cy+fh*.19);
    ctx.moveTo(cx,cy+fh*.17);
    ctx.quadraticCurveTo(cx+fw*.055,cy+fh*.205,cx+fw*.075,cy+fh*.19);
    ctx.stroke();

    const level=(this.state==='speaking'||this.speaking)?this.audioLevel:0;
    const mouthY=cy+fh*.305;
    const half=fw*(.18+level*.018);
    const mood=this.emotion==='happy'?-fh*.012:this.emotion==='curious'?fh*.006:0;
    const open=fh*(.006+level*.038);

    ctx.shadowColor=`rgba(${style.white},${.35+.35*level})`;
    ctx.shadowBlur=fw*(style.light?.012:.03);
    ctx.strokeStyle=`rgba(${style.white},${style.light?.42:.72})`;
    ctx.lineWidth=Math.max(1,fw*.006);
    ctx.beginPath();
    ctx.moveTo(cx-half,mouthY+mood);
    ctx.quadraticCurveTo(cx,mouthY+open+mood,cx+half,mouthY+mood);
    ctx.stroke();

    if(level>.06){
      ctx.strokeStyle=`rgba(${style.cyan},${.3+.36*level})`;
      ctx.lineWidth=Math.max(.8,fw*.004);
      ctx.beginPath();
      ctx.moveTo(cx-half*.75,mouthY+mood);
      ctx.quadraticCurveTo(cx,mouthY-open*.7+mood,cx+half*.75,mouthY+mood);
      ctx.stroke();
    }
    ctx.restore();

    if(level>.03){
      for(let i=0;i<8;i++){
        const u=i/7;
        const x=cx+(u-.5)*fw*.4;
        const arch=Math.sin(u*Math.PI);
        this.drawGlassCube(ctx,x,mouthY+open*.95*arch,Math.max(2,fw*.02),.32+u*.6,.12+.28*level,style,.04*Math.sin(time*.009+i));
      }
    }
  }

  drawCenterCore(ctx,cx,cy,fw,fh,time,energy,style){
    ctx.save();
    ctx.globalCompositeOperation='lighter';

    const beam=ctx.createLinearGradient(cx,cy-fh*.72,cx,cy+fh*1.05);
    beam.addColorStop(0,`rgba(${style.cyan},0)`);
    beam.addColorStop(.16,`rgba(${style.cyan},${.26*style.glow})`);
    beam.addColorStop(.47,`rgba(${style.white},${.52*style.glow})`);
    beam.addColorStop(.72,`rgba(${style.cyan},${.34*style.glow})`);
    beam.addColorStop(1,`rgba(${style.cyan},0)`);
    ctx.strokeStyle=beam;
    ctx.shadowColor=`rgba(${style.cyan},${.62*style.glow})`;
    ctx.shadowBlur=fw*(style.light?.025:.052);
    ctx.lineWidth=Math.max(1,fw*.006);
    ctx.beginPath();ctx.moveTo(cx,cy-fh*.72);ctx.lineTo(cx,cy+fh*1.05);ctx.stroke();

    const foreheadY=cy-fh*.345;
    const square=Math.max(2.3,fw*.03);
    const pulse=.72+.28*Math.sin(time*.004);
    const glyph=[[0,0],[-1,0],[1,0],[0,-1],[0,1]];
    for(const [gx,gy] of glyph){
      ctx.fillStyle=`rgba(${style.white},${(.55+.32*energy)*pulse})`;
      ctx.fillRect(cx+gx*square-square*.34,foreheadY+gy*square-square*.34,square*.68,square*.68);
    }

    // Bright chin and sternum nodes from the illustration.
    for(const [x,y,a] of [[cx,cy+fh*.49,.52],[cx,cy+fh*.98,.48]]){
      const r=fw*.016*(1+.24*Math.sin(time*.004+y));
      const grad=ctx.createRadialGradient(x,y,0,x,y,r*4);
      grad.addColorStop(0,`rgba(${style.white},${a+.18*energy})`);
      grad.addColorStop(.22,`rgba(${style.cyan},${a*.8})`);
      grad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=grad;ctx.beginPath();ctx.arc(x,y,r*4,0,TAU);ctx.fill();
    }
    ctx.restore();
  }

  drawEnergyFilaments(ctx,cx,cy,fw,fh,time,energy,style){
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    ctx.lineCap='round';
    const flicker=.6+.4*Math.sin(time*.0018);
    ctx.shadowColor=`rgba(${style.violet},${.45*style.glow})`;
    ctx.shadowBlur=fw*(style.light?.018:.04);
    ctx.strokeStyle=`rgba(${style.violet},${(.18+.13*energy)*flicker})`;
    ctx.lineWidth=Math.max(.7,fw*.004);

    // Left forehead -> cheek filament.
    ctx.beginPath();
    ctx.moveTo(cx-fw*.28,cy-fh*.46);
    ctx.bezierCurveTo(cx-fw*.12,cy-fh*.36,cx-fw*.38,cy-fh*.12,cx-fw*.26,cy+fh*.12);
    ctx.bezierCurveTo(cx-fw*.16,cy+fh*.24,cx-fw*.34,cy+fh*.34,cx-fw*.18,cy+fh*.48);
    ctx.stroke();

    // Right cheek -> neck filament.
    ctx.beginPath();
    ctx.moveTo(cx+fw*.3,cy-fh*.03);
    ctx.bezierCurveTo(cx+fw*.16,cy+fh*.12,cx+fw*.34,cy+fh*.38,cx+fw*.16,cy+fh*.62);
    ctx.bezierCurveTo(cx+fw*.04,cy+fh*.78,cx+fw*.18,cy+fh*.91,cx,cy+fh*1.02);
    ctx.stroke();

    ctx.restore();
  }

  drawFlow(ctx,cx,cy,fw,fh,time,energy,style){
    for(let i=0;i<this.flow.length;i++){
      if(this.detail<.72&&i%2)continue;
      const p=this.flow[i];
      const progress=(p.phase+time*.000075*p.speed)%1;
      const y=cy+fh*.93-progress*fh*1.45;
      const envelope=Math.sin(progress*Math.PI);
      const x=cx+p.lane*fw*.43*envelope+Math.sin(time*.001+p.seed*TAU)*fw*.009;
      const alpha=(.045+.11*energy)*envelope*(style.light?.65:1);
      ctx.fillStyle=`rgba(${p.seed>.55?style.cyan:style.violet},${alpha})`;
      ctx.fillRect(x,y,Math.max(.6,fw*.0017),fh*(.014+.025*p.seed));
    }
  }

  drawFloatingCubes(ctx,cx,cy,fw,fh,time,energy,style){
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    const thinking=this.state==='thinking'||this.state==='processing'||this.evolving;

    for(let i=0;i<this.floaters.length;i++){
      if(this.detail<.76&&i%2)continue;
      const p=this.floaters[i];
      const crown=p.zone===0;
      const side=p.zone===1;
      const shoulder=p.zone>=2;
      const pulse=.5+.5*Math.sin(time*.001*(.55+p.speed)+p.phase);

      let baseX,baseY;
      if(crown){
        baseX=cx+p.side*fw*(.12+.42*p.seed);
        baseY=cy-fh*(.53+.17*p.seed);
      }else if(side){
        baseX=cx+p.side*fw*(.52+.25*p.seed);
        baseY=cy+fh*(-.2+.5*p.seed);
      }else{
        baseX=cx+p.side*fw*(.32+.62*p.seed);
        baseY=cy+fh*(.5+.44*p.seed);
      }

      const orbit=fw*(.018+.055*p.seed)*(1+energy*.25);
      let x=baseX+Math.sin(time*.001*p.speed+p.phase)*orbit*p.side;
      let y=baseY+Math.cos(time*.0007*p.speed+p.phase)*orbit*.68;

      if(thinking&&crown){
        x+=(cx-x)*.08*pulse;
        y+=(cy-fh*.35-y)*.06*pulse;
      }

      const size=Math.max(2,fw*(.018+.034*p.seed));
      const alpha=(.09+.26*pulse+.08*energy)*(style.light?.72:1);
      this.drawGlassCube(ctx,x,y,size,.25+p.seed*.7,alpha,style,.18*Math.sin(time*.0008+p.phase));
    }
    ctx.restore();
  }

  drawProcessingOrbit(ctx,cx,cy,fw,fh,time,energy,style){
    if(this.state!=='processing'&&!this.evolving)return;
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    for(let i=0;i<16;i++){
      if(this.detail<.72&&i%2)continue;
      const a=time*.0007+i/16*TAU;
      const radius=fw*(.62+.03*Math.sin(time*.001+i));
      const x=cx+Math.cos(a)*radius;
      const y=cy-fh*.03+Math.sin(a)*fh*.55;
      this.drawGlassCube(ctx,x,y,Math.max(1.8,fw*.018),i/16,.16+.2*energy,style,.2*Math.sin(a));
    }
    ctx.restore();
  }

  frame(time){
    if(this.destroyed)return;
    this.raf=requestAnimationFrame(t=>this.frame(t));
    if(this.paused||document.hidden)return;

    const interval=performance.now()<this.lowPowerUntil?33:16;
    if(time-this.lastFrame<interval)return;
    const started=performance.now();
    this.lastFrame=time;

    this.audioLevel=lerp(this.audioLevel,this.audioTarget,this.reducedMotion?.08:.18);
    if(!this.speaking&&this.audioTarget<.01)this.audioTarget=0;

    if(time>this.nextBlink){
      this.blinkStart=time;
      this.nextBlink=time+2400+Math.random()*3800;
    }
    const age=time-this.blinkStart;
    const blink=age>=0&&age<205?Math.sin(age/205*Math.PI):0;

    const ctx=this.ctx,w=this.w,h=this.h;
    if(!w||!h)return;
    ctx.clearRect(0,0,w,h);

    // Match reference portrait proportions: head occupies upper/middle canvas; neck + shoulders visible.
    const size=Math.min(w,h);
    const fw=Math.min(size*.5,w*.46);
    const fh=fw*1.29;
    const breathing=this.animate&&!this.reducedMotion?Math.sin(time*.00105)*fh*.004:0;
    const float=this.animate&&!this.reducedMotion?Math.sin(time*.00072)*fh*.006:0;

    const target=this.coarsePointer||!this.track?{x:0,y:0}:(this.gazeActive?this.gazePointer:this.pointer);
    const ease=this.reducedMotion?.12:.04;
    this.rotation.x=lerp(this.rotation.x,clamp(target.x,-1,1),ease);
    this.rotation.y=lerp(this.rotation.y,clamp(target.y,-1,1),ease);
    let px=this.rotation.x*fw*.026;
    let py=this.rotation.y*fh*.015;

    const actionAge=time-this.actionStart;
    if(actionAge<1200){
      const env=Math.sin(actionAge/1200*Math.PI);
      if(this.action==='shake')px+=Math.sin(actionAge*.025)*fw*.034*env;
      if(this.action==='nod')py+=Math.sin(actionAge*.018)*fh*.026*env;
    }

    const transition=this.transition(time);
    const presence=transition.presence;
    const style=this.visualStyle();
    const energy=this.stateEnergy(time);
    const cx=w/2+px;
    const cy=h*.37+float+breathing+py;

    ctx.save();
    if(presence<1){
      ctx.globalAlpha=Math.max(.001,presence);
      ctx.translate(cx,cy);
      const s=.72+.28*presence;
      ctx.scale(s,s);
      ctx.translate(-cx,-cy);
    }

    this.drawBackdrop(ctx,cx,cy,fw,fh,time,energy,style);
    this.drawShoulders(ctx,cx,cy,fw,fh,time,energy,style,presence);
    this.drawNeck(ctx,cx,cy,fw,fh,time,energy,style,presence);
    this.drawFaceBase(ctx,cx,cy,fw,fh,style);
    this.drawFlow(ctx,cx,cy,fw,fh,time,energy,style);
    this.drawFaceTiles(ctx,cx,cy,fw,fh,time,energy,style,presence);
    this.drawEars(ctx,cx,cy,fw,fh,time,energy,style);
    this.drawEyes(ctx,cx,cy,fw,fh,blink,energy,style);
    this.drawNoseMouth(ctx,cx,cy,fw,fh,time,energy,style);
    this.drawCenterCore(ctx,cx,cy,fw,fh,time,energy,style);
    this.drawEnergyFilaments(ctx,cx,cy,fw,fh,time,energy,style);
    this.drawProcessingOrbit(ctx,cx,cy,fw,fh,time,energy,style);
    this.drawFloatingCubes(ctx,cx,cy,fw,fh,time,energy,style);

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

export const BinaryAvatar=HologramAvatar;
