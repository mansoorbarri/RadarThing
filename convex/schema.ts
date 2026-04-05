import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    role: v.union(v.literal("FREE"), v.literal("PRO"), v.literal("ADMIN")),
    isDeleted: v.boolean(),
    deletedAt: v.optional(v.number()), // timestamp
    googleId: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    discordUsername: v.optional(v.string()),
    discordUsernameLower: v.optional(v.string()),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_googleId", ["googleId"])
    .index("by_stripeCustomerId", ["stripeCustomerId"])
    .index("by_discordUsernameLower", ["discordUsernameLower"]),

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
    .index("by_userId_startTime", ["userId", "startTime"])
    .index("by_startTime", ["startTime"]),

  userStats: defineTable({
    userId: v.id("users"),
    totalFlights: v.number(),
    totalFlightTimeMs: v.number(),
    totalDistanceNm: v.number(),
    approvedAircraftImages: v.optional(v.number()),
    streakAtLastFlight: v.number(),
    longestStreak: v.number(),
    lastFlightDate: v.optional(v.string()), // YYYY-MM-DD UTC
    lastFlightStartTime: v.optional(v.number()),
    lastFlightCallsign: v.optional(v.string()),
  }).index("by_userId", ["userId"]),

  aircraftImages: defineTable({
    airlineIata: v.string(), // 2-letter IATA code (e.g., "EK") or "MIL" for military
    airlineIcao: v.string(), // 3-letter ICAO code (e.g., "UAE") or AF name (e.g., "USAF")
    aircraftType: v.string(),
    imageUrl: v.string(),
    imageKey: v.optional(v.string()), // UploadThing file key for deletion
    discordUsername: v.optional(v.string()),
    isMilitary: v.optional(v.boolean()), // true for military aircraft (AF name stored in airlineIcao)
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
    ])
    .index("by_iata_icao_aircraft_approved", [
      "airlineIata",
      "airlineIcao",
      "aircraftType",
      "isApproved",
    ]),

  virtualAirlines: defineTable({
    name: v.string(),
    callsignPrefix: v.string(),
    adminClerkId: v.string(),
    isActive: v.boolean(),
    createdBy: v.string(),
    updatedAt: v.number(),
  })
    .index("by_callsignPrefix", ["callsignPrefix"])
    .index("by_adminClerkId", ["adminClerkId"])
    .index("by_isActive", ["isActive"]),

  virtualAirlineAircraftImages: defineTable({
    virtualAirlineId: v.id("virtualAirlines"),
    aircraftType: v.string(),
    imageUrl: v.string(),
    imageKey: v.optional(v.string()),
    uploadedBy: v.string(),
    updatedAt: v.number(),
  })
    .index("by_virtualAirlineId", ["virtualAirlineId"])
    .index("by_virtualAirlineId_aircraftType", [
      "virtualAirlineId",
      "aircraftType",
    ]),

  virtualAirlineMembers: defineTable({
    virtualAirlineId: v.id("virtualAirlines"),
    userId: v.id("users"),
    clerkId: v.string(),
    googleId: v.string(),
    addedBy: v.string(),
  })
    .index("by_virtualAirlineId", ["virtualAirlineId"])
    .index("by_virtualAirlineId_userId", ["virtualAirlineId", "userId"])
    .index("by_userId", ["userId"])
    .index("by_googleId", ["googleId"]),

  // Airport charts (SIDs, STARs, approaches, taxi)
  airportCharts: defineTable({
    icao: v.string(),
    chartType: v.union(
      v.literal("TAXI"),
      v.literal("SID"),
      v.literal("STAR"),
      v.literal("APPROACH"),
    ),
    chartName: v.string(),
    chartUrl: v.string(),
    imageKey: v.optional(v.string()), // UploadThing key for deletion
    source: v.literal("COMMUNITY"),
    isApproved: v.boolean(),
    uploadedBy: v.optional(v.string()), // Clerk user ID
    discordUsername: v.optional(v.string()),
    approvedBy: v.optional(v.string()), // Clerk user ID
    approvedAt: v.optional(v.number()), // timestamp
  })
    .index("by_icao", ["icao"])
    .index("by_icao_type", ["icao", "chartType"])
    .index("by_icao_type_approved", ["icao", "chartType", "isApproved"])
    .index("by_isApproved", ["isApproved"])
    .index("by_uploadedBy", ["uploadedBy"]),

  // Track contributor reward winners (first to 100 uploads)
  // Track which flights users are currently watching
  activeTrackers: defineTable({
    clerkId: v.string(),
    callsign: v.string(),
    lastSeen: v.number(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_callsign", ["callsign"])
    .index("by_lastSeen", ["lastSeen"]),

  waypointReminders: defineTable({
    userId: v.id("users"),
    googleId: v.string(),
    discordUsername: v.string(),
    discordUserId: v.string(),
    callsign: v.string(),
    waypointIdent: v.string(),
    intervalSeconds: v.number(),
    durationSeconds: v.number(),
    status: v.union(
      v.literal("armed"),
      v.literal("active"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("failed"),
    ),
    createdAt: v.number(),
    triggeredAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    lastSentAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    failureReason: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_userId", ["userId"])
    .index("by_googleId_status", ["googleId", "status"])
    .index("by_createdAt", ["createdAt"]),
});
