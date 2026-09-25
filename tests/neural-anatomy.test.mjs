import test from 'node:test';
import assert from 'node:assert/strict';
import {BinaryAvatar} from '../public/avatar.js';
const R=globalThis.FaceRig,N=globalThis.NeuralAvatar;

test('lips share the face lattice; smaller eye spheres contain binary code, not empty sockets',()=>{
 const a=Object.create(N.prototype),points=a.buildFallback();
 const eyes=points.filter(p=>p.feature==='eye-surface');
 const upper=points.filter(p=>p.feature==='lip-upper'),lower=points.filter(p=>p.feature==='lip-lower');
 assert.ok(upper.length>30&&lower.length>30&&eyes.length>100);
 assert.ok([...upper,...lower].every(p=>p.size===undefined&&p.z===R.depthAt(p.x,p.y)));
 assert.ok(eyes.every(p=>p.binary&&Math.abs(p.x-p.eyeSide*R.EYE_X)<.088));
 assert.ok(new Set(eyes.map(p=>p.z.toFixed(4))).size>8);
 assert.ok(!points.some(p=>['pupil-code','eye-glint','iris-code'].includes(p.feature)));
 assert.ok(R.depthAt(R.EYE_X,R.EYE_Y)<R.depthAt(.23,.09)-.05);
});

test('continuous mouth weights and code flow travel smoothly from neck toward brain',()=>{
 const a=Object.create(N.prototype);
 for(let lane=0;lane<14;lane++){
  let prev=a.flowPosition(lane,0);
  assert.ok(prev.y>.7);
  for(let phase=.01;phase<=1;phase+=.01){
   const p=a.flowPosition(lane,phase);
   assert.ok(p.y<prev.y);assert.ok(Number.isFinite(p.z));
   assert.ok(Math.hypot(p.x-prev.x,p.y-prev.y)<.035);prev=p;
  }
  assert.ok(prev.y<-.33&&Math.abs(prev.x)<.01);
 }
 const left=R.mouthWeights(.03,R.MOUTH_Y-.0001),right=R.mouthWeights(.03,R.MOUTH_Y+.0001);
 assert.ok(Math.abs(left.influence-right.influence)<.002);
});

test('brain and neck nodes form one connected network',()=>{
 const g=globalThis.NeuralCore.create(),seen=new Set([0]),queue=[0];
 const adjacency=g.nodes.map(()=>[]);
 for(const {a,b} of g.links){adjacency[a].push(b);adjacency[b].push(a);}
 for(let i=0;i<queue.length;i++)for(const n of adjacency[queue[i]])if(!seen.has(n)){seen.add(n);queue.push(n);}
 assert.equal(seen.size,g.nodes.length);assert.equal(g.paths.length,9);
});

test('pointer turns the head distinctly in every direction while the neck follows softly',()=>{
 const leftUp=R.pointerPose(-1,-1),rightDown=R.pointerPose(1,1);
 assert.ok(leftUp.yaw<-.5&&leftUp.pitch>.3);
 assert.ok(rightDown.yaw>.5&&rightDown.pitch<-.24);
 assert.ok(Math.abs(R.pointerPose(0,0).yaw)<1e-12);
 assert.ok(Math.abs(R.pointerPose(0,0).pitch)<1e-12);
 const neutral={yaw:0,pitch:0,roll:0},turned={yaw:.5,pitch:.3,roll:0};
 const neck={yaw:.18,pitch:.10};
 const crown=R.deform(.1,-.2,.35,turned,neck),crownNeutral=R.deform(.1,-.2,.35,neutral,{yaw:0,pitch:0});
 const base=R.deform(.1,.76,.18,turned,neck),baseNeutral=R.deform(.1,.76,.18,neutral,{yaw:0,pitch:0});
 assert.ok(Math.abs(crown.x-crownNeutral.x)>Math.abs(base.x-baseNeutral.x)*4);
 assert.ok(Math.abs(base.x-baseNeutral.x)>0.0001);
});

test('ears and neck are code anatomy attached to a connected evolving surface',()=>{
 const a=Object.create(N.prototype),points=a.buildFallback();
 const ears=points.filter(p=>p.feature==='ear'),roots=points.filter(p=>p.feature==='ear-root'),neck=points.filter(p=>p.feature==='neck');
 assert.ok(ears.length>500&&neck.length>250);
 assert.ok(roots.length>150&&roots.every(p=>p.earFlex<1));
 assert.ok(roots.some(p=>Math.abs(p.x)<.38)&&ears.some(p=>Math.abs(p.x)<.38));
 assert.ok(ears.some(p=>p.earSide===-1)&&ears.some(p=>p.earSide===1));
 assert.ok(ears.every(p=>p.binary===true||p.binary===false));
 const network=a.buildSurfaceNetwork(points),seen=new Set([0]),queue=[0];
 const neighbors=network.anchors.map(()=>[]);
 for(const edge of network.links){neighbors[edge.a].push(edge.b);neighbors[edge.b].push(edge.a);}
 for(let i=0;i<queue.length;i++)for(const next of neighbors[queue[i]])if(!seen.has(next)){seen.add(next);queue.push(next);}
 assert.ok(network.anchors.length>150&&network.links.length>=network.anchors.length-1);
 assert.equal(seen.size,network.anchors.length);
});

