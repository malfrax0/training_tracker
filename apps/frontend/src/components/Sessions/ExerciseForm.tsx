import { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Slider,
  Stack,
} from '@mui/material';
import { Exercise } from '../../types';

interface ExerciseFormValues {
  name: string;
  description: string;
  nbSeries: number;
  defaultWeightKg: number;
  restTimerSeconds: number;
}

interface Props {
  initial?: Partial<Exercise>;
  onSave: (values: ExerciseFormValues) => Promise<void>;
  onCancel: () => void;
}

const defaults: ExerciseFormValues = {
  name: '',
  description: '',
  nbSeries: 3,
  defaultWeightKg: 0,
  restTimerSeconds: 60,
};

export function ExerciseForm({ initial, onSave, onCancel }: Props) {
  const [values, setValues] = useState<ExerciseFormValues>({
    name: initial?.name ?? defaults.name,
    description: initial?.description ?? defaults.description,
    nbSeries: initial?.nbSeries ?? defaults.nbSeries,
    defaultWeightKg: initial?.defaultWeightKg ?? defaults.defaultWeightKg,
    restTimerSeconds: initial?.restTimerSeconds ?? defaults.restTimerSeconds,
  });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ExerciseFormValues>(key: K, value: ExerciseFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!values.name.trim()) return;
    setSaving(true);
    try {
      await onSave(values);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <TextField
        label="Exercise name"
        value={values.name}
        onChange={(e) => set('name', e.target.value)}
        fullWidth
        required
        autoFocus
        inputProps={{ 'data-cy': 'exercise-name-input' }}
      />
      <TextField
        label="Description (optional)"
        value={values.description}
        onChange={(e) => set('description', e.target.value)}
        fullWidth
        multiline
        rows={2}
      />
      <Box>
        <Typography gutterBottom>Sets: {values.nbSeries}</Typography>
        <Slider
          value={values.nbSeries}
          onChange={(_, v) => set('nbSeries', v as number)}
          min={1}
          max={10}
          step={1}
          marks
          valueLabelDisplay="auto"
          color="primary"
        />
      </Box>
      <TextField
        label="Default weight (kg)"
        type="number"
        value={values.defaultWeightKg}
        onChange={(e) => set('defaultWeightKg', parseFloat(e.target.value) || 0)}
        inputProps={{ min: 0, step: 0.5 }}
        fullWidth
      />
      <Box>
        <Typography gutterBottom>Rest timer: {values.restTimerSeconds}s</Typography>
        <Slider
          value={values.restTimerSeconds}
          onChange={(_, v) => set('restTimerSeconds', v as number)}
          min={15}
          max={300}
          step={15}
          marks={[
            { value: 30, label: '30s' },
            { value: 60, label: '1m' },
            { value: 120, label: '2m' },
            { value: 180, label: '3m' },
          ]}
          valueLabelDisplay="auto"
          color="secondary"
        />
      </Box>
      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !values.name.trim()} data-cy="save-exercise-btn">
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Stack>
    </Stack>
  );
}
