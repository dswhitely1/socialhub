import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { cookies } from "next/headers";
import superjson from "superjson";
import type { AppRouter } from "@socialhub/api/trpc";

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${process.env.NEXT_PUBLIC_API_URL}/trpc`,
      transformer: superjson,
      async headers() {
        const cookieStore = await cookies();
        const token =
          cookieStore.get("__Secure-authjs.session-token")?.value ??
          cookieStore.get("authjs.session-token")?.value;
        return token ? { authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});
