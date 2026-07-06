import { useState, useEffect, useRef, useCallback } from 'react';
import { Session, Exercise } from '../types';
import { useWorkoutsApi } from '../api/workouts';

interface WorkoutState {
  workoutId: string | null;
  currentExerciseIndex: number;
  currentSetNumber: number;
  currentExerciseTotalSets: number; // effective total (nbSeries + extra sets added)
  isResting: boolean;
  restSecondsLeft: number;
  restTotalSeconds: number; // the rest duration of the exercise that was just completed
  pendingFinish: boolean; // true when this is the rest after the very last set of the workout
  isFinished: boolean;
  setsCompleted: number;
  totalSets: number; // sum across all exercises + extras
  error: string | null;
}

const initialState: WorkoutState = {
  workoutId: null,
  currentExerciseIndex: 0,
  currentSetNumber: 1,
  currentExerciseTotalSets: 0,
  isResting: false,
  restSecondsLeft: 0,
  restTotalSeconds: 0,
  pendingFinish: false,
  isFinished: false,
  setsCompleted: 0,
  totalSets: 0,
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

  useEffect(() => {
    if (state.isResting || !state.pendingFinish || !state.workoutId) return;
    let cancelled = false;
    (async () => {
      try {
        await api.completeWorkout(state.workoutId!);
        if (!cancelled) setState((prev) => ({ ...prev, pendingFinish: false, isFinished: true }));
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            pendingFinish: false,
            error: err instanceof Error ? err.message : 'Failed to complete workout',
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.isResting, state.pendingFinish, state.workoutId]);

  const startWorkout = useCallback(async () => {
    if (!session) return;
    try {
      const workout = await api.startWorkout(session.id);
      const total = session.exercises.reduce((sum, ex) => sum + ex.nbSeries, 0);
      setState({
        ...initialState,
        workoutId: workout.id,
        currentExerciseTotalSets: session.exercises[0]?.nbSeries ?? 0,
        totalSets: total,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to start workout',
      }));
    }
  }, [session]);

  const completeSet = useCallback(
    async (weightKg: number, reps: number) => {
      if (!state.workoutId || !currentExercise || !session) return;

      try {
        await api.logSet(state.workoutId, currentExercise.id, state.currentSetNumber, weightKg, reps);

        const isLastSet = state.currentSetNumber >= state.currentExerciseTotalSets;
        const isLastExercise = state.currentExerciseIndex >= session.exercises.length - 1;

        if (isLastSet && isLastExercise) {
          setState((prev) => ({
            ...prev,
            isResting: true,
            restSecondsLeft: currentExercise.restTimerSeconds,
            restTotalSeconds: currentExercise.restTimerSeconds,
            pendingFinish: true,
            setsCompleted: prev.setsCompleted + 1,
          }));
          return;
        }

        if (isLastSet) {
          const nextIndex = state.currentExerciseIndex + 1;
          setState((prev) => ({
            ...prev,
            currentExerciseIndex: nextIndex,
            currentSetNumber: 1,
            currentExerciseTotalSets: session.exercises[nextIndex].nbSeries,
            isResting: true,
            restSecondsLeft: currentExercise.restTimerSeconds,
            restTotalSeconds: currentExercise.restTimerSeconds,
            setsCompleted: prev.setsCompleted + 1,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            currentSetNumber: prev.currentSetNumber + 1,
            isResting: true,
            restSecondsLeft: currentExercise.restTimerSeconds,
            restTotalSeconds: currentExercise.restTimerSeconds,
            setsCompleted: prev.setsCompleted + 1,
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

  const addExtraSet = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentExerciseTotalSets: prev.currentExerciseTotalSets + 1,
      totalSets: prev.totalSets + 1,
    }));
  }, []);

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
    addExtraSet,
    skipRest,
    stopWorkout,
  };
}
