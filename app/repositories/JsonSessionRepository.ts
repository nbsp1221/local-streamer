import { v4 as uuidv4 } from 'uuid';
import type { Session, CookieOptions } from "~/types/auth";
import type { SessionRepository, CreateSessionInput, UpdateSessionInput } from "~/repositories/interfaces/SessionRepository";
import { BaseJsonRepository } from "~/repositories/base/BaseJsonRepository";
import { config } from "~/configs";

/**
 * JSON-based implementation of SessionRepository
 */
export class JsonSessionRepository extends BaseJsonRepository<Session, CreateSessionInput, UpdateSessionInput> implements SessionRepository {
  protected readonly filePath = config.paths.sessionsJson;

  /**
   * Transform raw JSON data to Session entity
   */
  protected transformFromJson(data: any): Session {
    return {
      ...data,
      expiresAt: new Date(data.expiresAt),
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      lastAccessedAt: data.lastAccessedAt ? new Date(data.lastAccessedAt) : undefined
    };
  }

  /**
   * Transform Session entity to JSON data
   */
  protected transformToJson(entity: Session): any {
    return {
      ...entity,
      expiresAt: entity.expiresAt.toISOString(),
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      lastAccessedAt: entity.lastAccessedAt?.toISOString()
    };
  }

  /**
   * Create a new Session entity from input data
   */
  protected createEntity(input: CreateSessionInput): Session {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.security.session.duration);
    
    return {
      id: uuidv4(),
      userId: input.userId,
      expiresAt,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now
    };
  }

  /**
   * Find sessions by user ID
   */
  async findByUserId(userId: string): Promise<Session[]> {
    return this.findWhere(session => session.userId === userId);
  }

  /**
   * Find active sessions for a user
   */
  async findActiveByUserId(userId: string): Promise<Session[]> {
    const now = new Date();
    
    return this.findWhere(session => 
      session.userId === userId && 
      session.isActive && 
      session.expiresAt > now
    );
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpired(): Promise<number> {
    const sessions = await this.readAllFromFile();
    const now = new Date();
    
    const activeSessions = sessions.filter(session => 
      session.expiresAt > now && session.isActive
    );
    
    const expiredCount = sessions.length - activeSessions.length;
    
    if (expiredCount > 0) {
      await this.writeAllToFile(activeSessions);
    }
    
    return expiredCount;
  }

  /**
   * Refresh session expiry
   */
  async refreshSession(sessionId: string): Promise<Session | null> {
    const sessions = await this.readAllFromFile();
    const sessionIndex = sessions.findIndex(session => session.id === sessionId);
    
    if (sessionIndex === -1) {
      return null;
    }
    
    const session = sessions[sessionIndex];
    
    // Check if session is still valid
    if (!session.isActive || session.expiresAt <= new Date()) {
      return null;
    }
    
    // Check if session needs refresh (within refresh threshold)
    const now = new Date();
    const timeUntilExpiry = session.expiresAt.getTime() - now.getTime();
    const refreshThreshold = config.security.session.refreshThreshold;
    
    if (timeUntilExpiry > refreshThreshold) {
      // Session doesn't need refresh yet, just update last accessed
      sessions[sessionIndex] = {
        ...session,
        lastAccessedAt: now,
        updatedAt: now
      };
      
      await this.writeAllToFile(sessions);
      return sessions[sessionIndex];
    }
    
    // Refresh the session
    const newExpiresAt = new Date(now.getTime() + config.security.session.duration);
    
    sessions[sessionIndex] = {
      ...session,
      expiresAt: newExpiresAt,
      lastAccessedAt: now,
      updatedAt: now
    };
    
    await this.writeAllToFile(sessions);
    return sessions[sessionIndex];
  }

  /**
   * Deactivate session
   */
  async deactivateSession(sessionId: string): Promise<boolean> {
    const sessions = await this.readAllFromFile();
    const sessionIndex = sessions.findIndex(session => session.id === sessionId);
    
    if (sessionIndex === -1) {
      return false;
    }
    
    sessions[sessionIndex] = {
      ...sessions[sessionIndex],
      isActive: false,
      updatedAt: new Date()
    };
    
    await this.writeAllToFile(sessions);
    return true;
  }

  /**
   * Deactivate all sessions for a user
   */
  async deactivateAllUserSessions(userId: string): Promise<number> {
    const sessions = await this.readAllFromFile();
    let deactivatedCount = 0;
    
    for (let i = 0; i < sessions.length; i++) {
      if (sessions[i].userId === userId && sessions[i].isActive) {
        sessions[i] = {
          ...sessions[i],
          isActive: false,
          updatedAt: new Date()
        };
        deactivatedCount++;
      }
    }
    
    if (deactivatedCount > 0) {
      await this.writeAllToFile(sessions);
    }
    
    return deactivatedCount;
  }

  /**
   * Check if session is valid and not expired
   */
  async isValidSession(sessionId: string): Promise<boolean> {
    const session = await this.findById(sessionId);
    
    if (!session) {
      return false;
    }
    
    const now = new Date();
    return session.isActive && session.expiresAt > now;
  }

  /**
   * Get cookie options for sessions
   */
  getCookieOptions(maxAge?: number): CookieOptions {
    return {
      httpOnly: true,
      secure: config.server.isProduction,
      sameSite: 'lax',
      maxAge: maxAge || config.security.session.duration / 1000, // in seconds
      path: '/'
    };
  }

  /**
   * Override update to handle session-specific logic
   */
  async update(id: string, updates: UpdateSessionInput): Promise<Session | null> {
    const updateData = {
      ...updates,
      updatedAt: new Date()
    };

    return super.update(id, updateData as UpdateSessionInput);
  }
}