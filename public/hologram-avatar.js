const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const gauss=(x,m,s)=>Math.exp(-((x-m)*(x-m))/(2*s*s));
const hash=(x,y=0,s=0)=>{
  const n=Math.sin(x*12.9898+y*78.233+s*37.719)*43758.5453123;
  return n-Math.floor(n);
};

const VALID_STATES=new Set(['idle','listening','thinking','speaking','processing','error']);
const VALID_EMOTIONS=new Set(['neutral','focused','happy','curious']);

function faceHalfWidth(y){
  const pts=[
    [-1.00,.42],[-.86,.69],[-.62,.90],[-.34,1.00],[-.08,.99],
    [.18,.95],[.42,.84],[.65,.68],[.84,.43],[1.00,.13]
  ];
  for(let i=0;i<pts.length-1;i++){
    const [y0,w0]=pts[i],[y1,w1]=pts[i+1];
    if(y>=y0&&y<=y1){
      const t=(y-y0)/(y1-y0);
      return lerp(w0,w1,t);
    }
  }
  return y<pts[0][0]?pts[0][1]:pts.at(-1)[1];
}

function roundedRect(ctx,x,y,w,h,r){
  const rr=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr,y);
  ctx.lineTo(x+w-rr,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+rr);
  ctx.lineTo(x+w,y+h-rr);
  ctx.quadraticCurveTo(x+w,y+h,x+w-rr,y+h);
  ctx.lineTo(x+rr,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-rr);
  ctx.lineTo(x,y+rr);
  ctx.quadraticCurveTo(x,y,x+rr,y);
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
    this.nextBlink=performance.now()+2100+Math.random()*3300;
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
    this.edgeFragments=this.buildEdgeFragments();
    this.neckTiles=this.buildNeckTiles();
    this.shoulderTiles=this.buildShoulderTiles();
    this.floaters=this.buildFloaters(112);
    this.dust=this.buildDust(58);
    this.flow=this.buildFlow(42);

    this.resizeObserver=new ResizeObserver(()=>this.resize());
    this.resizeObserver.observe(canvas);
    this.themeListener=()=>this.canvas.dispatchEvent(new CustomEvent('dudidam-theme-change'));
    this.themeQuery.addEventListener?.('change',this.themeListener);

    this.resize();
    this.raf=requestAnimationFrame(t=>this.frame(t));
  }

  faceDepth(nx,ny){
    const hw=faceHalfWidth(ny);
    const xn=nx/Math.max(.05,hw);
    const dome=Math.sqrt(Math.max(0,1-xn*xn))*gauss(ny,-.08,.96)*.58;
    const center=gauss(nx,0,.43)*gauss(ny,.02,.8)*.19;
    const noseRidge=gauss(nx,0,.075)*gauss(ny,.03,.32)*.58;
    const noseTip=gauss(nx,0,.12)*gauss(ny,.23,.10)*.42;
    const cheekL=gauss(nx,-.33,.17)*gauss(ny,.17,.18)*.23;
    const cheekR=gauss(nx,.33,.17)*gauss(ny,.17,.18)*.23;
    const browL=gauss(nx,-.27,.18)*gauss(ny,-.23,.095)*.15;
    const browR=gauss(nx,.27,.18)*gauss(ny,-.23,.095)*.15;
    const eyeL=gauss(nx,-.28,.16)*gauss(ny,-.13,.07)*.31;
    const eyeR=gauss(nx,.28,.16)*gauss(ny,-.13,.07)*.31;
    const mouthCut=gauss(nx,0,.24)*gauss(ny,.47,.06)*.10;
    const philtrum=gauss(nx,0,.06)*gauss(ny,.36,.09)*.09;
    return clamp(dome+center+noseRidge+noseTip+cheekL+cheekR+browL+browR-eyeL-eyeR-mouthCut-philtrum,0,1.35);
  }

  buildFaceTiles(){
    const tiles=[];
    const rows=58,cols=44;
    for(let iy=0;iy<=rows;iy++){
      const ny=-1+iy/rows*2;
      const half=faceHalfWidth(ny);
      for(let ix=0;ix<=cols;ix++){
        const nx=-1+ix/cols*2;
        if(Math.abs(nx)>half)continue;

        const eyeL=((nx+.29)/.245)**2+((ny+.13)/.09)**2<1;
        const eyeR=((nx-.29)/.245)**2+((ny+.13)/.09)**2<1;
        const mouthGap=Math.abs(nx)<.28&&Math.abs(ny-.47)<.027;
        if(eyeL||eyeR||mouthGap)continue;

        const seed=hash(ix,iy,1);
        const depth=this.faceDepth(nx,ny);
        const edge=Math.abs(nx)/Math.max(.05,half);
        const zone=ny<-.62?'crown':ny<-.27?'forehead':ny<.1?'eyes':ny<.38?'cheek':ny<.68?'mouth':'jaw';
        const breakup=(zone==='crown'?smooth(.35,1,edge)+smooth(-.62,-1,ny):smooth(.7,1,edge));
        if(breakup>.78&&seed<.18)continue;

        tiles.push({
          nx,ny,seed,depth,edge,zone,
          phase:hash(ix,iy,2)*TAU,
          hue:hash(ix,iy,3),
          lift:hash(ix,iy,4)
        });
      }
    }
    return tiles;
  }

  buildEdgeFragments(){
    const list=[];
    for(let i=0;i<118;i++){
      const seed=hash(i,5,11);
      const crown=i<64;
      const side=crown?(i%2?-1:1):(i%2?-1:1);
      const ny=crown?(-1.06+seed*.42):(-.66+seed*1.35);
      const half=faceHalfWidth(clamp(ny,-1,1));
      const nx=crown
        ?side*(.12+.82*hash(i,7,12))*half
        :side*(half+.03+.16*hash(i,9,13));
      list.push({nx,ny,seed,phase:hash(i,13,14)*TAU,size:.72+hash(i,17,15)*2.15,crown});
    }
    return list;
  }

  buildNeckTiles(){
    const list=[];
    const rows=19,cols=15;
    for(let iy=0;iy<=rows;iy++){
      const ny=iy/rows;
      for(let ix=0;ix<=cols;ix++){
        const nx=-1+ix/cols*2;
        const half=.58+.14*ny;
        if(Math.abs(nx)>half)continue;
        list.push({
          nx,ny,seed:hash(ix,iy,21),phase:hash(ix,iy,22)*TAU,
          depth:hash(ix,iy,23)
        });
      }
    }
    return list;
  }

  buildShoulderTiles(){
    const list=[];
    const rows=16,cols=58;
    for(let iy=0;iy<=rows;iy++){
      const ny=iy/rows;
      for(let ix=0;ix<=cols;ix++){
        const nx=-1+ix/cols*2;
        const curve=.18+(1-Math.abs(nx))*.72;
        if(ny>curve)continue;
        if(hash(ix,iy,27)<.055)continue;
        list.push({
          nx,ny,seed:hash(ix,iy,28),phase:hash(ix,iy,29)*TAU,
          depth:hash(ix,iy,30)
        });
      }
    }
    return list;
  }

  buildFloaters(count){
    return Array.from({length:count},(_,i)=>({
      seed:hash(i,3,35),phase:hash(i,7,36)*TAU,speed:.25+hash(i,5,37)*.7,
      side:i%2?-1:1,zone:i%5
    }));
  }

  buildDust(count){
    return Array.from({length:count},(_,i)=>({
      x:hash(i,2,41),y:hash(i,4,42),seed:hash(i,6,43),speed:.04+hash(i,8,44)*.1
    }));
  }

  buildFlow(count){
    return Array.from({length:count},(_,i)=>({
      lane:(i%9-4)/4,seed:hash(i,9,47),phase:hash(i,11,48),speed:.12+hash(i,13,49)*.3
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
    this.detail=this.w<300||this.h<300?.56:this.w<430||this.h<430?.78:1;
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
  setSpeechEnergy(level=.62){
    this.setAudioLevel(level);
    this.speaking=this.audioTarget>.025;
    if(this.speaking)this.setState('speaking');
  }
  setListening(value=false){
    this.listening=Boolean(value);
    if(this.listening)this.setState('listening');
    else if(this.state==='listening')this.setState('idle');
  }
  setEarSpectrum(value={}){
    for(const band of ['low','mid','high'])this.earSpectrum[band]=clamp(Number(value[band])||0,0,1);
  }
  setPaused(value=false){this.paused=Boolean(value);}
  setEvolving(value=false){
    this.evolving=Boolean(value);
    if(this.evolving)this.setState('processing');
    else if(this.state==='processing')this.setState('idle');
  }
  completeEvolution(){
    this.evolving=false;
    this.pulse(1600);
    this.setState('processing');
    setTimeout(()=>{if(!this.destroyed&&this.state==='processing')this.setState('idle');},1350);
  }
  activateAllEffects(value=true){if(value)this.pulse(1350);}
  setAvatarVariant(){}

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
  awaken(duration=4200){
    this.transitionKind='assemble';
    this.transitionStart=performance.now();
    this.transitionDuration=Math.max(900,Number(duration)||4200);
    this.pulse(duration);
  }
  dismiss(duration=3000){
    this.transitionKind='disassemble';
    this.transitionStart=performance.now();
    this.transitionDuration=Math.max(700,Number(duration)||3000);
  }
  isAwakening(now=performance.now()){
    return Boolean(this.transitionKind)&&now-this.transitionStart<this.transitionDuration;
  }

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
      glow:light?.50:1,
      faceBase:light?'rgba(58,119,174,.56)':'rgba(2,17,36,.96)',
      tileBase:light?'70,151,213':'16,67,116',
      tileBright:light?'111,189,238':'48,148,222',
      tileDark:light?'35,91,139':'4,31,61',
      cyan:error?'255,94,148':'73,221,255',
      white:error?'255,193,217':'235,253,255',
      blue:error?'203,93,255':'72,144,255',
      violet:error?'255,113,204':'154,101,255',
      outline:light?'rgba(35,127,190,.50)':'rgba(141,238,255,.72)',
      halo:light?.14:.26
    };
  }

  stateEnergy(time){
    const activePulse=performance.now()<this.pulseUntil?.32+.68*(.5+.5*Math.sin(time*.006)):0;
    const map={idle:.16,listening:.42,thinking:.56,speaking:.64,processing:.74,error:.82};
    return clamp((map[this.state]||.16)+activePulse*.34+this.audioLevel*.36,0,1);
  }

  tileColor(tile,style,alpha){
    const z=tile.depth||0;
    const h=tile.hue??tile.seed??.5;
    let rgb=style.tileBase;
    if(z>.78||h>.88)rgb=style.tileBright;
    else if(z<.32||h<.18)rgb=style.tileDark;
    if(h>.95)rgb=style.cyan;
    return `rgba(${rgb},${alpha})`;
  }

  drawGlassCube(ctx,x,y,size,seed,alpha,style,rot=0){
    if(alpha<.01||size<.65)return;
    const rgb=seed>.73?style.cyan:seed>.42?style.blue:style.violet;
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(rot);
    ctx.shadowColor=`rgba(${rgb},${alpha*style.glow})`;
    ctx.shadowBlur=size*(style.light?.6:1.8);
    ctx.fillStyle=`rgba(${rgb},${alpha*(style.light?.12:.18)})`;
    ctx.fillRect(-size/2,-size/2,size,size);
    ctx.strokeStyle=`rgba(${style.white},${alpha*(style.light?.52:.82)})`;
    ctx.lineWidth=Math.max(.5,size*.052);
    ctx.strokeRect(-size/2,-size/2,size,size);
    if(size>5&&this.detail>.65){
      const off=size*.28;
      ctx.strokeStyle=`rgba(${rgb},${alpha*.34})`;
      ctx.beginPath();
      ctx.moveTo(-size/2,-size/2);ctx.lineTo(-size/2+off,-size/2-off);
      ctx.lineTo(size/2+off,-size/2-off);ctx.lineTo(size/2,-size/2);
      ctx.moveTo(size/2,-size/2);ctx.lineTo(size/2+off,-size/2-off);
      ctx.lineTo(size/2+off,size/2-off);ctx.lineTo(size/2,size/2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawBackdrop(ctx,cx,cy,fw,fh,time,energy,style){
    ctx.save();
    const vignette=ctx.createRadialGradient(cx,cy+fh*.02,fw*.08,cx,cy+fh*.08,fw*1.08);
    vignette.addColorStop(0,style.light?'rgba(242,250,255,.16)':'rgba(0,8,22,.76)');
    vignette.addColorStop(.62,style.light?'rgba(231,244,253,.07)':'rgba(0,7,18,.43)');
    vignette.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=vignette;
    ctx.beginPath();ctx.ellipse(cx,cy+fh*.16,fw*1.08,fh*1.28,0,0,TAU);ctx.fill();

    const aura=ctx.createRadialGradient(cx,cy-fh*.04,fw*.08,cx,cy-fh*.04,fw*.98);
    aura.addColorStop(0,`rgba(${style.cyan},${.10+.07*energy})`);
    aura.addColorStop(.48,`rgba(${style.blue},${.035+.035*energy})`);
    aura.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=aura;
    ctx.beginPath();ctx.arc(cx,cy-fh*.04,fw*.9,0,TAU);ctx.fill();

    const pulse=.5+.5*Math.sin(time*.0011);
    for(let ring=0;ring<3;ring++){
      const radius=fw*(.65+ring*.07+pulse*.004);
      ctx.beginPath();
      ctx.arc(cx,cy-fh*.04,radius,(-.07+ring*.04)*Math.PI,1.58*Math.PI);
      ctx.strokeStyle=`rgba(${ring===2?style.violet:style.cyan},${style.halo*(1-ring*.22)})`;
      ctx.lineWidth=Math.max(.65,fw*.002);
      ctx.setLineDash([fw*.021+ring*2,fw*.014+ring*3]);
      ctx.lineDashOffset=-time*.012*(ring%2?1:-1);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.strokeStyle=`rgba(${style.cyan},${style.light?.055:.085})`;
    ctx.lineWidth=Math.max(.4,fw*.0013);
    ctx.beginPath();
    ctx.moveTo(cx-fw*.95,cy-fh*.105);ctx.lineTo(cx+fw*.95,cy-fh*.105);
    ctx.moveTo(cx,cy-fh*.87);ctx.lineTo(cx,Math.min(this.h,cy+fh*1.38));
    ctx.stroke();

    for(const d of this.dust){
      const yy=((d.y+time*.000018*d.speed)%1)*this.h;
      const xx=d.x*this.w+Math.sin(time*.00034+d.seed*TAU)*fw*.02;
      const a=(.035+d.seed*.075)*(style.light?.55:1);
      ctx.fillStyle=`rgba(${d.seed>.58?style.cyan:style.violet},${a})`;
      ctx.fillRect(xx,yy,1+d.seed*1.15,1+d.seed*1.15);
    }
    ctx.restore();
  }

  drawBustBase(ctx,cx,cy,fw,fh,style){
    ctx.save();

    const neckTop=cy+fh*.47;
    const neckBottom=cy+fh*1.05;
    const neckW=fw*.235;

    const neckGrad=ctx.createLinearGradient(cx,neckTop,cx,neckBottom);
    neckGrad.addColorStop(0,style.faceBase);
    neckGrad.addColorStop(1,style.light?'rgba(65,124,169,.20)':'rgba(1,13,30,.58)');
    ctx.fillStyle=neckGrad;
    ctx.beginPath();
    ctx.moveTo(cx-neckW,neckTop);
    ctx.lineTo(cx-neckW*.76,neckBottom);
    ctx.lineTo(cx+neckW*.76,neckBottom);
    ctx.lineTo(cx+neckW,neckTop);
    ctx.closePath();
    ctx.fill();

    const shoulderY=cy+fh*.86;
    const shoulderW=fw*1.62;
    const shoulderH=fh*.42;
    const sh=ctx.createLinearGradient(cx,shoulderY,cx,shoulderY+shoulderH);
    sh.addColorStop(0,style.light?'rgba(50,108,157,.38)':'rgba(3,24,49,.72)');
    sh.addColorStop(1,style.light?'rgba(48,96,139,.10)':'rgba(1,10,23,.28)');
    ctx.fillStyle=sh;
    ctx.beginPath();
    ctx.moveTo(cx-neckW*.72,shoulderY);
    ctx.bezierCurveTo(cx-fw*.44,shoulderY+fh*.03,cx-fw*.8,shoulderY+fh*.11,cx-shoulderW,shoulderY+shoulderH*.7);
    ctx.lineTo(cx-shoulderW,shoulderY+shoulderH);
    ctx.lineTo(cx+shoulderW,shoulderY+shoulderH);
    ctx.lineTo(cx+shoulderW,shoulderY+shoulderH*.7);
    ctx.bezierCurveTo(cx+fw*.8,shoulderY+fh*.11,cx+fw*.44,shoulderY+fh*.03,cx+neckW*.72,shoulderY);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  drawFaceBase(ctx,cx,cy,fw,fh,style){
    ctx.save();
    const grad=ctx.createRadialGradient(cx-fw*.08,cy-fh*.12,fw*.06,cx,cy,fw*.65);
    grad.addColorStop(0,style.light?'rgba(85,154,207,.50)':'rgba(18,75,125,.48)');
    grad.addColorStop(.46,style.faceBase);
    grad.addColorStop(1,style.light?'rgba(33,77,117,.34)':'rgba(1,13,30,.88)');
    ctx.fillStyle=grad;
    ctx.beginPath();
    ctx.moveTo(cx,cy-fh*.54);
    ctx.bezierCurveTo(cx+fw*.43,cy-fh*.53,cx+fw*.51,cy-fh*.22,cx+fw*.47,cy+fh*.08);
    ctx.bezierCurveTo(cx+fw*.44,cy+fh*.34,cx+fw*.29,cy+fh*.52,cx+fw*.10,cy+fh*.62);
    ctx.quadraticCurveTo(cx,cy+fh*.68,cx-fw*.10,cy+fh*.62);
    ctx.bezierCurveTo(cx-fw*.29,cy+fh*.52,cx-fw*.44,cy+fh*.34,cx-fw*.47,cy+fh*.08);
    ctx.bezierCurveTo(cx-fw*.51,cy-fh*.22,cx-fw*.43,cy-fh*.53,cx,cy-fh*.54);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle=style.outline;
    ctx.lineWidth=Math.max(.7,fw*.0028);
    ctx.stroke();
    ctx.restore();
  }

  drawFaceContours(ctx,cx,cy,fw,fh,style,energy){
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    ctx.lineCap='round';
    ctx.lineJoin='round';
    ctx.shadowColor=`rgba(${style.cyan},${.38*style.glow})`;
    ctx.shadowBlur=fw*(style.light?.012:.030);
    ctx.strokeStyle=`rgba(${style.cyan},${style.light?.20:.34})`;
    ctx.lineWidth=Math.max(.55,fw*.0024);

    // Brow / temple arcs make the voxel field read as a face rather than a flat mask.
    for(const side of [-1,1]){
      ctx.beginPath();
      ctx.moveTo(cx+side*fw*.38,cy-fh*.22);
      ctx.quadraticCurveTo(cx+side*fw*.24,cy-fh*.30,cx+side*fw*.09,cy-fh*.245);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx+side*fw*.42,cy-fh*.02);
      ctx.bezierCurveTo(cx+side*fw*.40,cy+fh*.16,cx+side*fw*.30,cy+fh*.31,cx+side*fw*.18,cy+fh*.43);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx+side*fw*.12,cy+fh*.30);
      ctx.quadraticCurveTo(cx+side*fw*.20,cy+fh*.36,cx+side*fw*.26,cy+fh*.35);
      ctx.stroke();
    }

    ctx.strokeStyle=`rgba(${style.white},${style.light?.10:.18+.08*energy})`;
    ctx.lineWidth=Math.max(.45,fw*.0018);
    ctx.beginPath();
    ctx.moveTo(cx-fw*.11,cy+fh*.49);
    ctx.quadraticCurveTo(cx,cy+fh*.53,cx+fw*.11,cy+fh*.49);
    ctx.stroke();
    ctx.restore();
  }

  drawFaceTiles(ctx,cx,cy,fw,fh,time,energy,style,presence){
    const error=this.state==='error'||performance.now()<this.glitchUntil;
    const thinking=this.state==='thinking'||this.state==='processing'||this.evolving;
    const speaking=this.state==='speaking'||this.speaking;
    const baseTile=Math.max(1.7,fw*.0165);
    const pulseY=cy+fh*.62-((time*.00016)%1)*fh*1.22;

    for(let i=0;i<this.faceTiles.length;i++){
      if(this.detail<.62&&i%2)continue;
      const p=this.faceTiles[i];
      const wave=.5+.5*Math.sin(time*.001*(.72+p.seed*.65)+p.phase);
      const active=
        (thinking&&(p.zone==='crown'||p.zone==='forehead'))||
        (speaking&&(p.zone==='cheek'||p.zone==='mouth'||p.zone==='jaw'));
      const pop=(active?.85:.16)*wave*(1.2+5.5*p.lift);
      const half=faceHalfWidth(p.ny);
      const radial=Math.max(.18,Math.hypot(p.nx,p.ny));
      const edgePush=smooth(.72,1,p.edge)*wave*(2+6*p.lift);
      const depthShift=p.depth*fw*.012;

      let x=cx+p.nx*fw*.46+(p.nx/radial)*(pop+edgePush);
      let y=cy+p.ny*fh*.50-(p.depth-.45)*fh*.014+(p.ny/radial)*pop*.34;

      // Slight pseudo-3D projection follows the head without losing the frontal symmetry.
      x+=this.rotation.x*(fw*.012+depthShift*.2);
      y+=this.rotation.y*fh*.006;

      if(error&&hash(i,Math.floor(time/70),70)>.88){
        x+=(hash(i,2,71)-.5)*fw*.08;
        y+=(hash(i,3,72)-.5)*fh*.025;
      }

      const scan=Math.exp(-((y-pulseY)**2)/(2*(fh*.035)**2));
      const size=baseTile*(.83+p.depth*.28)*(p.zone==='crown'?1.03:1);
      const alpha=clamp((.26+p.depth*.42+energy*.07+scan*.22)*presence,0,.90);

      ctx.save();
      ctx.translate(x,y);
      ctx.rotate((wave-.5)*.022*(active?1:.35));
      ctx.fillStyle=this.tileColor(p,style,alpha);
      ctx.fillRect(-size/2,-size/2,size,size);

      ctx.strokeStyle=`rgba(${style.cyan},${alpha*(style.light?.26:.42)})`;
      ctx.lineWidth=Math.max(.32,size*.042);
      ctx.strokeRect(-size/2,-size/2,size,size);

      if(p.depth>.76){
        ctx.fillStyle=`rgba(${style.white},${alpha*.14})`;
        ctx.fillRect(-size*.34,-size*.34,size*.62,Math.max(.45,size*.08));
      }
      ctx.restore();
    }
  }

  drawEdgeFragments(ctx,cx,cy,fw,fh,time,energy,style){
    for(let i=0;i<this.edgeFragments.length;i++){
      if(this.detail<.72&&i%2)continue;
      const p=this.edgeFragments[i];
      const wave=.5+.5*Math.sin(time*.00085+p.phase);
      const drift=(3+22*p.seed)*wave;
      const x=cx+p.nx*fw*.46+(p.nx>=0?1:-1)*drift;
      const y=cy+p.ny*fh*.50-(p.crown?drift*.45:0)+Math.sin(time*.0007+p.phase)*4;
      const size=Math.max(2.4,fw*.019*p.size);
      const alpha=(.18+.34*wave+.08*energy)*(style.light?.78:1);
      this.drawGlassCube(ctx,x,y,size,p.seed,alpha,style,.18*Math.sin(time*.0007+p.phase));
    }
  }

  drawNeckTiles(ctx,cx,cy,fw,fh,time,energy,style,presence){
    const top=cy+fh*.49;
    const height=fh*.62;
    const half=fw*.255;
    const tile=Math.max(1.8,fw*.0185);

    for(let i=0;i<this.neckTiles.length;i++){
      if(this.detail<.62&&i%2)continue;
      const p=this.neckTiles[i];
      const x=cx+p.nx*half*(1+p.ny*.14);
      const y=top+p.ny*height;
      const wave=.5+.5*Math.sin(time*.001+p.phase);
      const size=tile*(.82+p.depth*.26);
      const alpha=(.20+p.depth*.36+.06*energy)*presence;
      const rgb=p.seed>.78?style.cyan:p.seed>.45?style.tileBright:style.tileBase;
      ctx.fillStyle=`rgba(${rgb},${alpha})`;
      ctx.fillRect(x-size/2,y-size/2,size,size);
      ctx.strokeStyle=`rgba(${style.cyan},${alpha*.23})`;
      ctx.lineWidth=.35;
      ctx.strokeRect(x-size/2,y-size/2,size,size);
      if(p.seed>.965)this.drawGlassCube(ctx,x,y,size*1.2,p.seed,.12+.16*wave,style);
    }
  }

  drawShoulderTiles(ctx,cx,cy,fw,fh,time,energy,style,presence){
    const baseY=cy+fh*.88;
    const width=fw*1.61;
    const height=fh*.37;
    const tile=Math.max(1.9,fw*.019);

    for(let i=0;i<this.shoulderTiles.length;i++){
      if(this.detail<.65&&i%2)continue;
      const p=this.shoulderTiles[i];
      const x=cx+p.nx*width;
      const y=baseY+p.ny*height;
      const fall=1-Math.abs(p.nx)*.32;
      const wave=.5+.5*Math.sin(time*.0009+p.phase);
      const size=tile*(.76+p.depth*.38);
      const alpha=clamp((.16+.29*p.depth+.06*energy)*fall*presence,0,.56);
      const rgb=p.seed>.82?style.cyan:p.seed>.49?style.tileBright:style.tileBase;
      ctx.fillStyle=`rgba(${rgb},${alpha})`;
      ctx.fillRect(x-size/2,y-size/2,size,size);
      ctx.strokeStyle=`rgba(${style.cyan},${alpha*.2})`;
      ctx.lineWidth=.34;
      ctx.strokeRect(x-size/2,y-size/2,size,size);
      if(p.seed>.95)this.drawGlassCube(ctx,x,y,size*1.3,p.seed,.14+.18*wave,style,.08*Math.sin(time*.001+p.phase));
    }
  }

  drawEyes(ctx,cx,cy,fw,fh,blink,energy,style){
    const y=cy-fh*.085;
    const width=fw*.174;
    const close=clamp(blink,0,1);
    const height=Math.max(1.1,fh*.028*(1-close*.95));
    const focused=this.emotion==='focused'||this.state==='thinking';

    for(const side of [-1,1]){
      const x=cx+side*fw*.215;
      ctx.save();
      ctx.globalCompositeOperation='lighter';
      ctx.shadowColor=`rgba(${style.cyan},${.84*style.glow})`;
      ctx.shadowBlur=fw*(style.light?.040:.098);

      const g=ctx.createLinearGradient(x-width,y,x+width,y);
      g.addColorStop(0,`rgba(${style.cyan},0)`);
      g.addColorStop(.18,`rgba(${style.cyan},${.38+.24*energy})`);
      g.addColorStop(.50,`rgba(${style.white},${.93+.05*energy})`);
      g.addColorStop(.82,`rgba(${style.cyan},${.42+.24*energy})`);
      g.addColorStop(1,`rgba(${style.cyan},0)`);
      ctx.fillStyle=g;

      ctx.beginPath();
      ctx.moveTo(x-width,y);
      ctx.quadraticCurveTo(x-side*fw*.012,y-height*1.72,x+width,y);
      ctx.quadraticCurveTo(x+side*fw*.010,y+height*.42,x-width,y);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle=`rgba(${style.white},${style.light?.36:.72})`;
      ctx.lineWidth=Math.max(.75,fw*.003);
      ctx.stroke();

      if(focused){
        ctx.strokeStyle=`rgba(${style.violet},${.24+.18*energy})`;
        ctx.beginPath();
        ctx.moveTo(x-width*.96,y-height*1.65);
        ctx.quadraticCurveTo(x,y-height*2.08,x+width*.96,y-height*1.63);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawEars(ctx,cx,cy,fw,fh,time,energy,style){
    const level=Math.max(this.earSpectrum.low,this.earSpectrum.mid,this.earSpectrum.high,this.state==='listening'?.22:0);
    for(const side of [-1,1]){
      const x=cx+side*fw*.505;
      const y=cy+fh*.045;
      ctx.save();
      ctx.strokeStyle=`rgba(${style.cyan},${style.light?.25:.45})`;
      ctx.lineWidth=Math.max(1,fw*.007);
      ctx.beginPath();ctx.ellipse(x,y,fw*.066,fh*.13,0,0,TAU);ctx.stroke();
      ctx.strokeStyle=`rgba(${style.blue},${style.light?.17:.30})`;
      ctx.lineWidth=Math.max(.7,fw*.0037);
      ctx.beginPath();ctx.ellipse(x,y+fh*.008,fw*.033,fh*.074,0,0,TAU);ctx.stroke();

      for(let i=0;i<9;i++){
        const a=-1.9+i/8*3.8;
        const px=x+Math.cos(a)*fw*.058;
        const py=y+Math.sin(a)*fh*.116;
        this.drawGlassCube(ctx,px,py,Math.max(1.8,fw*.019),.31+i*.073,.22+.08*energy,style,.06*Math.sin(time*.001+i));
      }

      if(level>.02){
        for(let w=0;w<3;w++){
          const travel=(time*.0004+w*.26)%1;
          ctx.beginPath();
          ctx.arc(x,y,fw*(.07+travel*.14),side<0?Math.PI*.55:-Math.PI*.45,side<0?Math.PI*1.45:Math.PI*.45,side>0);
          ctx.strokeStyle=`rgba(${style.cyan},${(1-travel)*(.13+level*.4)})`;
          ctx.lineWidth=Math.max(.65,fw*.0028);
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
    ctx.shadowBlur=fw*(style.light?.012:.027);
    ctx.strokeStyle=`rgba(${style.cyan},${style.light?.34:.60})`;
    ctx.lineWidth=Math.max(.8,fw*.0038);

    ctx.beginPath();
    ctx.moveTo(cx,cy-fh*.02);
    ctx.lineTo(cx-fw*.004,cy+fh*.205);
    ctx.quadraticCurveTo(cx-fw*.045,cy+fh*.235,cx-fw*.066,cy+fh*.215);
    ctx.moveTo(cx,cy+fh*.205);
    ctx.quadraticCurveTo(cx+fw*.045,cy+fh*.235,cx+fw*.066,cy+fh*.215);
    ctx.stroke();

    const level=(this.state==='speaking'||this.speaking)?this.audioLevel:0;
    const mouthY=cy+fh*.405;
    const half=fw*(.17+level*.016);
    const mood=this.emotion==='happy'?-fh*.009:this.emotion==='curious'?fh*.004:0;
    const open=fh*(.003+level*.026);

    ctx.shadowColor=`rgba(${style.white},${.25+.30*level})`;
    ctx.shadowBlur=fw*(style.light?.009:.022);
    ctx.strokeStyle=`rgba(${style.white},${style.light?.36:.63})`;
    ctx.lineWidth=Math.max(.95,fw*.0048);
    ctx.beginPath();
    ctx.moveTo(cx-half,mouthY+mood);
    ctx.quadraticCurveTo(cx,mouthY+open+mood,cx+half,mouthY+mood);
    ctx.stroke();

    if(level>.08){
      ctx.strokeStyle=`rgba(${style.cyan},${.25+.33*level})`;
      ctx.lineWidth=Math.max(.75,fw*.0036);
      ctx.beginPath();
      ctx.moveTo(cx-half*.72,mouthY+mood);
      ctx.quadraticCurveTo(cx,mouthY-open*.65+mood,cx+half*.72,mouthY+mood);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawCenterCore(ctx,cx,cy,fw,fh,time,energy,style){
    ctx.save();
    ctx.globalCompositeOperation='lighter';

    const beam=ctx.createLinearGradient(cx,cy-fh*.78,cx,cy+fh*1.24);
    beam.addColorStop(0,`rgba(${style.cyan},0)`);
    beam.addColorStop(.13,`rgba(${style.cyan},${.28*style.glow})`);
    beam.addColorStop(.43,`rgba(${style.white},${.60*style.glow})`);
    beam.addColorStop(.73,`rgba(${style.cyan},${.38*style.glow})`);
    beam.addColorStop(1,`rgba(${style.cyan},0)`);
    ctx.strokeStyle=beam;
    ctx.shadowColor=`rgba(${style.cyan},${.70*style.glow})`;
    ctx.shadowBlur=fw*(style.light?.027:.058);
    ctx.lineWidth=Math.max(1,fw*.0054);
    ctx.beginPath();ctx.moveTo(cx,cy-fh*.78);ctx.lineTo(cx,cy+fh*1.24);ctx.stroke();

    const glyphY=cy-fh*.34;
    const cell=Math.max(2.2,fw*.024);
    const pulse=.72+.28*Math.sin(time*.004);
    const glyph=[[0,0],[-1,0],[1,0],[0,-1],[0,1]];
    for(const [gx,gy] of glyph){
      ctx.fillStyle=`rgba(${style.white},${(.62+.28*energy)*pulse})`;
      ctx.fillRect(cx+gx*cell-cell*.34,glyphY+gy*cell-cell*.34,cell*.68,cell*.68);
    }

    const nodes=[
      [cx,cy-fh*.12,.42,1.0],
      [cx,cy+fh*.16,.28,.72],
      [cx,cy+fh*.61,.44,1.0],
      [cx,cy+fh*1.07,.46,1.1]
    ];
    for(const [x,y,a,s] of nodes){
      const rr=fw*.012*s*(1+.22*Math.sin(time*.004+y));
      const g=ctx.createRadialGradient(x,y,0,x,y,rr*4.5);
      g.addColorStop(0,`rgba(${style.white},${a+.18*energy})`);
      g.addColorStop(.2,`rgba(${style.cyan},${a*.86})`);
      g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,rr*4.5,0,TAU);ctx.fill();
    }
    ctx.restore();
  }

  drawEnergyFilaments(ctx,cx,cy,fw,fh,time,energy,style){
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    ctx.lineCap='round';
    const flick=.62+.38*Math.sin(time*.0018);
    ctx.shadowColor=`rgba(${style.violet},${.48*style.glow})`;
    ctx.shadowBlur=fw*(style.light?.017:.044);
    ctx.strokeStyle=`rgba(${style.violet},${(.19+.14*energy)*flick})`;
    ctx.lineWidth=Math.max(.7,fw*.0037);

    ctx.beginPath();
    ctx.moveTo(cx-fw*.28,cy-fh*.47);
    ctx.bezierCurveTo(cx-fw*.10,cy-fh*.36,cx-fw*.37,cy-fh*.14,cx-fw*.25,cy+fh*.10);
    ctx.bezierCurveTo(cx-fw*.15,cy+fh*.24,cx-fw*.34,cy+fh*.36,cx-fw*.17,cy+fh*.53);
    ctx.bezierCurveTo(cx-fw*.06,cy+fh*.67,cx-fw*.16,cy+fh*.82,cx-fw*.02,cy+fh*1.06);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx+fw*.29,cy-fh*.02);
    ctx.bezierCurveTo(cx+fw*.16,cy+fh*.13,cx+fw*.34,cy+fh*.39,cx+fw*.15,cy+fh*.60);
    ctx.bezierCurveTo(cx+fw*.03,cy+fh*.78,cx+fw*.18,cy+fh*.92,cx,cy+fh*1.13);
    ctx.stroke();
    ctx.restore();
  }

  drawFlow(ctx,cx,cy,fw,fh,time,energy,style){
    for(let i=0;i<this.flow.length;i++){
      if(this.detail<.72&&i%2)continue;
      const p=this.flow[i];
      const progress=(p.phase+time*.000074*p.speed)%1;
      const y=cy+fh*1.02-progress*fh*1.58;
      const env=Math.sin(progress*Math.PI);
      const x=cx+p.lane*fw*.43*env+Math.sin(time*.001+p.seed*TAU)*fw*.008;
      const a=(.042+.105*energy)*env*(style.light?.62:1);
      ctx.fillStyle=`rgba(${p.seed>.55?style.cyan:style.violet},${a})`;
      ctx.fillRect(x,y,Math.max(.55,fw*.0016),fh*(.012+.022*p.seed));
    }
  }

  drawFloatingCubes(ctx,cx,cy,fw,fh,time,energy,style){
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    const thinking=this.state==='thinking'||this.state==='processing'||this.evolving;

    for(let i=0;i<this.floaters.length;i++){
      if(this.detail<.76&&i%2)continue;
      const p=this.floaters[i];
      const pulse=.5+.5*Math.sin(time*.001*(.55+p.speed)+p.phase);
      let x,y;

      if(p.zone===0){
        x=cx+p.side*fw*(.12+.50*p.seed);
        y=cy-fh*(.56+.21*p.seed);
      }else if(p.zone===1){
        x=cx+p.side*fw*(.49+.32*p.seed);
        y=cy+fh*(-.28+.54*p.seed);
      }else if(p.zone===2){
        x=cx+p.side*fw*(.28+.80*p.seed);
        y=cy+fh*(.65+.44*p.seed);
      }else if(p.zone===3){
        x=cx+p.side*fw*(.52+.44*p.seed);
        y=cy+fh*(.22+.68*p.seed);
      }else{
        x=cx+p.side*fw*(.20+.58*p.seed);
        y=cy-fh*(.39+.26*p.seed);
      }

      const orbit=fw*(.016+.052*p.seed)*(1+energy*.22);
      x+=Math.sin(time*.001*p.speed+p.phase)*orbit*p.side;
      y+=Math.cos(time*.00072*p.speed+p.phase)*orbit*.65;

      if(thinking&&p.zone===0){
        x+=(cx-x)*.06*pulse;
        y+=(cy-fh*.38-y)*.05*pulse;
      }

      const size=Math.max(1.9,fw*(.015+.031*p.seed));
      const a=(.08+.25*pulse+.075*energy)*(style.light?.70:1);
      this.drawGlassCube(ctx,x,y,size,.22+p.seed*.74,a,style,.18*Math.sin(time*.0008+p.phase));
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
      const radius=fw*(.69+.025*Math.sin(time*.001+i));
      const x=cx+Math.cos(a)*radius;
      const y=cy-fh*.04+Math.sin(a)*fh*.57;
      this.drawGlassCube(ctx,x,y,Math.max(1.7,fw*.016),i/16,.14+.20*energy,style,.2*Math.sin(a));
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
      this.nextBlink=time+2350+Math.random()*3900;
    }
    const blinkAge=time-this.blinkStart;
    const blink=blinkAge>=0&&blinkAge<205?Math.sin(blinkAge/205*Math.PI):0;

    const ctx=this.ctx,w=this.w,h=this.h;
    if(!w||!h)return;
    ctx.clearRect(0,0,w,h);

    const size=Math.min(w,h);
    const fw=Math.min(size*.57,w*.50);
    const fh=fw*1.27;
    const breathing=this.animate&&!this.reducedMotion?Math.sin(time*.00105)*fh*.0035:0;
    const float=this.animate&&!this.reducedMotion?Math.sin(time*.00072)*fh*.0055:0;

    const target=this.coarsePointer||!this.track?{x:0,y:0}:(this.gazeActive?this.gazePointer:this.pointer);
    const ease=this.reducedMotion?.12:.038;
    this.rotation.x=lerp(this.rotation.x,clamp(target.x,-1,1),ease);
    this.rotation.y=lerp(this.rotation.y,clamp(target.y,-1,1),ease);

    let px=this.rotation.x*fw*.020;
    let py=this.rotation.y*fh*.012;

    const actionAge=time-this.actionStart;
    if(actionAge<1200){
      const env=Math.sin(actionAge/1200*Math.PI);
      if(this.action==='shake')px+=Math.sin(actionAge*.025)*fw*.03*env;
      if(this.action==='nod')py+=Math.sin(actionAge*.018)*fh*.023*env;
    }

    const tr=this.transition(time);
    const presence=tr.presence;
    const style=this.visualStyle();
    const energy=this.stateEnergy(time);
    const cx=w/2+px;
    const cy=h*.342+float+breathing+py;

    ctx.save();
    if(presence<1){
      ctx.globalAlpha=Math.max(.001,presence);
      ctx.translate(cx,cy);
      const s=.72+.28*presence;
      ctx.scale(s,s);
      ctx.translate(-cx,-cy);
    }

    this.drawBackdrop(ctx,cx,cy,fw,fh,time,energy,style);
    this.drawBustBase(ctx,cx,cy,fw,fh,style);
    this.drawShoulderTiles(ctx,cx,cy,fw,fh,time,energy,style,presence);
    this.drawNeckTiles(ctx,cx,cy,fw,fh,time,energy,style,presence);
    this.drawFaceBase(ctx,cx,cy,fw,fh,style);
    this.drawFlow(ctx,cx,cy,fw,fh,time,energy,style);
    this.drawFaceTiles(ctx,cx,cy,fw,fh,time,energy,style,presence);
    this.drawFaceContours(ctx,cx,cy,fw,fh,style,energy);
    this.drawEdgeFragments(ctx,cx,cy,fw,fh,time,energy,style);
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
