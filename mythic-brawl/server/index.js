/**
 * MYTHIC BRAWL — Colyseus Multiplayer Server
 *
 * Runs on port 2567. Hosts DungeonRoom instances for co-op play.
 */

import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createServer } from 'http';
import { DungeonRoom } from './rooms/DungeonRoom.js';

const port = 2567;

const server = new Server({
  transport: new WebSocketTransport({
    server: createServer(),
  }),
});

server.define('dungeon', DungeonRoom);

server.listen(port).then(() => {
  console.log(`Mythic Brawl server running on ws://localhost:${port}`);
});
