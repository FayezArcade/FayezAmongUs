import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Server} from 'socket.io';
import {deckRevision} from '../shared/deck.js';
import {attach} from './game.js';

const staticRoot=fileURLToPath(new URL('../dist/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
export function createGameServer({origins=process.env.CORS_ORIGIN,serve=process.env.SERVE_CLIENT==='1',...options}={}) {
  const allow=origins?.split(',').map(v=>v.trim()).filter(Boolean)||[];
  const server=createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/health'){
      res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'}).end(JSON.stringify({ok:true,game:'Fayez Crew',deck:deckRevision}));
      return;
    }
    if(serve&&req.method==='GET'){
      const file=path.resolve(staticRoot,'.'+(url.pathname==='/'?'/index.html':url.pathname));
      try{
        if(!file.startsWith(staticRoot)||!(await stat(file)).isFile())throw Error();
        res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'}).end(await readFile(file));return;
      }catch{}
    }
    res.writeHead(404).end('Not found');
  });
  const io=new Server(server,{
    cors:{origin:allow.length?allow:false},
    allowRequest:(req,callback)=> {
      const origin=req.headers.origin;
      let same=false;
      try{same=new URL(origin).host===(req.headers['x-forwarded-host']||req.headers.host);}catch{}
      callback(null,!origin||same||allow.includes(origin)||(!allow.length&&/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)));
    },
    maxHttpBufferSize:8192,perMessageDeflate:false
  });
  const stop=attach(io,options);
  return {server,io,close:()=>{stop();return io.close();}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const game=createGameServer();
  game.server.listen(Number(process.env.PORT)||3001,'0.0.0.0',()=>console.log('Fayez Crew relay is ready.'));
  process.on('SIGTERM',()=>game.close());
}
