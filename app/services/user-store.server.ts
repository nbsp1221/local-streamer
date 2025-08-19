import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import type { CreateUserData, PublicUser, User } from '~/types/auth';
import { config } from '~/configs';

const DATA_DIR = config.paths.data;
const USERS_FILE = config.paths.usersJson;

// Argon2 configuration (2025 recommended settings)
const ARGON2_OPTIONS = config.security.argon2;

// Ensure directory and files exist, create if they don't
async function ensureDataFiles() {
  try {
    // Create data directory
    if (!existsSync(DATA_DIR)) {
      await fs.mkdir(DATA_DIR, { recursive: true });
    }

    // Create users.json file
    if (!existsSync(USERS_FILE)) {
      await fs.writeFile(USERS_FILE, '[]', 'utf-8');
    }
  }
  catch (error) {
    console.error('Failed to ensure user data files:', error);
    throw new Error('Failed to initialize user data files');
  }
}

// Get all users
export async function getUsers(): Promise<User[]> {
  try {
    await ensureDataFiles();
    const content = await fs.readFile(USERS_FILE, 'utf-8');
    const users = JSON.parse(content);

    // Restore Date objects
    return users.map((user: any) => ({
      ...user,
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt),
    }));
  }
  catch (error) {
    console.error('Failed to load users:', error);
    return [];
  }
}

// Save users list
export async function saveUsers(users: User[]): Promise<void> {
  try {
    await ensureDataFiles();

    // Convert Date objects to ISO strings
    const serializedUsers = users.map(user => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    }));

    await fs.writeFile(USERS_FILE, JSON.stringify(serializedUsers, null, 2), 'utf-8');
  }
  catch (error) {
    console.error('Failed to save users:', error);
    throw new Error('Failed to save users');
  }
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  try {
    return await argon2.hash(password, ARGON2_OPTIONS);
  }
  catch (error) {
    console.error('Failed to hash password:', error);
    throw new Error('Failed to hash password');
  }
}

// Verify password
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  }
  catch (error) {
    console.error('Failed to verify password:', error);
    return false;
  }
}

// Create new user
export async function createUser(userData: CreateUserData): Promise<User> {
  const users = await getUsers();

  // Check for duplicate email
  const existingUser = users.find(user => user.email.toLowerCase() === userData.email.toLowerCase());
  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Hash password
  const passwordHash = await hashPassword(userData.password);

  const newUser: User = {
    id: uuidv4(),
    email: userData.email.toLowerCase(),
    passwordHash,
    role: userData.role || 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  users.push(newUser);
  await saveUsers(users);

  return newUser;
}

// Find user by email
export async function findUserByEmail(email: string): Promise<User | null> {
  const users = await getUsers();
  return users.find(user => user.email.toLowerCase() === email.toLowerCase()) || null;
}

// Find user by ID
export async function findUserById(userId: string): Promise<User | null> {
  const users = await getUsers();
  return users.find(user => user.id === userId) || null;
}

// Return public user info (exclude password hash)
export function toPublicUser(user: User): PublicUser {
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

// Authenticate user
export async function authenticateUser(email: string, password: string): Promise<User | null> {
  const user = await findUserByEmail(email);
  if (!user) {
    return null;
  }

  const isValid = await verifyPassword(user.passwordHash, password);
  return isValid ? user : null;
}

// Check if admin user exists
export async function hasAdminUser(): Promise<boolean> {
  const users = await getUsers();
  return users.some(user => user.role === 'admin');
}

// Update user
export async function updateUser(userId: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | null> {
  const users = await getUsers();
  const userIndex = users.findIndex(user => user.id === userId);

  if (userIndex === -1) {
    return null;
  }

  // Hash password if updating
  if (updates.passwordHash && typeof updates.passwordHash === 'string') {
    updates.passwordHash = await hashPassword(updates.passwordHash);
  }

  const updatedUser = {
    ...users[userIndex],
    ...updates,
    id: userId, // ID cannot be changed
    createdAt: users[userIndex].createdAt, // Creation date cannot be changed
    updatedAt: new Date(),
  };

  users[userIndex] = updatedUser;
  await saveUsers(users);

  return updatedUser;
}

// Delete user
export async function deleteUser(userId: string): Promise<void> {
  const users = await getUsers();
  const filteredUsers = users.filter(user => user.id !== userId);
  await saveUsers(filteredUsers);
}
