import fp from 'fastify-plugin';
import fastifyPostgres from '@fastify/postgres';
import { env } from '../config/env';
import { INITIAL_MIGRATION } from '../migrations/schema';

export const postgresPlugin = fp(async (fastify) => {
  await fastify.register(fastifyPostgres, {
    connectionString: env.DATABASE_URL,
  });

  const client = await fastify.pg.connect();
  try {
    await client.query(INITIAL_MIGRATION);
    fastify.log.info('Database migrations applied');
  } finally {
    client.release();
  }
});
