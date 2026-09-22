import {TerminalManager} from '../desktop/terminal-manager.mjs';

if(process.platform!=='win32'){
 console.log('Terminal PTY smoke skipped: Windows only.');
 process.exit(0);
}

let output='',manager,session,timer;
try{
 const exited=new Promise(resolve=>{
  manager=new TerminalManager({
   workspace:process.cwd(),
   onData:(_id,data)=>{output+=String(data);},
   onExit:(id,exitCode)=>resolve({id,exitCode})
  });
 });
 session=await manager.create({shell:'cmd',cols:100,rows:30,title:'Dudidam CI CMD'});
 if(session.shell!=='cmd'||!session.pid)throw new Error('CMD PTY tidak berjalan.');
 manager.write(session.id,'echo DUDIDAM CMD OK\r');
 manager.write(session.id,'where git\r');
 manager.write(session.id,'exit\r');
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('PTY Windows tidak selesai dalam 12 detik.')),12000);});
 const ended=await Promise.race([exited,timeout]);
 clearTimeout(timer);
 if(ended.id!==session.id)throw new Error('Sesi PTY yang selesai tidak cocok.');
 if(!/DUDIDAM CMD OK/i.test(output))throw new Error('Output echo PTY tidak ditemukan.');
 if(!/git(?:\.exe)?/i.test(output))throw new Error('Git tidak ditemukan melalui CMD PTY.');
 const stopped=manager.list().find(item=>item.id===session.id);
 if(!stopped||stopped.status!=='stopped')throw new Error('Sesi PTY yang selesai harus tetap tersedia untuk Restart.');
 const restarted=await manager.restart(session.id);
 if(!restarted?.pid||restarted.id===session.id||restarted.status!=='running')throw new Error('Restart PTY tidak membuat sesi baru yang aktif.');
 manager.kill(restarted.id);
 if(manager.list().length)throw new Error('Sesi PTY tidak bersih setelah ditutup eksplisit.');
 console.log('Dudidam terminal PTY smoke passed: CMD interactive input, realtime output, Git PATH, stopped-session recovery, restart, and explicit cleanup.');
 manager.killAll();
 process.exit(0);
}catch(error){
 clearTimeout(timer);
 try{manager?.killAll();}catch{}
 console.error('Dudidam terminal PTY smoke failed:',error);
 process.exit(1);
}