import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JsonSessionRepository } from '../app/repositories/JsonSessionRepository';
import { JsonWriteQueue } from '../app/repositories/utils/JsonWriteQueue';
import type { Session } from '../app/types/auth';
import type { CreateSessionInput, UpdateSessionInput } from '../app/repositories/interfaces/SessionRepository';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('JsonSessionRepository', () => {
  let repository: JsonSessionRepository;
  let writeQueue: JsonWriteQueue;
  let testDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'session-repo-test-'));
    testFilePath = path.join(testDir, 'sessions.json');
    
    // Create test repository with custom write queue and file path
    writeQueue = new JsonWriteQueue();
    repository = new (class extends JsonSessionRepository {
      protected readonly filePath = testFilePath;
    })(writeQueue);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    
    writeQueue.clearMutexes();
  });

  const createSampleSession = (overrides?: Partial<CreateSessionInput>): CreateSessionInput => ({
    userId: 'user-123',
    userAgent: 'Mozilla/5.0',
    ipAddress: '192.168.1.100',
    ...overrides
  });

  describe('Basic CRUD operations', () => {
    it('should create a session', async () => {
      const input = createSampleSession();
      
      const session = await repository.create(input);
      
      expect(session).toMatchObject({
        userId: input.userId,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
        isActive: true
      });
      expect(session.id).toBeDefined();
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
      expect(session.expiresAt).toBeInstanceOf(Date);
      expect(session.lastAccessedAt).toBeInstanceOf(Date);
      
      // Should expire in the future
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should find session by ID', async () => {
      const session = await repository.create(createSampleSession());
      
      const foundSession = await repository.findById(session.id);
      
      expect(foundSession).toEqual(session);
    });

    it('should update session', async () => {
      const session = await repository.create(createSampleSession());
      
      // Add small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const updates: UpdateSessionInput = {
        userAgent: 'Updated User Agent',
        ipAddress: '10.0.0.1'
      };
      
      const updatedSession = await repository.update(session.id, updates);
      
      expect(updatedSession).toMatchObject({
        id: session.id,
        userId: session.userId,
        userAgent: 'Updated User Agent',
        ipAddress: '10.0.0.1',
        isActive: session.isActive,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        lastAccessedAt: session.lastAccessedAt
      });
      expect(updatedSession!.updatedAt.getTime()).toBeGreaterThan(session.updatedAt.getTime());
    });

    it('should delete session', async () => {
      const session = await repository.create(createSampleSession());
      
      const deleted = await repository.delete(session.id);
      
      expect(deleted).toBe(true);
      
      const foundSession = await repository.findById(session.id);
      expect(foundSession).toBeNull();
    });
  });

  describe('Session-specific methods', () => {
    let user1Sessions: Session[];
    let user2Sessions: Session[];

    beforeEach(async () => {
      // Create test sessions for multiple users
      user1Sessions = [
        await repository.create(createSampleSession({ userId: 'user1' })),
        await repository.create(createSampleSession({ userId: 'user1' }))
      ];
      
      user2Sessions = [
        await repository.create(createSampleSession({ userId: 'user2' }))
      ];
    });

    it('should find sessions by user ID', async () => {
      const user1Found = await repository.findByUserId('user1');
      const user2Found = await repository.findByUserId('user2');
      
      expect(user1Found).toHaveLength(2);
      expect(user1Found.every(session => session.userId === 'user1')).toBe(true);
      
      expect(user2Found).toHaveLength(1);
      expect(user2Found[0].userId).toBe('user2');
    });

    it('should find active sessions for a user', async () => {
      // Deactivate one session
      await repository.deactivateSession(user1Sessions[0].id);
      
      const activeSessions = await repository.findActiveByUserId('user1');
      
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].id).toBe(user1Sessions[1].id);
      expect(activeSessions[0].isActive).toBe(true);
    });

    it('should not return expired sessions as active', async () => {
      // Create expired session by updating its expiry date
      await repository.update(user1Sessions[0].id, {
        expiresAt: new Date(Date.now() - 1000) // 1 second ago
      });
      
      const activeSessions = await repository.findActiveByUserId('user1');
      
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].id).toBe(user1Sessions[1].id);
    });

    it('should clean up expired sessions', async () => {
      // Make some sessions expired
      await repository.update(user1Sessions[0].id, {
        expiresAt: new Date(Date.now() - 1000)
      });
      await repository.update(user2Sessions[0].id, {
        expiresAt: new Date(Date.now() - 1000)
      });
      
      const expiredCount = await repository.cleanupExpired();
      
      expect(expiredCount).toBe(2);
      
      // Should only have active, non-expired sessions left
      const allSessions = await repository.findAll();
      expect(allSessions).toHaveLength(1);
      expect(allSessions[0].id).toBe(user1Sessions[1].id);
    });

    it('should deactivate session', async () => {
      const deactivated = await repository.deactivateSession(user1Sessions[0].id);
      
      expect(deactivated).toBe(true);
      
      const session = await repository.findById(user1Sessions[0].id);
      expect(session!.isActive).toBe(false);
    });

    it('should return false when deactivating non-existent session', async () => {
      const result = await repository.deactivateSession('non-existent-id');
      
      expect(result).toBe(false);
    });

    it('should deactivate all user sessions', async () => {
      const deactivatedCount = await repository.deactivateAllUserSessions('user1');
      
      expect(deactivatedCount).toBe(2);
      
      const user1Sessions = await repository.findByUserId('user1');
      expect(user1Sessions.every(session => !session.isActive)).toBe(true);
      
      // User2 sessions should remain active
      const user2Sessions = await repository.findByUserId('user2');
      expect(user2Sessions.every(session => session.isActive)).toBe(true);
    });

    it('should check if session is valid', async () => {
      expect(await repository.isValidSession(user1Sessions[0].id)).toBe(true);
      
      // Deactivate session
      await repository.deactivateSession(user1Sessions[0].id);
      expect(await repository.isValidSession(user1Sessions[0].id)).toBe(false);
      
      // Expire session
      await repository.update(user1Sessions[1].id, {
        expiresAt: new Date(Date.now() - 1000)
      });
      expect(await repository.isValidSession(user1Sessions[1].id)).toBe(false);
      
      // Non-existent session
      expect(await repository.isValidSession('non-existent')).toBe(false);
    });
  });

  describe('Session refresh', () => {
    let session: Session;

    beforeEach(async () => {
      session = await repository.create(createSampleSession());
    });

    it('should refresh session when near expiry', async () => {
      // Set session to expire soon (within refresh threshold)
      const soonExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
      await repository.update(session.id, { expiresAt: soonExpiry });
      
      // Add small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const refreshedSession = await repository.refreshSession(session.id);
      
      expect(refreshedSession).toBeDefined();
      expect(refreshedSession!.expiresAt.getTime()).toBeGreaterThan(soonExpiry.getTime());
      expect(refreshedSession!.lastAccessedAt!.getTime()).toBeGreaterThanOrEqual(session.lastAccessedAt!.getTime());
    });

    it('should update last accessed time without refresh when not needed', async () => {
      // Set session to expire far in future (beyond refresh threshold of 4 days)
      const farExpiry = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
      const updatedSession = await repository.update(session.id, { expiresAt: farExpiry });
      
      // Add delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const refreshedSession = await repository.refreshSession(session.id);
      
      expect(refreshedSession).toBeDefined();
      expect(refreshedSession!.expiresAt.getTime()).toBe(farExpiry.getTime());
      expect(refreshedSession!.lastAccessedAt!.getTime()).toBeGreaterThan(updatedSession!.lastAccessedAt!.getTime());
    });

    it('should return null for inactive session', async () => {
      await repository.deactivateSession(session.id);
      
      const result = await repository.refreshSession(session.id);
      
      expect(result).toBeNull();
    });

    it('should return null for expired session', async () => {
      await repository.update(session.id, {
        expiresAt: new Date(Date.now() - 1000)
      });
      
      const result = await repository.refreshSession(session.id);
      
      expect(result).toBeNull();
    });

    it('should return null for non-existent session', async () => {
      const result = await repository.refreshSession('non-existent');
      
      expect(result).toBeNull();
    });
  });

  describe('Cookie options', () => {
    it('should return cookie options with default max age', () => {
      const options = repository.getCookieOptions();
      
      expect(options).toEqual({
        httpOnly: true,
        secure: false, // Not production in tests
        sameSite: 'lax',
        maxAge: expect.any(Number),
        path: '/'
      });
      expect(options.maxAge).toBeGreaterThan(0);
    });

    it('should return cookie options with custom max age', () => {
      const customMaxAge = 3600; // 1 hour
      const options = repository.getCookieOptions(customMaxAge);
      
      expect(options.maxAge).toBe(customMaxAge);
    });
  });

  describe('Data persistence and transformation', () => {
    it('should persist data across repository instances', async () => {
      const session = await repository.create(createSampleSession());
      
      // Create new repository instance with same file path
      const newRepository = new (class extends JsonSessionRepository {
        protected readonly filePath = testFilePath;
      })(writeQueue);
      
      const foundSession = await newRepository.findById(session.id);
      expect(foundSession).toEqual(session);
    });

    it('should handle Date objects correctly', async () => {
      const session = await repository.create(createSampleSession());
      
      // Read raw file content
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      const rawData = JSON.parse(fileContent);
      
      // Should store dates as ISO strings
      expect(typeof rawData[0].createdAt).toBe('string');
      expect(typeof rawData[0].updatedAt).toBe('string');
      expect(typeof rawData[0].expiresAt).toBe('string');
      expect(typeof rawData[0].lastAccessedAt).toBe('string');
      
      // But when loaded, should be Date objects
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
      expect(session.expiresAt).toBeInstanceOf(Date);
      expect(session.lastAccessedAt).toBeInstanceOf(Date);
    });
  });
});