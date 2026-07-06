import { useApiClient } from './client';
import { Session, Exercise, DumbbellType } from '../types';

interface SessionBody {
  name: string;
  description?: string;
}

interface ExerciseBody {
  name: string;
  description?: string;
  nbSeries: number;
  defaultWeightKg: number;
  defaultReps: number;
  restTimerSeconds: number;
  dumbbellType: DumbbellType;
  imageData?: string;
}

export function useSessionsApi() {
  const { apiFetch } = useApiClient();

  return {
    listSessions: () => apiFetch<Session[]>('/api/sessions'),
    getSession: (id: string) => apiFetch<Session>(`/api/sessions/${id}`),
    createSession: (body: SessionBody) =>
      apiFetch<Session>('/api/sessions', { method: 'POST', body: JSON.stringify(body) }),
    updateSession: (id: string, body: SessionBody) =>
      apiFetch<{ success: boolean }>(`/api/sessions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    deleteSession: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/sessions/${id}`, { method: 'DELETE' }),
    updateSchedule: (sessionId: string, days: number[]) =>
      apiFetch<{ success: boolean; days: number[] }>(`/api/sessions/${sessionId}/schedules`, {
        method: 'PUT',
        body: JSON.stringify({ days }),
      }),
    addExercise: (sessionId: string, body: ExerciseBody) =>
      apiFetch<Exercise>(`/api/sessions/${sessionId}/exercises`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    updateExercise: (exerciseId: string, body: ExerciseBody) =>
      apiFetch<{ success: boolean }>(`/api/exercises/${exerciseId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    deleteExercise: (exerciseId: string) =>
      apiFetch<{ success: boolean }>(`/api/exercises/${exerciseId}`, { method: 'DELETE' }),
    updateExerciseDefaults: (exerciseId: string, defaultWeightKg: number, defaultReps: number) =>
      apiFetch<{ success: boolean }>(`/api/exercises/${exerciseId}/defaults`, {
        method: 'PATCH',
        body: JSON.stringify({ defaultWeightKg, defaultReps }),
      }),
    reorderExercises: (sessionId: string, orderedIds: string[]) =>
      apiFetch<{ success: boolean }>(`/api/sessions/${sessionId}/exercises/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ orderedIds }),
      }),
  };
}
