import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

/**
 * Derives a sanitized Redis connection URL from environment variables
 */
export const getRedisUrl = () => {
    if (process.env.REDIS_URL) {
        return process.env.REDIS_URL;
    }

    const host = process.env.REDIS_HOST || "localhost";
    const port = process.env.REDIS_PORT || 6379;
    const password = process.env.REDIS_PASSWORD;

    if (password) {
        return `redis://:${encodeURIComponent(password)}@${host}:${port}`;
    }

    return `redis://${host}:${port}`;
};

/**
 * Returns a sanitized URL for safe logging (hides passwords)
 */
export const getSanitizedRedisUrl = () => {
    const rawUrl = getRedisUrl();
    try {
        const parsed = new URL(rawUrl);
        if (parsed.password) {
            parsed.password = "******";
        }
        return parsed.toString();
    } catch {
        return "redis://[secured]";
    }
};

let pubClient = null;
let subClient = null;
let redisStatus = "disconnected"; // 'connecting' | 'connected' | 'error' | 'disconnected'

/**
 * Initializes Redis Pub/Sub adapter for Socket.IO horizontal scaling
 */
export const initRedisAdapter = async (io) => {
    const redisUrl = getRedisUrl();
    const sanitizedUrl = getSanitizedRedisUrl();

    try {
        console.log(`[Redis] Connecting to ${sanitizedUrl}...`);
        redisStatus = "connecting";

        pubClient = createClient({
            url: redisUrl,
            socket: {
                reconnectStrategy(retries) {
                    if (retries > 5) {
                        console.warn("[Redis] Maximum reconnect attempts reached. Continuing in single-node mode.");
                        return false; // stop automatic reconnect to avoid infinite logs
                    }
                    return Math.min(retries * 200, 3000);
                }
            }
        });

        subClient = pubClient.duplicate();

        pubClient.on("error", (err) => {
            console.warn("[Redis Publisher Warning]:", err.message);
            redisStatus = "error";
        });

        subClient.on("error", (err) => {
            console.warn("[Redis Subscriber Warning]:", err.message);
            redisStatus = "error";
        });

        pubClient.on("connect", () => {
            console.log("[Redis] Publisher Client connected ✅");
        });

        subClient.on("connect", () => {
            console.log("[Redis] Subscriber Client connected ✅");
        });

        pubClient.on("ready", () => {
            redisStatus = "connected";
        });

        // Connect both clients concurrently
        await Promise.all([pubClient.connect(), subClient.connect()]);

        // Attach Redis adapter to Socket.IO
        io.adapter(createAdapter(pubClient, subClient));
        console.log("[Socket.IO] Redis Adapter initialized successfully! Horizontal scaling active 🚀");
        redisStatus = "connected";
    } catch (err) {
        console.warn(`[Redis Adapter Warning]: Failed to connect to Redis (${err.message}).`);
        console.warn("[Socket.IO] Operating in single-instance memory mode. Server will remain functional.");
        redisStatus = "error";
    }
};

/**
 * Returns current health status of Redis
 */
export const getRedisStatus = () => {
    return {
        status: redisStatus,
        url: getSanitizedRedisUrl()
    };
};

/**
 * Redis Key-Value helpers for token blacklist / session caching
 */
export const getRedisValue = async (key) => {
    if (pubClient && pubClient.isOpen) {
        try {
            return await pubClient.get(key);
        } catch {
            return null;
        }
    }
    return null;
};

export const setRedisValue = async (key, value, expirySeconds = 86400) => {
    if (pubClient && pubClient.isOpen) {
        try {
            await pubClient.set(key, value, { EX: expirySeconds });
            return true;
        } catch {
            return false;
        }
    }
    return false;
};

export default {
    initRedisAdapter,
    getRedisStatus,
    getRedisValue,
    setRedisValue,
    getRedisUrl
};