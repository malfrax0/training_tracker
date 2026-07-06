import { Pool } from 'pg';
import { env } from '../config/env';
import { INITIAL_MIGRATION, MIGRATION_V2, MIGRATION_V3, MIGRATION_V3_BACKFILL } from './schema';

async function migrate() {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(INITIAL_MIGRATION);
    await client.query(MIGRATION_V2);
    await client.query(MIGRATION_V3);
    await client.query(MIGRATION_V3_BACKFILL);
    console.log('Migration completed successfully');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
