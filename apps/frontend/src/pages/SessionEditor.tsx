import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  AppBar,
  Toolbar,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useSessionsApi } from '../api/sessions';
import { Session, Exercise } from '../types';
import { ExerciseForm } from '../components/Sessions/ExerciseForm';
import { ScheduleDayPicker } from '../components/Sessions/ScheduleDayPicker';
import { LoadingSpinner } from '../components/Common/LoadingSpinner';
import { ErrorAlert } from '../components/Common/ErrorAlert';

export function SessionEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const api = useSessionsApi();
  const isNew = !id;

  const [session, setSession] = useState<Session | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schedule, setSchedule] = useState<number[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exerciseDialog, setExerciseDialog] = useState<{ open: boolean; editing: Exercise | null }>({
    open: false,
    editing: null,
  });

  useEffect(() => {
    if (isNew) return;
    api.getSession(id!).then((s) => {
      setSession(s);
      setName(s.name);
      setDescription(s.description ?? '');
      setSchedule(s.schedule);
      setLoading(false);
    }).catch((err) => {
      setError(err.message);
      setLoading(false);
    });
  }, [id]);

  const handleSaveMeta = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (isNew) {
        const created = await api.createSession({ name, description });
        await api.updateSchedule(created.id, schedule);
        navigate(`/sessions/${created.id}`, { replace: true });
      } else {
        await api.updateSession(id!, { name, description });
        await api.updateSchedule(id!, schedule);
        setSession((prev) => prev ? { ...prev, name, description: description || null, schedule } : prev);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveExercise = async (values: {
    name: string;
    description: string;
    nbSeries: number;
    defaultWeightKg: number;
    restTimerSeconds: number;
  }) => {
    const sessionId = isNew ? session?.id : id!;
    if (!sessionId) return;

    if (exerciseDialog.editing) {
      await api.updateExercise(exerciseDialog.editing.id, values);
    } else {
      await api.addExercise(sessionId, values);
    }

    const updated = await api.getSession(sessionId);
    setSession(updated);
    setExerciseDialog({ open: false, editing: null });
  };

  const handleDeleteExercise = async (exerciseId: string) => {
    if (!confirm('Remove this exercise?')) return;
    await api.deleteExercise(exerciseId);
    const updated = await api.getSession(isNew ? session!.id : id!);
    setSession(updated);
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} />;

  return (
    <Box>
      <AppBar position="sticky" color="transparent" elevation={0} sx={{ bgcolor: 'background.default', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Toolbar>
          <IconButton edge="start" onClick={() => navigate(-1)}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flex: 1, ml: 1 }}>
            {isNew ? 'New Session' : 'Edit Session'}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 2 }}>
        <Stack spacing={2}>
          <TextField
            label="Session name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            inputProps={{ 'data-cy': 'session-name-input' }}
          />
          <TextField
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
          <ScheduleDayPicker value={schedule} onChange={setSchedule} />
          <Button
            variant="contained"
            onClick={handleSaveMeta}
            disabled={saving || !name.trim()}
            fullWidth
            data-cy="save-session-btn"
          >
            {saving ? 'Saving…' : isNew ? 'Create Session' : 'Save Changes'}
          </Button>
        </Stack>

        {(!isNew || session) && (
          <>
            <Divider sx={{ my: 3 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                Exercises ({session?.exercises.length ?? 0})
              </Typography>
              <Button
                startIcon={<AddIcon />}
                onClick={() => setExerciseDialog({ open: true, editing: null })}
                size="small"
                data-cy="add-exercise-btn"
              >
                Add
              </Button>
            </Box>

            <Stack spacing={1.5}>
              {(session?.exercises ?? []).map((ex) => (
                <Card key={ex.id} variant="outlined">
                  <CardContent sx={{ pb: 0 }}>
                    <Typography fontWeight={600}>{ex.name}</Typography>
                    {ex.description && (
                      <Typography variant="caption" color="text.secondary">
                        {ex.description}
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {ex.nbSeries} sets · {ex.defaultWeightKg} kg · {ex.restTimerSeconds}s rest
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ pt: 0 }}>
                    <IconButton
                      size="small"
                      onClick={() => setExerciseDialog({ open: true, editing: ex })}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteExercise(ex.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </CardActions>
                </Card>
              ))}
            </Stack>
          </>
        )}
      </Box>

      <Dialog
        open={exerciseDialog.open}
        onClose={() => setExerciseDialog({ open: false, editing: null })}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{exerciseDialog.editing ? 'Edit Exercise' : 'Add Exercise'}</DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <ExerciseForm
            initial={exerciseDialog.editing ?? undefined}
            onSave={handleSaveExercise}
            onCancel={() => setExerciseDialog({ open: false, editing: null })}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
