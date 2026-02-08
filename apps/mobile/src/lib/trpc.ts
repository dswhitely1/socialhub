import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import superjson from "superjson";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import type { AppRouter } from "@socialhub/api/trpc";

export const trpc = createTRPCReact<AppRouter>();

const API_URL =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? "http://localhost:4000";

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${API_URL}/trpc`,
        transformer: superjson,
        async headers() {
          const token = await SecureStore.getItemAsync("auth_token");
          return token ? { authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
