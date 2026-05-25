import { FastifyInstance } from 'fastify';
import type { PoolClient } from 'pg';

interface ExerciseParams {
  sessionId?: string;
  id?: string;
}

interface ExerciseBody {
  name: string;
  description?: string;
  nbSeries: number;
  defaultWeightKg: number;
  restTimerSeconds: number;
  sortOrder?: number;
}

interface ReorderBody {
  orderedIds: string[];
}

export async function exerciseRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };

  fastify.get<{ Params: ExerciseParams }>(
    '/sessions/:sessionId/exercises',
    auth,
    async (request, reply) => {
      const client = await fastify.pg.connect();
      try {
        const owned = await ownsSession(client, request.params.sessionId!, request.user.sub);
        if (!owned) return reply.status(404).send({ error: 'Session not found' });

        const { rows } = await client.query(
          `SELECT id, session_id, name, description, nb_series, default_weight_kg,
                  rest_timer_seconds, sort_order
           FROM exercises WHERE session_id = $1 ORDER BY sort_order ASC`,
          [request.params.sessionId]
        );
        return rows.map(mapExercise);
      } finally {
        client.release();
      }
    }
  );

  fastify.post<{ Params: ExerciseParams; Body: ExerciseBody }>(
    '/sessions/:sessionId/exercises',
    auth,
    async (request, reply) => {
      const { name, description, nbSeries, defaultWeightKg, restTimerSeconds, sortOrder } =
        request.body;
      const client = await fastify.pg.connect();
      try {
        const owned = await ownsSession(client, request.params.sessionId!, request.user.sub);
        if (!owned) return reply.status(404).send({ error: 'Session not found' });

        const { rows: maxRows } = await client.query(
          `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM exercises WHERE session_id = $1`,
          [request.params.sessionId]
        );
        const nextOrder = sortOrder ?? (maxRows[0].max_order as number) + 1;

        const { rows } = await client.query(
          `INSERT INTO exercises (session_id, name, description, nb_series, default_weight_kg, rest_timer_seconds, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, session_id, name, description, nb_series, default_weight_kg, rest_timer_seconds, sort_order`,
          [
            request.params.sessionId,
            name,
            description ?? null,
            nbSeries,
            defaultWeightKg,
            restTimerSeconds,
            nextOrder,
          ]
        );
        return reply.status(201).send(mapExercise(rows[0]));
      } finally {
        client.release();
      }
    }
  );

  fastify.put<{ Params: ExerciseParams; Body: ExerciseBody }>(
    '/exercises/:id',
    auth,
    async (request, reply) => {
      const { name, description, nbSeries, defaultWeightKg, restTimerSeconds, sortOrder } =
        request.body;
      const client = await fastify.pg.connect();
      try {
        const { rowCount } = await client.query(
          `UPDATE exercises e
           SET name = $1, description = $2, nb_series = $3, default_weight_kg = $4,
               rest_timer_seconds = $5, sort_order = COALESCE($6, e.sort_order)
           FROM sessions s
           WHERE e.id = $7 AND e.session_id = s.id AND s.user_id = $8`,
          [
            name,
            description ?? null,
            nbSeries,
            defaultWeightKg,
            restTimerSeconds,
            sortOrder ?? null,
            request.params.id,
            request.user.sub,
          ]
        );
        if (!rowCount) return reply.status(404).send({ error: 'Exercise not found' });
        return { success: true };
      } finally {
        client.release();
      }
    }
  );

  fastify.delete<{ Params: ExerciseParams }>(
    '/exercises/:id',
    auth,
    async (request, reply) => {
      const client = await fastify.pg.connect();
      try {
        const { rowCount } = await client.query(
          `DELETE FROM exercises e
           USING sessions s
           WHERE e.id = $1 AND e.session_id = s.id AND s.user_id = $2`,
          [request.params.id, request.user.sub]
        );
        if (!rowCount) return reply.status(404).send({ error: 'Exercise not found' });
        return { success: true };
      } finally {
        client.release();
      }
    }
  );

  fastify.put<{ Params: ExerciseParams; Body: ReorderBody }>(
    '/sessions/:sessionId/exercises/reorder',
    auth,
    async (request, reply) => {
      const client = await fastify.pg.connect();
      try {
        const owned = await ownsSession(client, request.params.sessionId!, request.user.sub);
        if (!owned) return reply.status(404).send({ error: 'Session not found' });

        for (let i = 0; i < request.body.orderedIds.length; i++) {
          await client.query(
            `UPDATE exercises SET sort_order = $1 WHERE id = $2 AND session_id = $3`,
            [i, request.body.orderedIds[i], request.params.sessionId]
          );
        }
        return { success: true };
      } finally {
        client.release();
      }
    }
  );
}

async function ownsSession(
  client: PoolClient,
  sessionId: string,
  userId: string
): Promise<boolean> {
  const { rowCount } = await client.query(
    `SELECT 1 FROM sessions WHERE id = $1 AND user_id = $2`,
    [sessionId, userId]
  );
  return (rowCount ?? 0) > 0;
}

function mapExercise(row: {
  id: string;
  session_id: string;
  name: string;
  description: string | null;
  nb_series: number;
  default_weight_kg: number;
  rest_timer_seconds: number;
  sort_order: number;
}) {
  return {
    id: row.id,
    sessionId: row.session_id,
    name: row.name,
    description: row.description,
    nbSeries: row.nb_series,
    defaultWeightKg: parseFloat(String(row.default_weight_kg)),
    restTimerSeconds: row.rest_timer_seconds,
    sortOrder: row.sort_order,
  };
}
