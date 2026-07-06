import { useSessionsApi } from './sessions';
import { DumbbellType, Exercise, Session } from '../types';
import { AiToolName } from '../types/ai';

export const AI_TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'update_session_meta',
      description: "Update the current training session's name and/or description.",
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'New session name' },
          description: { type: 'string', description: 'New session description' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_schedule',
      description: 'Set the recurring days of the week this session is scheduled on.',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'array',
            items: { type: 'integer', minimum: 0, maximum: 6 },
            description: '0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun',
          },
        },
        required: ['days'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_exercise',
      description: 'Add a new exercise to the current session.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          nbSeries: { type: 'integer', minimum: 1 },
          defaultWeightKg: { type: 'number', minimum: 0 },
          defaultReps: { type: 'integer', minimum: 1 },
          restTimerSeconds: { type: 'integer', minimum: 0 },
          dumbbellType: { type: 'string', enum: ['none', 'one_dumbbell', 'two_dumbbell', 'bar'] },
        },
        required: ['name', 'nbSeries', 'defaultWeightKg', 'defaultReps', 'restTimerSeconds', 'dumbbellType'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_exercise',
      description: 'Update fields of an existing exercise in the current session. Only include fields you want to change.',
      parameters: {
        type: 'object',
        properties: {
          exerciseId: { type: 'string', description: 'id of the exercise to update, from the current session snapshot' },
          name: { type: 'string' },
          description: { type: 'string' },
          nbSeries: { type: 'integer', minimum: 1 },
          defaultWeightKg: { type: 'number', minimum: 0 },
          defaultReps: { type: 'integer', minimum: 1 },
          restTimerSeconds: { type: 'integer', minimum: 0 },
          dumbbellType: { type: 'string', enum: ['none', 'one_dumbbell', 'two_dumbbell', 'bar'] },
        },
        required: ['exerciseId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_exercise',
      description: 'Remove an exercise from the current session.',
      parameters: {
        type: 'object',
        properties: {
          exerciseId: { type: 'string' },
        },
        required: ['exerciseId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reorder_exercises',
      description: 'Reorder the exercises in the current session.',
      parameters: {
        type: 'object',
        properties: {
          orderedIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'All exercise ids of the current session, in the new desired order',
          },
        },
        required: ['orderedIds'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_exercise_image',
      description:
        'Search a fitness website for a photo demonstrating an exercise. Presents up to 4 candidate photos to the ' +
        "user, who picks the one they like (or none) — you never choose which result is used, and you don't need " +
        'to call this again for the same exercise unless the user asks for different results. Only works for an ' +
        'exercise that already exists in the current session snapshot (has a real exerciseId); if you just proposed ' +
        'adding a new exercise, wait until the user approves it and it appears in a later snapshot before searching ' +
        'for its photo.',
      parameters: {
        type: 'object',
        properties: {
          exerciseId: {
            type: 'string',
            description: 'id of an existing exercise from the current session snapshot to attach the chosen photo to',
          },
          query: {
            type: 'string',
            description: 'Search terms describing the movement, e.g. "dumbbell bicep curl" or "barbell squat"',
          },
        },
        required: ['exerciseId', 'query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_exercises',
      description:
        'Get the full, up-to-date list of exercises in the current session (id, name, description, sets, weight, ' +
        'reps, rest timer, equipment, order). This is a read-only lookup, not a change — it never needs approval. ' +
        'The exercise list is already included in the session snapshot on every turn, so you usually do not need ' +
        'this; call it only if you want to explicitly double-check current exercise data (e.g. exact ids) before ' +
        'proposing a change, especially after several turns of conversation.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
] as const;

const DUMBBELL_TYPES: DumbbellType[] = ['none', 'one_dumbbell', 'two_dumbbell', 'bar'];

function numberOr(value: unknown, fallback: number | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
  return fallback as number;
}

function requireExerciseId(args: Record<string, unknown>, session: Session): Exercise {
  const exerciseId = args.exerciseId;
  const exercise = typeof exerciseId === 'string' ? session.exercises.find((e) => e.id === exerciseId) : undefined;
  if (!exercise) {
    throw new Error('exerciseId does not belong to the current session');
  }
  return exercise;
}

function validateDays(value: unknown): number[] {
  if (!Array.isArray(value)) throw new Error('days must be an array of numbers 0-6');
  const days = value.map((d) => Number(d));
  if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    throw new Error('days must be integers between 0 and 6');
  }
  return Array.from(new Set(days)).sort((a, b) => a - b);
}

function validateExerciseBody(args: Record<string, unknown>, existing?: Exercise) {
  const name = typeof args.name === 'string' && args.name.trim() ? args.name.trim() : existing?.name;
  if (!name) throw new Error('name is required');

  const nbSeries = numberOr(args.nbSeries, existing?.nbSeries);
  if (!Number.isInteger(nbSeries) || nbSeries <= 0) throw new Error('nbSeries must be a positive integer');

  const defaultWeightKg = numberOr(args.defaultWeightKg, existing?.defaultWeightKg);
  if (typeof defaultWeightKg !== 'number' || Number.isNaN(defaultWeightKg) || defaultWeightKg < 0) {
    throw new Error('defaultWeightKg must be a number >= 0');
  }

  const defaultReps = numberOr(args.defaultReps, existing?.defaultReps);
  if (!Number.isInteger(defaultReps) || defaultReps <= 0) throw new Error('defaultReps must be a positive integer');

  const restTimerSeconds = numberOr(args.restTimerSeconds, existing?.restTimerSeconds);
  if (!Number.isInteger(restTimerSeconds) || restTimerSeconds < 0) {
    throw new Error('restTimerSeconds must be an integer >= 0');
  }

  const dumbbellType = (
    typeof args.dumbbellType === 'string' && DUMBBELL_TYPES.includes(args.dumbbellType as DumbbellType)
      ? args.dumbbellType
      : existing?.dumbbellType
  ) as DumbbellType | undefined;
  if (!dumbbellType) throw new Error('dumbbellType is required');

  const description = typeof args.description === 'string' ? args.description : (existing?.description ?? '');

  return { name, description, nbSeries, defaultWeightKg, defaultReps, restTimerSeconds, dumbbellType };
}

function validateOrderedIds(value: unknown, session: Session): string[] {
  if (!Array.isArray(value)) throw new Error('orderedIds must be an array of exercise ids');
  const ids = value.map(String);
  const sessionIds = new Set(session.exercises.map((e) => e.id));
  if (ids.length !== sessionIds.size || !ids.every((id) => sessionIds.has(id))) {
    throw new Error('orderedIds must contain exactly the exercise ids of the current session');
  }
  return ids;
}

export interface ToolExecutionContext {
  session: Session;
  api: ReturnType<typeof useSessionsApi>;
}

export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  { session, api }: ToolExecutionContext,
): Promise<void> {
  switch (toolName as AiToolName) {
    case 'update_session_meta': {
      const name = typeof args.name === 'string' && args.name.trim() ? args.name.trim() : session.name;
      const description = typeof args.description === 'string' ? args.description : (session.description ?? '');
      await api.updateSession(session.id, { name, description });
      return;
    }
    case 'update_schedule': {
      const days = validateDays(args.days);
      await api.updateSchedule(session.id, days);
      return;
    }
    case 'add_exercise': {
      const body = validateExerciseBody(args);
      await api.addExercise(session.id, body);
      return;
    }
    case 'update_exercise': {
      const existing = requireExerciseId(args, session);
      const body = validateExerciseBody(args, existing);
      await api.updateExercise(existing.id, body);
      return;
    }
    case 'delete_exercise': {
      const existing = requireExerciseId(args, session);
      await api.deleteExercise(existing.id);
      return;
    }
    case 'reorder_exercises': {
      const orderedIds = validateOrderedIds(args.orderedIds, session);
      await api.reorderExercises(session.id, orderedIds);
      return;
    }
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
