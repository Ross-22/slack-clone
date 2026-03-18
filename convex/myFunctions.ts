import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Used by the frontend to get the current authenticated user's email.
export const listNumbers = query({
  args: {
    count: v.number(),
  },
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const user = userId === null ? null : await ctx.db.get(userId);
    return {
      viewer: user?.email ?? null,
      viewerId: userId,
      numbers: [] as number[],
    };
  },
});
