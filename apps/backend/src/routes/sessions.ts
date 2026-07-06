import { FastifyInstance } from 'fastify';

interface SessionBody {
  name: string;
  description?: string;
}

interface ScheduleBody {
  days: number[];
}

interface SessionParams {
  id: string;
}

export async function sessionRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };

  fastify.get('/sessions', auth, async (request) => {
    const client = await fastify.pg.connect();
    try {
      const { rows: sessions } = await client.query(
        `SELECT id, name, description, created_at, updated_at
         FROM sessions WHERE user_id = $1 ORDER BY created_at DESC`,
        [request.user.sub]
      );

      const { rows: schedules } = await client.query(
        `SELECT session_id, day_of_week FROM session_schedules
         WHERE session_id = ANY($1::uuid[])`,
        [sessions.map((s: { id: string }) => s.id)]
      );

      const { rows: exercises } = await client.query(
        `SELECT id, session_id, name, description, nb_series, default_weight_kg,
                default_reps, rest_timer_seconds, dumbbell_type, sort_order, image_data
         FROM exercises WHERE session_id = ANY($1::uuid[])
         ORDER BY sort_order ASC`,
        [sessions.map((s: { id: string }) => s.id)]
      );

      return sessions.map((session: { id: string; name: string; description: string | null; created_at: Date; updated_at: Date }) => ({
        id: session.id,
        name: session.name,
        description: session.description,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        schedule: schedules
          .filter((sc: { session_id: string }) => sc.session_id === session.id)
          .map((sc: { day_of_week: number }) => sc.day_of_week),
        exercises: exercises
          .filter((ex: { session_id: string }) => ex.session_id === session.id)
          .map(mapExercise),
      }));
    } finally {
      client.release();
    }
  });

  fastify.get<{ Params: SessionParams }>('/sessions/:id', auth, async (request, reply) => {
    const client = await fastify.pg.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, name, description, created_at, updated_at
         FROM sessions WHERE id = $1 AND user_id = $2`,
        [request.params.id, request.user.sub]
      );
      if (!rows[0]) return reply.status(404).send({ error: 'Session not found' });

      const { rows: schedules } = await client.query(
        `SELECT day_of_week FROM session_schedules WHERE session_id = $1`,
        [request.params.id]
      );

      const { rows: exercises } = await client.query(
        `SELECT id, session_id, name, description, nb_series, default_weight_kg,
                default_reps, rest_timer_seconds, dumbbell_type, sort_order, image_data
         FROM exercises WHERE session_id = $1 ORDER BY sort_order ASC`,
        [request.params.id]
      );

      const session = rows[0];
      return {
        id: session.id,
        name: session.name,
        description: session.description,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        schedule: schedules.map((sc: { day_of_week: number }) => sc.day_of_week),
        exercises: exercises.map(mapExercise),
      };
    } finally {
      client.release();
    }
  });

  fastify.post<{ Body: SessionBody }>('/sessions', auth, async (request, reply) => {
    const { name, description } = request.body;
    const client = await fastify.pg.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO sessions (user_id, name, description)
         VALUES ($1, $2, $3) RETURNING id, name, description, created_at, updated_at`,
        [request.user.sub, name, description ?? null]
      );
      const session = rows[0];
      return reply.status(201).send({
        id: session.id,
        name: session.name,
        description: session.description,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        schedule: [],
        exercises: [],
      });
    } finally {
      client.release();
    }
  });

  fastify.put<{ Params: SessionParams; Body: SessionBody }>(
    '/sessions/:id',
    auth,
    async (request, reply) => {
      const { name, description } = request.body;
      const client = await fastify.pg.connect();
      try {
        const { rowCount } = await client.query(
          `UPDATE sessions SET name = $1, description = $2, updated_at = NOW()
           WHERE id = $3 AND user_id = $4`,
          [name, description ?? null, request.params.id, request.user.sub]
        );
        if (!rowCount) return reply.status(404).send({ error: 'Session not found' });
        return { success: true };
      } finally {
        client.release();
      }
    }
  );

  fastify.delete<{ Params: SessionParams }>('/sessions/:id', auth, async (request, reply) => {
    const client = await fastify.pg.connect();
    try {
      const { rowCount } = await client.query(
        `DELETE FROM sessions WHERE id = $1 AND user_id = $2`,
        [request.params.id, request.user.sub]
      );
      if (!rowCount) return reply.status(404).send({ error: 'Session not found' });
      return { success: true };
    } finally {
      client.release();
    }
  });

  fastify.put<{ Params: SessionParams; Body: ScheduleBody }>(
    '/sessions/:id/schedules',
    auth,
    async (request, reply) => {
      const { days } = request.body;
      const client = await fastify.pg.connect();
      try {
        const { rowCount } = await client.query(
          `SELECT 1 FROM sessions WHERE id = $1 AND user_id = $2`,
          [request.params.id, request.user.sub]
        );
        if (!rowCount) return reply.status(404).send({ error: 'Session not found' });

        await client.query('DELETE FROM session_schedules WHERE session_id = $1', [
          request.params.id,
        ]);

        if (days.length > 0) {
          const values = days.map((d, i) => `($1, $${i + 2})`).join(', ');
          await client.query(
            `INSERT INTO session_schedules (session_id, day_of_week) VALUES ${values}`,
            [request.params.id, ...days]
          );
        }

        return { success: true, days };
      } finally {
        client.release();
      }
    }
  );
}

function mapExercise(row: {
  id: string;
  session_id: string;
  name: string;
  description: string | null;
  nb_series: number;
  default_weight_kg: number;
  default_reps: number;
  rest_timer_seconds: number;
  dumbbell_type: string;
  sort_order: number;
  image_data: string | null;
}) {
  return {
    id: row.id,
    sessionId: row.session_id,
    name: row.name,
    description: row.description,
    nbSeries: row.nb_series,
    defaultWeightKg: parseFloat(String(row.default_weight_kg)),
    defaultReps: row.default_reps ?? 8,
    restTimerSeconds: row.rest_timer_seconds,
    dumbbellType: row.dumbbell_type ?? 'none',
    sortOrder: row.sort_order,
    imageData: row.image_data,
  };
}
