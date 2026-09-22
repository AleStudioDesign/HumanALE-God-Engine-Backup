import {access,cp,mkdir,rename,rm} from 'node:fs/promises';
import path from 'node:path';

if(process.platform!=='win32'){
 throw new Error('Paket desktop HumanALE God Engine saat ini hanya dibangun di Windows.');
}

const electronDist=process.env.ELECTRON_DIST_PATH
 ? path.resolve(process.env.ELECTRON_DIST_PATH)
 : path.resolve('node_modules','electron','dist');
const electronExe=path.join(electronDist,'electron.exe');
await access(electronExe);

const outputName=process.env.HUMANALE_PACKAGE_OUTPUT||process.env.DUDIDAM_PACKAGE_OUTPUT||'HumanALE-God-Engine-Desktop';
if(!/^HumanALE-God-Engine-Desktop(?:-[A-Za-z0-9._-]+)?$/.test(outputName))throw new Error('Nama folder paket HumanALE God Engine tidak valid.');
const output=path.resolve(outputName);
await rm(output,{recursive:true,force:true});
await cp(electronDist,output,{recursive:true});

const appDir=path.join(output,'resources','app');
await mkdir(appDir,{recursive:true});
await cp('public',path.join(appDir,'public'),{recursive:true});
await cp('desktop',path.join(appDir,'desktop'),{recursive:true,filter:source=>!source.includes('__pycache__')});
await cp('package.json',path.join(appDir,'package.json'));
const runtimeModules=[
 ['node-pty'],
 ['node-addon-api'],
 ['@xterm','xterm'],
 ['@xterm','addon-fit']
];
for(const parts of runtimeModules){
 const source=path.join('node_modules',...parts);
 const target=path.join(appDir,'node_modules',...parts);
 await mkdir(path.dirname(target),{recursive:true});
 await cp(source,target,{recursive:true});
}
await cp('Setup-suara-Indonesia.ps1',path.join(output,'Setup-suara-Indonesia.ps1'));

await rename(path.join(output,'electron.exe'),path.join(output,'HumanALE-God-Engine.exe'));
console.log(`Built portable Windows app: ${outputName}/HumanALE-God-Engine.exe`);
