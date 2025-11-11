import { type User, type InsertUser, type GameSession } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Game session methods
  createGameSession(): Promise<GameSession>;
  getGameSession(id: string): Promise<GameSession | undefined>;
  updateGameSession(id: string, session: GameSession): Promise<GameSession>;
  deleteGameSession(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private gameSessions: Map<string, GameSession>;

  constructor() {
    this.users = new Map();
    this.gameSessions = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createGameSession(): Promise<GameSession> {
    const id = randomUUID();
    const session: GameSession = {
      id,
      messages: [],
      discoveries: [],
      discoveredKeys: new Set(),
      isComplete: false,
      createdAt: Date.now(),
    };
    this.gameSessions.set(id, session);
    return session;
  }

  async getGameSession(id: string): Promise<GameSession | undefined> {
    return this.gameSessions.get(id);
  }

  async updateGameSession(id: string, session: GameSession): Promise<GameSession> {
    this.gameSessions.set(id, session);
    return session;
  }

  async deleteGameSession(id: string): Promise<void> {
    this.gameSessions.delete(id);
  }
}

export const storage = new MemStorage();
