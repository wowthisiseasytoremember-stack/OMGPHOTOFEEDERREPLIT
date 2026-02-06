import { pool } from "./db";

export async function runMigrations() {
  console.log("Running database migrations...");
  
  try {
    // Create items table if it doesn't exist
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
    
    console.log("Database migrations completed successfully!");
  } catch (error) {
    console.error("Migration error:", error);
    throw error;
  }
}
