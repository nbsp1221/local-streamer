import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { UpdateUserInput } from '../app/repositories/interfaces/UserRepository';
import type { CreateUserData, User } from '../app/types/auth';
import { JsonUserRepository } from '../app/repositories/JsonUserRepository';
import { JsonWriteQueue } from '../app/repositories/utils/JsonWriteQueue';

describe('JsonUserRepository', () => {
  let repository: JsonUserRepository;
  let writeQueue: JsonWriteQueue;
  let testDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'user-repo-test-'));
    testFilePath = path.join(testDir, 'users.json');

    // Create test repository with custom write queue and file path
    writeQueue = new JsonWriteQueue();
    repository = new (class extends JsonUserRepository {
      protected readonly filePath = testFilePath;
    })(writeQueue);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    }
    catch (error) {
      // Ignore cleanup errors
    }

    writeQueue.clearMutexes();
  });

  const createSampleUser = (overrides?: Partial<CreateUserData>): CreateUserData => ({
    email: 'test@example.com',
    password: 'test123456',
    role: 'user',
    ...overrides,
  });

  describe('Password handling', () => {
    it('should hash password correctly', async () => {
      const password = 'test123456';

      const hash = await repository.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // Argon2 hashes are long
    });

    it('should verify password correctly', async () => {
      const password = 'test123456';
      const hash = await repository.hashPassword(password);

      const isValid = await repository.verifyPassword(hash, password);
      const isInvalid = await repository.verifyPassword(hash, 'wrongpassword');

      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });

    it('should return false for invalid hash', async () => {
      const result = await repository.verifyPassword('invalid-hash', 'password');

      expect(result).toBe(false);
    });
  });

  describe('Basic CRUD operations', () => {
    it('should create a user with hashed password', async () => {
      const input = createSampleUser();

      const user = await repository.create(input);

      expect(user).toMatchObject({
        email: input.email,
        role: input.role,
      });
      expect(user.id).toBeDefined();
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
      expect(user.passwordHash).not.toBe(input.password); // Should be hashed
      expect(user.passwordHash.length).toBeGreaterThan(50);
    });

    it('should convert email to lowercase when creating user', async () => {
      const input = createSampleUser({ email: 'TEST@EXAMPLE.COM' });

      const user = await repository.create(input);

      expect(user.email).toBe('test@example.com');
    });

    it('should throw error for duplicate email', async () => {
      const input = createSampleUser();
      await repository.create(input);

      await expect(repository.create(input))
        .rejects.toThrow('User with this email already exists');
    });

    it('should throw error for duplicate email (case insensitive)', async () => {
      await repository.create(createSampleUser({ email: 'test@example.com' }));

      await expect(repository.create(createSampleUser({ email: 'TEST@EXAMPLE.COM' })))
        .rejects.toThrow('User with this email already exists');
    });

    it('should find user by ID', async () => {
      const user = await repository.create(createSampleUser());

      const foundUser = await repository.findById(user.id);

      expect(foundUser).toEqual(user);
    });

    it('should update user', async () => {
      const user = await repository.create(createSampleUser());

      // Add small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));

      const updates: UpdateUserInput = {
        email: 'updated@example.com',
        role: 'admin',
      };

      const updatedUser = await repository.update(user.id, updates);

      expect(updatedUser).toMatchObject({
        id: user.id,
        email: 'updated@example.com',
        role: 'admin',
        passwordHash: user.passwordHash,
        createdAt: user.createdAt,
      });
      // Should preserve id and createdAt
      expect(updatedUser!.id).toBe(user.id);
      expect(updatedUser!.createdAt).toEqual(user.createdAt);
      // Should update updatedAt
      expect(updatedUser!.updatedAt.getTime()).toBeGreaterThanOrEqual(user.updatedAt.getTime());
    });

    it('should hash password when updating', async () => {
      const user = await repository.create(createSampleUser());
      const newPassword = 'newpassword123';

      const updatedUser = await repository.update(user.id, {
        passwordHash: newPassword,
      });

      expect(updatedUser!.passwordHash).not.toBe(newPassword);
      expect(updatedUser!.passwordHash).not.toBe(user.passwordHash);

      // Should be able to verify with new password
      const isValid = await repository.verifyPassword(updatedUser!.passwordHash, newPassword);
      expect(isValid).toBe(true);
    });

    it('should convert email to lowercase when updating', async () => {
      const user = await repository.create(createSampleUser());

      const updatedUser = await repository.update(user.id, {
        email: 'UPDATED@EXAMPLE.COM',
      });

      expect(updatedUser!.email).toBe('updated@example.com');
    });

    it('should delete user', async () => {
      const user = await repository.create(createSampleUser());

      const deleted = await repository.delete(user.id);

      expect(deleted).toBe(true);

      const foundUser = await repository.findById(user.id);
      expect(foundUser).toBeNull();
    });
  });

  describe('User-specific methods', () => {
    beforeEach(async () => {
      // Create test users
      await repository.create(createSampleUser({
        email: 'admin@example.com',
        role: 'admin',
      }));

      await repository.create(createSampleUser({
        email: 'user1@example.com',
        role: 'user',
      }));

      await repository.create(createSampleUser({
        email: 'user2@example.com',
        role: 'user',
      }));
    });

    it('should find user by email', async () => {
      const user = await repository.findByEmail('admin@example.com');

      expect(user).toBeDefined();
      expect(user!.email).toBe('admin@example.com');
      expect(user!.role).toBe('admin');
    });

    it('should find user by email (case insensitive)', async () => {
      const user = await repository.findByEmail('ADMIN@EXAMPLE.COM');

      expect(user).toBeDefined();
      expect(user!.email).toBe('admin@example.com');
    });

    it('should return null for non-existent email', async () => {
      const user = await repository.findByEmail('nonexistent@example.com');

      expect(user).toBeNull();
    });

    it('should find users by role', async () => {
      const adminUsers = await repository.findByRole('admin');
      const regularUsers = await repository.findByRole('user');

      expect(adminUsers).toHaveLength(1);
      expect(adminUsers[0].role).toBe('admin');

      expect(regularUsers).toHaveLength(2);
      expect(regularUsers.every(user => user.role === 'user')).toBe(true);
    });

    it('should check if admin user exists', async () => {
      expect(await repository.hasAdminUser()).toBe(true);

      // Delete admin user
      const adminUser = await repository.findByRole('admin');
      await repository.delete(adminUser[0].id);

      expect(await repository.hasAdminUser()).toBe(false);
    });

    it('should authenticate user with correct password', async () => {
      const password = 'testpassword123';
      await repository.create(createSampleUser({
        email: 'auth@example.com',
        password,
      }));

      const authenticatedUser = await repository.authenticate('auth@example.com', password);

      expect(authenticatedUser).toBeDefined();
      expect(authenticatedUser!.email).toBe('auth@example.com');
    });

    it('should authenticate user (case insensitive email)', async () => {
      const password = 'testpassword123';
      await repository.create(createSampleUser({
        email: 'auth@example.com',
        password,
      }));

      const authenticatedUser = await repository.authenticate('AUTH@EXAMPLE.COM', password);

      expect(authenticatedUser).toBeDefined();
      expect(authenticatedUser!.email).toBe('auth@example.com');
    });

    it('should return null for wrong password', async () => {
      await repository.create(createSampleUser({
        email: 'auth@example.com',
        password: 'correctpassword',
      }));

      const result = await repository.authenticate('auth@example.com', 'wrongpassword');

      expect(result).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      const result = await repository.authenticate('nonexistent@example.com', 'password');

      expect(result).toBeNull();
    });

    it('should convert user to public user', () => {
      const user: User = {
        id: 'test-id',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const publicUser = repository.toPublicUser(user);

      expect(publicUser).toEqual({
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
      expect(publicUser).not.toHaveProperty('passwordHash');
    });
  });

  describe('Data persistence and transformation', () => {
    it('should persist data across repository instances', async () => {
      const user = await repository.create(createSampleUser());

      // Create new repository instance with same file path
      const newRepository = new (class extends JsonUserRepository {
        protected readonly filePath = testFilePath;
      })(writeQueue);

      const foundUser = await newRepository.findById(user.id);
      expect(foundUser).toEqual(user);
    });

    it('should handle Date objects correctly', async () => {
      const user = await repository.create(createSampleUser());

      // Read raw file content
      const fileContent = await fs.readFile(testFilePath, 'utf-8');
      const rawData = JSON.parse(fileContent);

      // Should store dates as ISO strings
      expect(typeof rawData[0].createdAt).toBe('string');
      expect(typeof rawData[0].updatedAt).toBe('string');
      expect(rawData[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);

      // But when loaded, should be Date objects
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });
  });
});
