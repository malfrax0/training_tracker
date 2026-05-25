export interface Session {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionSchedule {
  sessionId: string;
  dayOfWeek: number;
}

export interface Exercise {
  id: string;
  sessionId: string;
  name: string;
  description: string | null;
  nbSeries: number;
  defaultWeightKg: number;
  restTimerSeconds: number;
  sortOrder: number;
  createdAt: Date;
}

export interface WorkoutLog {
  id: string;
  userId: string;
  sessionId: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  isComplete: boolean;
}

export interface WorkoutSetLog {
  id: string;
  workoutLogId: string;
  exerciseId: string | null;
  setNumber: number;
  weightKg: number | null;
  doneAt: Date;
}
