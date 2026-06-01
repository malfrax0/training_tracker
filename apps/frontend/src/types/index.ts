export interface Session {
  id: string;
  name: string;
  description: string | null;
  schedule: number[];
  exercises: Exercise[];
  createdAt: string;
  updatedAt: string;
}

export interface Exercise {
  id: string;
  sessionId: string;
  name: string;
  description: string | null;
  nbSeries: number;
  defaultWeightKg: number;
  defaultReps: number;
  restTimerSeconds: number;
  sortOrder: number;
  imageData: string | null;
}

export interface WorkoutLog {
  id: string;
  sessionId: string | null;
  sessionName: string | null;
  startedAt: string;
  finishedAt: string | null;
  isComplete: boolean;
  sets?: WorkoutSetLog[];
}

export interface WorkoutSetLog {
  id: string;
  exerciseId: string | null;
  exerciseName: string | null;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  doneAt: string;
}

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_LABELS: Record<DayOfWeek, string> = {
  0: 'Mon',
  1: 'Tue',
  2: 'Wed',
  3: 'Thu',
  4: 'Fri',
  5: 'Sat',
  6: 'Sun',
};
