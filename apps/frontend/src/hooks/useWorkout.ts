import { useState, useEffect, useRef, useCallback } from 'react';
import { Session, Exercise } from '../types';
import { useWorkoutsApi } from '../api/workouts';

interface WorkoutState {
  workoutId: string | null;
  currentExerciseIndex: number;
  currentSetNumber: number;
  isResting: boolean;
  restSecondsLeft: number;
  isFinished: boolean;
  error: string | null;
}

const initialState: WorkoutState = {
  workoutId: null,
  currentExerciseIndex: 0,
  currentSetNumber: 1,
  isResting: false,
  restSecondsLeft: 0,
  isFinished: false,
  error: null,
};

export function useWorkout(session: Session | null) {
  const api = useWorkoutsApi();
  const [state, setState] = useState<WorkoutState>(initialState);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentExercise: Exercise | null = session?.exercises[state.currentExerciseIndex] ?? null;

  useEffect(() => {
    if (!state.isResting) return;

    timerRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.restSecondsLeft <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return { ...prev, isResting: false, restSecondsLeft: 0 };
        }
        return { ...prev, restSecondsLeft: prev.restSecondsLeft - 1 };
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.isResting]);

  const startWorkout = useCallback(async () => {
    if (!session) return;
    try {
      const workout = await api.startWorkout(session.id);
      setState({ ...initialState, workoutId: workout.id });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to start workout',
      }));
    }
  }, [session]);

  const completeSet = useCallback(
    async (weightKg: number) => {
      if (!state.workoutId || !currentExercise || !session) return;

      try {
        await api.logSet(state.workoutId, currentExercise.id, state.currentSetNumber, weightKg);

        const isLastSet = state.currentSetNumber >= currentExercise.nbSeries;
        const isLastExercise = state.currentExerciseIndex >= session.exercises.length - 1;

        if (isLastSet && isLastExercise) {
          await api.completeWorkout(state.workoutId);
          setState((prev) => ({ ...prev, isFinished: true }));
          return;
        }

        if (isLastSet) {
          setState((prev) => ({
            ...prev,
            currentExerciseIndex: prev.currentExerciseIndex + 1,
            currentSetNumber: 1,
            isResting: true,
            restSecondsLeft: currentExercise.restTimerSeconds,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            currentSetNumber: prev.currentSetNumber + 1,
            isResting: true,
            restSecondsLeft: currentExercise.restTimerSeconds,
          }));
        }
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to log set',
        }));
      }
    },
    [state, currentExercise, session]
  );

  const skipRest = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setState((prev) => ({ ...prev, isResting: false, restSecondsLeft: 0 }));
  }, []);

  const stopWorkout = useCallback(async () => {
    if (!state.workoutId) return;
    try {
      await api.finishWorkout(state.workoutId);
      setState((prev) => ({ ...prev, isFinished: true }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to finish workout',
      }));
    }
  }, [state.workoutId]);

  return {
    state,
    currentExercise,
    startWorkout,
    completeSet,
    skipRest,
    stopWorkout,
  };
}
