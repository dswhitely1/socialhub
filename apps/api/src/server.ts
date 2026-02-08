import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { env } from "./env.js";
import { getRedis } from "./lib/redis.js";
import { trpcPlugin } from "./plugins/trpc.plugin.js";
import { socketPlugin } from "./plugins/socket.plugin.js";

async function main() {
  const fastify = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  await fastify.register(cors, {
    origin: env.CORS_ORIGINS,
    credentials: true,
  });

  await fastify.register(cookie);

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    redis: getRedis(),
  });

  await fastify.register(trpcPlugin);
  await fastify.register(socketPlugin);

  fastify.get("/health", async () => {
    return { status: "ok" };
  });

  await fastify.listen({ port: env.API_PORT, host: env.API_HOST });
  fastify.log.info(`API server running on ${env.API_HOST}:${env.API_PORT}`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
