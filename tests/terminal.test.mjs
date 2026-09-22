import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {classifyCommand,redactSecrets,shouldPersistHistory} from '../desktop/terminal-policy.mjs';
import {TerminalManager} from '../desktop/terminal-manager.mjs';

test('terminal policy separates SAFE CONFIRM and BLOCK commands',()=>{
 assert.equal(classifyCommand('git status').category,'SAFE');
 assert.equal(classifyCommand('npm run build').category,'CONFIRM');
 assert.equal(classifyCommand('npm test').category,'CONFIRM');
 assert.equal(classifyCommand('git push origin main').category,'CONFIRM');
 assert.equal(classifyCommand('winget install Example.App').category,'CONFIRM');
 assert.equal(classifyCommand('Set-MpPreference -DisableRealtimeMonitoring $true').category,'BLOCK');
 assert.equal(classifyCommand('cmdkey /list').category,'BLOCK');
 assert.equal(classifyCommand('echo one\necho two').category,'BLOCK');
 assert.equal(classifyCommand('git status; echo chained').category,'CONFIRM');
 assert.equal(classifyCommand('git status && echo chained').category,'CONFIRM');
 assert.equal(classifyCommand('git status | findstr main').category,'CONFIRM');
 assert.equal(classifyCommand('git status > status.txt').category,'CONFIRM');
 assert.equal(classifyCommand('git status $(echo injected)').category,'CONFIRM');
});

test('terminal redaction removes common credentials before AI or logs',()=>{
 const value='OPENAI_API_KEY=sk-test-secret Authorization: Bearer abc.def.ghi password=hunter2 token=abc123 github_pat_1234567890abcdefghijklmnop sk-ant-abcdefghijklmnop';
 const redacted=redactSecrets(value);
 assert.doesNotMatch(redacted,/sk-test-secret|abc\.def\.ghi|hunter2|abc123|github_pat_|sk-ant-/);
 assert.match(redacted,/\[REDACTED\]/);
 assert.equal(shouldPersistHistory('git status'),true);
 assert.equal(shouldPersistHistory('set token=abc'),false);
});

test('terminal renderer and preload keep Node APIs behind bounded IPC',async()=>{
 const [preload,main,html,ui,pkg,portable]=await Promise.all([
  readFile(new URL('../desktop/preload.cjs',import.meta.url),'utf8'),
  readFile(new URL('../desktop/main.cjs',import.meta.url),'utf8'),
  readFile(new URL('../public/index.html',import.meta.url),'utf8'),
  readFile(new URL('../public/terminal-ui.js',import.meta.url),'utf8'),
  readFile(new URL('../package.json',import.meta.url),'utf8'),
  readFile(new URL('../package-desktop.mjs',import.meta.url),'utf8')
 ]);
 assert.match(main,/nodeIntegration:false/);
 assert.match(main,/contextIsolation:true/);
 assert.match(main,/sandbox:true/);
 assert.match(main,/dudidam:terminal-create/);
 assert.match(main,/dudidam:terminal-execute/);
 assert.match(main,/Konfirmasi command Dudidam/);
 assert.doesNotMatch(main,/decision\.category==='CONFIRM'&&!value\?\.confirmed/);
 assert.match(main,/return await terminalManager\.setCwd/);
 assert.match(main,/vendor\/xterm\.js/);
 assert.match(preload,/terminalCreate/);
 assert.match(preload,/onTerminalData/);
 assert.doesNotMatch(preload,/require:\s*require|child_process|node-pty/);
 assert.match(html,/id="terminalDialog"/);
 assert.match(ui,/\/vendor\/xterm\.js/);
 assert.match(ui,/new window\.Terminal/);
 assert.match(ui,/FitAddon/);
 assert.match(ui,/terminalResize/);
 assert.match(ui,/\/run/);
 assert.match(ui,/terminalExecute/);
 assert.doesNotMatch(ui,/needsConfirmation|command,true/);
 assert.match(main,/terminalManager\?\.killAll/);
 assert.match(pkg,/"node-pty": "1\.1\.0"/);
 assert.match(pkg,/"@xterm\/xterm": "6\.0\.0"/);
 assert.match(portable,/node-pty/);
 assert.match(portable,/@xterm/);
});

test('terminal startup is restricted to detected CLI profiles and cannot accept raw startup commands',async()=>{
 const [manager,ui]=await Promise.all([
  readFile(new URL('../desktop/terminal-manager.mjs',import.meta.url),'utf8'),
  readFile(new URL('../public/terminal-ui.js',import.meta.url),'utf8')
 ]);
 assert.match(manager,/async resolveProfile\(profile\)/);
 assert.match(manager,/if\(profile\)terminal\.write\(executableLine/);
 assert.doesNotMatch(manager,/options\.startupCommand/);
 assert.match(ui,/profile:kind/);
 assert.doesNotMatch(ui,/startupCommand/);
 assert.match(manager,/Set-Location -LiteralPath/);
 assert.match(ui,/terminalRecent/);
 assert.match(ui,/terminalList/);
});

test('TerminalManager detects Windows shell fallback and developer CLIs without failing',{skip:process.platform!=='win32'},async()=>{
 const manager=new TerminalManager({workspace:process.cwd()});
 const detection=await manager.detect();
 assert.equal(detection.workspace,process.cwd());
 assert.ok(['READY','NOT FOUND'].includes(detection.shells.pwsh.state));
 assert.equal(detection.shells.cmd.state,'READY');
 for(const id of ['claude','codex','cursor','gemini','git','gh','node','npm','python'])assert.ok(detection.registry[id]);
 manager.killAll();
});