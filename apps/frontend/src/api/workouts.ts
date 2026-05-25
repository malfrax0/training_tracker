import { useApiClient } from './client';
import { WorkoutLog, WorkoutSetLog } from '../types';

export function useWorkoutsApi() {
  const { apiFetch } = useApiClient();

  return {
    startWorkout: (sessionId?: string) =>
      apiFetch<WorkoutLog>('/api/workouts', {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      }),
    listWorkouts: (from?: Date, to?: Date) => {
      const params = new URLSearchParams();
      if (from) params.set('from', from.toISOString());
      if (to) params.set('to', to.toISOString());
      const qs = params.toString();
      return apiFetch<WorkoutLog[]>(`/api/workouts${qs ? `?${qs}` : ''}`);
    },
    getWorkout: (id: string) => apiFetch<WorkoutLog>(`/api/workouts/${id}`),
    completeWorkout: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/workouts/${id}/complete`, { method: 'PUT' }),
    finishWorkout: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/workouts/${id}/finish`, { method: 'PUT' }),
    logSet: (workoutId: string, exerciseId: string, setNumber: number, weightKg: number) =>
      apiFetch<WorkoutSetLog>(`/api/workouts/${workoutId}/sets`, {
        method: 'POST',
        body: JSON.stringify({ exerciseId, setNumber, weightKg }),
      }),
  };
}
