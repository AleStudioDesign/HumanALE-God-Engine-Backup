import assert from 'node:assert/strict';
import test from 'node:test';
import {frequencyBands} from '../public/audio-reactor.js';
import {emotionFromText} from '../public/avatar-emotion.js';
import {BinaryAvatar} from '../public/avatar.js';

test('telinga membedakan frekuensi rendah, tengah, dan tinggi',()=>{
 const sampleRate=48000,fftSize=512;
 for(const [hz,expected] of [[188,'low'],[938,'mid'],[3750,'high']]){
  const data=new Uint8Array(fftSize/2);
  data[Math.round(hz*fftSize/sampleRate)]=220;
  const bands=frequencyBands(data,sampleRate,fftSize);
  assert.ok(bands[expected]>0);
  for(const name of ['low','mid','high'])if(name!==expected)assert.equal(bands[name],0);
 }
 assert.deepEqual(frequencyBands(null,0,0),{low:0,mid:0,high:0});
});

test('ekspresi otomatis mengerti ungkapan Indonesia',()=>{
 assert.equal(emotionFromText('Saya bahagia dan senang!'),'happy');
 assert.equal(emotionFromText('Saya marah sekali'),'angry');
 assert.equal(emotionFromText('Ini membuat saya kesal'),'annoyed');
 assert.equal(emotionFromText('Kabar ini sedih'),'sad');
 assert.equal(emotionFromText('Halo, apa kabar?'),'neutral');
});

test('mulut bahagia dan sedih menghasilkan bentuk yang berbeda',()=>{
 const mouthFor=emotion=>{
  const calls=[];
  const avatar={emotion,speaking:false,drawBinaryQuadratic:(...args)=>calls.push(args)};
  BinaryAvatar.prototype.drawEmotionOverlay.call(avatar,{},420,210,210,205,260,130,false,0);
  return calls.at(-1);
 };
 const happy=mouthFor('happy'),sad=mouthFor('sad');
 assert.equal(happy.length,10);
 assert.ok(happy[2].y>happy[1].y);
 assert.ok(sad[2].y<sad[1].y);
});
