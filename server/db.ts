import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, persons, detectionLogs, InsertPerson, InsertDetectionLog, Person, DetectionLog } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.id) {
    throw new Error("User ID is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      id: user.id,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role === undefined) {
      if (user.id === ENV.ownerId) {
        user.role = 'admin';
        values.role = 'admin';
        updateSet.role = 'admin';
      }
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUser(id: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ========== 人员管理相关查询 ==========

/**
 * 获取所有人员列表
 */
export async function getAllPersons(): Promise<Person[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get persons: database not available");
    return [];
  }

  const result = await db.select().from(persons).orderBy(desc(persons.createdAt));
  return result;
}

/**
 * 根据 ID 获取人员信息
 */
export async function getPersonById(id: number): Promise<Person | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get person: database not available");
    return undefined;
  }

  const result = await db.select().from(persons).where(eq(persons.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * 创建新人员
 */
export async function createPerson(person: InsertPerson): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.insert(persons).values(person);
  return Number(result[0].insertId);
}

/**
 * 更新人员信息
 */
export async function updatePerson(id: number, updates: Partial<InsertPerson>): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.update(persons).set(updates).where(eq(persons.id, id));
}

/**
 * 删除人员
 */
export async function deletePerson(id: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.delete(persons).where(eq(persons.id, id));
}

// ========== 检测记录相关查询 ==========

/**
 * 创建检测记录
 */
export async function createDetectionLog(log: InsertDetectionLog): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.insert(detectionLogs).values(log);
  return Number(result[0].insertId);
}

/**
 * 获取最近的检测记录
 */
export async function getRecentDetectionLogs(limit: number = 50): Promise<DetectionLog[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get detection logs: database not available");
    return [];
  }

  const result = await db.select().from(detectionLogs).orderBy(desc(detectionLogs.createdAt)).limit(limit);
  return result;
}

/**
 * 根据用户 ID 获取检测记录
 */
export async function getDetectionLogsByUser(userId: string, limit: number = 50): Promise<DetectionLog[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get detection logs: database not available");
    return [];
  }

  const result = await db.select().from(detectionLogs)
    .where(eq(detectionLogs.userId, userId))
    .orderBy(desc(detectionLogs.createdAt))
    .limit(limit);
  return result;
}

/**
 * 根据人员 ID 获取识别记录
 */
export async function getDetectionLogsByPerson(personId: number, limit: number = 50): Promise<DetectionLog[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get detection logs: database not available");
    return [];
  }

  const result = await db.select().from(detectionLogs)
    .where(eq(detectionLogs.personId, personId))
    .orderBy(desc(detectionLogs.createdAt))
    .limit(limit);
  return result;
}


// ==================== 统计函数 ====================

/**
 * 统计人员总数
 */
export async function countPersons(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const result = await db.select().from(persons);
    return result.length;
  } catch (error) {
    console.error("[Database] Failed to count persons:", error);
    return 0;
  }
}

/**
 * 统计检测记录总数
 */
export async function countDetectionLogs(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const result = await db.select().from(detectionLogs);
    return result.length;
  } catch (error) {
    console.error("[Database] Failed to count detection logs:", error);
    return 0;
  }
}

/**
 * 统计今天的检测记录数
 */
export async function countTodayDetectionLogs(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const result = await db.select().from(detectionLogs);
    const todayLogs = result.filter(log => {
      const logDate = new Date(log.createdAt);
      return logDate >= today;
    });
    
    return todayLogs.length;
  } catch (error) {
    console.error("[Database] Failed to count today's logs:", error);
    return 0;
  }
}

