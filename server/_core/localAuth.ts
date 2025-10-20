import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import bcrypt from "bcryptjs";

export function registerLocalAuthRoutes(app: Express) {
  // 本地登录
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "用户名和密码不能为空" });
      return;
    }

    try {
      // 根据用户名查找用户
      const user = await db.getUser(username);
      
      if (!user || !user.password) {
        res.status(401).json({ error: "用户名或密码错误" });
        return;
      }

      // 验证密码
      const isValid = await bcrypt.compare(password, user.password);
      
      if (!isValid) {
        res.status(401).json({ error: "用户名或密码错误" });
        return;
      }

      // 更新最后登录时间
      await db.upsertUser({
        id: user.id,
        lastSignedIn: new Date(),
      });

      // 创建会话token
      const sessionToken = await sdk.createSessionToken(user.id, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ 
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      });
    } catch (error) {
      console.error("[LocalAuth] Login failed", error);
      res.status(500).json({ error: "登录失败" });
    }
  });

  // 注册（可选）
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const { username, password, name, email } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "用户名和密码不能为空" });
      return;
    }

    try {
      // 检查用户是否已存在
      const existingUser = await db.getUser(username);
      if (existingUser) {
        res.status(400).json({ error: "用户名已存在" });
        return;
      }

      // 哈希密码
      const hashedPassword = await bcrypt.hash(password, 10);

      // 创建用户
      await db.upsertUser({
        id: username,
        name: name || username,
        email: email || null,
        password: hashedPassword,
        loginMethod: "local",
        role: "user",
        createdAt: new Date(),
        lastSignedIn: new Date(),
      });

      res.json({ success: true, message: "注册成功" });
    } catch (error) {
      console.error("[LocalAuth] Registration failed", error);
      res.status(500).json({ error: "注册失败" });
    }
  });
}

