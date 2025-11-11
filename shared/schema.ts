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

// Game session types
export interface GameMessage {
  id: number;
  type: "player" | "system" | "discovery";
  content: string;
  response?: "YES" | "NO" | "DOES NOT MATTER" | "HINT";
  timestamp: number;
}

export interface GameSession {
  id: string;
  messages: GameMessage[];
  discoveries: string[];
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
  response: "YES" | "NO" | "DOES NOT MATTER";
  content: string;
  discovery?: string;
  isComplete: boolean;
  discoveries: string[];
}
