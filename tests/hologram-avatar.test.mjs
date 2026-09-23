import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('main Dudidam renderer is a procedural hologram with no static face image dependency',async()=>{
  const [app,hologram,webgl,index]=await Promise.all([
    read('public/app.js'),
    read('public/hologram-avatar.js'),
    read('public/webgl-avatar.js'),
    read('public/index.html')
  ]);
  assert.match(app,/import \{HologramAvatar\} from '\.\/hologram-avatar\.js'/);
  assert.match(app,/new HologramAvatar\(\$\('#avatar'\)\)/);
  assert.match(hologram,/webgl-avatar\.js/);
  assert.doesNotMatch(webgl,/reference\.png|new Image\(|drawImage\(/);
  assert.match(webgl,/getContext\('webgl2'/);
  assert.match(webgl,/drawArraysInstanced/);
  assert.match(webgl,/buildFaceTiles/);
  assert.match(webgl,/buildNeckAndShoulders/);
  assert.match(webgl,/buildFragmentsAndGlyph/);
  assert.match(webgl,/buildOverlay/);
  assert.match(webgl,/ResizeObserver/);
  assert.match(index,/Entitas AI holografik procedural/);
});

test('hologram public control API supports state, audio, emotion, theme, pulse and glitch',async()=>{
  const [app,hologram]=await Promise.all([read('public/app.js'),read('public/webgl-avatar.js')]);
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
  const hologram=await read('public/webgl-avatar.js');
  for(const feature of ['drawBackground','drawCubes','drawOverlay','buildOverlay','stateEnergy','resolvedTheme','lowPowerUntil']){
    assert.match(hologram,new RegExp(feature),feature);
  }
  assert.match(hologram,/prefers-color-scheme: light/);
  assert.match(hologram,/pointer: coarse/);
  assert.match(hologram,/this\.audioLevel/);
  assert.match(hologram,/this\.nextBlink/);
  assert.match(hologram,/drawArraysInstanced/);
  assert.match(hologram,/this\.glitchUntil/);
});


test('HumanALE v3 face keeps human-like proportions, lips, eyes and frequency-reactive ears',async()=>{
  const webgl=await read('public/webgl-avatar.js');
  assert.match(webgl,/const rows=88,cols=68/);
  assert.match(webgl,/\[1,\.30\]/);
  assert.match(webgl,/drawEarContour/);
  assert.match(webgl,/earSpectrum\.low/);
  assert.match(webgl,/drawHumanMouth/);
  assert.match(webgl,/const cupid=/);
  assert.match(webgl,/const gazeX=/);
  assert.match(webgl,/circle\(gazeX,gazeY/);
  assert.match(webgl,/const upperLip=/);
  assert.match(webgl,/const lowerLip=/);
  assert.match(webgl,/const jaw=/);
});
