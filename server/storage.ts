// Complete storage layer for SaaS puzzle game
import { 
  users, 
  puzzles,
  gameSessions,
  type User, 
  type UpsertUser,
  type Puzzle,
  type InsertPuzzle,
  type GameSession,
  type InsertGameSession,
  type Discovery,
  type GameMessage,
  type DiscoveryKey,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc } from "drizzle-orm";

export interface IStorage {
  // ============================================================================
  // USER OPERATIONS (Required for Replit Auth)
  // ============================================================================
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Stripe subscription management
  updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User>;
  updateUserProStatus(userId: string, isPro: boolean, expiresAt?: Date): Promise<User>;
  
  // ============================================================================
  // PUZZLE OPERATIONS
  // ============================================================================
  getAllPuzzles(): Promise<Puzzle[]>;
  getActivePuzzles(): Promise<Puzzle[]>;
  getFreePuzzles(): Promise<Puzzle[]>;
  getPuzzleById(id: string): Promise<Puzzle | undefined>;
  getPuzzleBySlug(slug: string): Promise<Puzzle | undefined>;
  createPuzzle(puzzle: InsertPuzzle): Promise<Puzzle>;
  updatePuzzleStats(puzzleId: string, avgQuestions: number): Promise<void>;
  
  // ============================================================================
  // GAME SESSION OPERATIONS
  // ============================================================================
  createGameSession(userId: string, puzzleId: string): Promise<GameSession>;
  getGameSession(id: string): Promise<GameSession | undefined>;
  getUserGameSession(userId: string, puzzleId: string): Promise<GameSession | undefined>;
  updateGameSession(
    id: string, 
    messages: GameMessage[], 
    discoveries: Discovery[], 
    discoveredKeys: DiscoveryKey[],
    questionCount: number
  ): Promise<GameSession>;
  completeGameSession(id: string, questionCount: number): Promise<GameSession>;
  getUserCompletedSessions(userId: string): Promise<GameSession[]>;
  
  // ============================================================================
  // LEADERBOARD OPERATIONS
  // ============================================================================
  getPuzzleLeaderboard(puzzleId: string, limit?: number): Promise<Array<{
    user: User;
    questionCount: number;
    completedAt: Date;
  }>>;
}

export class DatabaseStorage implements IStorage {
  // ============================================================================
  // USER OPERATIONS
  // ============================================================================
  
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserStripeInfo(
    userId: string, 
    stripeCustomerId: string, 
    stripeSubscriptionId: string
  ): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        stripeCustomerId,
        stripeSubscriptionId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserProStatus(userId: string, isPro: boolean, expiresAt?: Date): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        isPro,
        subscriptionExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // ============================================================================
  // PUZZLE OPERATIONS
  // ============================================================================
  
  async getAllPuzzles(): Promise<Puzzle[]> {
    return await db.select().from(puzzles).orderBy(asc(puzzles.createdAt));
  }

  async getActivePuzzles(): Promise<Puzzle[]> {
    return await db
      .select()
      .from(puzzles)
      .where(eq(puzzles.isActive, true))
      .orderBy(asc(puzzles.createdAt));
  }

  async getFreePuzzles(): Promise<Puzzle[]> {
    return await db
      .select()
      .from(puzzles)
      .where(and(eq(puzzles.isActive, true), eq(puzzles.isFree, true)))
      .orderBy(asc(puzzles.createdAt));
  }

  async getPuzzleById(id: string): Promise<Puzzle | undefined> {
    const [puzzle] = await db.select().from(puzzles).where(eq(puzzles.id, id));
    return puzzle;
  }

  async getPuzzleBySlug(slug: string): Promise<Puzzle | undefined> {
    const [puzzle] = await db.select().from(puzzles).where(eq(puzzles.slug, slug));
    return puzzle;
  }

  async createPuzzle(puzzleData: InsertPuzzle): Promise<Puzzle> {
    const [puzzle] = await db.insert(puzzles).values(puzzleData).returning();
    return puzzle;
  }

  async updatePuzzleStats(puzzleId: string, avgQuestions: number): Promise<void> {
    await db
      .update(puzzles)
      .set({
        averageQuestions: avgQuestions,
        completionCount: db.$count(gameSessions, eq(gameSessions.puzzleId, puzzleId)),
        updatedAt: new Date(),
      })
      .where(eq(puzzles.id, puzzleId));
  }

  // ============================================================================
  // GAME SESSION OPERATIONS
  // ============================================================================
  
  async createGameSession(userId: string, puzzleId: string): Promise<GameSession> {
    const [session] = await db
      .insert(gameSessions)
      .values({
        userId,
        puzzleId,
        messages: [],
        discoveries: [],
        discoveredKeys: [],
        isComplete: false,
        questionCount: 0,
      })
      .returning();
    return session;
  }

  async getGameSession(id: string): Promise<GameSession | undefined> {
    const [session] = await db
      .select()
      .from(gameSessions)
      .where(eq(gameSessions.id, id));
    return session;
  }

  async getUserGameSession(userId: string, puzzleId: string): Promise<GameSession | undefined> {
    const [session] = await db
      .select()
      .from(gameSessions)
      .where(
        and(
          eq(gameSessions.userId, userId),
          eq(gameSessions.puzzleId, puzzleId),
          eq(gameSessions.isComplete, false)
        )
      )
      .orderBy(desc(gameSessions.createdAt));
    return session;
  }

  async updateGameSession(
    id: string,
    messages: GameMessage[],
    discoveries: Discovery[],
    discoveredKeys: DiscoveryKey[],
    questionCount: number
  ): Promise<GameSession> {
    const [session] = await db
      .update(gameSessions)
      .set({
        messages,
        discoveries,
        discoveredKeys,
        questionCount,
        updatedAt: new Date(),
      })
      .where(eq(gameSessions.id, id))
      .returning();
    return session;
  }

  async completeGameSession(id: string, questionCount: number): Promise<GameSession> {
    const [session] = await db
      .update(gameSessions)
      .set({
        isComplete: true,
        questionCount,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(gameSessions.id, id))
      .returning();
    return session;
  }

  async getUserCompletedSessions(userId: string): Promise<GameSession[]> {
    return await db
      .select()
      .from(gameSessions)
      .where(
        and(
          eq(gameSessions.userId, userId),
          eq(gameSessions.isComplete, true)
        )
      )
      .orderBy(desc(gameSessions.completedAt));
  }

  // ============================================================================
  // LEADERBOARD OPERATIONS
  // ============================================================================
  
  async getPuzzleLeaderboard(puzzleId: string, limit: number = 100): Promise<Array<{
    user: User;
    questionCount: number;
    completedAt: Date;
  }>> {
    const results = await db
      .select({
        user: users,
        questionCount: gameSessions.questionCount,
        completedAt: gameSessions.completedAt,
      })
      .from(gameSessions)
      .innerJoin(users, eq(gameSessions.userId, users.id))
      .where(
        and(
          eq(gameSessions.puzzleId, puzzleId),
          eq(gameSessions.isComplete, true)
        )
      )
      .orderBy(asc(gameSessions.questionCount), desc(gameSessions.completedAt))
      .limit(limit);

    return results.map(r => ({
      user: r.user,
      questionCount: r.questionCount,
      completedAt: r.completedAt!,
    }));
  }
}

export const storage = new DatabaseStorage();
