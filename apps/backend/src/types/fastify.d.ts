import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user: { sub: string };
  }

  interface FastifyInstance {
    authenticate: (
      request: import('fastify').FastifyRequest,
      reply: import('fastify').FastifyReply
    ) => Promise<void>;
  }
}
