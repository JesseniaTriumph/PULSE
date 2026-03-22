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

      const { username, email, password, displayName, role } = parsed.data;

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
        role: role || "instructor",
      });

      await storage.createScanConfig({ userId: user.id, scanTime: "10:00", enabled: true, scanGmail: true, scanSlack: true });
      await storage.createScanConfig({ userId: user.id, scanTime: "14:00", enabled: true, scanGmail: true, scanSlack: true });
      await storage.createScanConfig({ userId: user.id, scanTime: "18:25", enabled: true, scanGmail: true, scanSlack: true });
      await storage.createScanConfig({ userId: user.id, scanTime: "20:00", enabled: true, scanGmail: true, scanSlack: true });
      await storage.createScanConfig({ userId: user.id, scanTime: "21:55", enabled: true, scanGmail: true, scanSlack: true });

      req.session.userId = user.id;

      res.status(201).json({
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
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
        role: user.role,
        googleId: user.googleId || null,
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

      if (user && user.role !== "admin") {
        await storage.updateUser(user.id, { role: "admin", displayName: "Admin Demo" });
        user = await storage.getUserById(user.id);
      }

      const existingCohorts = await storage.getAllCohorts();
      const needsSeeding = existingCohorts.length === 0;

      if (!user) {
        const hashedPassword = await bcrypt.hash("demo123456", 10);
        user = await storage.createUser({
          username: demoUsername,
          email: "demo@attendanceautomator.com",
          password: hashedPassword,
          displayName: "Admin Demo",
          role: "admin",
        });
      }

      if (needsSeeding) {
        const scanConfigs = await storage.getScanConfigsByUser(user!.id);
        if (scanConfigs.length === 0) {
          await storage.createScanConfig({ userId: user!.id, scanTime: "10:00", enabled: true, scanGmail: true, scanSlack: true });
          await storage.createScanConfig({ userId: user!.id, scanTime: "14:00", enabled: true, scanGmail: true, scanSlack: true });
          await storage.createScanConfig({ userId: user!.id, scanTime: "18:25", enabled: true, scanGmail: true, scanSlack: true });
          await storage.createScanConfig({ userId: user!.id, scanTime: "20:00", enabled: true, scanGmail: true, scanSlack: true });
          await storage.createScanConfig({ userId: user!.id, scanTime: "21:55", enabled: true, scanGmail: true, scanSlack: true });
        }

        const instructorPassword = await bcrypt.hash("instructor123", 10);
        let instructor1 = await storage.getUserByUsername("instructor_smith");
        if (!instructor1) {
          instructor1 = await storage.createUser({
            username: "instructor_smith",
            email: "smith@university.edu",
            password: instructorPassword,
            displayName: "Prof. Smith",
            role: "instructor",
          });
        }
        let instructor2 = await storage.getUserByUsername("instructor_jones");
        if (!instructor2) {
          instructor2 = await storage.createUser({
            username: "instructor_jones",
            email: "jones@university.edu",
            password: instructorPassword,
            displayName: "Prof. Jones",
            role: "instructor",
          });
        }

        const cohortL1 = await storage.createCohort({ name: "L1", instructorId: instructor1.id });
        const cohortL2 = await storage.createCohort({ name: "L2", instructorId: instructor1.id });
        const cohortL3 = await storage.createCohort({ name: "L3", instructorId: instructor2.id });
        const cohortLinf = await storage.createCohort({ name: "L∞", instructorId: instructor2.id });

        const l1Students = [
          { name: "Maria Garcia", email: "maria.garcia@university.edu", cohortId: cohortL1.id },
          { name: "James Wilson", email: "j.wilson@university.edu", cohortId: cohortL1.id },
          { name: "Aisha Patel", email: "aisha.p@university.edu", cohortId: cohortL1.id },
          { name: "Tyler Brooks", email: "tbrooks@university.edu", cohortId: cohortL1.id },
        ];
        const l2Students = [
          { name: "Sarah Chen", email: "sarah.chen@university.edu", cohortId: cohortL2.id },
          { name: "Devon Kim", email: "devon.kim@university.edu", cohortId: cohortL2.id },
          { name: "Alex Rivera", email: "alex.r@university.edu", cohortId: cohortL2.id },
        ];
        const l3Students = [
          { name: "Jordan Lee", email: "jordan.lee@university.edu", cohortId: cohortL3.id },
          { name: "Kim Park", email: "kim.park@university.edu", cohortId: cohortL3.id },
          { name: "Casey Morgan", email: "casey.m@university.edu", cohortId: cohortL3.id },
        ];
        const linfStudents = [
          { name: "Robin Taylor", email: "robin.t@university.edu", cohortId: cohortLinf.id },
          { name: "Sam Martinez", email: "sam.m@university.edu", cohortId: cohortLinf.id },
        ];

        const allStudentData = [...l1Students, ...l2Students, ...l3Students, ...linfStudents];
        const createdStudents: any[] = [];
        for (const s of allStudentData) {
          const created = await storage.createStudent(s);
          createdStudents.push(created);
        }

        await storage.createScheduleEntry({ cohortId: cohortL1.id, dayOfWeek: 1, startTime: "09:00", endTime: "12:00", label: "Morning Session" });
        await storage.createScheduleEntry({ cohortId: cohortL1.id, dayOfWeek: 1, startTime: "13:00", endTime: "17:00", label: "Afternoon Lab" });
        await storage.createScheduleEntry({ cohortId: cohortL1.id, dayOfWeek: 3, startTime: "09:00", endTime: "12:00", label: "Workshop" });
        await storage.createScheduleEntry({ cohortId: cohortL1.id, dayOfWeek: 5, startTime: "10:00", endTime: "14:00", label: "Project Time" });
        await storage.createScheduleEntry({ cohortId: cohortL2.id, dayOfWeek: 2, startTime: "09:00", endTime: "12:00", label: "Morning Session" });
        await storage.createScheduleEntry({ cohortId: cohortL2.id, dayOfWeek: 4, startTime: "09:00", endTime: "12:00", label: "Workshop" });
        await storage.createScheduleEntry({ cohortId: cohortL3.id, dayOfWeek: 1, startTime: "14:00", endTime: "17:00", label: "Advanced Lab" });
        await storage.createScheduleEntry({ cohortId: cohortL3.id, dayOfWeek: 3, startTime: "14:00", endTime: "17:00", label: "Seminar" });
        await storage.createScheduleEntry({ cohortId: cohortLinf.id, dayOfWeek: 2, startTime: "14:00", endTime: "17:00", label: "Research Block" });
        await storage.createScheduleEntry({ cohortId: cohortLinf.id, dayOfWeek: 4, startTime: "14:00", endTime: "17:00", label: "Independent Study" });

        const now = new Date();
        const seedRecords = [
          {
            userId: instructor1.id,
            studentId: createdStudents[0].id,
            senderName: "Maria Garcia",
            senderEmail: "maria.garcia@university.edu",
            receivedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            emailBody: "Good morning, I woke up with a severe migraine and nausea this morning. I've already scheduled a doctor's appointment for 10 AM. I won't be able to make it to today's session.",
            attendanceType: "Absent",
            excuseCategory: "Medical",
            messageSnippet: "Good morning, I woke up with a severe migraine and nausea this morning. I've already scheduled a doctor's appointment for 10 AM. I won't be able to make ...",
            status: "processed",
            batchId: "demo-batch-001",
            needsResponse: false,
            urgency: "low",
            source: "gmail",
            emailSubject: "Absent today — migraine",
          },
          {
            userId: instructor1.id,
            studentId: createdStudents[1].id,
            senderName: "James Wilson",
            senderEmail: "j.wilson@university.edu",
            receivedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            emailBody: "Hi, I have a program-wide networking event today. Our program director said attendance is required. I'll be back for the next session.",
            attendanceType: "Absent",
            excuseCategory: "Administrative",
            messageSnippet: "Hi, I have a program-wide networking event today. Our program director said attendance is required. I'll be back for the next session.",
            status: "processed",
            batchId: "demo-batch-001",
            needsResponse: false,
            urgency: "low",
            source: "gmail",
            emailSubject: "Out for networking event",
          },
          {
            userId: instructor1.id,
            studentId: createdStudents[2].id,
            senderName: "Aisha Patel",
            senderEmail: "aisha.p@university.edu",
            receivedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
            emailBody: "Hello, my grandmother is visiting from out of state and this is the only day our family can all get together. I apologize for the short notice. Can I get the materials I'll miss?",
            attendanceType: "Absent",
            excuseCategory: "Family",
            messageSnippet: "Hello, my grandmother is visiting from out of state and this is the only day our family can all get together. I apologize for the short notice. Can I ge...",
            status: "processed",
            batchId: "demo-batch-001",
            needsResponse: true,
            urgency: "medium",
            alertReason: "Student is asking for materials they will miss",
            source: "gmail",
            emailSubject: "Family visit — absent today",
          },
          {
            userId: instructor1.id,
            studentId: createdStudents[3].id,
            senderName: "Tyler Brooks",
            senderEmail: "tbrooks@university.edu",
            receivedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
            emailBody: "My internet has been down since last night. I won't be able to participate in today's remote session.",
            attendanceType: "Absent",
            excuseCategory: "Technical",
            messageSnippet: "My internet has been down since last night. I won't be able to participate in today's remote session.",
            status: "processed",
            batchId: "demo-batch-001",
            needsResponse: false,
            urgency: "low",
            source: "slack",
            slackChannelName: "#l1-attendance",
            slackChannelId: "C01DEMO001",
            slackMessageTs: "1709100000.000100",
            slackIsDm: false,
          },
          {
            userId: instructor1.id,
            studentId: createdStudents[4].id,
            senderName: "Sarah Chen",
            senderEmail: "sarah.chen@university.edu",
            receivedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
            emailBody: "Hi, I have a job interview at 2 PM today and need to leave early. Is it okay if I skip the afternoon portion? Also, will there be a recording of the session?",
            attendanceType: "Late/Tardy",
            excuseCategory: "Other",
            messageSnippet: "Hi, I have a job interview at 2 PM today and need to leave early. Is it okay if I skip the afternoon portion? Also, will there be a recording of the ses...",
            status: "processed",
            batchId: "demo-batch-001",
            needsResponse: true,
            urgency: "high",
            alertReason: "Student has a job interview and is asking about leaving early and whether there will be a recording",
            source: "gmail",
            emailSubject: "Leaving early — job interview",
          },
          {
            userId: instructor2.id,
            studentId: createdStudents[7].id,
            senderName: "Jordan Lee",
            senderEmail: "jordan.lee@university.edu",
            receivedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
            emailBody: "Hey, I'm stuck in traffic and running about 20 minutes late. Sorry!",
            attendanceType: "Late/Tardy",
            excuseCategory: "Technical",
            messageSnippet: "Hey, I'm stuck in traffic and running about 20 minutes late. Sorry!",
            status: "processed",
            batchId: "demo-batch-001",
            needsResponse: false,
            urgency: "low",
            source: "slack",
            slackIsDm: true,
            slackMessageTs: "1709100000.000200",
          },
          {
            userId: instructor2.id,
            studentId: createdStudents[5].id,
            senderName: "Devon Kim",
            senderEmail: "devon.kim@university.edu",
            receivedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
            emailBody: "Hey, I just can't make it today. Something came up.",
            attendanceType: "Unexcused",
            excuseCategory: "Unexcused",
            messageSnippet: "Hey, I just can't make it today. Something came up.",
            status: "processed",
            batchId: "demo-batch-001",
            needsResponse: false,
            urgency: "low",
            source: "slack",
            slackChannelName: "#l3-general",
            slackChannelId: "C01DEMO003",
            slackMessageTs: "1709100000.000300",
            slackIsDm: false,
          },
        ];

        for (const record of seedRecords) {
          const created = await storage.createRecord(record as any);
          if ((record as any).needsResponse && (record as any).alertReason) {
            await storage.createAlert({
              userId: record.userId,
              recordId: created.id,
              alertType: (record as any).urgency === "high" ? "urgent" : "action_needed",
              message: (record as any).alertReason,
              urgency: (record as any).urgency || "low",
            });
          }
        }
      }

      req.session.userId = user.id;

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        googleId: user.googleId || null,
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
      role: user.role,
      googleId: user.googleId || null,
    });
  });
}
