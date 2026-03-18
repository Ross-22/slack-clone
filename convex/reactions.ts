import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const toggle = mutation({
  args: {
    messageId: v.id("messages"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("reactions")
      .withIndex("by_user_and_message", (q) =>
        q.eq("userId", userId).eq("messageId", args.messageId)
      )
      .filter((q) => q.eq(q.field("emoji"), args.emoji))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    } else {
      await ctx.db.insert("reactions", {
        messageId: args.messageId,
        userId,
        emoji: args.emoji,
      });
    }
  },
});

export const listForMessage = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reactions")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();
  },
});

export const updateHotbar = mutation({
  args: { hotbar: v.array(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { hotbar: args.hotbar });
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        hotbar: args.hotbar,
      });
    }
  },
});

export const getHotbar = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return ["👍", "❤️", "😂", "😮", "😢", "🔥"];

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return settings?.hotbar ?? ["👍", "❤️", "😂", "😮", "😢", "🔥"];
  },
});
