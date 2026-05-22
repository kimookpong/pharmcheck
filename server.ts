import "dotenv/config";
import express from "express";
import path from "path";
import pg from "pg";

const { Pool } = pg;

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

    // Create user_profiles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        uid VARCHAR(100) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL,
        student_id VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Auth.js tables (Legacy - keeping for safety but no longer used)
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
      
      -- Grant permissions for Neon Data API
      GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT USAGE ON SCHEMA public TO anonymous;
      
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anonymous;
      
      -- Grant usage on sequences for SERIAL columns
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anonymous;

      -- Neon Data API requires explicit RLS policies if RLS is enabled by default or forced.
      -- We will enable RLS but add a permissive policy so the app functions correctly
      -- without complex auth mapping (since we validate on the client side for now).
      
      -- user_profiles
      ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "allow_all_user_profiles" ON user_profiles;
      CREATE POLICY "allow_all_user_profiles" ON user_profiles FOR ALL USING (true) WITH CHECK (true);

      -- subjects
      ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "allow_all_subjects" ON subjects;
      CREATE POLICY "allow_all_subjects" ON subjects FOR ALL USING (true) WITH CHECK (true);

      -- class_sessions
      ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "allow_all_class_sessions" ON class_sessions;
      CREATE POLICY "allow_all_class_sessions" ON class_sessions FOR ALL USING (true) WITH CHECK (true);

      -- attendances
      ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "allow_all_attendances" ON attendances;
      CREATE POLICY "allow_all_attendances" ON attendances FOR ALL USING (true) WITH CHECK (true);
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
// Note: All database queries are now handled directly by the frontend
// using the Neon Data API (@neondatabase/neon-js data client).
// This server now only acts as a Vite dev server and database initializer.
// -------------------------------------------------------------


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
