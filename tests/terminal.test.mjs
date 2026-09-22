import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {classifyCommand,redactSecrets,shouldPersistHistory} from '../desktop/terminal-policy.mjs';
import {TerminalManager} from '../desktop/terminal-manager.mjs';

test('terminal policy separates SAFE CONFIRM and BLOCK commands',()=>{
 assert.equal(classifyCommand('git status').category,'SAFE');
 assert.equal(classifyCommand('npm run build').category,'SAFE');
 assert.equal(classifyCommand('git push origin main').category,'CONFIRM');
 assert.equal(classifyCommand('winget install Example.App').category,'CONFIRM');
 assert.equal(classifyCommand('Set-MpPreference -DisableRealtimeMonitoring $true').category,'BLOCK');
 assert.equal(classifyCommand('cmdkey /list').category,'BLOCK');
 assert.equal(classifyCommand('echo one\necho two').category,'BLOCK');
});

test('terminal redaction removes common credentials before AI or logs',()=>{
 const value='OPENAI_API_KEY=sk-test-secret Authorization: Bearer abc.def.ghi password=hunter2 token=abc123';
 const redacted=redactSecrets(value);
 assert.doesNotMatch(redacted,/sk-test-secret|abc\.def\.ghi|hunter2|abc123/);
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
 assert.match(main,/vendor\/xterm\.js/);
 assert.match(preload,/terminalCreate/);
 assert.match(preload,/onTerminalData/);
 assert.doesNotMatch(preload,/require:\s*require|child_process|node-pty/);
 assert.match(html,/id="terminalDialog"/);
 assert.match(html,/\/vendor\/xterm\.js/);
 assert.match(ui,/new window\.Terminal/);
 assert.match(ui,/FitAddon/);
 assert.match(ui,/terminalResize/);
 assert.match(ui,/\/run/);
 assert.match(pkg,/"node-pty": "1\.1\.0"/);
 assert.match(pkg,/"@xterm\/xterm": "6\.0\.0"/);
 assert.match(portable,/node-pty/);
 assert.match(portable,/@xterm/);
});

test('TerminalManager runs an interactive Windows PTY and cleans it up',{skip:process.platform!=='win32'},async()=>{
 let output='',resolveExit;
 const exited=new Promise(resolve=>resolveExit=resolve);
 const manager=new TerminalManager({
  workspace:process.cwd(),
  onData:(_id,data)=>output+=data,
  onExit:(id,exitCode)=>resolveExit({id,exitCode})
 });
 const session=await manager.create({shell:'cmd',cols:100,rows:30,title:'CI CMD'});
 assert.equal(session.shell,'cmd');
 assert.equal(session.status,'running');
 assert.ok(session.pid>0);
 manager.write(session.id,'echo DUDIDAM CMD OK\r');
 manager.write(session.id,'where git\r');
 manager.write(session.id,'exit\r');
 const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error('PTY Windows tidak selesai dalam 15 detik.')),15000));
 const ended=await Promise.race([exited,timeout]);
 assert.equal(ended.id,session.id);
 assert.match(output,/DUDIDAM CMD OK/i);
 assert.match(output,/git(?:\.exe)?/i);
 assert.equal(manager.list().length,0);
 manager.killAll();
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
