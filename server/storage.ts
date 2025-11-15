// Complete storage layer for SaaS puzzle game
import { 
  users, 
  puzzles,
  gameSessions,
  guestSessions,
  type User, 
  type UpsertUser,
  type Puzzle,
  type InsertPuzzle,
  type GameSession,
  type InsertGameSession,
  type GuestSession,
  type InsertGuestSession,
  type Discovery,
  type GameMessage,
  type DiscoveryKey,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, or, isNull } from "drizzle-orm";

export interface IStorage {
  // ============================================================================
  // USER OPERATIONS (Required for Replit Auth)
  // ============================================================================
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(userData: UpsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Stripe subscription management
  updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User>;
  updateUserProStatus(userId: string, isPro: boolean, expiresAt?: Date): Promise<User>;
  
  // Admin operations
  getAllUsers(): Promise<User[]>;
  getAllGameSessions(): Promise<GameSession[]>;
  
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
  // GUEST SESSION OPERATIONS
  // ============================================================================
  createGuestSession(guestId: string, puzzleId: string): Promise<GuestSession>;
  getGuestSession(id: string): Promise<GuestSession | undefined>;
  getGuestSessionByGuestAndPuzzle(guestId: string, puzzleId: string): Promise<GuestSession | undefined>;
  updateGuestSession(
    id: string,
    messages: GameMessage[],
    discoveries: Discovery[],
    discoveredKeys: DiscoveryKey[],
    questionCount: number
  ): Promise<GuestSession>;
  completeGuestSession(id: string, questionCount: number): Promise<GuestSession>;
  migrateGuestSessions(guestId: string, userId: string): Promise<void>;
  
  // ============================================================================
  // LEADERBOARD OPERATIONS
  // ============================================================================
  getPuzzleLeaderboard(puzzleId: string, limit?: number): Promise<Array<{
    displayName: string;
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
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

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getAllGameSessions(): Promise<GameSession[]> {
    return await db.select().from(gameSessions).orderBy(desc(gameSessions.createdAt));
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
  // GUEST SESSION OPERATIONS
  // ============================================================================

  async createGuestSession(guestId: string, puzzleId: string): Promise<GuestSession> {
    const [session] = await db
      .insert(guestSessions)
      .values({
        guestId,
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

  async getGuestSession(id: string): Promise<GuestSession | undefined> {
    const [session] = await db
      .select()
      .from(guestSessions)
      .where(eq(guestSessions.id, id));
    return session;
  }

  async getGuestSessionByGuestAndPuzzle(guestId: string, puzzleId: string): Promise<GuestSession | undefined> {
    const [session] = await db
      .select()
      .from(guestSessions)
      .where(
        and(
          eq(guestSessions.guestId, guestId),
          eq(guestSessions.puzzleId, puzzleId),
          eq(guestSessions.isComplete, false)
        )
      )
      .orderBy(desc(guestSessions.createdAt));
    return session;
  }

  async updateGuestSession(
    id: string,
    messages: GameMessage[],
    discoveries: Discovery[],
    discoveredKeys: DiscoveryKey[],
    questionCount: number
  ): Promise<GuestSession> {
    const [session] = await db
      .update(guestSessions)
      .set({
        messages,
        discoveries,
        discoveredKeys,
        questionCount,
        updatedAt: new Date(),
      })
      .where(eq(guestSessions.id, id))
      .returning();
    return session;
  }

  async completeGuestSession(id: string, questionCount: number): Promise<GuestSession> {
    const [session] = await db
      .update(guestSessions)
      .set({
        isComplete: true,
        questionCount,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(guestSessions.id, id))
      .returning();
    return session;
  }

  async migrateGuestSessions(guestId: string, userId: string): Promise<void> {
    // Get all unmigrated guest sessions for this guest
    const guestSessionsList = await db
      .select()
      .from(guestSessions)
      .where(
        and(
          eq(guestSessions.guestId, guestId),
          isNull(guestSessions.migratedToUserId)
        )
      );

    // For each guest session, create a corresponding game session
    for (const guestSession of guestSessionsList) {
      // Check if user already has a session for this puzzle
      const existingUserSession = await this.getUserGameSession(userId, guestSession.puzzleId);
      
      if (!existingUserSession) {
        // Create new game session from guest session
        await db.insert(gameSessions).values({
          userId,
          puzzleId: guestSession.puzzleId,
          messages: guestSession.messages,
          discoveries: guestSession.discoveries,
          discoveredKeys: guestSession.discoveredKeys,
          isComplete: guestSession.isComplete,
          questionCount: guestSession.questionCount,
          completedAt: guestSession.completedAt,
        });
      }

      // Mark guest session as migrated
      await db
        .update(guestSessions)
        .set({
          migratedToUserId: userId,
          migratedAt: new Date(),
        })
        .where(eq(guestSessions.id, guestSession.id));
    }
  }

  // ============================================================================
  // LEADERBOARD OPERATIONS
  // ============================================================================
  
  async getPuzzleLeaderboard(puzzleId: string, limit: number = 100): Promise<Array<{
    displayName: string;
    questionCount: number;
    completedAt: Date;
  }>> {
    const results = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        username: users.username,
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
      displayName: (r.firstName && r.lastName) 
        ? `${r.firstName} ${r.lastName}`
        : r.username || "Anonymous Player",
      questionCount: r.questionCount,
      completedAt: r.completedAt!,
    }));
  }
}

export const storage = new DatabaseStorage();
