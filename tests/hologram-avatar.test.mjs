import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('main Dudidam renderer is a procedural hologram with no static face image dependency',async()=>{
  const [app,hologram,index]=await Promise.all([
    read('public/app.js'),
    read('public/hologram-avatar.js'),
    read('public/index.html')
  ]);
  assert.match(app,/import \{HologramAvatar\} from '\.\/hologram-avatar\.js'/);
  assert.match(app,/new HologramAvatar\(\$\('#avatar'\)\)/);
  assert.doesNotMatch(hologram,/reference\.png|new Image\(|drawImage\(/);
  assert.match(hologram,/buildFaceTiles/);
  assert.match(hologram,/drawProcessingOrbit/);
  assert.match(hologram,/drawBackdrop/);
  assert.match(hologram,/drawCenterCore/);
  assert.match(hologram,/drawEnergyFilaments/);
  assert.match(hologram,/drawShoulders/);
  assert.match(hologram,/ResizeObserver/);
  assert.match(index,/Entitas AI holografik procedural/);
});

test('hologram public control API supports state, audio, emotion, theme, pulse and glitch',async()=>{
  const [app,hologram]=await Promise.all([read('public/app.js'),read('public/hologram-avatar.js')]);
  for(const method of ['setState','setTheme','setTalking','setAudioLevel','setEmotion','pulse','triggerGlitch']){
    assert.match(hologram,new RegExp(method+'\\('),method);
  }
  for(const api of ['setAvatarState','setAvatarAudioLevel','setAvatarEmotion','setAvatarTheme','pulseAvatar','triggerAvatarGlitch','showAssistantPopup','hideAssistantPopup','toggleAssistantPopup']){
    assert.match(app,new RegExp(api),api);
  }
  for(const state of ['idle','listening','thinking','speaking','processing','error'])assert.match(hologram,new RegExp("'"+state+"'"));
});

test('assistant popup is interactive, adaptive and connected to desktop terminal',async()=>{
  const [html,css,popup,app,main,preload]=await Promise.all([
    read('public/index.html'),read('public/style.css'),read('public/dudidam-popup.js'),
    read('public/app.js'),read('desktop/main.cjs'),read('desktop/preload.cjs')
  ]);
  for(const action of ['terminal','voice','settings','collapse','close'])assert.match(html,new RegExp('data-popup-action="'+action+'"'));
  assert.match(css,/body\[data-dudidam-theme="dark"\]/);
  assert.match(css,/body\[data-dudidam-theme="light"\]/);
  assert.match(css,/backdrop-filter:blur/);
  assert.match(popup,/toggleVisibility/);
  assert.match(app,/prefers-color-scheme: light/);
  assert.match(main,/dudidam:terminal-open/);
  assert.match(preload,/openTerminal/);
});

test('hologram includes responsive theme-aware motion and audio-reactive facial systems',async()=>{
  const hologram=await read('public/hologram-avatar.js');
  for(const feature of ['drawEyes','drawNoseMouth','drawEars','drawFlow','drawFloatingCubes','stateEnergy','resolvedTheme','lowPowerUntil']){
    assert.match(hologram,new RegExp(feature),feature);
  }
  assert.match(hologram,/prefers-color-scheme: light/);
  assert.match(hologram,/pointer: coarse/);
  assert.match(hologram,/this\.audioLevel/);
  assert.match(hologram,/this\.nextBlink/);
  assert.match(hologram,/this\.frameCost>24/);
});
