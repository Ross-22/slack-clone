import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  channels: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
  }),
  messages: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    authorEmail: v.string(),
    content: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
  }).index("by_channel", ["channelId"]),
  readReceipts: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    lastReadTime: v.number(),
  })
    .index("by_user_and_channel", ["userId", "channelId"])
    .index("by_channel", ["channelId"]),
});
