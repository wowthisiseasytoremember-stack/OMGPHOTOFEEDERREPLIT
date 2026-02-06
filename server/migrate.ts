import pg from "pg";

export async function runMigrations() {
  console.log("=== Starting database migrations ===");
  
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL is not set, skipping migrations");
    return;
  }

  const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });

  const timeout = setTimeout(() => {
    console.error("=== Migration timed out after 10s, continuing anyway ===");
    pool.end().catch(() => {});
  }, 10000);

  try {
    console.log("Testing database connection...");
    const testResult = await pool.query("SELECT NOW()");
    console.log("Database connected:", testResult.rows[0].now);
    
    console.log("Creating items table if not exists...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        brand TEXT,
        edition TEXT,
        year TEXT,
        identifiers TEXT,
        vibes TEXT[],
        qty INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        added_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ambient_data JSONB,
        image_url TEXT
      )
    `);
    
    console.log("=== Database migrations completed! ===");
  } catch (error) {
    console.error("=== Migration error ===", error);
  } finally {
    clearTimeout(timeout);
    await pool.end().catch(() => {});
  }
}
