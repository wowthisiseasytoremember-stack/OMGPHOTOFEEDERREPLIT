import pg from "pg";

export async function runMigrations() {
  console.log("=== Starting database migrations ===");
  
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL is not set, skipping migrations");
    return;
  }

  // Set a timeout to prevent hanging
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Migration timed out after 10 seconds")), 10000);
  });

  const migrationPromise = (async () => {
    const pool = new pg.Pool({ 
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000, // 5 second connection timeout
    });

    try {
      // Test connection first
      console.log("Testing database connection...");
      const testResult = await pool.query("SELECT NOW()");
      console.log("Database connected:", testResult.rows[0].now);
      
      // Create items table if it doesn't exist
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
      
      // Verify table exists
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'items'
        )
      `);
      console.log("Table 'items' exists:", tableCheck.rows[0].exists);
      
      console.log("=== Database migrations completed successfully! ===");
    } finally {
      await pool.end();
    }
  })();

  try {
    await Promise.race([migrationPromise, timeoutPromise]);
  } catch (error) {
    console.error("=== Migration failed or timed out ===");
    console.error("Error:", error);
    // Don't throw - let the app start anyway
  }
}
