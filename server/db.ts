import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let drizzleDb: ReturnType<typeof drizzle> | null = null;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL must be set");
    }
    pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

export { getPool as pool };

export function getDb() {
  if (!drizzleDb) {
    drizzleDb = drizzle(getPool(), { schema });
  }
  return drizzleDb;
}

// For backwards compatibility
export const db = {
  get select() { return getDb().select.bind(getDb()); },
  get insert() { return getDb().insert.bind(getDb()); },
  get update() { return getDb().update.bind(getDb()); },
  get delete() { return getDb().delete.bind(getDb()); },
  get query() { return getDb().query; },
};
