import fp from 'fastify-plugin';
import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { env } from '../config/env';

const jwksClient = jwksRsa({
  jwksUri: `https://${env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
});

function resolveSigningKey(header: jwt.JwtHeader): Promise<string> {
  return new Promise((resolve, reject) => {
    jwksClient.getSigningKey(header.kid, (err, key) => {
      if (err) return reject(err);
      resolve(key!.getPublicKey());
    });
  });
}

function verifyAccessToken(token: string): Promise<jwt.JwtPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      (header, callback) => {
        resolveSigningKey(header)
          .then((key) => callback(null, key))
          .catch(callback);
      },
      {
        audience: env.AUTH0_AUDIENCE,
        issuer: `https://${env.AUTH0_DOMAIN}/`,
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded as jwt.JwtPayload);
      }
    );
  });
}

export const authPlugin = fp(async (fastify) => {
  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Missing authorization header' });
      }

      const token = authHeader.slice(7);
      let payload: jwt.JwtPayload;
      try {
        payload = await verifyAccessToken(token);
      } catch {
        return reply.status(401).send({ error: 'Invalid or expired token' });
      }

      request.user = { sub: payload.sub! };

      const client = await fastify.pg.connect();
      try {
        await client.query(
          'INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING',
          [payload.sub!]
        );
      } finally {
        client.release();
      }
    }
  );
});
