const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const gauss=(x,m,s)=>Math.exp(-((x-m)*(x-m))/(2*s*s));
const hash=(x,y=0,s=0)=>{
  const n=Math.sin(x*12.9898+y*78.233+s*37.719)*43758.5453123;
  return n-Math.floor(n);
};

const VALID_STATES=new Set(['idle','listening','thinking','speaking','processing','error']);
const VALID_EMOTIONS=new Set(['neutral','focused','happy','curious']);

function faceHalfWidth(y){
  const pts=[
    [-1,.44],[-.84,.72],[-.6,.91],[-.3,1],[-.05,.99],
    [.22,.94],[.46,.82],[.68,.65],[.86,.40],[1,.12]
  ];
  for(let i=0;i<pts.length-1;i++){
    const [y0,w0]=pts[i],[y1,w1]=pts[i+1];
    if(y>=y0&&y<=y1)return lerp(w0,w1,(y-y0)/(y1-y0));
  }
  return y<pts[0][0]?pts[0][1]:pts.at(-1)[1];
}

function faceDepth(nx,ny){
  const half=faceHalfWidth(ny);
  const xn=nx/Math.max(.05,half);
  const dome=Math.sqrt(Math.max(0,1-xn*xn))*gauss(ny,-.06,.96)*.54;
  const center=gauss(nx,0,.45)*gauss(ny,.02,.82)*.18;
  const nose=gauss(nx,0,.07)*gauss(ny,.05,.33)*.58+gauss(nx,0,.12)*gauss(ny,.23,.11)*.36;
  const cheeks=(gauss(nx,-.33,.18)+gauss(nx,.33,.18))*gauss(ny,.18,.20)*.22;
  const brow=(gauss(nx,-.28,.20)+gauss(nx,.28,.20))*gauss(ny,-.23,.10)*.14;
  const eyes=(gauss(nx,-.29,.16)+gauss(nx,.29,.16))*gauss(ny,-.12,.075)*.30;
  const mouth=gauss(nx,0,.25)*gauss(ny,.47,.065)*.11;
  return clamp(dome+center+nose+cheeks+brow-eyes-mouth,0,1.35);
}

function mat4Perspective(fovy,aspect,near,far){
  const f=1/Math.tan(fovy/2),nf=1/(near-far);
  return new Float32Array([
    f/aspect,0,0,0,
    0,f,0,0,
    0,0,(far+near)*nf,-1,
    0,0,(2*far*near)*nf,0
  ]);
}

function mat4LookAt(eye,center,up){
  let zx=eye[0]-center[0],zy=eye[1]-center[1],zz=eye[2]-center[2];
  let len=Math.hypot(zx,zy,zz)||1;zx/=len;zy/=len;zz/=len;
  let xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;
  len=Math.hypot(xx,xy,xz)||1;xx/=len;xy/=len;xz/=len;
  const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
  return new Float32Array([
    xx,yx,zx,0,
    xy,yy,zy,0,
    xz,yz,zz,0,
    -(xx*eye[0]+xy*eye[1]+xz*eye[2]),
    -(yx*eye[0]+yy*eye[1]+yz*eye[2]),
    -(zx*eye[0]+zy*eye[1]+zz*eye[2]),1
  ]);
}

function mat4Multiply(a,b){
  const out=new Float32Array(16);
  for(let c=0;c<4;c++){
    for(let r=0;r<4;r++){
      out[c*4+r]=
        a[0*4+r]*b[c*4+0]+
        a[1*4+r]*b[c*4+1]+
        a[2*4+r]*b[c*4+2]+
        a[3*4+r]*b[c*4+3];
    }
  }
  return out;
}

function compile(gl,type,source){
  const shader=gl.createShader(type);
  gl.shaderSource(shader,source);
  gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
    const error=gl.getShaderInfoLog(shader)||'Unknown shader error';
    gl.deleteShader(shader);
    throw new Error(error);
  }
  return shader;
}

function program(gl,vs,fs){
  const p=gl.createProgram();
  const v=compile(gl,gl.VERTEX_SHADER,vs);
  const f=compile(gl,gl.FRAGMENT_SHADER,fs);
  gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);
  gl.deleteShader(v);gl.deleteShader(f);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)){
    const error=gl.getProgramInfoLog(p)||'Unknown program error';
    gl.deleteProgram(p);
    throw new Error(error);
  }
  return p;
}

