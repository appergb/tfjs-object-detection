import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { storagePut } from "./storage";
import { TRPCError } from "@trpc/server";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // 人员管理 API
  persons: router({
    // 获取所有人员列表
    list: protectedProcedure.query(async () => {
      return await db.getAllPersons();
    }),

    // 根据 ID 获取人员
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const person = await db.getPersonById(input.id);
        if (!person) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "人员不存在",
          });
        }
        return person;
      }),

    // 创建新人员（仅管理员）
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1, "姓名不能为空"),
          description: z.string().optional(),
          imageData: z.string(), // Base64 编码的图片数据
          faceEmbedding: z.string().optional(), // 人脸特征向量 JSON
        })
      )
      .mutation(async ({ input, ctx }) => {
        // 检查管理员权限
        if (ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "只有管理员可以添加人员",
          });
        }

        // 上传图片到 S3
        const imageBuffer = Buffer.from(input.imageData.split(",")[1], "base64");
        const fileName = `persons/${Date.now()}-${input.name}.jpg`;
        const { url: imageUrl } = await storagePut(fileName, imageBuffer, "image/jpeg");

        // 创建人员记录
        const personId = await db.createPerson({
          name: input.name,
          description: input.description || null,
          imageUrl,
          faceEmbedding: input.faceEmbedding || null,
          createdBy: ctx.user.id,
        });

        return { id: personId, imageUrl };
      }),

    // 更新人员信息（仅管理员）
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          faceEmbedding: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "只有管理员可以更新人员信息",
          });
        }

        const { id, ...updates } = input;
        await db.updatePerson(id, updates);
        return { success: true };
      }),

    // 删除人员（仅管理员）
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "只有管理员可以删除人员",
          });
        }

        await db.deletePerson(input.id);
        return { success: true };
      }),
  }),

  // 统计 API
  stats: router({
    // 获取总体统计
    getOverview: protectedProcedure.query(async () => {
      const totalPersons = await db.countPersons();
      const totalLogs = await db.countDetectionLogs();
      const todayLogs = await db.countTodayDetectionLogs();
      
      return {
        totalPersons,
        totalLogs,
        todayLogs,
        lastUpdate: new Date().toISOString(),
      };
    }),

    // 获取使用统计（最近7天）
    getUsageStats: protectedProcedure.query(async () => {
      const logs = await db.getRecentDetectionLogs(100);
      
      const dailyStats = new Map<string, number>();
      logs.forEach((log) => {
        const date = new Date(log.createdAt).toISOString().split('T')[0];
        dailyStats.set(date, (dailyStats.get(date) || 0) + 1);
      });
      
      return Array.from(dailyStats.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }),
  }),

  // 检测记录 API
  detectionLogs: router({
    // 获取最近的检测记录
    recent: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await db.getRecentDetectionLogs(input.limit);
      }),

    // 获取当前用户的检测记录
    myLogs: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        return await db.getDetectionLogsByUser(ctx.user.id, input.limit);
      }),

    // 根据人员 ID 获取识别记录
    byPerson: protectedProcedure
      .input(z.object({ personId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await db.getDetectionLogsByPerson(input.personId, input.limit);
      }),

    // 创建检测记录
    create: protectedProcedure
      .input(
        z.object({
          personId: z.number().optional(),
          personName: z.string().optional(),
          confidence: z.number().optional(),
          detectedObjects: z.string(), // JSON 数组
          snapshotData: z.string().optional(), // Base64 编码的快照图片
        })
      )
      .mutation(async ({ input, ctx }) => {
        let snapshotUrl: string | null = null;

        // 如果有快照数据，上传到 S3
        if (input.snapshotData) {
          const snapshotBuffer = Buffer.from(input.snapshotData.split(",")[1], "base64");
          const fileName = `snapshots/${Date.now()}-${ctx.user.id}.jpg`;
          const { url } = await storagePut(fileName, snapshotBuffer, "image/jpeg");
          snapshotUrl = url;
        }

        // 创建检测记录
        const logId = await db.createDetectionLog({
          personId: input.personId || null,
          personName: input.personName || null,
          confidence: input.confidence || null,
          detectedObjects: input.detectedObjects,
          snapshotUrl: snapshotUrl || null,
          userId: ctx.user.id,
        });

        return { id: logId, snapshotUrl };
      }),
  }),
});

export type AppRouter = typeof appRouter;
