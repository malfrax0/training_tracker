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

  const { state, currentExercise, startWorkout, completeSet, skipRest, stopWorkout } =
    useWorkout(session);

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

  const exerciseIndex = state.currentExerciseIndex;
  const progress = (exerciseIndex / session.exercises.length) * 100;

  return (
    <Box>
      <AppBar position="sticky" color="transparent" elevation={0} sx={{ bgcolor: 'background.default', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Toolbar>
          <IconButton edge="start" onClick={() => navigate(-1)}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flex: 1, mx: 1 }}>
            <Typography variant="subtitle2" noWrap>
              {session.name}
            </Typography>
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
            onClick={stopWorkout}
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
            totalSeconds={currentExercise?.restTimerSeconds ?? 60}
            onSkip={skipRest}
          />
        ) : currentExercise ? (
          <Stack spacing={2} sx={{ px: 2 }}>
            <Typography variant="caption" color="text.secondary" align="center" display="block">
              Exercise {exerciseIndex + 1} of {session.exercises.length}
            </Typography>
            <ExerciseStep
              exercise={currentExercise}
              setNumber={state.currentSetNumber}
              totalSets={currentExercise.nbSeries}
              onSetDone={completeSet}
            />
          </Stack>
        ) : null}
      </Box>
    </Box>
  );
}
