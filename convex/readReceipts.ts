import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const markRead = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    // Get the absolute latest message to guarantee we don't fall behind it due to clock skew
    const latestMessage = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .first();

    const readTime = latestMessage ? Math.max(Date.now(), latestMessage._creationTime + 1) : Date.now();

    const existing = await ctx.db
      .query("readReceipts")
      .withIndex("by_user_and_channel", (q) =>
        q.eq("userId", userId).eq("channelId", args.channelId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { lastReadTime: readTime });
    } else {
      await ctx.db.insert("readReceipts", {
        userId,
        channelId: args.channelId,
        lastReadTime: readTime,
      });
    }
  },
});

export const unreadChannels = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const channels = await ctx.db.query("channels").collect();
    const unreadIds = [];

    for (const channel of channels) {
      const latestMessage = await ctx.db
        .query("messages")
        .withIndex("by_channel", (q) => q.eq("channelId", channel._id))
        .order("desc")
        .first();

      if (!latestMessage) continue;

      const receipt = await ctx.db
        .query("readReceipts")
        .withIndex("by_user_and_channel", (q) =>
          q.eq("userId", userId).eq("channelId", channel._id)
        )
        .unique();

      const lastReadTime = receipt?.lastReadTime ?? 0;
      
      if (latestMessage._creationTime > lastReadTime && latestMessage.userId !== userId) {
        unreadIds.push(channel._id);
      }
    }

    return unreadIds;
  },
});

export const channelReaders = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const receipts = await ctx.db
      .query("readReceipts")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect();

    // Get user details for these receipts
    const readers = [];
    for (const r of receipts) {
      if (r.userId === userId) continue; // Don't show the current user's own read receipts
      const user = await ctx.db.get(r.userId);
      if (user) {
        readers.push({
          userId: r.userId,
          email: user.email as string,
          lastReadTime: r.lastReadTime,
        });
      }
    }
    return readers;
  },
});
