import { useEffect, useRef } from 'react';
import { Box, Typography, CircularProgress, Button, Paper, Chip } from '@mui/material';
import SkipNextIcon from '@mui/icons-material/SkipNext';
// import AddIcon from '@mui/icons-material/Add';
import { Exercise } from '../../types';

interface Props {
  secondsLeft: number;
  totalSeconds: number;
  onSkip: () => void;
  onAddExtraSet: () => void;
  nextExercise: Exercise | null;
}

function playWarningBeep() {
  try {
    const ctx = new AudioContext();
    const schedule = [
      { freq: 440,  start: 0.00 }, // A4
      { freq: 494,  start: 0.14 }, // B4
      { freq: 440,  start: 0.28 }, // A4
      { freq: 392,  start: 0.42 }, // G4  ← tension drop
    ];
    schedule.forEach(({ freq, start }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + 0.12);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + 0.12);
    });
    setTimeout(() => ctx.close(), 700);
  } catch {
    // AudioContext not available (e.g. SSR or restricted)
  }
}

function playDoneBeep() {
  try {
    const ctx = new AudioContext();
    const schedule = [
      { freq: 523,  start: 0.00 }, // C5
      { freq: 659,  start: 0.14 }, // E5
      { freq: 784,  start: 0.28 }, // G5
      { freq: 1047, start: 0.42 }, // C6
      { freq: 880,  start: 0.58 }, // A5
      { freq: 784,  start: 0.72 }, // G5
      { freq: 659,  start: 0.86 }, // E5
      { freq: 1047, start: 1.00 }, // C6  ← bright finish
    ];
    schedule.forEach(({ freq, start }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.35, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + 0.25);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + 0.25);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {
    // ignore
  }
}

export function SetTimer({ secondsLeft, totalSeconds, onSkip, /*onAddExtraSet,*/ nextExercise }: Props) {
  const safeTotalSeconds = totalSeconds > 0 ? totalSeconds : 1;
  const progress = Math.min(100, Math.max(0, ((safeTotalSeconds - secondsLeft) / safeTotalSeconds) * 100));
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  const warned10Ref = useRef(false);
  const warnedDoneRef = useRef(false);

  useEffect(() => {
    if (secondsLeft <= 10 && secondsLeft > 0 && !warned10Ref.current) {
      warned10Ref.current = true;
      playWarningBeep();
    }
    if (secondsLeft <= 1 && !warnedDoneRef.current) {
      warnedDoneRef.current = true;
      playDoneBeep();
    }
  }, [secondsLeft]);

  return (
    <Box
      data-cy="rest-timer"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 3,
        gap: 2,
        px: 2,
      }}
    >
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress
          variant="determinate"
          value={progress}
          size={160}
          thickness={4}
          color="secondary"
          sx={{ transform: 'rotate(-90deg)' }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="h3" fontWeight={700}>
            {minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : secondsLeft}
          </Typography>
        </Box>
      </Box>
      <Typography variant="body1" color="text.secondary">
        Rest time
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button
          variant="outlined"
          startIcon={<SkipNextIcon />}
          onClick={onSkip}
          color="secondary"
          data-cy="skip-rest-btn"
        >
          Skip rest
        </Button>
        {/* <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={onAddExtraSet}
          color="primary"
          data-cy="add-extra-set-btn"
        >
          One more set
        </Button> */}
      </Box>

      {nextExercise && (
        <Paper
          elevation={0}
          sx={{ width: '100%', p: 2, bgcolor: 'background.paper', borderRadius: 3, mt: 1 }}
        >
          <Typography variant="overline" color="text.secondary">
            Up next
          </Typography>
          {nextExercise.imageData && (
            <Box
              component="img"
              src={nextExercise.imageData}
              alt={nextExercise.name}
              sx={{ maxWidth: '100%', height: 'auto', borderRadius: 2, mb: 1, display: 'block', mx: 'auto' }}
            />
          )}
          <Typography variant="subtitle1" fontWeight={700}>
            {nextExercise.name}
          </Typography>
          {nextExercise.description && (
            <Typography variant="body2" color="text.secondary">
              {nextExercise.description}
            </Typography>
          )}
          <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip size="small" label={`${nextExercise.nbSeries} sets`} />
            <Chip size="small" label={`${nextExercise.defaultReps} reps`} />
            {nextExercise.defaultWeightKg > 0 && (
              <Chip size="small" label={`${nextExercise.defaultWeightKg} kg`} />
            )}
          </Box>
        </Paper>
      )}
    </Box>
  );
}
