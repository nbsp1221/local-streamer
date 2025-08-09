import { v4 as uuidv4 } from 'uuid';
import * as argon2 from 'argon2';
import type { User, CreateUserData, PublicUser } from "~/types/auth";
import type { UserRepository, UpdateUserInput } from "~/repositories/interfaces/UserRepository";
import { BaseJsonRepository } from "~/repositories/base/BaseJsonRepository";
import { config } from "~/configs";

/**
 * JSON-based implementation of UserRepository
 */
export class JsonUserRepository extends BaseJsonRepository<User, CreateUserData, UpdateUserInput> implements UserRepository {
  protected readonly filePath = config.paths.usersJson;

  /**
   * Transform raw JSON data to User entity
   */
  protected transformFromJson(data: any): User {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt)
    };
  }

  /**
   * Transform User entity to JSON data
   */
  protected transformToJson(entity: User): any {
    return {
      ...entity,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString()
    };
  }

  /**
   * Create a new User entity from input data
   */
  protected createEntity(input: CreateUserData): User {
    const now = new Date();
    return {
      id: uuidv4(),
      email: input.email.toLowerCase(),
      passwordHash: input.password, // Will be hashed in create method
      role: input.role || 'user',
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * Hash password using Argon2
   */
  async hashPassword(password: string): Promise<string> {
    try {
      return await argon2.hash(password, config.security.argon2);
    } catch (error) {
      throw new Error(`Failed to hash password: ${error}`);
    }
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      console.error('Failed to verify password:', error);
      return false;
    }
  }

  /**
   * Create new user (override to hash password)
   */
  async create(input: CreateUserData): Promise<User> {
    // Check for duplicate email
    const existingUser = await this.findByEmail(input.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(input.password);
    
    const userWithHashedPassword = {
      ...input,
      password: hashedPassword
    };

    return super.create(userWithHashedPassword);
  }

  /**
   * Update user (override to handle password hashing)
   */
  async update(id: string, updates: UpdateUserInput): Promise<User | null> {
    const updateData = { ...updates };
    
    // Hash password if updating
    if (updateData.passwordHash && typeof updateData.passwordHash === 'string') {
      updateData.passwordHash = await this.hashPassword(updateData.passwordHash);
    }

    // Update email to lowercase
    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase();
    }

    // Set updated timestamp
    const updatedData = {
      ...updateData,
      updatedAt: new Date()
    };

    return super.update(id, updatedData as UpdateUserInput);
  }

  /**
   * Find user by email (case-insensitive)
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.findOneWhere(user => 
      user.email.toLowerCase() === email.toLowerCase()
    );
  }

  /**
   * Find users by role
   */
  async findByRole(role: 'admin' | 'user'): Promise<User[]> {
    return this.findWhere(user => user.role === role);
  }

  /**
   * Check if admin user exists
   */
  async hasAdminUser(): Promise<boolean> {
    const adminUsers = await this.findByRole('admin');
    return adminUsers.length > 0;
  }

  /**
   * Authenticate user with email and password
   */
  async authenticate(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (!user) {
      return null;
    }

    const isValid = await this.verifyPassword(user.passwordHash, password);
    return isValid ? user : null;
  }

  /**
   * Convert user to public user (without password hash)
   */
  toPublicUser(user: User): PublicUser {
    const { passwordHash, ...publicUser } = user;
    return publicUser;
  }
}