import {access,cp,mkdir,rename,rm} from 'node:fs/promises';
import path from 'node:path';

if(process.platform!=='win32'){
 throw new Error('Paket desktop Dudidam saat ini hanya dibangun di Windows.');
}

const electronDist=process.env.ELECTRON_DIST_PATH
 ? path.resolve(process.env.ELECTRON_DIST_PATH)
 : path.resolve('node_modules','electron','dist');
const electronExe=path.join(electronDist,'electron.exe');
await access(electronExe);

const outputName=process.env.DUDIDAM_PACKAGE_OUTPUT||'Dudidam-Desktop';
if(!/^Dudidam-Desktop(?:-[A-Za-z0-9._-]+)?$/.test(outputName))throw new Error('Nama folder paket Dudidam tidak valid.');
const output=path.resolve(outputName);
await rm(output,{recursive:true,force:true});
await cp(electronDist,output,{recursive:true});

const appDir=path.join(output,'resources','app');
await mkdir(appDir,{recursive:true});
await cp('public',path.join(appDir,'public'),{recursive:true});
await cp('desktop',path.join(appDir,'desktop'),{recursive:true});
await cp('package.json',path.join(appDir,'package.json'));
await cp('Setup-suara-Indonesia.ps1',path.join(output,'Setup-suara-Indonesia.ps1'));

await rename(path.join(output,'electron.exe'),path.join(output,'Dudidam.exe'));
console.log(`Built portable Windows app: ${outputName}/Dudidam.exe`);
