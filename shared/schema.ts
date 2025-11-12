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

// Discovery keys - progressive system with base and evolved states
export const DISCOVERY_KEYS = {
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
} as const;

export type DiscoveryKey = (typeof DISCOVERY_KEYS)[keyof typeof DISCOVERY_KEYS];

// Topic mapping - each discovery key maps to a canonical topic
export const DISCOVERY_TOPICS: Record<DiscoveryKey, string> = {
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
  GUILT: "OUTCOME",
  SUICIDE: "OUTCOME",
};

// Stage determination - which keys are evolved states
export const EVOLVED_KEYS: Set<DiscoveryKey> = new Set<DiscoveryKey>([
  "VESSEL_SANK" as DiscoveryKey,
  "FAMILY_DIED" as DiscoveryKey,
  "STRANDED" as DiscoveryKey,
  "CANNIBALISM" as DiscoveryKey,
  "ALBATROSS_REVEAL" as DiscoveryKey,
  "SUICIDE" as DiscoveryKey,
]);

// Critical topics that MUST be discovered to complete the game
export const CRITICAL_TOPICS = ["DECEPTION", "RESTAURANT", "FOOD"];

// Minimum required unique topics to complete (allows missing a few non-critical topics)
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

// Game session types
export interface GameMessage {
  id: number;
  type: "player" | "system" | "discovery";
  content: string;
  response?: "YES" | "NO" | "DOES_NOT_MATTER" | "HINT" | "ONE_QUESTION_AT_A_TIME_PLEASE";
  timestamp: number;
}

export interface GameSession {
  id: string;
  messages: GameMessage[];
  discoveries: Discovery[];
  discoveredTopics: Set<string>;
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

// Helper function to get topic for a discovery key
export function getDiscoveryTopic(key: DiscoveryKey): string {
  return DISCOVERY_TOPICS[key];
}

// Helper function to determine stage
export function getDiscoveryStage(key: DiscoveryKey): DiscoveryStage {
  return EVOLVED_KEYS.has(key) ? "evolved" : "base";
}
