import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Lazy initialization - only create pool when first used
let _pool: pg.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getPool(): pg.Pool {
  if (!_pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
    }
    _pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
    });
  }
  return _pool;
}

function getDb() {
  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}

// Export a proxy that lazily initializes the db
export const pool = new Proxy({} as pg.Pool, {
  get: (_target, prop) => {
    const p = getPool();
    const value = (p as any)[prop];
    return typeof value === 'function' ? value.bind(p) : value;
  }
});

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get: (_target, prop) => {
    const d = getDb();
    const value = (d as any)[prop];
    return typeof value === 'function' ? value.bind(d) : value;
  }
});
