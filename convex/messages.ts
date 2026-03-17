import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .order("asc")
      .take(200);
  },
});

export const send = mutation({
  args: { channelId: v.id("channels"), content: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const content = args.content.trim();
    if (!content) throw new Error("Message cannot be empty");
    const user = await ctx.db.get(userId);
    await ctx.db.insert("messages", {
      channelId: args.channelId,
      userId,
      authorEmail: user?.email ?? "unknown",
      content,
    });
  },
});
