import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as argon2 from 'argon2';
import type { User, CreateUserData, PublicUser } from '~/types/auth';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Argon2 설정 (2025 권장 설정)
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16, // 64MB
  timeCost: 3,         // 3 iterations
  parallelism: 1,      // 1 thread
};

// 디렉토리와 파일이 존재하는지 확인하고 없으면 생성
async function ensureDataFiles() {
  try {
    // 데이터 디렉토리 생성
    if (!existsSync(DATA_DIR)) {
      await fs.mkdir(DATA_DIR, { recursive: true });
    }

    // users.json 파일 생성
    if (!existsSync(USERS_FILE)) {
      await fs.writeFile(USERS_FILE, '[]', 'utf-8');
    }
  } catch (error) {
    console.error('Failed to ensure user data files:', error);
    throw new Error('Failed to initialize user data files');
  }
}

// 사용자 목록 조회
export async function getUsers(): Promise<User[]> {
  try {
    await ensureDataFiles();
    const content = await fs.readFile(USERS_FILE, 'utf-8');
    const users = JSON.parse(content);
    
    // Date 객체 복원
    return users.map((user: any) => ({
      ...user,
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt)
    }));
  } catch (error) {
    console.error('Failed to load users:', error);
    return [];
  }
}

// 사용자 목록 저장
export async function saveUsers(users: User[]): Promise<void> {
  try {
    await ensureDataFiles();
    
    // Date 객체를 ISO 문자열로 변환
    const serializedUsers = users.map(user => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    }));
    
    await fs.writeFile(USERS_FILE, JSON.stringify(serializedUsers, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save users:', error);
    throw new Error('Failed to save users');
  }
}

// 패스워드 해싱
export async function hashPassword(password: string): Promise<string> {
  try {
    return await argon2.hash(password, ARGON2_OPTIONS);
  } catch (error) {
    console.error('Failed to hash password:', error);
    throw new Error('Failed to hash password');
  }
}

// 패스워드 검증
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    console.error('Failed to verify password:', error);
    return false;
  }
}

// 새 사용자 생성
export async function createUser(userData: CreateUserData): Promise<User> {
  const users = await getUsers();
  
  // 이메일 중복 체크
  const existingUser = users.find(user => user.email.toLowerCase() === userData.email.toLowerCase());
  if (existingUser) {
    throw new Error('User with this email already exists');
  }
  
  // 패스워드 해싱
  const passwordHash = await hashPassword(userData.password);
  
  const newUser: User = {
    id: uuidv4(),
    email: userData.email.toLowerCase(),
    passwordHash,
    role: userData.role || 'user',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  users.push(newUser);
  await saveUsers(users);
  
  return newUser;
}

// 이메일로 사용자 찾기
export async function findUserByEmail(email: string): Promise<User | null> {
  const users = await getUsers();
  return users.find(user => user.email.toLowerCase() === email.toLowerCase()) || null;
}

// ID로 사용자 찾기
export async function findUserById(userId: string): Promise<User | null> {
  const users = await getUsers();
  return users.find(user => user.id === userId) || null;
}

// 공개 사용자 정보 반환 (패스워드 해시 제외)
export function toPublicUser(user: User): PublicUser {
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

// 사용자 인증
export async function authenticateUser(email: string, password: string): Promise<User | null> {
  const user = await findUserByEmail(email);
  if (!user) {
    return null;
  }
  
  const isValid = await verifyPassword(user.passwordHash, password);
  return isValid ? user : null;
}

// 관리자 사용자 존재 여부 확인
export async function hasAdminUser(): Promise<boolean> {
  const users = await getUsers();
  return users.some(user => user.role === 'admin');
}

// 사용자 업데이트
export async function updateUser(userId: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | null> {
  const users = await getUsers();
  const userIndex = users.findIndex(user => user.id === userId);
  
  if (userIndex === -1) {
    return null;
  }
  
  // 패스워드 업데이트 시 해싱
  if (updates.passwordHash && typeof updates.passwordHash === 'string') {
    updates.passwordHash = await hashPassword(updates.passwordHash);
  }
  
  const updatedUser = {
    ...users[userIndex],
    ...updates,
    id: userId, // ID는 변경 불가
    createdAt: users[userIndex].createdAt, // 생성일은 변경 불가
    updatedAt: new Date()
  };
  
  users[userIndex] = updatedUser;
  await saveUsers(users);
  
  return updatedUser;
}

// 사용자 삭제
export async function deleteUser(userId: string): Promise<void> {
  const users = await getUsers();
  const filteredUsers = users.filter(user => user.id !== userId);
  await saveUsers(filteredUsers);
}