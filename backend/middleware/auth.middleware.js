import jwt from "jsonwebtoken";
import { getRedisValue } from "../services/redis.service.js";

export const authUser = async (req, res, next) => {
    try {
        const token =
            req.cookies?.token ||
            req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // Check if token is blacklisted in Redis (if Redis is active)
        let isBlacklisted = null;
        try {
            isBlacklisted = await getRedisValue(token);
        } catch (redisErr) {
            console.warn("Redis check skipped:", redisErr.message);
        }

        if (isBlacklisted) {
            res.clearCookie('token');
            return res.status(401).json({ message: "Token is blacklisted" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Unauthorized User" });
    }
};