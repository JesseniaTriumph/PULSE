import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { storage } from "./storage";
import { loginSchema, registerSchema } from "@shared/schema";
import bcrypt from "bcrypt";

declare module "express-session" {
  interface SessionData {
    userId: number;
    oauthState?: string;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

export function setupAuth(app: Express) {
  const PgStore = connectPgSimple(session);

  app.use(
    session({
      store: new PgStore({
        pool: pool,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
    })
  );

  app.post("/api/auth/register", async (req, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.errors });
      }

      const { username, email, password, displayName } = parsed.data;

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ error: "Username already taken" });
      }

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(409).json({ error: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        displayName,
      });

      req.session.userId = user.id;

      res.status(201).json({
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
      });
    } catch (error) {
      console.error("Error registering user:", error);
      res.status(500).json({ error: "Failed to register" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.errors });
      }

      const { username, password } = parsed.data;

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      req.session.userId = user.id;

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
      });
    } catch (error) {
      console.error("Error logging in:", error);
      res.status(500).json({ error: "Failed to log in" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to log out" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });

  app.post("/api/auth/demo", async (req, res) => {
    try {
      const demoUsername = "demo";
      let user = await storage.getUserByUsername(demoUsername);

      if (!user) {
        const hashedPassword = await bcrypt.hash("demo123456", 10);
        user = await storage.createUser({
          username: demoUsername,
          email: "demo@attendanceautomator.com",
          password: hashedPassword,
          displayName: "Demo User",
        });

        const now = new Date();
        const seedRecords = [
          {
            userId: user.id,
            senderName: "Maria Garcia",
            senderEmail: "maria.garcia@university.edu",
            receivedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            emailBody: "Good morning, I woke up with a severe migraine and nausea this morning. I've already scheduled a doctor's appointment for 10 AM. I won't be able to make it to today's session. I'll make sure to review the materials and catch up with a classmate. Thank you for understanding.",
            excuseCategory: "Sick/Medical",
            messageSnippet: "Good morning, I woke up with a severe migraine and nausea this morning. I've already scheduled a doctor's appointment for 10 AM. I won't be able to make ...",
            status: "processed",
            batchId: "demo-batch-001",
          },
          {
            userId: user.id,
            senderName: "James Wilson",
            senderEmail: "j.wilson@university.edu",
            receivedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            emailBody: "Hi, I have a program-wide networking event today that conflicts with the builder session. Our program director said attendance at the event is required for all participants. I'll be back for the next session.",
            excuseCategory: "Program Event",
            messageSnippet: "Hi, I have a program-wide networking event today that conflicts with the builder session. Our program director said attendance at the event is required fo...",
            status: "processed",
            batchId: "demo-batch-001",
          },
          {
            userId: user.id,
            senderName: "Aisha Patel",
            senderEmail: "aisha.p@university.edu",
            receivedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
            emailBody: "Hello, my grandmother is visiting from out of state and this is the only day our family can all get together. I have a family dinner tonight and need to help with preparations during the day. I apologize for the short notice.",
            excuseCategory: "Personal",
            messageSnippet: "Hello, my grandmother is visiting from out of state and this is the only day our family can all get together. I have a family dinner tonight and need to ...",
            status: "processed",
            batchId: "demo-batch-001",
          },
          {
            userId: user.id,
            senderName: "Tyler Brooks",
            senderEmail: "tbrooks@university.edu",
            receivedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
            emailBody: "My internet has been down since last night and the ISP says they can't send a technician until this afternoon. I've tried using my mobile hotspot but the connection keeps dropping. I won't be able to participate in today's remote session.",
            excuseCategory: "Technical Issue",
            messageSnippet: "My internet has been down since last night and the ISP says they can't send a technician until this afternoon. I've tried using my mobile hotspot but the...",
            status: "processed",
            batchId: "demo-batch-001",
          },
          {
            userId: user.id,
            senderName: "Sarah Chen",
            senderEmail: "sarah.chen@university.edu",
            receivedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
            emailBody: "Hi, I need to pick up a prescription and handle some errands that I've been putting off. I'll try to join the afternoon portion if possible.",
            excuseCategory: "Other",
            messageSnippet: "Hi, I need to pick up a prescription and handle some errands that I've been putting off. I'll try to join the afternoon portion if possible.",
            status: "processed",
            batchId: "demo-batch-001",
          },
          {
            userId: user.id,
            senderName: "Devon Kim",
            senderEmail: "devon.kim@university.edu",
            receivedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
            emailBody: "Hey, I just can't make it today. Something came up.",
            excuseCategory: "Unexcused",
            messageSnippet: "Hey, I just can't make it today. Something came up.",
            status: "processed",
            batchId: "demo-batch-001",
          },
        ];

        await storage.createRecords(seedRecords as any);
      }

      req.session.userId = user.id;

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
      });
    } catch (error) {
      console.error("Error with demo login:", error);
      res.status(500).json({ error: "Failed to start demo" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      googleId: user.googleId || null,
    });
  });
}
