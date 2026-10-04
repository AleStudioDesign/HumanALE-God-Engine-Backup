import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, copyFile, readFile, rm, access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

test('rebuild removes deleted client assets and stale hosting metadata',async t=>{
  const root=await mkdtemp(join(tmpdir(),'humanale-build-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await copyFile(new URL('../build.mjs',import.meta.url),join(root,'build.mjs'));
  await mkdir(join(root,'public'));
  await mkdir(join(root,'.openai'));
  await writeFile(join(root,'public','index.html'),'first build');
  await writeFile(join(root,'public','removed.js'),'obsolete client asset');
  await writeFile(join(root,'worker.mjs'),'export default {};');
  await writeFile(join(root,'.openai','hosting.json'),JSON.stringify({static:'public',project:'fixture'}));
  execFileSync(process.execPath,['build.mjs'],{cwd:root});
  assert.equal(await readFile(join(root,'dist','client','removed.js'),'utf8'),'obsolete client asset');
  assert.deepEqual(JSON.parse(await readFile(join(root,'dist','.openai','hosting.json'),'utf8')),{project:'fixture'});

  await rm(join(root,'public','removed.js'));
  await rm(join(root,'.openai','hosting.json'));
  await writeFile(join(root,'public','index.html'),'second build');
  execFileSync(process.execPath,['build.mjs'],{cwd:root});
  await assert.rejects(access(join(root,'dist','client','removed.js')),{code:'ENOENT'});
  await assert.rejects(access(join(root,'dist','.openai','hosting.json')),{code:'ENOENT'});
  assert.equal(await readFile(join(root,'dist','client','index.html'),'utf8'),'second build');
  assert.equal(await readFile(join(root,'dist','server','index.js'),'utf8'),'export default {};');
  const config=JSON.parse(await readFile(join(root,'dist','server','wrangler.json'),'utf8'));
  assert.equal(config.assets.directory,'../client');
});
