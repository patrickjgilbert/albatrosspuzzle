import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, integer, boolean, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// AUTH TABLES (Required for Replit Auth)
// ============================================================================

// Session storage table - required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - extended for our SaaS features
export const users = pgTable("users", {
  // Replit Auth required fields
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  
  // Local username/password authentication
  username: varchar("username").unique(),
  passwordHash: varchar("password_hash"),
  
  // Authorization
  role: varchar("role").default("USER").notNull(), // USER or ADMIN
  
  // Stripe subscription fields
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  isPro: boolean("is_pro").default(false).notNull(),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// ============================================================================
// PUZZLE SYSTEM
// ============================================================================

export const puzzles = pgTable("puzzles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar("slug").notNull().unique(), // URL-friendly identifier
  title: text("title").notNull(),
  description: text("description").notNull(),
  prompt: text("prompt").notNull(), // The initial puzzle statement
  isFree: boolean("is_free").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  difficulty: varchar("difficulty").default("medium").notNull(), // easy, medium, hard
  averageQuestions: integer("average_questions"), // Track average completion
  completionCount: integer("completion_count").default(0).notNull(),
  
  // AI configuration for this puzzle
  aiPrompt: text("ai_prompt").notNull(), // The system prompt for OpenAI
  
  // Detailed puzzle configuration (discovery mappings, post-it images, etc.)
  config: jsonb("config"), // Stores discovery system, image paths, etc.
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPuzzleSchema = createInsertSchema(puzzles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  averageQuestions: true,
  completionCount: true,
});

export type InsertPuzzle = z.infer<typeof insertPuzzleSchema>;
export type Puzzle = typeof puzzles.$inferSelect;

// ============================================================================
// GAME SESSIONS - Track user progress on puzzles
// ============================================================================

export const gameSessions = pgTable(
  "game_sessions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    puzzleId: varchar("puzzle_id").references(() => puzzles.id, { onDelete: "cascade" }).notNull(),
    
    // Progress tracking
    messages: jsonb("messages").default([]).notNull(), // Array of GameMessage
    discoveries: jsonb("discoveries").default([]).notNull(), // Array of Discovery
    discoveredKeys: jsonb("discovered_keys").default([]).notNull(), // Array of DiscoveryKey
    
    // Completion metrics
    isComplete: boolean("is_complete").default(false).notNull(),
    questionCount: integer("question_count").default(0).notNull(),
    completedAt: timestamp("completed_at"),
    
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_game_sessions_user_puzzle").on(table.userId, table.puzzleId),
    index("idx_game_sessions_leaderboard").on(table.puzzleId, table.isComplete, table.questionCount),
  ]
);

// Guest sessions for anonymous users (before account creation)
export const guestSessions = pgTable(
  "guest_sessions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    guestId: varchar("guest_id").notNull(), // Cookie-based identifier
    puzzleId: varchar("puzzle_id").references(() => puzzles.id, { onDelete: "cascade" }).notNull(),
    
    // Progress tracking (same as game_sessions)
    messages: jsonb("messages").default([]).notNull(),
    discoveries: jsonb("discoveries").default([]).notNull(),
    discoveredKeys: jsonb("discovered_keys").default([]).notNull(),
    
    // Completion metrics
    isComplete: boolean("is_complete").default(false).notNull(),
    questionCount: integer("question_count").default(0).notNull(),
    completedAt: timestamp("completed_at"),
    
    // Migration tracking - set when guest creates account
    migratedToUserId: varchar("migrated_to_user_id").references(() => users.id, { onDelete: "set null" }),
    migratedAt: timestamp("migrated_at"),
    
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_guest_sessions_guest_puzzle").on(table.guestId, table.puzzleId),
  ]
);

export const insertGameSessionSchema = createInsertSchema(gameSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGameSession = z.infer<typeof insertGameSessionSchema>;
export type GameSession = typeof gameSessions.$inferSelect;

export const insertGuestSessionSchema = createInsertSchema(guestSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  migratedToUserId: true,
  migratedAt: true,
});

export type InsertGuestSession = z.infer<typeof insertGuestSessionSchema>;
export type GuestSession = typeof guestSessions.$inferSelect;

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  gameSessions: many(gameSessions),
}));

export const puzzlesRelations = relations(puzzles, ({ many }) => ({
  gameSessions: many(puzzles),
}));

export const gameSessionsRelations = relations(gameSessions, ({ one }) => ({
  user: one(users, {
    fields: [gameSessions.userId],
    references: [users.id],
  }),
  puzzle: one(puzzles, {
    fields: [gameSessions.puzzleId],
    references: [puzzles.id],
  }),
}));

