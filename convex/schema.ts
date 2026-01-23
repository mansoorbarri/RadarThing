import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    role: v.union(v.literal("FREE"), v.literal("PRO")),
    isDeleted: v.boolean(),
    deletedAt: v.optional(v.number()), // timestamp
    googleId: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_googleId", ["googleId"])
    .index("by_stripeCustomerId", ["stripeCustomerId"]),

  flights: defineTable({
    userId: v.id("users"),
    callsign: v.string(),
    aircraftType: v.string(),
    depICAO: v.optional(v.string()),
    arrICAO: v.optional(v.string()),
    squawk: v.optional(v.string()),
    duration: v.optional(v.number()), // milliseconds
    maxAltitude: v.optional(v.number()), // feet
    maxSpeed: v.optional(v.number()), // knots
    routeData: v.optional(v.any()), // JSON data - array of coordinates
    startTime: v.number(), // timestamp
    endTime: v.optional(v.number()), // timestamp
  })
    .index("by_userId", ["userId"])
    .index("by_startTime", ["startTime"]),

  aircraftImages: defineTable({
    airlineIata: v.string(), // 2-letter IATA code (e.g., "EK")
    airlineIcao: v.string(), // 3-letter ICAO code (e.g., "UAE")
    aircraftType: v.string(),
    imageUrl: v.string(),
    imageKey: v.optional(v.string()), // UploadThing file key for deletion
    discordUsername: v.optional(v.string()),
    isApproved: v.boolean(),
    uploadedBy: v.string(), // Clerk user ID
    approvedBy: v.optional(v.string()), // Clerk user ID
    approvedAt: v.optional(v.number()), // timestamp
  })
    .index("by_airlineIata", ["airlineIata"])
    .index("by_airlineIcao", ["airlineIcao"])
    .index("by_aircraftType", ["aircraftType"])
    .index("by_isApproved", ["isApproved"])
    .index("by_uploadedBy", ["uploadedBy"])
    .index("by_iata_aircraft_approved", [
      "airlineIata",
      "aircraftType",
      "isApproved",
    ])
    .index("by_icao_aircraft_approved", [
      "airlineIcao",
      "aircraftType",
      "isApproved",
    ]),
});
