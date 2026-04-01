import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

const JWT_SECRET = process.env.JWT_SECRET || "tira-secret-key-change-me";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const ADMIN2_USERNAME = process.env.ADMIN2_USERNAME || "superadmin";
const ADMIN2_PASSWORD = process.env.ADMIN2_PASSWORD || "tira@2026";

export type UserRole = "admin" | "editor" | "viewer";

export interface User {
  id: string;
  username: string;
  password_hash: string;
  email?: string;
  role: UserRole;
  created_at: string;
}

// In-memory store with JSON persistence
let users: User[] = [];
const DATA_FILE = path.resolve(process.cwd(), "data", "users.json");

export function loadUsers() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      users = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    }
  } catch {}
  // Ensure primary admin exists and password is always in sync with env
  const adminIdx = users.findIndex(u => u.username === ADMIN_USERNAME);
  if (adminIdx === -1) {
    users.push({
      id: "admin-001",
      username: ADMIN_USERNAME,
      password_hash: bcrypt.hashSync(ADMIN_PASSWORD, 10),
      email: "admin@tira.local",
      role: "admin",
      created_at: new Date().toISOString(),
    });
  } else {
    // Always re-sync password from env on startup
    users[adminIdx].password_hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    users[adminIdx].role = "admin";
  }

  // Ensure secondary admin exists
  const admin2Idx = users.findIndex(u => u.username === ADMIN2_USERNAME);
  if (admin2Idx === -1) {
    users.push({
      id: "admin-002",
      username: ADMIN2_USERNAME,
      password_hash: bcrypt.hashSync(ADMIN2_PASSWORD, 10),
      email: "superadmin@tira.local",
      role: "admin",
      created_at: new Date().toISOString(),
    });
  } else {
    users[admin2Idx].password_hash = bcrypt.hashSync(ADMIN2_PASSWORD, 10);
    users[admin2Idx].role = "admin";
  }

  saveUsers();
}

function saveUsers() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
}

export function login(username: string, password: string): { token: string; user: Omit<User, "password_hash"> } | null {
  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return null;
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
  const { password_hash, ...safe } = user;
  return { token, user: safe };
}

export function register(username: string, password: string, email?: string, role: UserRole = "viewer"): User | null {
  if (users.find(u => u.username === username)) return null;
  const hash = bcrypt.hashSync(password, 10);
  const user: User = {
    id: `user-${Date.now()}`,
    username,
    password_hash: hash,
    email,
    role,
    created_at: new Date().toISOString(),
  };
  users.push(user);
  saveUsers();
  return user;
}

export function verifyToken(token: string): { id: string; username: string; role: UserRole } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch { return null; }
}

export function getAllUsers(): Omit<User, "password_hash">[] {
  return users.map(({ password_hash, ...rest }) => rest);
}

export function updateUserRole(userId: string, role: UserRole): boolean {
  const user = users.find(u => u.id === userId);
  if (!user) return false;
  user.role = role;
  saveUsers();
  return true;
}

export function deleteUser(userId: string): boolean {
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return false;
  users.splice(idx, 1);
  saveUsers();
  return true;
}

export function resetPassword(username: string, newPassword: string): boolean {
  const user = users.find(u => u.username === username);
  if (!user) return false;
  user.password_hash = bcrypt.hashSync(newPassword, 10);
  saveUsers();
  return true;
}

// Middleware helper
export function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Chưa đăng nhập" });
  }
  const payload = verifyToken(authHeader.slice(7));
  if (!payload) return res.status(401).json({ error: "Token không hợp lệ" });
  req.user = payload;
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Không có quyền" });
    }
    next();
  };
}
