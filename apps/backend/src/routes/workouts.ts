import { FastifyInstance } from 'fastify';

interface WorkoutParams {
  id: string;
}

interface StartWorkoutBody {
  sessionId?: string;
}

interface LogSetBody {
  exerciseId: string;
  setNumber: number;
  weightKg: number;
}

interface WorkoutListQuery {
  from?: string;
  to?: string;
}

export async function workoutRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };

  fastify.post<{ Body: StartWorkoutBody }>('/workouts', auth, async (request, reply) => {
    const client = await fastify.pg.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO workout_logs (user_id, session_id)
         VALUES ($1, $2) RETURNING id, session_id, started_at, finished_at, is_complete`,
        [request.user.sub, request.body.sessionId ?? null]
      );
      return reply.status(201).send(mapWorkout(rows[0]));
    } finally {
      client.release();
    }
  });

  fastify.get<{ Querystring: WorkoutListQuery }>('/workouts', auth, async (request) => {
    const { from, to } = request.query;
    const client = await fastify.pg.connect();
    try {
      let query = `
        SELECT wl.id, wl.session_id, s.name AS session_name,
               wl.started_at, wl.finished_at, wl.is_complete
        FROM workout_logs wl
        LEFT JOIN sessions s ON s.id = wl.session_id
        WHERE wl.user_id = $1
      `;
      const params: (string | Date)[] = [request.user.sub];

      if (from) {
        params.push(new Date(from));
        query += ` AND wl.started_at >= $${params.length}`;
      }
      if (to) {
        params.push(new Date(to));
        query += ` AND wl.started_at <= $${params.length}`;
      }
      query += ' ORDER BY wl.started_at DESC';

      const { rows } = await client.query(query, params);
      return rows.map((row: {
        id: string;
        session_id: string | null;
        session_name: string | null;
        started_at: Date;
        finished_at: Date | null;
        is_complete: boolean;
      }) => ({
        id: row.id,
        sessionId: row.session_id,
        sessionName: row.session_name,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        isComplete: row.is_complete,
      }));
    } finally {
      client.release();
    }
  });

  fastify.get<{ Params: WorkoutParams }>('/workouts/:id', auth, async (request, reply) => {
    const client = await fastify.pg.connect();
    try {
      const { rows } = await client.query(
        `SELECT wl.id, wl.session_id, s.name AS session_name,
                wl.started_at, wl.finished_at, wl.is_complete
         FROM workout_logs wl
         LEFT JOIN sessions s ON s.id = wl.session_id
         WHERE wl.id = $1 AND wl.user_id = $2`,
        [request.params.id, request.user.sub]
      );
      if (!rows[0]) return reply.status(404).send({ error: 'Workout not found' });

      const { rows: sets } = await client.query(
        `SELECT wsl.id, wsl.exercise_id, e.name AS exercise_name,
                wsl.set_number, wsl.weight_kg, wsl.done_at
         FROM workout_set_logs wsl
         LEFT JOIN exercises e ON e.id = wsl.exercise_id
         WHERE wsl.workout_log_id = $1
         ORDER BY wsl.done_at ASC`,
        [request.params.id]
      );

      const row = rows[0];
      return {
        id: row.id,
        sessionId: row.session_id,
        sessionName: row.session_name,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        isComplete: row.is_complete,
        sets: sets.map((s: {
          id: string;
          exercise_id: string | null;
          exercise_name: string | null;
          set_number: number;
          weight_kg: number | null;
          done_at: Date;
        }) => ({
          id: s.id,
          exerciseId: s.exercise_id,
          exerciseName: s.exercise_name,
          setNumber: s.set_number,
          weightKg: s.weight_kg !== null ? parseFloat(String(s.weight_kg)) : null,
          doneAt: s.done_at,
        })),
      };
    } finally {
      client.release();
    }
  });

  fastify.put<{ Params: WorkoutParams }>('/workouts/:id/complete', auth, async (request, reply) => {
    const client = await fastify.pg.connect();
    try {
      const { rowCount } = await client.query(
        `UPDATE workout_logs SET finished_at = NOW(), is_complete = TRUE
         WHERE id = $1 AND user_id = $2`,
        [request.params.id, request.user.sub]
      );
      if (!rowCount) return reply.status(404).send({ error: 'Workout not found' });
      return { success: true };
    } finally {
      client.release();
    }
  });

  fastify.put<{ Params: WorkoutParams }>('/workouts/:id/finish', auth, async (request, reply) => {
    const client = await fastify.pg.connect();
    try {
      const { rowCount } = await client.query(
        `UPDATE workout_logs SET finished_at = NOW(), is_complete = FALSE
         WHERE id = $1 AND user_id = $2`,
        [request.params.id, request.user.sub]
      );
      if (!rowCount) return reply.status(404).send({ error: 'Workout not found' });
      return { success: true };
    } finally {
      client.release();
    }
  });

  fastify.post<{ Params: WorkoutParams; Body: LogSetBody }>(
    '/workouts/:id/sets',
    auth,
    async (request, reply) => {
      const { exerciseId, setNumber, weightKg } = request.body;
      const client = await fastify.pg.connect();
      try {
        const { rowCount } = await client.query(
          `SELECT 1 FROM workout_logs WHERE id = $1 AND user_id = $2`,
          [request.params.id, request.user.sub]
        );
        if (!rowCount) return reply.status(404).send({ error: 'Workout not found' });

        const { rows } = await client.query(
          `INSERT INTO workout_set_logs (workout_log_id, exercise_id, set_number, weight_kg)
           VALUES ($1, $2, $3, $4) RETURNING id, exercise_id, set_number, weight_kg, done_at`,
          [request.params.id, exerciseId, setNumber, weightKg]
        );
        const s = rows[0];
        return reply.status(201).send({
          id: s.id,
          exerciseId: s.exercise_id,
          setNumber: s.set_number,
          weightKg: s.weight_kg !== null ? parseFloat(String(s.weight_kg)) : null,
          doneAt: s.done_at,
        });
      } finally {
        client.release();
      }
    }
  );
}

function mapWorkout(row: {
  id: string;
  session_id: string | null;
  started_at: Date;
  finished_at: Date | null;
  is_complete: boolean;
}) {
  return {
    id: row.id,
    sessionId: row.session_id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    isComplete: row.is_complete,
  };
}
