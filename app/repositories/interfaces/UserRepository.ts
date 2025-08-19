import type { CreateUserData, PublicUser, User } from '~/types/auth';
import type { BaseRepository } from './BaseRepository';

/**
 * Input for updating an existing user
 */
export interface UpdateUserInput {
  email?: string;
  passwordHash?: string;
  role?: 'admin' | 'user';
}

/**
 * User repository interface extending base repository with user-specific methods
 */
export interface UserRepository extends BaseRepository<User, CreateUserData, UpdateUserInput> {
  /**
   * Find user by email (case-insensitive)
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Find users by role
   */
  findByRole(role: 'admin' | 'user'): Promise<User[]>;

  /**
   * Check if admin user exists
   */
  hasAdminUser(): Promise<boolean>;

  /**
   * Authenticate user with email and password hash
   */
  authenticate(email: string, passwordHash: string): Promise<User | null>;

  /**
   * Convert user to public user (without password hash)
   */
  toPublicUser(user: User): PublicUser;

  /**
   * Hash password using Argon2
   */
  hashPassword(password: string): Promise<string>;

  /**
   * Verify password against hash
   */
  verifyPassword(hash: string, password: string): Promise<boolean>;
}
