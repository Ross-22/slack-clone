import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("channels").collect();
  },
});

export const create = mutation({
  args: { name: v.string(), description: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const name = args.name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    if (!name) throw new Error("Invalid channel name");
    return await ctx.db.insert("channels", {
      name,
      description: args.description,
    });
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("channels").collect();
    if (existing.length === 0) {
      await ctx.db.insert("channels", {
        name: "general",
        description: "General discussion",
      });
      await ctx.db.insert("channels", {
        name: "random",
        description: "Off-topic conversations",
      });
      await ctx.db.insert("channels", {
        name: "announcements",
        description: "Important updates",
      });
    }
  },
});
