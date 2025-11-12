import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Discovery key enum - canonical story elements required to solve the puzzle
export const DISCOVERY_KEYS = {
  SHIPWRECK: "SHIPWRECK",
  FAMILY_DIED: "FAMILY_DIED",
  STRANDED_ISLAND: "STRANDED_ISLAND",
  CANNIBALISM: "CANNIBALISM",
  DECEPTION: "DECEPTION",
  RESCUED: "RESCUED",
  ALBATROSS_REVEAL: "ALBATROSS_REVEAL",
  SUICIDE: "SUICIDE",
} as const;

export type DiscoveryKey = (typeof DISCOVERY_KEYS)[keyof typeof DISCOVERY_KEYS];

// All discovery keys required to complete the game
export const REQUIRED_DISCOVERY_KEYS: DiscoveryKey[] = [
  DISCOVERY_KEYS.SHIPWRECK,
  DISCOVERY_KEYS.FAMILY_DIED,
  DISCOVERY_KEYS.STRANDED_ISLAND,
  DISCOVERY_KEYS.CANNIBALISM,
  DISCOVERY_KEYS.DECEPTION,
  DISCOVERY_KEYS.RESCUED,
  DISCOVERY_KEYS.ALBATROSS_REVEAL,
  DISCOVERY_KEYS.SUICIDE,
];

// Minimum required discoveries to complete (allows missing 1-2 tertiary details)
export const MIN_REQUIRED_DISCOVERIES = 7;

// Critical discoveries that MUST be found to complete the game
export const CRITICAL_DISCOVERY_KEYS: DiscoveryKey[] = [
  DISCOVERY_KEYS.DECEPTION,         // Core to understanding the mystery
  DISCOVERY_KEYS.ALBATROSS_REVEAL,  // The moment of realization at the restaurant
  DISCOVERY_KEYS.CANNIBALISM,       // What he actually ate
];

export interface Discovery {
  key: DiscoveryKey;
  label: string;
  timestamp: number;
}

// Game session types
export interface GameMessage {
  id: number;
  type: "player" | "system" | "discovery";
  content: string;
  response?: "YES" | "NO" | "DOES NOT MATTER" | "HINT" | "ONE QUESTION AT A TIME, PLEASE";
  timestamp: number;
}

export interface GameSession {
  id: string;
  messages: GameMessage[];
  discoveries: Discovery[];
  discoveredKeys: Set<DiscoveryKey>;
  isComplete: boolean;
  createdAt: number;
}

// API request/response schemas
export const askQuestionSchema = z.object({
  sessionId: z.string().nullable().optional(),
  question: z.string().min(1).max(500),
});

export type AskQuestionRequest = z.infer<typeof askQuestionSchema>;

export interface AskQuestionResponse {
  sessionId: string;
  response: "YES" | "NO" | "DOES NOT MATTER" | "ONE QUESTION AT A TIME, PLEASE";
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
