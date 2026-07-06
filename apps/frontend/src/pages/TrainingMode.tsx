import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  LinearProgress,
  AppBar,
  Toolbar,
  IconButton,
  Alert,
  Stack,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StopIcon from '@mui/icons-material/Stop';
import { useSessionsApi } from '../api/sessions';
import { useWorkout } from '../hooks/useWorkout';
import { useTrainingGuard } from '../contexts/TrainingGuardContext';
import { Session } from '../types';
import { ExerciseStep } from '../components/Training/ExerciseStep';
import { SetTimer } from '../components/Training/SetTimer';
import { LoadingSpinner } from '../components/Common/LoadingSpinner';
import { ErrorAlert } from '../components/Common/ErrorAlert';

export function TrainingMode() {
  const location = useLocation();
  const navigate = useNavigate();
  const api = useSessionsApi();
  const sessionId = (location.state as { sessionId?: string } | null)?.sessionId;

  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { state, currentExercise, startWorkout, completeSet, addExtraSet, skipRest, stopWorkout } =
    useWorkout(session);
  const { setActive, guardedAction } = useTrainingGuard();

  useEffect(() => {
    setActive(!!state.workoutId && !state.isFinished);
  }, [state.workoutId, state.isFinished, setActive]);

  useEffect(() => {
    if (!sessionId) {
      setLoadingSession(false);
      return;
    }
    api.getSession(sessionId)
      .then((s) => {
        setSession(s);
        setLoadingSession(false);
      })
      .catch((err) => {
        setLoadError(err.message);
        setLoadingSession(false);
      });
  }, [sessionId]);

  useEffect(() => {
    if (session && !state.workoutId && !state.isFinished) {
      startWorkout();
    }
  }, [session]);

  if (loadingSession) return <LoadingSpinner />;
  if (loadError) return <ErrorAlert message={loadError} />;

  if (!session) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary" gutterBottom>
          No session selected.
        </Typography>
        <Button onClick={() => navigate('/sessions')}>Choose a session</Button>
      </Box>
    );
  }

  if (state.isFinished) {
    return (
      <Box data-cy="workout-done" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 3, p: 3 }}>
        <Typography variant="h4" fontWeight={700} color="success.main">
          Workout Done! 🎉
        </Typography>
        <Typography color="text.secondary" align="center">
          Great job completing {session.name}!
        </Typography>
        <Button variant="contained" onClick={() => navigate('/')} size="large">
          Back to Home
        </Button>
      </Box>
    );
  }

  const progress = state.totalSets > 0
    ? Math.round((state.setsCompleted / state.totalSets) * 100)
    : 0;

  const exerciseIndex = state.currentExerciseIndex;
  const nextExercise = state.pendingFinish ? null : session.exercises[exerciseIndex + 1] ?? null;

  const handleSetDone = async (weightKg: number, reps: number) => {
    if (currentExercise) {
      const weightChanged = weightKg !== currentExercise.defaultWeightKg;
      const repsChanged = reps !== currentExercise.defaultReps;
      if (weightChanged || repsChanged) {
        try {
          await api.updateExerciseDefaults(currentExercise.id, weightKg, reps);
          setSession((prev) =>
            prev
              ? {
                  ...prev,
                  exercises: prev.exercises.map((ex) =>
                    ex.id === currentExercise.id
                      ? { ...ex, defaultWeightKg: weightKg, defaultReps: reps }
                      : ex
                  ),
                }
              : prev
          );
        } catch {
          // Non-critical — don't block the set log
        }
      }
    }
    await completeSet(weightKg, reps);
  };

  return (
    <Box>
      <AppBar position="sticky" color="transparent" elevation={0} sx={{ bgcolor: 'background.default', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Toolbar>
          <IconButton edge="start" data-cy="training-back-btn" onClick={() => guardedAction(() => navigate('/sessions'))}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flex: 1, mx: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Typography variant="subtitle2" noWrap sx={{ flex: 1 }}>
                {session.name}
              </Typography>
              <Typography variant="caption" color="primary" sx={{ ml: 1, fontWeight: 700, whiteSpace: 'nowrap' }} data-cy="progress-pct">
                {progress}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              color="primary"
              sx={{ borderRadius: 1, mt: 0.5 }}
            />
          </Box>
          <Button
            startIcon={<StopIcon />}
            color="error"
            size="small"
            data-cy="stop-workout-btn"
            onClick={() => guardedAction(stopWorkout)}
          >
            Stop
          </Button>
        </Toolbar>
      </AppBar>

      {state.error && (
        <Alert severity="error" sx={{ mx: 2, mt: 1 }}>
          {state.error}
        </Alert>
      )}

      <Box sx={{ pt: 4 }}>
        {state.isResting ? (
          <SetTimer
            secondsLeft={state.restSecondsLeft}
            totalSeconds={state.restTotalSeconds}
            onSkip={skipRest}
            onAddExtraSet={addExtraSet}
            nextExercise={nextExercise}
          />
        ) : currentExercise ? (
          <Stack spacing={2} sx={{ px: 2 }}>
            <Typography variant="caption" color="text.secondary" align="center" display="block">
              Exercise {exerciseIndex + 1} of {session.exercises.length}
            </Typography>
            <ExerciseStep
              exercise={currentExercise}
              setNumber={state.currentSetNumber}
              totalSets={state.currentExerciseTotalSets}
              onSetDone={handleSetDone}
            />
          </Stack>
        ) : null}
      </Box>
    </Box>
  );
}