export const guestSessionsRelations = relations(guestSessions, ({ one }) => ({
  puzzle: one(puzzles, {
    fields: [guestSessions.puzzleId],
    references: [puzzles.id],
  }),
  migratedUser: one(users, {
    fields: [guestSessions.migratedToUserId],
    references: [users.id],
  }),
}));

// ============================================================================
// DISCOVERY TYPES (from original game logic)
// ============================================================================

export const DISCOVERY_KEYS = {
  // Albatross Puzzle
  VESSEL: "VESSEL",
  VESSEL_SANK: "VESSEL_SANK",
  FAMILY: "FAMILY",
  FAMILY_DIED: "FAMILY_DIED",
  ISLAND: "ISLAND",
  STRANDED: "STRANDED",
  NO_FOOD: "NO_FOOD",
  CANNIBALISM: "CANNIBALISM",
  DECEPTION: "DECEPTION",
  RESCUED: "RESCUED",
  RESTAURANT: "RESTAURANT",
  ALBATROSS_REVEAL: "ALBATROSS_REVEAL",
  GUILT: "GUILT",
  SUICIDE: "SUICIDE",
  
  // Lighthouse Keeper Puzzle
  LIGHTHOUSE_JOB: "LIGHTHOUSE_JOB",
  LAMP_BROKE: "LAMP_BROKE",
  SHIP_CRASH: "SHIP_CRASH",
  SON_DIED: "SON_DIED",
  NEGLIGENCE: "NEGLIGENCE",
  RESPONSIBILITY: "RESPONSIBILITY",
  
  // Last Phone Call Puzzle
  DAUGHTER: "DAUGHTER",
  KIDNAPPED: "KIDNAPPED",
  YEARS_AGO: "YEARS_AGO",
  NEVER_FOUND: "NEVER_FOUND",
  SEARCHING: "SEARCHING",
  DETECTIVE_CALL: "DETECTIVE_CALL",
  FOUND_ALIVE: "FOUND_ALIVE",
  REUNION: "REUNION",
  
  // Mirror Room Puzzle
  CON_ARTIST: "CON_ARTIST",
  FAKE_IDENTITIES: "FAKE_IDENTITIES",
  PRETENDING: "PRETENDING",
  THERAPY_ROOM: "THERAPY_ROOM",
  TRUE_SELF: "TRUE_SELF",
  REAL_FACE: "REAL_FACE",
  CONFRONTATION: "CONFRONTATION",
  REDEMPTION: "REDEMPTION",
  
  // Empty Restaurant Puzzle
  NUCLEAR_PLANT: "NUCLEAR_PLANT",
  EMERGENCY_SIRENS: "EMERGENCY_SIRENS",
  REACTOR_MELTDOWN: "REACTOR_MELTDOWN",
  EVACUATION: "EVACUATION",
  LEFT_IMMEDIATELY: "LEFT_IMMEDIATELY",
  TOWN_ABANDONED: "TOWN_ABANDONED",
  EXCLUSION_ZONE: "EXCLUSION_ZONE",
  FROZEN_TIME: "FROZEN_TIME",
  
  // Silent Concert Puzzle
  MEMORIAL: "MEMORIAL",
  MUSICIAN_DIED: "MUSICIAN_DIED",
  TRIBUTE: "TRIBUTE",
  SILENCE_PERFORMANCE: "SILENCE_PERFORMANCE",
  ABSENCE: "ABSENCE",
  BELOVED_ARTIST: "BELOVED_ARTIST",
  TRAGIC_DEATH: "TRAGIC_DEATH",
  POWERFUL_TRIBUTE: "POWERFUL_TRIBUTE",
} as const;

export type DiscoveryKey = (typeof DISCOVERY_KEYS)[keyof typeof DISCOVERY_KEYS];

