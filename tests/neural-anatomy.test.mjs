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

test('Dudidam preserves voice energy, emotions, global pointer and all material controls',()=>{
 const a=Object.create(BinaryAvatar.prototype),calls=[];a.earSpectrum={low:0,mid:0,high:0};
 Object.assign(a,{animate:true,track:true,mode:'matrix',color:'cyan',emotion:'happy',speaking:true,
 speechTarget:.7,audioLevel:.4,pointerActive:false,gazeActive:true,gazePointer:{x:.5,y:-.3},
 actionStart:-10000,engine:{accent:'',material:'',emotionName:'',setAccent:v=>calls.push(['color',v]),setMaterial:v=>calls.push(['material',v]),setEmotion:v=>calls.push(['emotion',v]),setPointer:(...v)=>calls.push(['pointer',...v])}});
 a.syncRenderer(1000);
 assert.equal(a.engine.externalSpeech,.7);
 assert.deepEqual(calls,[['color','cyan'],['material','binary'],['emotion','happy'],['pointer',.5,-.3,true,false]]);
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
