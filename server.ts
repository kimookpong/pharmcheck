import "dotenv/config";
import express from "express";
import path from "path";
import pg from "pg";
import { OAuth2Client } from "google-auth-library";

const { Pool } = pg;
const clientId = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const oauthClient = new OAuth2Client(clientId);

const app = express();
app.use(express.json());

const PORT = 3000;

// The connection string is read from the environment variable with a robust fallback to the neon postgres database
const connectionString = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_4Eh9JdvuoSqs@ep-calm-base-aoy5rg03-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

// Database initialization
async function initializeDb() {
  console.log("Checking and initializing Neon PostgreSQL tables...");
  let client;
  try {
    client = await pool.connect();
    
    // Create subjects table
    await client.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        teacher_uid VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Rename old sessions to class_sessions if needed
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS(SELECT *
          FROM information_schema.tables
          WHERE table_name='sessions'
          AND table_schema='public')
        THEN
          IF EXISTS(SELECT column_name FROM information_schema.columns WHERE table_name='sessions' AND column_name='subject_name') THEN
            ALTER TABLE sessions RENAME TO class_sessions;
          END IF;
        END IF;
      END $$;
    `);

    // Create class_sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS class_sessions (
        id VARCHAR(100) PRIMARY KEY,
        subject_name VARCHAR(255) NOT NULL,
        duration INT NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        radius DOUBLE PRECISION NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMPTZ NOT NULL,
        teacher_uid VARCHAR(100) NOT NULL,
        teacher_name VARCHAR(255) NOT NULL,
        teacher_email VARCHAR(255) NOT NULL
      );
    `);

    // Create attendances table
    await client.query(`
      CREATE TABLE IF NOT EXISTS attendances (
        id VARCHAR(255) PRIMARY KEY,
        session_id VARCHAR(100) NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
        student_uid VARCHAR(100) NOT NULL,
        student_name VARCHAR(255) NOT NULL,
        student_email VARCHAR(255) NOT NULL,
        student_id VARCHAR(100) NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        distance DOUBLE PRECISION NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) NOT NULL
      );
    `);

    // Create Auth.js tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS verification_token (
        identifier TEXT NOT NULL,
        expires TIMESTAMPTZ NOT NULL,
        token TEXT NOT NULL,
        PRIMARY KEY (identifier, token)
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL,
        "userId" INTEGER NOT NULL,
        type VARCHAR(255) NOT NULL,
        provider VARCHAR(255) NOT NULL,
        "providerAccountId" VARCHAR(255) NOT NULL,
        refresh_token TEXT,
        access_token TEXT,
        expires_at BIGINT,
        id_token TEXT,
        scope TEXT,
        session_state TEXT,
        token_type TEXT,
        PRIMARY KEY (id)
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL,
        "userId" INTEGER NOT NULL,
        expires TIMESTAMPTZ NOT NULL,
        "sessionToken" VARCHAR(255) NOT NULL,
        PRIMARY KEY (id)
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL,
        name VARCHAR(255),
        email VARCHAR(255),
        "emailVerified" TIMESTAMPTZ,
        image TEXT,
        PRIMARY KEY (id)
      );
    `);

    console.log("Neon PostgreSQL database tables checked and verified successfully!");
  } catch (err) {
    console.error("Database schema initialization failed. Double check your credentials/network:", err);
  } finally {
    if (client) client.release();
  }
}

// Invoke DB schema setup only if not on Vercel to prevent Lambda freezing issues
if (!process.env.VERCEL) {
  initializeDb();
}

// -------------------------------------------------------------
// Authentication Endpoint
// -------------------------------------------------------------
app.post("/api/auth/verify", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: "No credential provided" });
    }
    const ticket = await oauthClient.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (!payload) throw new Error("Invalid token payload");
    
    res.json({
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
      sub: payload.sub
    });
  } catch (error: any) {
    console.error("Token verification failed:", error);
    res.status(401).json({ error: "Unauthorized" });
  }
});

// -------------------------------------------------------------
// API Endpoints for PharmCheck Smart QR & Geo Radar System
// -------------------------------------------------------------

// 1. Subjects Endpoints
app.get("/api/subjects", async (req, res) => {
  try {
    const { teacherUid } = req.query;
    if (!teacherUid) {
      return res.status(400).json({ error: "teacherUid parameter is required" });
    }
    const result = await pool.query(
      `SELECT id, name, teacher_uid AS "teacherUid", created_at AS "createdAt" 
       FROM subjects 
       WHERE teacher_uid = $1 
       ORDER BY created_at DESC`,
      [teacherUid]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error("GET /api/subjects error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/subjects", async (req, res) => {
  try {
    const { name, teacherUid } = req.body;
    if (!name || !teacherUid) {
      return res.status(400).json({ error: "name and teacherUid are required" });
    }
    const id = "sub_" + Math.random().toString(36).substring(2, 11);
    const createdAt = new Date().toISOString();
    await pool.query(
      `INSERT INTO subjects (id, name, teacher_uid, created_at) 
       VALUES ($1, $2, $3, $4)`,
      [id, name, teacherUid, createdAt]
    );
    res.status(201).json({ id, name, teacherUid, createdAt });
  } catch (err: any) {
    console.error("POST /api/subjects error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/subjects/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM subjects WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/subjects error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Sessions Endpoints
app.get("/api/sessions", async (req, res) => {
  try {
    const { teacherUid } = req.query;
    let queryStr = `
      SELECT id, subject_name AS "subjectName", duration, latitude, longitude, radius, active, 
             created_at AS "createdAt", expires_at AS "expiresAt", teacher_uid AS "teacherUid", 
             teacher_name AS "teacherName", teacher_email AS "teacherEmail" 
      FROM class_sessions
    `;
    const params = [];
    if (teacherUid) {
      queryStr += " WHERE teacher_uid = $1";
      params.push(teacherUid);
    }
    queryStr += " ORDER BY created_at DESC";
    
    const result = await pool.query(queryStr, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error("GET /api/sessions error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/sessions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, subject_name AS "subjectName", duration, latitude, longitude, radius, active, 
              created_at AS "createdAt", expires_at AS "expiresAt", teacher_uid AS "teacherUid", 
              teacher_name AS "teacherName", teacher_email AS "teacherEmail" 
       FROM class_sessions 
       WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error("GET /api/sessions/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/sessions", async (req, res) => {
  try {
    const { subjectName, duration, latitude, longitude, radius, teacherUid, teacherName, teacherEmail } = req.body;
    if (!subjectName || !teacherUid) {
      return res.status(400).json({ error: "subjectName and teacherUid are required" });
    }
    
    const id = "session_" + Math.random().toString(36).substring(2, 11);
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + (duration || 15) * 60 * 1000).toISOString();
    
    await pool.query(
      `INSERT INTO class_sessions 
       (id, subject_name, duration, latitude, longitude, radius, active, created_at, expires_at, teacher_uid, teacher_name, teacher_email) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id, 
        subjectName, 
        duration || 15, 
        latitude || 0, 
        longitude || 0, 
        radius || 10, 
        true, 
        createdAt, 
        expiresAt, 
        teacherUid, 
        teacherName, 
        teacherEmail
      ]
    );
    
    res.status(201).json({
      id,
      subjectName,
      duration: duration || 15,
      latitude: latitude || 0,
      longitude: longitude || 0,
      radius: radius || 10,
      active: true,
      createdAt,
      expiresAt,
      teacherUid,
      teacherName,
      teacherEmail
    });
  } catch (err: any) {
    console.error("POST /api/sessions error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/sessions/:id/toggle", async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    await pool.query("UPDATE class_sessions SET active = $1 WHERE id = $2", [active === true, id]);
    res.json({ success: true, active: active === true });
  } catch (err: any) {
    console.error("POST /api/sessions/:id/toggle error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Attendances Endpoints
app.get("/api/sessions/:id/attendances", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, session_id AS "sessionId", student_uid AS "studentUid", student_name AS "studentName", 
              student_email AS "studentEmail", student_id AS "studentId", latitude, longitude, distance, 
              timestamp, status 
       FROM attendances 
       WHERE session_id = $1 
       ORDER BY timestamp DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error("GET /api/sessions/:id/attendances error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/sessions/:id/attendances", async (req, res) => {
  try {
    const { id: sessionId } = req.params;
    const { studentUid, studentName, studentEmail, studentId, latitude, longitude, distance, status } = req.body;
    
    if (!studentUid || !studentName) {
      return res.status(400).json({ error: "studentUid and studentName are required" });
    }
    
    const id = `${studentUid}_${sessionId}`;
    const timestamp = new Date().toISOString();

    await pool.query(
      `INSERT INTO attendances 
       (id, session_id, student_uid, student_name, student_email, student_id, latitude, longitude, distance, timestamp, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET 
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         distance = EXCLUDED.distance,
         timestamp = EXCLUDED.timestamp,
         status = EXCLUDED.status`,
      [
        id, 
        sessionId, 
        studentUid, 
        studentName, 
        studentEmail || "", 
        studentId || "", 
        latitude || 0, 
        longitude || 0, 
        distance || 0, 
        timestamp, 
        status || "present"
      ]
    );

    res.status(200).json({
      id,
      sessionId,
      studentUid,
      studentName,
      studentEmail,
      studentId,
      latitude,
      longitude,
      distance,
      timestamp,
      status
    });
  } catch (err: any) {
    console.error("POST /api/sessions/:id/attendances error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend assets
async function startServer() {
  if (process.env.VERCEL) return; // Do not start dev server on Vercel

  if (process.env.NODE_ENV !== "production") {
    // Obfuscate Vite import so Vercel's Node File Trace doesn't bundle it
    const viteMod = "vi" + "te";
    const { createServer: createViteServer } = await import(viteMod);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (process.env.VERCEL) {
    // Vercel Serverless Function will handle listening, so we just return
    return;
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PharmCheck server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

export default app;