export const DISCOVERY_TOPICS: Record<DiscoveryKey, string> = {
  // Albatross Puzzle
  VESSEL: "VESSEL",
  VESSEL_SANK: "VESSEL",
  FAMILY: "FAMILY",
  FAMILY_DIED: "FAMILY",
  ISLAND: "ISLAND",
  STRANDED: "ISLAND",
  NO_FOOD: "FOOD",
  CANNIBALISM: "FOOD",
  DECEPTION: "DECEPTION",
  RESCUED: "RESCUED",
  RESTAURANT: "RESTAURANT",
  ALBATROSS_REVEAL: "RESTAURANT",
  GUILT: "GUILT",
  SUICIDE: "SUICIDE",
  
  // Lighthouse Keeper Puzzle
  LIGHTHOUSE_JOB: "LIGHTHOUSE_JOB",
  LAMP_BROKE: "LAMP_BROKE",
  SHIP_CRASH: "SHIP_CRASH",
  SON_DIED: "SON_DIED",
  NEGLIGENCE: "NEGLIGENCE",
  RESPONSIBILITY: "RESPONSIBILITY",
  
  // Last Phone Call Puzzle
  DAUGHTER: "DAUGHTER",
  KIDNAPPED: "KIDNAPPED",
  YEARS_AGO: "YEARS_AGO",
  NEVER_FOUND: "NEVER_FOUND",
  SEARCHING: "SEARCHING",
  DETECTIVE_CALL: "DETECTIVE_CALL",
  FOUND_ALIVE: "FOUND_ALIVE",
  REUNION: "REUNION",
  
  // Mirror Room Puzzle
  CON_ARTIST: "CON_ARTIST",
  FAKE_IDENTITIES: "FAKE_IDENTITIES",
  PRETENDING: "PRETENDING",
  THERAPY_ROOM: "THERAPY_ROOM",
  TRUE_SELF: "TRUE_SELF",
  REAL_FACE: "REAL_FACE",
  CONFRONTATION: "CONFRONTATION",
  REDEMPTION: "REDEMPTION",
  
  // Empty Restaurant Puzzle
  NUCLEAR_PLANT: "NUCLEAR_PLANT",
  EMERGENCY_SIRENS: "EMERGENCY_SIRENS",
  REACTOR_MELTDOWN: "REACTOR_MELTDOWN",
  EVACUATION: "EVACUATION",
  LEFT_IMMEDIATELY: "LEFT_IMMEDIATELY",
  TOWN_ABANDONED: "TOWN_ABANDONED",
  EXCLUSION_ZONE: "EXCLUSION_ZONE",
  FROZEN_TIME: "FROZEN_TIME",
  
  // Silent Concert Puzzle
  MEMORIAL: "MEMORIAL",
  MUSICIAN_DIED: "MUSICIAN_DIED",
  TRIBUTE: "TRIBUTE",
  SILENCE_PERFORMANCE: "SILENCE_PERFORMANCE",
  ABSENCE: "ABSENCE",
  BELOVED_ARTIST: "BELOVED_ARTIST",
  TRAGIC_DEATH: "TRAGIC_DEATH",
  POWERFUL_TRIBUTE: "POWERFUL_TRIBUTE",
};

export const EVOLVED_KEYS: Set<DiscoveryKey> = new Set<DiscoveryKey>([
  "VESSEL_SANK" as DiscoveryKey,
  "FAMILY_DIED" as DiscoveryKey,
  "STRANDED" as DiscoveryKey,
  "CANNIBALISM" as DiscoveryKey,
  "ALBATROSS_REVEAL" as DiscoveryKey,
  "SUICIDE" as DiscoveryKey,
]);

export const CRITICAL_TOPICS = ["DECEPTION", "RESTAURANT", "FOOD"];
export const MIN_REQUIRED_TOPICS = 6;

export type DiscoveryStage = "base" | "evolved";

export interface Discovery {
  key: DiscoveryKey;
  topic: string;
  label: string;
  timestamp: number;
  stage: DiscoveryStage;
  evolutionTimestamp?: number;
}

export interface GameMessage {
  id: number;
  type: "player" | "system" | "discovery";
  content: string;
  response?: "YES" | "NO" | "DOES_NOT_MATTER" | "HINT" | "ONE_QUESTION_AT_A_TIME_PLEASE";
  timestamp: number;
}

// ============================================================================
// API SCHEMAS
// ============================================================================

export const askQuestionSchema = z.object({
  sessionId: z.string().nullable().optional(),
  puzzleId: z.string().optional(), // Now required to know which puzzle
  question: z.string().min(1).max(500),
});

export type AskQuestionRequest = z.infer<typeof askQuestionSchema>;

export interface AskQuestionResponse {
  sessionId: string;
  response: "YES" | "NO" | "DOES_NOT_MATTER" | "ONE_QUESTION_AT_A_TIME_PLEASE";
  content: string;
  discovery?: Discovery;
  isComplete: boolean;
  discoveries: Discovery[];
  discoveredKeys: DiscoveryKey[];
  progress: {
    total: number;
    discovered: number;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getDiscoveryTopic(key: DiscoveryKey): string {
  return DISCOVERY_TOPICS[key];
}

export function getDiscoveryStage(key: DiscoveryKey): DiscoveryStage {
  return EVOLVED_KEYS.has(key) ? "evolved" : "base";
}
