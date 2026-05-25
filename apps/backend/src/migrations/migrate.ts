import { Pool } from 'pg';
import { env } from '../config/env';
import { INITIAL_MIGRATION } from './schema';

async function migrate() {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(INITIAL_MIGRATION);
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
