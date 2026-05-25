import { FastifyInstance } from 'fastify';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (_request, reply) => {
    const client = await fastify.pg.connect();
    try {
      await client.query('SELECT 1');
      return reply.send({ status: 'ok', database: 'connected' });
    } catch {
      return reply.status(503).send({ status: 'error', database: 'unreachable' });
    } finally {
      client.release();
    }
  });
}
