import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { getRedisUrl, getSanitizedRedisUrl } from './services/redis.service.js';

const REDIS_URL = getRedisUrl();

console.log("=================================================");
console.log("🧪 TESTING REDIS + SOCKET.IO HORIZONTAL SCALING");
console.log(`Using Redis Endpoint: ${getSanitizedRedisUrl()}`);
console.log("=================================================\n");

async function createServerInstance(port) {
    const app = express();
    const server = http.createServer(app);
    const io = new Server(server, {
        cors: { origin: '*' }
    });

    const pubClient = createClient({ url: REDIS_URL });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));

    io.on('connection', (socket) => {
        const room = socket.handshake.query.room || 'project-room-default';
        socket.join(room);
        console.log(`[Server @ Port ${port}] Client connected (${socket.id}) -> Joined ${room}`);

        socket.on('chat-message', (data) => {
            console.log(`[Server @ Port ${port}] Received message from ${socket.id}: "${data.text}". Broadcasting to ${room}...`);
            io.to(room).emit('chat-message', {
                ...data,
                relayedByPort: port,
                timestamp: Date.now()
            });
        });
    });

    await new Promise((resolve) => server.listen(port, resolve));
    console.log(`✓ Server instance listening on http://localhost:${port}`);
    return { server, io, pubClient, subClient };
}

async function runTest() {
    let server1, server2;

    try {
        // 1. Boot Server 1 on Port 9001
        console.log("1️⃣ Spawning Server Instance 1 on Port 9001...");
        server1 = await createServerInstance(9001);

        // 2. Boot Server 2 on Port 9002
        console.log("2️⃣ Spawning Server Instance 2 on Port 9002...");
        server2 = await createServerInstance(9002);

        console.log("\n🔗 Both server instances connected to shared Redis Pub/Sub adapter!\n");

        // 3. Connect Client A to Server 1
        console.log("3️⃣ Connecting Client A -> Server 1 (Port 9001)...");
        const clientA = ClientIO('http://localhost:9001', {
            query: { room: 'project-soen-101' },
            transports: ['websocket']
        });

        // 4. Connect Client B to Server 2
        console.log("4️⃣ Connecting Client B -> Server 2 (Port 9002)...");
        const clientB = ClientIO('http://localhost:9002', {
            query: { room: 'project-soen-101' },
            transports: ['websocket']
        });

        await new Promise((res) => {
            let connectedCount = 0;
            const check = () => {
                connectedCount++;
                if (connectedCount === 2) res();
            };
            clientA.on('connect', check);
            clientB.on('connect', check);
        });

        console.log("✓ Client A connected to Server 1");
        console.log("✓ Client B connected to Server 2\n");

        // 5. Test Message from Client A (Server 1) -> Client B (Server 2)
        const crossServerPromise1 = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Timeout waiting for Client B to receive message")), 5000);

            clientB.on('chat-message', (data) => {
                if (data.sender === 'Client A') {
                    clearTimeout(timeout);
                    console.log(`🎉 SUCCESS! Client B (on Server 2) received: "${data.text}" from Server ${data.relayedByPort}!`);
                    resolve(data);
                }
            });

            console.log("5️⃣ Client A (Server 1) sending message: 'Hello from Server 1'...");
            clientA.emit('chat-message', {
                sender: 'Client A',
                text: 'Hello from Server 1'
            });
        });

        await crossServerPromise1;

        // 6. Test Reverse Message from Client B (Server 2) -> Client A (Server 1)
        const crossServerPromise2 = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Timeout waiting for Client A to receive reply")), 5000);

            clientA.on('chat-message', (data) => {
                if (data.sender === 'Client B') {
                    clearTimeout(timeout);
                    console.log(`🎉 SUCCESS! Client A (on Server 1) received reply: "${data.text}" from Server ${data.relayedByPort}!`);
                    resolve(data);
                }
            });

            console.log("\n6️⃣ Client B (Server 2) sending reply: 'Hello from Server 2'...");
            clientB.emit('chat-message', {
                sender: 'Client B',
                text: 'Hello from Server 2'
            });
        });

        await crossServerPromise2;

        console.log("\n=================================================");
        console.log("✅ ALL HORIZONTAL SCALING TESTS PASSED!");
        console.log("Redis Pub/Sub successfully synchronized Socket.IO instances!");
        console.log("=================================================\n");

        // Cleanup
        clientA.disconnect();
        clientB.disconnect();
    } catch (err) {
        console.error("\n❌ Test Error:", err.message);
    } finally {
        if (server1) {
            server1.io.close();
            server1.server.close();
            await server1.pubClient.quit().catch(() => {});
            await server1.subClient.quit().catch(() => {});
        }
        if (server2) {
            server2.io.close();
            server2.server.close();
            await server2.pubClient.quit().catch(() => {});
            await server2.subClient.quit().catch(() => {});
        }
        process.exit(0);
    }
}

runTest();
