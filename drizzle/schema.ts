import { mysqlEnum, mysqlTable, text, timestamp, varchar, int } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 人员信息表 - 存储需要识别的人员基本信息
 */
export const persons = mysqlTable("persons", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  imageUrl: varchar("imageUrl", { length: 500 }).notNull(),
  faceEmbedding: text("faceEmbedding"), // 存储人脸特征向量的 JSON 字符串
  createdBy: varchar("createdBy", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Person = typeof persons.$inferSelect;
export type InsertPerson = typeof persons.$inferInsert;

/**
 * 识别记录表 - 存储每次识别的历史记录
 */
export const detectionLogs = mysqlTable("detectionLogs", {
  id: int("id").primaryKey().autoincrement(),
  personId: int("personId"), // 识别到的人员 ID，null 表示未识别
  personName: varchar("personName", { length: 100 }), // 识别到的人员名称
  confidence: int("confidence"), // 置信度 0-100
  detectedObjects: text("detectedObjects"), // 检测到的其他物体 JSON 数组
  snapshotUrl: varchar("snapshotUrl", { length: 500 }), // 识别时的快照图片
  userId: varchar("userId", { length: 64 }), // 执行识别的用户
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DetectionLog = typeof detectionLogs.$inferSelect;
export type InsertDetectionLog = typeof detectionLogs.$inferInsert;
