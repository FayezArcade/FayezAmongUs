import {defineConfig} from 'vite';
import {Server} from 'socket.io';
import {attach} from './server/game.js';

function developmentRelay() {
  return {
    name:'fayez-development-relay',
    configureServer(vite) {
      if(!vite.httpServer)return;
      const io=new Server(vite.httpServer,{maxHttpBufferSize:8192,perMessageDeflate:false});
      const stop=attach(io);
      vite.httpServer.on('close',stop);
    }
  };
}
export default defineConfig({base:'./',plugins:[developmentRelay()]});
