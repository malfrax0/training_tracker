import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Chip,
  Paper,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { Exercise } from '../../types';

interface Props {
  exercise: Exercise;
  setNumber: number;
  totalSets: number;
  onSetDone: (weightKg: number, reps: number) => void;
}

export function ExerciseStep({ exercise, setNumber, totalSets, onSetDone }: Props) {
  const [weight, setWeight] = useState(exercise.defaultWeightKg);
  const [reps, setReps] = useState(exercise.defaultReps);

  useEffect(() => {
    setWeight(exercise.defaultWeightKg);
    setReps(exercise.defaultReps);
  }, [exercise.id]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, px: 2 }}>
      <Paper
        elevation={0}
        sx={{ width: '100%', p: 2, bgcolor: 'background.paper', borderRadius: 3 }}
      >
        {exercise.imageData && (
          <Box
            component="img"
            src={exercise.imageData}
            alt={exercise.name}
            data-cy="exercise-image"
            sx={{ maxWidth: '100%', height: 'auto', borderRadius: 2, mb: 1.5, display: 'block', mx: 'auto' }}
          />
        )}
        <Typography variant="h5" fontWeight={700} gutterBottom>
          {exercise.name}
        </Typography>
        {exercise.description && (
          <Typography variant="body2" color="text.secondary">
            {exercise.description}
          </Typography>
        )}
      </Paper>

      <Chip
        label={`Set ${setNumber} of ${totalSets}`}
        color="primary"
        sx={{ fontSize: '1rem', px: 2, py: 2.5, borderRadius: 3 }}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <TextField
          label="Weight (kg)"
          type="number"
          value={weight}
          onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
          inputProps={{ min: 0, step: 0.5, 'data-cy': 'weight-input' }}
          sx={{ width: 130 }}
        />
        <TextField
          label="Reps"
          type="number"
          value={reps}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            setReps(Math.min(20, Math.max(0, isNaN(v) ? 0 : v)));
          }}
          inputProps={{ min: 0, max: 20, step: 1, 'data-cy': 'reps-input' }}
          sx={{ width: 100 }}
        />
      </Box>

      <Button
        variant="contained"
        color="primary"
        size="large"
        startIcon={<CheckCircleIcon />}
        data-cy="set-done-btn"
        onClick={() => onSetDone(weight, reps)}
        sx={{
          width: '100%',
          py: 3,
          fontSize: '1.25rem',
          fontWeight: 700,
          borderRadius: 4,
          boxShadow: '0 4px 20px rgba(255,107,53,0.4)',
        }}
      >
        Set Done!
      </Button>
    </Box>
  );
}
