import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Stack,
  Paper,
  AppBar,
  Toolbar,
  IconButton,
  Chip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useSessionsApi } from '../api/sessions';
import { Session } from '../types';
import { computeEquipmentNeeds } from '../utils/equipment';
import { LoadingSpinner } from '../components/Common/LoadingSpinner';
import { ErrorAlert } from '../components/Common/ErrorAlert';

export function EquipmentSummary() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const api = useSessionsApi();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getSession(id)
      .then((s) => {
        setSession(s);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load session');
        setLoading(false);
      });
  }, [id]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} />;
  if (!session) return <ErrorAlert message="Session not found" />;

  const equipment = computeEquipmentNeeds(session.exercises);

  return (
    <Box data-cy="equipment-page">
      <AppBar position="sticky" color="transparent" elevation={0} sx={{ bgcolor: 'background.default', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Toolbar>
          <IconButton edge="start" onClick={() => navigate(-1)}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flex: 1, ml: 1 }} noWrap>
            {session.name}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Equipment needed
        </Typography>

        {equipment.length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            No dumbbells or bars needed for this session.
          </Typography>
        ) : (
          <Stack spacing={1.5} sx={{ mt: 2 }} data-cy="equipment-list">
            {equipment.map((item) => (
              <Paper
                key={`${item.type}-${item.weightKg}`}
                variant="outlined"
                data-cy="equipment-item"
                sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}
              >
                <FitnessCenterIcon color="secondary" />
                <Typography sx={{ flex: 1 }}>
                  {item.type === 'bar' ? 'Bodybuilding bar' : 'Dumbbell'} · {item.weightKg} kg
                </Typography>
                <Chip label={`× ${item.count}`} color="primary" size="small" />
              </Paper>
            ))}
          </Stack>
        )}

        <Button
          variant="contained"
          fullWidth
          size="large"
          startIcon={<PlayArrowIcon />}
          data-cy="equipment-start-training-btn"
          onClick={() => navigate('/train', { state: { sessionId: session.id } })}
          sx={{ mt: 4 }}
        >
          Start Training
        </Button>
      </Box>
    </Box>
  );
}
