import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      image: user.image,
      imageUrl: user.image ? await ctx.storage.getUrl(user.image) : null,
    };
  },
});

export const update = mutation({
  args: {
    name: v.optional(v.string()),
    image: v.optional(v.id("_storage")),
  },
  handler: async (ctx, { name, image }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    
    const updates: { name?: string; image?: Id<"_storage"> } = {};
    if (name !== undefined) updates.name = name;
    if (image !== undefined) updates.image = image;
    
    await ctx.db.patch(userId, updates);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    return await ctx.storage.generateUploadUrl();
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return Promise.all(
      users.map(async (user) => ({
        _id: user._id,
        name: user.name,
        email: user.email,
        image: user.image,
        imageUrl: user.image ? await ctx.storage.getUrl(user.image) : null,
      }))
    );
  },
});
