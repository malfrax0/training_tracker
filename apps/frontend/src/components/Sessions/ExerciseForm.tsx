import { useState, useRef } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Slider,
  Stack,
  IconButton,
} from '@mui/material';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import DeleteIcon from '@mui/icons-material/Delete';
import { Exercise } from '../../types';

interface ExerciseFormValues {
  name: string;
  description: string;
  nbSeries: number;
  defaultWeightKg: number;
  defaultReps: number;
  restTimerSeconds: number;
  imageData: string;
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
  defaultReps: 8,
  restTimerSeconds: 60,
  imageData: '',
};

async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 600;
        const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ExerciseForm({ initial, onSave, onCancel }: Props) {
  const [values, setValues] = useState<ExerciseFormValues>({
    name: initial?.name ?? defaults.name,
    description: initial?.description ?? defaults.description,
    nbSeries: initial?.nbSeries ?? defaults.nbSeries,
    defaultWeightKg: initial?.defaultWeightKg ?? defaults.defaultWeightKg,
    defaultReps: initial?.defaultReps ?? defaults.defaultReps,
    restTimerSeconds: initial?.restTimerSeconds ?? defaults.restTimerSeconds,
    imageData: initial?.imageData ?? defaults.imageData,
  });
  const [saving, setSaving] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    try {
      const compressed = await compressImageFile(file);
      set('imageData', compressed);
    } catch {
      // ignore
    }
  };

  const handleUrlApply = () => {
    const url = imageUrlInput.trim();
    if (url) {
      set('imageData', url);
      setImageUrlInput('');
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await handleFileChange(file);
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

      {/* Image section */}
      <Box>
        <Typography variant="body2" gutterBottom color="text.secondary">
          Exercise image (optional)
        </Typography>
        {values.imageData ? (
          <Box sx={{ position: 'relative', display: 'inline-block', width: '100%' }}>
            <Box
              component="img"
              src={values.imageData}
              alt="Exercise preview"
              data-cy="image-preview"
              sx={{ maxWidth: '100%', height: 'auto', borderRadius: 2, display: 'block', mx: 'auto' }}
            />
            <IconButton
              size="small"
              onClick={() => set('imageData', '')}
              data-cy="remove-image-btn"
              sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'background.paper', opacity: 0.85 }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ) : (
          <Box
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              border: '2px dashed',
              borderColor: isDragging ? 'primary.main' : 'divider',
              borderRadius: 2,
              p: 2,
              textAlign: 'center',
              cursor: 'pointer',
              bgcolor: isDragging ? 'action.hover' : 'transparent',
              transition: 'all 0.15s',
            }}
          >
            <AddPhotoAlternateIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 0.5 }} />
            <Typography variant="caption" color="text.secondary" display="block">
              Drop an image or click to browse
            </Typography>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChange(f); }}
            />
          </Box>
        )}
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <TextField
            label="Or paste image URL"
            value={imageUrlInput}
            onChange={(e) => setImageUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleUrlApply(); }}
            size="small"
            fullWidth
            inputProps={{ 'data-cy': 'image-url-input' }}
          />
          <Button variant="outlined" size="small" onClick={handleUrlApply} disabled={!imageUrlInput.trim()} sx={{ whiteSpace: 'nowrap' }} data-cy="use-url-btn">
            Use URL
          </Button>
        </Stack>
      </Box>

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
        <Typography gutterBottom>Default reps: {values.defaultReps}</Typography>
        <Slider
          value={values.defaultReps}
          onChange={(_, v) => set('defaultReps', v as number)}
          min={0}
          max={20}
          step={1}
          marks={[
            { value: 0, label: '0' },
            { value: 5, label: '5' },
            { value: 10, label: '10' },
            { value: 15, label: '15' },
            { value: 20, label: '20' },
          ]}
          valueLabelDisplay="auto"
          color="primary"
        />
      </Box>
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