function cubeVertices(){
  const faces=[
    [[0,0,1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],
    [[0,0,-1],[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]],
    [[1,0,0],[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]],
    [[-1,0,0],[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]],
    [[0,1,0],[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]],
    [[0,-1,0],[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]
  ];
  const out=[];
  for(const [n,a,b,c,d] of faces){
    for(const v of [a,b,c,a,c,d])out.push(v[0]*.5,v[1]*.5,v[2]*.5,n[0],n[1],n[2]);
  }
  return new Float32Array(out);
}

function pushInstance(list,x,y,z,scale,color,phase,zone,seed,alpha){
  list.push(x,y,z,scale,color[0],color[1],color[2],phase,zone,seed,alpha);
}

const CUBE_VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 iOffset;
layout(location=3) in float iScale;
layout(location=4) in vec3 iColor;
layout(location=5) in vec4 iMeta;

uniform mat4 uVP;
uniform float uTime;
uniform float uEnergy;
uniform float uAudio;
uniform float uPresence;
uniform float uGlitch;
uniform vec2 uPointer;
uniform float uTheme;

out vec3 vColor;
out float vAlpha;
out float vLight;

mat3 rotY(float a){
  float c=cos(a),s=sin(a);
  return mat3(c,0.,-s,0.,1.,0.,s,0.,c);
}
mat3 rotX(float a){
  float c=cos(a),s=sin(a);
  return mat3(1.,0.,0.,0.,c,s,0.,-s,c);
}

void main(){
  float phase=iMeta.x;
  float zone=iMeta.y;
  float seed=iMeta.z;
  float alpha=iMeta.w;
  float wave=.5+.5*sin(uTime*(.75+seed*.55)+phase);
  vec3 offset=iOffset;

  float react=.0;
  if(zone<1.5) react=(.05+.12*uEnergy)*wave;
  else if(zone>2.5&&zone<5.6) react=(.015+.14*uAudio)*wave;
  else if(zone>7.5) react=(.06+.16*uEnergy)*wave;

  vec3 radial=normalize(vec3(offset.x,offset.y*.55,max(.18,abs(offset.z))));
  if(length(offset.xy)<.08)radial=vec3(0.,1.,.2);
  offset+=radial*react;

  if(zone>7.5){
    float a=uTime*(.18+.16*seed)+phase;
    offset.x+=sin(a)*(.035+.09*seed);
    offset.y+=cos(a*.73)*(.03+.065*seed);
    offset.z+=sin(a*.51)*(.025+.06*seed);
  }

  if(zone>5.5&&zone<7.6){
    offset.y+=sin(uTime*.62+phase)*.012;
  }

  offset.x+=(seed-.5)*uGlitch*.18;
  offset.y+=sin(phase*13.)*uGlitch*.06;

  float localScale=iScale*(1.+.045*sin(uTime*.8+phase));
  vec3 local=aPosition*localScale;
  mat3 R=rotY(uPointer.x*.14)*rotX(-uPointer.y*.08);
  vec3 world=R*(offset+local);
  world.y+=sin(uTime*.72)*.012;

  vec3 normal=normalize(R*aNormal);
  vec3 lightDir=normalize(vec3(-.35,.55,1.));
  float diffuse=.24+.76*max(dot(normal,lightDir),0.);
  float rim=pow(1.-max(dot(normal,normalize(vec3(0.,0.,1.))),0.),2.);

  vColor=iColor*(.62+.55*diffuse)+vec3(.16,.62,1.)*(rim*.24+uEnergy*.08);
  if(uTheme>.5)vColor=mix(vColor,vec3(.08,.34,.58),.18);
  vAlpha=alpha*uPresence;
  vLight=diffuse+rim*.6;
  gl_Position=uVP*vec4(world,1.);
}`;

const CUBE_FS=`#version 300 es
precision highp float;
in vec3 vColor;
in float vAlpha;
in float vLight;
out vec4 outColor;
void main(){
  vec3 color=vColor*(.85+.25*vLight);
  outColor=vec4(color,vAlpha);
}`;

const FLAT_VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec4 aColor;
uniform mat4 uVP;
uniform vec2 uPointer;
out vec4 vColor;
mat3 rotY(float a){
  float c=cos(a),s=sin(a);
  return mat3(c,0.,-s,0.,1.,0.,s,0.,c);
}
mat3 rotX(float a){
  float c=cos(a),s=sin(a);
  return mat3(1.,0.,0.,0.,c,s,0.,-s,c);
}
void main(){
  mat3 R=rotY(uPointer.x*.14)*rotX(-uPointer.y*.08);
  vec3 p=R*aPosition;
  gl_Position=uVP*vec4(p,1.);
  vColor=aColor;
}`;

const FLAT_FS=`#version 300 es
precision highp float;
in vec4 vColor;
out vec4 outColor;
void main(){outColor=vColor;}`;

const BG_VS=`#version 300 es
precision highp float;
out vec2 vUv;
void main(){
  vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);
  vUv=p*.5;
  gl_Position=vec4(p*2.-1.,0.,1.);
}`;

const BG_FS=`#version 300 es
precision highp float;
in vec2 vUv;
uniform float uTheme;
uniform float uEnergy;
out vec4 outColor;
void main(){
  vec2 p=vUv-vec2(.5,.49);
  p.x*=1.05;
  float d=length(p);
  float mask=1.-smoothstep(.18,.62,d);
  vec3 dark=mix(vec3(.004,.012,.030),vec3(.014,.06,.11),.22+uEnergy*.12);
  vec3 light=vec3(.88,.95,.98);
  vec3 col=mix(dark,light,uTheme*.82);
  float alpha=mix(.60,.17,uTheme)*mask;
  outColor=vec4(col,alpha);
}`;

export class WebGLAvatar{
  constructor(canvas){
    if(!canvas)throw new Error('Canvas avatar Dudidam tidak ditemukan.');
    this.canvas=canvas;
    this.gl=canvas.getContext('webgl2',{
      alpha:true,
      antialias:true,
      premultipliedAlpha:false,
      powerPreference:'high-performance'
    });
    this.fallbackCtx=null;
    this.webglActive=Boolean(this.gl);

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
    this.mode='webgl';
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
    this.nextBlink=performance.now()+2200+Math.random()*3300;
    this.pulseUntil=0;
    this.glitchUntil=0;
    this.transitionKind='';
    this.transitionStart=0;
    this.transitionDuration=0;
    this.lastFrame=0;
    this.lowPowerUntil=0;
    this.destroyed=false;
    this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.coarsePointer=matchMedia('(pointer: coarse)').matches;
    this.themeQuery=matchMedia('(prefers-color-scheme: light)');
    this.theme='auto';

    this.instances=[];
    this.buildFaceTiles();
    this.buildNeckAndShoulders();
    this.buildFragmentsAndGlyph();

    if(this.gl)this.initWebGL();
    else{
      this.fallbackCtx=canvas.getContext('2d',{alpha:true});
      canvas.dispatchEvent(new CustomEvent('avatar-webgl-fallback'));
    }

    this.resizeObserver=new ResizeObserver(()=>this.resize());
    this.resizeObserver.observe(canvas);
    this.themeListener=()=>this.resize();
    this.themeQuery.addEventListener?.('change',this.themeListener);
    this.resize();
    this.raf=requestAnimationFrame(t=>this.frame(t));
  }

  buildFaceTiles(){
    const rows=64,cols=50;
    for(let iy=0;iy<=rows;iy++){
      const ny=-1+iy/rows*2;
      const half=faceHalfWidth(ny);
      for(let ix=0;ix<=cols;ix++){
        const nx=-1+ix/cols*2;
        if(Math.abs(nx)>half)continue;
        const eyeL=((nx+.29)/.235)**2+((ny+.13)/.082)**2<1;
        const eyeR=((nx-.29)/.235)**2+((ny+.13)/.082)**2<1;
        const mouthGap=Math.abs(nx)<.27&&Math.abs(ny-.47)<.024;
        if(eyeL||eyeR||mouthGap)continue;

        const seed=hash(ix,iy,1);
        const depth=faceDepth(nx,ny);
        const edge=Math.abs(nx)/Math.max(.05,half);
        const zone=ny<-.62?0:ny<-.27?1:ny<.1?2:ny<.38?3:ny<.68?4:5;
        const x=nx*1.03;
        const y=-ny*1.34+.12;
        const z=depth*.52-.30;
        const scale=.032+depth*.010+(zone===0?.003:0);
        const blue=.28+.24*depth+.08*seed;
        const color=[
          .025+.055*seed,
          .18+.22*depth+.08*seed,
          blue
        ];
        const alpha=.36+.34*depth+.10*(1-edge);
        pushInstance(this.instances,x,y,z,scale,color,seed*TAU,zone,seed,alpha);
      }
    }
  }

  buildNeckAndShoulders(){
    const nRows=22,nCols=18;
    for(let iy=0;iy<=nRows;iy++){
      const t=iy/nRows;
      for(let ix=0;ix<=nCols;ix++){
        const nx=-1+ix/nCols*2;
        const half=.62+.12*t;
        if(Math.abs(nx)>half)continue;
        const seed=hash(ix,iy,11);
        const x=nx*.43*(1+t*.12);
        const y=-1.20-t*1.28;
        const z=.05+.18*(1-nx*nx)-t*.10;
        const scale=.035+seed*.010;
        const color=[.035+.04*seed,.22+.18*seed,.38+.25*seed];
        pushInstance(this.instances,x,y,z,scale,color,seed*TAU,6,seed,.42+.22*seed);
      }
    }

    const sRows=16,sCols=60;
    for(let iy=0;iy<=sRows;iy++){
      const t=iy/sRows;
      for(let ix=0;ix<=sCols;ix++){
        const nx=-1+ix/sCols*2;
        const curve=.18+(1-Math.abs(nx))*.78;
        if(t>curve)continue;
        const seed=hash(ix,iy,18);
        if(seed<.045)continue;
        const x=nx*2.45;
        const y=-2.22-t*.78;
        const z=-.20+.24*(1-Math.abs(nx))+.10*seed;
        const scale=.038+seed*.014;
        const color=[.025+.05*seed,.20+.20*seed,.37+.30*seed];
        pushInstance(this.instances,x,y,z,scale,color,seed*TAU,7,seed,.30+.24*seed);
      }
    }
  }

  buildFragmentsAndGlyph(){
    for(let i=0;i<150;i++){
      const seed=hash(i,2,24);
      const side=i%2?-1:1;
      const crown=i<86;
      let x,y,z;
      if(crown){
        x=side*(.08+.92*hash(i,4,25));
        y=1.32+.10+hash(i,6,26)*.68;
        z=-.22+hash(i,8,27)*.70;
      }else{
        x=side*(1.05+.20+hash(i,4,28)*.72);
        y=.95-hash(i,6,29)*2.25;
        z=-.25+hash(i,8,30)*.72;
      }
      const s=.045+seed*.075;
      const color=seed>.72?[.18,.70,1.0]:seed>.40?[.12,.45,.95]:[.38,.24,1.0];
      pushInstance(this.instances,x,y,z,s,color,seed*TAU,8,seed,.34+.34*seed);
    }

    for(let i=0;i<84;i++){
      const seed=hash(i,3,33);
      const side=i%2?-1:1;
      const x=side*(.38+.55*seed);
      const y=-1.7-hash(i,5,34)*1.25;
      const z=-.12+hash(i,7,35)*.62;
      const s=.035+seed*.060;
      const color=seed>.68?[.12,.65,1]:[.30,.20,.92];
      pushInstance(this.instances,x,y,z,s,color,seed*TAU,9,seed,.24+.32*seed);
    }

    const glyph=[
      [0,.78,.43],[.055,.78,.43],[-.055,.78,.43],[0,.835,.43],[0,.725,.43]
    ];
    for(const [x,y,z] of glyph)pushInstance(this.instances,x,y,z,.040,[.82,.98,1],0,10,.9,.92);
  }

  initWebGL(){
    const gl=this.gl;
    this.cubeProgram=program(gl,CUBE_VS,CUBE_FS);
    this.flatProgram=program(gl,FLAT_VS,FLAT_FS);
    this.bgProgram=program(gl,BG_VS,BG_FS);

    this.cubeVAO=gl.createVertexArray();
    gl.bindVertexArray(this.cubeVAO);

    this.cubeBuffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,this.cubeBuffer);
    const cube=cubeVertices();
    gl.bufferData(gl.ARRAY_BUFFER,cube,gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);

    this.instanceBuffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,this.instanceBuffer);
    this.instanceData=new Float32Array(this.instances);
    gl.bufferData(gl.ARRAY_BUFFER,this.instanceData,gl.STATIC_DRAW);
    const stride=11*4;
    gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,3,gl.FLOAT,false,stride,0);gl.vertexAttribDivisor(2,1);
    gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,1,gl.FLOAT,false,stride,12);gl.vertexAttribDivisor(3,1);
    gl.enableVertexAttribArray(4);gl.vertexAttribPointer(4,3,gl.FLOAT,false,stride,16);gl.vertexAttribDivisor(4,1);
    gl.enableVertexAttribArray(5);gl.vertexAttribPointer(5,4,gl.FLOAT,false,stride,28);gl.vertexAttribDivisor(5,1);

    this.flatVAO=gl.createVertexArray();
    gl.bindVertexArray(this.flatVAO);
    this.flatBuffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,this.flatBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,1024*1024,gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,28,0);
    gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,28,12);

    gl.bindVertexArray(null);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0,0,0,0);

    this.uCube={
      vp:gl.getUniformLocation(this.cubeProgram,'uVP'),
      time:gl.getUniformLocation(this.cubeProgram,'uTime'),
      energy:gl.getUniformLocation(this.cubeProgram,'uEnergy'),
      audio:gl.getUniformLocation(this.cubeProgram,'uAudio'),
      presence:gl.getUniformLocation(this.cubeProgram,'uPresence'),
      glitch:gl.getUniformLocation(this.cubeProgram,'uGlitch'),
      pointer:gl.getUniformLocation(this.cubeProgram,'uPointer'),
      theme:gl.getUniformLocation(this.cubeProgram,'uTheme')
    };
    this.uFlat={vp:gl.getUniformLocation(this.flatProgram,'uVP'),pointer:gl.getUniformLocation(this.flatProgram,'uPointer')};
    this.uBg={
      theme:gl.getUniformLocation(this.bgProgram,'uTheme'),
      energy:gl.getUniformLocation(this.bgProgram,'uEnergy')
    };
  }

  resolvedTheme(){
    if(this.theme==='dark'||this.theme==='light')return this.theme;
    return this.themeQuery.matches?'light':'dark';
  }
  setTheme(value='auto'){this.theme=['auto','dark','light'].includes(value)?value:'auto';this.environment=this.theme;}
  setEnvironment(value='auto'){this.setTheme(value);}
  setState(value='idle'){
    const next=VALID_STATES.has(value)?value:'idle';
    this.state=next;
    this.listening=next==='listening';
    this.thinking=next==='thinking'||next==='processing';
    if(next==='speaking')this.speaking=true;
    else if(this.audioTarget<.025)this.speaking=false;
    if(next==='error')this.triggerGlitch(850);
    if(next==='processing')this.pulse(1200);
  }
  setEmotion(value='neutral'){
    const aliases={angry:'focused',annoyed:'focused',sad:'curious'};
    const next=aliases[value]||value;
    this.emotion=VALID_EMOTIONS.has(next)?next:'neutral';
  }
  setTalking(active=false){this.speaking=Boolean(active);if(this.speaking)this.setState('speaking');else if(this.state==='speaking')this.setState('idle');}
  setAudioLevel(level=0){this.audioTarget=clamp(Number(level)||0,0,1);}
  setSpeechEnergy(level=.62){this.setAudioLevel(level);this.speaking=this.audioTarget>.025;if(this.speaking)this.setState('speaking');}
  setListening(value=false){this.listening=Boolean(value);if(this.listening)this.setState('listening');else if(this.state==='listening')this.setState('idle');}
  setEarSpectrum(value={}){for(const band of ['low','mid','high'])this.earSpectrum[band]=clamp(Number(value[band])||0,0,1);}
  setPaused(value=false){this.paused=Boolean(value);}
  setEvolving(value=false){this.evolving=Boolean(value);if(this.evolving)this.setState('processing');else if(this.state==='processing')this.setState('idle');}
  completeEvolution(){this.evolving=false;this.pulse(1500);this.setState('processing');setTimeout(()=>{if(!this.destroyed&&this.state==='processing')this.setState('idle');},1300);}
  activateAllEffects(value=true){if(value)this.pulse(1300);}
  setAvatarVariant(){}
  pulse(duration=1000){this.pulseUntil=Math.max(this.pulseUntil,performance.now()+duration);}
  pulseAvatar(duration=1000){this.pulse(duration);}
  triggerGlitch(duration=600){this.glitchUntil=Math.max(this.glitchUntil,performance.now()+duration);}
  trigger(action=''){
    this.action=action;this.actionStart=performance.now();
    if(action==='blink')this.blinkStart=this.actionStart;
    if(action==='pulse')this.pulse();
    if(action==='glitch')this.triggerGlitch();
  }
  reveal(){this.transitionKind='';}
  awaken(duration=4200){this.transitionKind='assemble';this.transitionStart=performance.now();this.transitionDuration=Math.max(900,Number(duration)||4200);this.pulse(duration);}
  dismiss(duration=3000){this.transitionKind='disassemble';this.transitionStart=performance.now();this.transitionDuration=Math.max(700,Number(duration)||3000);}
  isAwakening(now=performance.now()){return Boolean(this.transitionKind)&&now-this.transitionStart<this.transitionDuration;}

  transition(now){
    if(!this.transitionKind)return 1;
    const raw=clamp((now-this.transitionStart)/Math.max(1,this.transitionDuration),0,1);
    const eased=raw*raw*(3-2*raw);
    const presence=this.transitionKind==='assemble'?eased:1-eased;
    if(raw>=1)this.transitionKind='';
    return presence;
  }

  stateEnergy(time){
    const pulse=performance.now()<this.pulseUntil?.32+.68*(.5+.5*Math.sin(time*.006)):0;
    const map={idle:.18,listening:.44,thinking:.58,speaking:.66,processing:.76,error:.84};
    return clamp((map[this.state]||.18)+pulse*.34+this.audioLevel*.34,0,1);
  }

  resize(){
    const rect=this.canvas.getBoundingClientRect();
    const dpr=Math.min(window.devicePixelRatio||1,2);
    this.w=Math.max(1,rect.width);
    this.h=Math.max(1,rect.height);
    this.canvas.width=Math.round(this.w*dpr);
    this.canvas.height=Math.round(this.h*dpr);
    if(this.gl)this.gl.viewport(0,0,this.canvas.width,this.canvas.height);
  }

  vpMatrix(){
    const aspect=Math.max(.1,this.w/Math.max(1,this.h));
    const projection=mat4Perspective(30*Math.PI/180,aspect,.1,30);
    const view=mat4LookAt([0,-.62,10.4],[0,-.62,0],[0,1,0]);
    return mat4Multiply(projection,view);
  }

  flatPush(out,x,y,z,r,g,b,a){out.push(x,y,z,r,g,b,a);}

  buildOverlay(time,blink,energy){
    const lines=[],triangles=[];
    const cyan=[.28,.88,1],white=[.95,1,1],violet=[.58,.36,1];

    const line=(out,a,b,color,alpha)=>{
      this.flatPush(out,a[0],a[1],a[2],...color,alpha);
      this.flatPush(out,b[0],b[1],b[2],...color,alpha);
    };

    const circle=(cx,cy,cz,radius,segments,color,alpha,phase=0)=>{
      for(let i=0;i<segments;i++){
        const a=phase+i/segments*TAU,b=phase+(i+1)/segments*TAU;
        line(lines,
          [cx+Math.cos(a)*radius,cy+Math.sin(a)*radius,cz],
          [cx+Math.cos(b)*radius,cy+Math.sin(b)*radius,cz],
          color,alpha
        );
      }
    };

    circle(0,.12,-.72,1.70,96,cyan,.18+.07*energy,time*.00008);
    circle(0,.12,-.74,1.92,96,[.20,.48,1],.10+.05*energy,-time*.00005);
    circle(0,.12,-.76,2.10,96,violet,.055+.035*energy,time*.000035);

    const earEnergy=Math.max(this.earSpectrum.low,this.earSpectrum.mid,this.earSpectrum.high,this.listening?.2:0);
    for(const side of [-1,1]){
      circle(side*1.07,.04,.02,.19,44,cyan,.28+.18*earEnergy);
      circle(side*1.07,.04,.02,.11,36,[.24,.55,1],.18+.12*earEnergy);
      if(earEnergy>.02){
        circle(side*1.07,.04,-.02,.27+earEnergy*.06,40,cyan,.10+.12*earEnergy,time*.00025*side);
      }
    }

    const eye=(side,scale=1,alpha=.9)=>{
      const cx=side*.29,cy=.29,cz=.52;
      const half=.235*scale,h=.045*scale*(1-blink*.94);
      const boundary=[];
      const seg=22;
      for(let i=0;i<=seg;i++){
        const t=i/seg;
        boundary.push([cx+lerp(-half,half,t),cy+Math.sin(t*Math.PI)*h,cz]);
      }
      for(let i=seg;i>=0;i--){
        const t=i/seg;
        boundary.push([cx+lerp(-half,half,t),cy-Math.sin(t*Math.PI)*h*.42,cz]);
      }
      for(let i=0;i<boundary.length;i++){
        const a=boundary[i],b=boundary[(i+1)%boundary.length];
        this.flatPush(triangles,cx,cy,cz,...white,alpha);
        this.flatPush(triangles,...a,...cyan,.18*alpha);
        this.flatPush(triangles,...b,...cyan,.18*alpha);
      }
    };
    eye(-1,1.55,.10);eye(1,1.55,.10);
    eye(-1,1,.96);eye(1,1,.96);

    const quad=(x0,y0,x1,y1,z,color,a0,a1=a0)=>{
      this.flatPush(triangles,x0,y0,z,...color,a0);
      this.flatPush(triangles,x1,y0,z,...color,a0);
      this.flatPush(triangles,x1,y1,z,...color,a1);
      this.flatPush(triangles,x0,y0,z,...color,a0);
      this.flatPush(triangles,x1,y1,z,...color,a1);
      this.flatPush(triangles,x0,y1,z,...color,a1);
    };
    quad(-.025,1.78,.025,-2.95,.50,cyan,.05,.20+.20*energy);
    quad(-.009,1.78,.009,-2.95,.53,white,.16,.58+.22*energy);

    const level=this.speaking?this.audioLevel:0;
    const mouthY=-.57,open=.008+.055*level;
    line(lines,[-.19,mouthY,.51],[0,mouthY-open,.53],cyan,.34+.25*level);
    line(lines,[0,mouthY-open,.53],[.19,mouthY,.51],cyan,.34+.25*level);

    if(this.state==='processing'||this.evolving){
      circle(0,.12,-.25,1.42,72,[.38,.62,1],.18+.10*energy,time*.00045);
    }
    return {
      lines:new Float32Array(lines),
      triangles:new Float32Array(triangles)
    };
  }

  drawBackground(energy,themeLight){
    const gl=this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.bgProgram);
    gl.uniform1f(this.uBg.theme,themeLight);
    gl.uniform1f(this.uBg.energy,energy);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES,0,3);
  }

  drawCubes(time,energy,presence,themeLight,glitch){
    const gl=this.gl;
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.useProgram(this.cubeProgram);
    gl.bindVertexArray(this.cubeVAO);
    const vp=this.vpMatrix();
    gl.uniformMatrix4fv(this.uCube.vp,false,vp);
    gl.uniform1f(this.uCube.time,time*.001);
    gl.uniform1f(this.uCube.energy,energy);
    gl.uniform1f(this.uCube.audio,this.audioLevel);
    gl.uniform1f(this.uCube.presence,presence);
    gl.uniform1f(this.uCube.glitch,glitch);
    gl.uniform2f(this.uCube.pointer,this.rotation.x,this.rotation.y);
    gl.uniform1f(this.uCube.theme,themeLight);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArraysInstanced(gl.TRIANGLES,0,36,this.instances.length/11);
    gl.bindVertexArray(null);
  }

  drawOverlay(time,blink,energy){
    const gl=this.gl;
    const data=this.buildOverlay(time,blink,energy);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.useProgram(this.flatProgram);
    gl.bindVertexArray(this.flatVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.flatBuffer);
    gl.uniformMatrix4fv(this.uFlat.vp,false,this.vpMatrix());
    gl.uniform2f(this.uFlat.pointer,this.rotation.x,this.rotation.y);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE);

    if(data.triangles.length){
      gl.bufferSubData(gl.ARRAY_BUFFER,0,data.triangles);
      gl.drawArrays(gl.TRIANGLES,0,data.triangles.length/7);
    }
    if(data.lines.length){
      gl.bufferSubData(gl.ARRAY_BUFFER,0,data.lines);
      gl.drawArrays(gl.LINES,0,data.lines.length/7);
    }

    gl.bindVertexArray(null);
    gl.depthMask(true);
  }

  drawFallback(time,energy){
    const ctx=this.fallbackCtx;
    if(!ctx)return;
    ctx.clearRect(0,0,this.w,this.h);
    const cx=this.w/2,cy=this.h*.42,r=Math.min(this.w,this.h)*.22;
    const light=this.resolvedTheme()==='light';
    const g=ctx.createRadialGradient(cx,cy,r*.2,cx,cy,r*2.1);
    g.addColorStop(0,light?'rgba(80,180,230,.18)':'rgba(40,180,255,.24)');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,this.w,this.h);
    ctx.strokeStyle='rgba(90,220,255,.72)';ctx.lineWidth=1.2;
    ctx.beginPath();ctx.ellipse(cx,cy,r*.82,r*1.12,0,0,TAU);ctx.stroke();
    ctx.fillStyle='rgba(225,252,255,.92)';
    ctx.fillRect(cx-r*.48,cy-r*.12,r*.32,3);
    ctx.fillRect(cx+r*.16,cy-r*.12,r*.32,3);
    ctx.fillStyle='rgba(65,205,255,.65)';
    ctx.fillRect(cx-1,cy-r*.82,2,r*2.2);
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
    if(time>this.nextBlink){
      this.blinkStart=time;
      this.nextBlink=time+2400+Math.random()*3900;
    }
    const blinkAge=time-this.blinkStart;
    const blink=blinkAge>=0&&blinkAge<205?Math.sin(blinkAge/205*Math.PI):0;

    const target=this.coarsePointer||!this.track?{x:0,y:0}:(this.gazeActive?this.gazePointer:this.pointer);
    const ease=this.reducedMotion?.12:.042;
    this.rotation.x=lerp(this.rotation.x,clamp(target.x,-1,1),ease);
    this.rotation.y=lerp(this.rotation.y,clamp(target.y,-1,1),ease);

    const actionAge=time-this.actionStart;
    if(actionAge<1100){
      const env=Math.sin(actionAge/1100*Math.PI);
      if(this.action==='shake')this.rotation.x+=Math.sin(actionAge*.026)*.12*env;
      if(this.action==='nod')this.rotation.y+=Math.sin(actionAge*.018)*.08*env;
    }

    const presence=this.transition(time);
    const energy=this.stateEnergy(time);
    const glitch=performance.now()<this.glitchUntil?1:0;
    const themeLight=this.resolvedTheme()==='light'?1:0;

    if(!this.gl){
      this.drawFallback(time,energy);
      return;
    }

    const gl=this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    this.drawBackground(energy,themeLight);
    this.drawCubes(time,energy,presence,themeLight,glitch);
    this.drawOverlay(time,blink,energy);

    const cost=performance.now()-started;
    if(cost>24)this.lowPowerUntil=performance.now()+1800;
  }

  destroy(){
    this.destroyed=true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    this.themeQuery.removeEventListener?.('change',this.themeListener);
    if(this.gl){
      const gl=this.gl;
      for(const p of [this.cubeProgram,this.flatProgram,this.bgProgram])if(p)gl.deleteProgram(p);
      for(const b of [this.cubeBuffer,this.instanceBuffer,this.flatBuffer])if(b)gl.deleteBuffer(b);
      for(const v of [this.cubeVAO,this.flatVAO])if(v)gl.deleteVertexArray(v);
    }
  }
}

export const HologramAvatar=WebGLAvatar;
export const BinaryAvatar=WebGLAvatar;
