import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .order("asc")
      .take(200);

    return Promise.all(
      messages.map(async (msg) => {
        let imageUrl = null;
        if (msg.imageId) {
          imageUrl = await ctx.storage.getUrl(msg.imageId);
        }
        return { ...msg, imageUrl };
      })
    );
  },
});

export const send = mutation({
  args: {
    channelId: v.id("channels"),
    content: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
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
