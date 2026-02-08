import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter } from "../trpc/router.js";
import { createContext } from "../trpc/context.js";

async function trpcPluginImpl(fastify: FastifyInstance) {
  await fastify.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: appRouter,
      createContext,
    },
  });
}

export const trpcPlugin = fp(trpcPluginImpl);
