import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {classifyTaskDifficulty,reviewVerdict} from '../desktop/agent-hub.mjs';

test('structured HumanALE orchestrator classifies difficult work and review verdicts',()=>{
 assert.equal(classifyTaskDifficulty('halo'),'low');
 assert.equal(classifyTaskDifficulty('review runtime lalu perbaiki bug, jalankan test, audit security dan build Electron release'),'high');
 assert.equal(reviewVerdict('Semua sesuai.\nVERDICT: PASS'),'pass');
 assert.equal(reviewVerdict('Masih ada regression.\nVERDICT: NEEDS_FIX'),'needs_fix');
 assert.equal(reviewVerdict('belum ada keputusan'),'unknown');
});

test('structured HumanALE orchestrator keeps planning, work and review bounded',async()=>{
 const [hub,app,html]=await Promise.all([
  readFile(new URL('../desktop/agent-hub.mjs',import.meta.url),'utf8'),
  readFile(new URL('../public/app.js',import.meta.url),'utf8'),
  readFile(new URL('../public/index.html',import.meta.url),'utf8')
 ]);
 assert.match(hub,/id:'humanale-orchestrator'/);
 assert.match(hub,/async runStructured\(prompt,mode\)/);
 assert.match(hub,/Planner HumanALE/);
 assert.match(hub,/Worker HumanALE/);
 assert.match(hub,/Reviewer HumanALE/);
 assert.match(hub,/Final Reviewer HumanALE/);
 assert.match(hub,/reviewVerdict\(review\.text\)==='needs_fix'/);
 assert.match(hub,/runDirect\(planner,planPrompt,'analyze'\)/);
 assert.match(hub,/runDirect\(worker,workPrompt,mode\)/);
 assert.match(hub,/runDirect\(reviewer,reviewPrompt,'analyze'\)/);
 assert.match(hub,/Jangan git push, git merge, publish/);
 assert.match(app,/\['humanale-orchestrator','github-copilot','codex','cursor','claude'\]\.includes\(id\)/);
 assert.match(html,/Planner → Worker → Reviewer/);
});
