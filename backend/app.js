import express from "express";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import cors from "cors";
import mongoose from "mongoose";
import userRoutes from "./routes/user.routes.js";
import projectRoutes from "./routes/project.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import { getRedisStatus } from "./services/redis.service.js";

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/users", userRoutes);
app.use("/projects", projectRoutes);
app.use("/ai", aiRoutes);

// Health check endpoint with MongoDB & Redis connection telemetry
app.get("/health", (req, res) => {
    const mongoStateMap = {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting"
    };

    const mongoStatus = mongoStateMap[mongoose.connection.readyState] || "unknown";
    const redisInfo = getRedisStatus();

    const isHealthy = mongoStatus === "connected";

    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        services: {
            mongodb: mongoStatus,
            redis: redisInfo.status
        },
        redisEndpoint: redisInfo.url
    });
});

app.get("/", (req, res) => {
    res.send("NexChat Collaborative IDE API Server");
});

export default app;