import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { env } from "./env.js";
import { trpcPlugin } from "./plugins/trpc.plugin.js";
import { socketPlugin } from "./plugins/socket.plugin.js";

async function main() {
  const fastify = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  await fastify.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  await fastify.register(cookie);

  await fastify.register(trpcPlugin);
  await fastify.register(socketPlugin);

  fastify.get("/health", async () => {
    return { status: "ok" };
  });

  await fastify.listen({ port: env.API_PORT, host: "0.0.0.0" });
  fastify.log.info(`API server running on port ${env.API_PORT}`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
