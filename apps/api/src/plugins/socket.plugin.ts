import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { Server } from "socket.io";
import { env } from "../env.js";
import { verifyToken } from "../services/auth.service.js";

async function socketPluginImpl(fastify: FastifyInstance) {
  const io = new Server(fastify.server, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
    },
  });

  // Authenticate socket connections via JWT
  io.use(async (socket, next) => {
    const token =
      (socket.handshake.auth as Record<string, unknown>)?.token as string | undefined;
    if (!token) {
      return next(new Error("Authentication required"));
    }
    const payload = await verifyToken(token);
    if (!payload) {
      return next(new Error("Invalid or expired token"));
    }
    socket.data.userId = payload.userId;
    next();
  });

  io.on("connection", (socket) => {
    fastify.log.info(`Socket connected: ${socket.id} (user: ${socket.data.userId})`);

    // Auto-join the authenticated user's notification room
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);

    socket.on("disconnect", () => {
      fastify.log.info(`Socket disconnected: ${socket.id}`);
    });
  });

  fastify.decorate("io", io);

  fastify.addHook("onClose", () => {
    io.close();
  });
}

export const socketPlugin = fp(socketPluginImpl);
