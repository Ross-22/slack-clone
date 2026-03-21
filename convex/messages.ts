import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .take(200);

    const chronologicalMessages = [...messages].reverse();

    return Promise.all(
      chronologicalMessages.map(async (msg) => {
        let imageUrl = null;
        if (msg.imageId) {
          imageUrl = await ctx.storage.getUrl(msg.imageId);
        }

        const author = await ctx.db.get(msg.userId);
        let authorImageUrl = null;
        if (author?.image) {
          authorImageUrl = await ctx.storage.getUrl(author.image);
        }
        
        let replyTo = null;
        if (msg.replyToId) {
          const original = await ctx.db.get(msg.replyToId);
          if (original) {
            replyTo = {
              _id: original._id,
              content: original.content,
              authorEmail: original.authorEmail,
            };
          }
        }
        
        const reactions = await ctx.db
          .query("reactions")
          .withIndex("by_message", (q) => q.eq("messageId", msg._id))
          .collect();
        
        return { ...msg, imageUrl, authorImageUrl, authorName: author?.name, replyTo, reactions };
      })
    );
  },
});

export const send = mutation({
  args: {
    channelId: v.id("channels"),
    content: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
    replyToId: v.optional(v.id("messages")),
    mentions: v.optional(v.array(v.id("users"))),
    isGlobalMention: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const content = args.content?.trim() || "";
    if (!content && !args.imageId) {
      throw new Error("Message cannot be empty");
    }

    const user = await ctx.db.get(userId);
    await ctx.db.insert("messages", {
      channelId: args.channelId,
      userId,
      authorEmail: user?.email ?? "unknown",
      content,
      replyToId: args.replyToId,
      mentions: args.mentions,
      isGlobalMention: args.isGlobalMention,
      ...(args.imageId ? { imageId: args.imageId } : {}),
    });
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const update = mutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.userId !== userId) throw new Error("Unauthorized");

    const content = args.content.trim();
    if (!content && !message.imageId) {
      throw new Error("Message cannot be empty");
    }

    await ctx.db.patch(args.messageId, { content });
  },
});

export const remove = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.userId !== userId) throw new Error("Unauthorized");

    await ctx.db.delete(args.messageId);
  },
});

export const getRecentGlobal = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const recent = await ctx.db
      .query("messages")
      .order("desc")
      .take(10);

    return Promise.all(
      recent.map(async (msg) => {
        const channel = await ctx.db.get(msg.channelId);
        const author = await ctx.db.get(msg.userId);
        return {
          ...msg,
          channelName: channel?.name ?? "unknown",
          authorName: author?.name ?? author?.email ?? "unknown",
        };
      })
    );
  },
});
