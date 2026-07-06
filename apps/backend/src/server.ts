import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import { env } from './config/env';
import { postgresPlugin } from './plugins/postgres';
import { authPlugin } from './plugins/auth';
import { healthRoutes } from './routes/health';
import { sessionRoutes } from './routes/sessions';
import { exerciseRoutes } from './routes/exercises';
import { exerciseImageRoutes } from './routes/exerciseImages';
import { workoutRoutes } from './routes/workouts';

const server = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'warn' : 'info',
  },
});

async function start() {
  await server.register(fastifyHelmet, { contentSecurityPolicy: false });
  await server.register(fastifyCors, { origin: env.CORS_ORIGIN });

  await server.register(postgresPlugin);
  await server.register(authPlugin);

  await server.register(healthRoutes);
  await server.register(sessionRoutes, { prefix: '/api' });
  await server.register(exerciseRoutes, { prefix: '/api' });
  await server.register(exerciseImageRoutes, { prefix: '/api' });
  await server.register(workoutRoutes, { prefix: '/api' });

  await server.listen({ port: env.PORT, host: '0.0.0.0' });
  server.log.info(`Server running on port ${env.PORT}`);
}

start().catch((err) => {
  server.log.error(err);
  process.exit(1);
});
