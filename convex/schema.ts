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
    content: v.string(),
  }).index("by_channel", ["channelId"]),
});