test('accent and black modes pass through intermediate tones across gradient bands',()=>{
 const a=Object.create(N.prototype);
 a.accent='cyan';a.paletteState={hue:192,sat:72,light:77,name:'CYAN'};
 const previousDocument=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>({fillText(){}})})};
 try{
  a.prepareGlyphs(0);
  assert.equal(a.glyphCache.darkBands.length,5);
  assert.notEqual(a.glyphCache.darkBands[0].colors[10],a.glyphCache.darkBands[4].colors[10]);
  assert.equal(a.glyphCache.lightBands[0].colors[10].split(' ')[1],'0%');
 }finally{
  if(previousDocument===undefined)delete globalThis.document;
  else globalThis.document=previousDocument;
 }
 a.accent='violet';a.advancePalette(1000,1/60);
 assert.ok(a.palette().hue>192&&a.palette().hue<266);
 for(let i=0;i<180;i++)a.advancePalette(1000+i*16,1/60);
 assert.ok(Math.abs(a.palette().hue-266)<.1);
 a.accent='black';a.advancePalette(4000,1/60);
 assert.ok(a.palette().sat>0&&a.palette().sat<66);
 assert.ok(a.palette().light>4&&a.palette().light<76);
});

test('surface code flows coherently and binary mutations advance without random flicker',()=>{
 const a=Object.create(N.prototype),pt={baseX:.2,baseY:.1,feature:'eye-surface',digit:0};
 a.animate=true;a.reducedMotion=false;a.evolution=1;a.mutationClock=0;
 const eye=a.surfaceDrift(pt,500);
 pt.feature='ear';const ear=a.surfaceDrift(pt,500);
 assert.ok(Math.hypot(ear.x,ear.y)>Math.hypot(eye.x,eye.y)*5);
 assert.equal(a.digitAt(pt),0);
 a.mutationClock=1.1;assert.equal(a.digitAt(pt),1);
 a.mutationClock=2.1;assert.equal(a.digitAt(pt),0);
 const node={x:.14,y:-.3,z:.16};a.evolution=0;
 const idle=a.corePosition(node,800);
 a.evolution=1;const evolving=a.corePosition(node,800);
 assert.ok(Math.hypot(evolving.x-node.x,evolving.y-node.y,evolving.z-node.z)>
   Math.hypot(idle.x-node.x,idle.y-node.y,idle.z-node.z)*3);
 a.animate=false;
 const still=a.surfaceDrift(pt,800);
 assert.ok(Math.hypot(still.x,still.y)<1e-12);
 assert.deepEqual(a.corePosition(node,800),node);
});

test('Dudidam preserves voice energy, emotions, global pointer and all material controls',()=>{
 const a=Object.create(BinaryAvatar.prototype),calls=[];a.earSpectrum={low:0,mid:0,high:0};
 Object.assign(a,{animate:true,track:true,mode:'matrix',color:'cyan',emotion:'happy',speaking:true,
 speechTarget:.7,audioLevel:.4,pointerActive:false,gazeActive:true,gazePointer:{x:.5,y:-.3},
 actionStart:-10000,engine:{accent:'',material:'',emotionName:'',setAccent:v=>calls.push(['color',v]),setMaterial:v=>calls.push(['material',v]),setEmotion:v=>calls.push(['emotion',v]),setPointer:(...v)=>calls.push(['pointer',...v])}});
 a.syncRenderer(1000);
 assert.equal(a.engine.externalSpeech,.7);
 assert.ok(a.engine.evolutionTarget>0);
 assert.deepEqual(a.engine.earSpectrum,{low:0,mid:0,high:0});
 assert.deepEqual(calls,[['color','cyan'],['material','binary'],['emotion','happy'],['pointer',.5,-.3,true,false]]);
 a.speaking=false;a.speechTarget=0;a.audioLevel=.4;a.syncRenderer(1100);
 assert.equal(a.engine.externalSpeech,.4);
 a.setSpeechEnergy(99);assert.equal(a.speechTarget,1);
 a.setSpeechEnergy(-9);assert.equal(a.speechTarget,0);
 a.setEarSpectrum({low:.8,mid:-1,high:3});
 assert.deepEqual(a.earSpectrum,{low:.8,mid:0,high:1});
});

test('viewport-local background map, zoom, manual contrast and invalid input are bounded',()=>{
 const a=Object.create(N.prototype);
 Object.assign(a,{width:400,height:400,environment:'auto',environmentQuery:{matches:false},zoomTarget:1});
 a.setBackdrop({columns:2,rows:1,values:[0,1]});
 assert.equal(a.lightAt(0,200),false);assert.equal(a.lightAt(400,200),true);
 a.environment='light';assert.equal(a.lightAt(0,200),true);
 a.setZoom(999);assert.equal(a.zoomTarget,3.8);a.setZoom(-5);assert.equal(a.zoomTarget,1);
 const old=a.backdrop;a.setBackdrop({columns:2,rows:1,values:[NaN,1]});assert.equal(a.backdrop,old);
});

test('gentle blink closes then opens continuously',()=>{
 const a=Object.create(N.prototype);
 Object.assign(a,{blinkStart:1000,nextBlink:9999,random:()=>.5});
 assert.equal(a.blinkValue(1000),0);assert.equal(a.blinkValue(1150),1);assert.equal(a.blinkValue(1480),0);
 assert.ok(a.blinkValue(1070)>.4&&a.blinkValue(1070)<.6);
});
