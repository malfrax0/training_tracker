import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { Box, Typography, Button, Card, CardContent, Chip, Stack, Divider, IconButton, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { useSessions } from '../hooks/useSessions';
import { LoadingSpinner } from '../components/Common/LoadingSpinner';
import { ErrorAlert } from '../components/Common/ErrorAlert';
import { DAY_LABELS, DayOfWeek, Session } from '../types';

function todayDayIndex(): DayOfWeek {
  return ((new Date().getDay() + 6) % 7) as DayOfWeek;
}

export function Dashboard() {
  const { user } = useAuth0();
  const navigate = useNavigate();
  const { sessions, loading, error } = useSessions();
  const [dialogSession, setDialogSession] = useState<Session | null>(null);

  const today = todayDayIndex();
  const todaySessions = sessions.filter((s) => s.schedule.includes(today));
  const otherSessions = sessions.filter((s) => !s.schedule.includes(today)).slice(0, 3);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} />;

  return (
    <Box sx={{ p: 2 }} data-cy="dashboard">
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Hey, {user?.given_name ?? user?.nickname ?? 'Athlete'} 👋
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </Typography>
      </Box>

      {todaySessions.length > 0 ? (
        <>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Today's sessions
          </Typography>
          <Stack spacing={1.5} sx={{ mb: 3 }}>
            {todaySessions.map((session) => (
              <Card key={session.id}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', '&:last-child': { pb: 2 } }}>
                  <Box>
                    <Typography fontWeight={600}>{session.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {session.exercises.length} exercises
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    startIcon={<PlayArrowIcon />}
                    onClick={() => navigate('/train', { state: { sessionId: session.id } })}
                    size="small"
                    data-cy="start-session"
                  >
                    Start
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </>
      ) : (
        <Card sx={{ mb: 3, p: 2, textAlign: 'center', border: '1px dashed rgba(255,255,255,0.2)' }}>
          <Typography color="text.secondary" gutterBottom>
            No sessions scheduled for today
          </Typography>
          <Button
            variant="outlined"
            onClick={() => navigate('/sessions/new')}
            size="small"
          >
            Create a session
          </Button>
        </Card>
      )}

      {otherSessions.length > 0 && (
        <>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Other sessions
          </Typography>
          <Stack spacing={1}>
            {otherSessions.map((session) => (
              <Card key={session.id} variant="outlined">
                <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FitnessCenterIcon fontSize="small" color="primary" />
                    <Typography variant="body2" fontWeight={500}>
                      {session.name}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {session.schedule.slice(0, 3).map((d) => (
                      <Chip key={d} label={DAY_LABELS[d as DayOfWeek]} size="small" variant="outlined" />
                    ))}
                    <IconButton
                      size="small"
                      sx={{ ml: 0.5, color: 'text.disabled' }}
                      onClick={() => setDialogSession(session)}
                      data-cy="other-session-more-btn"
                    >
                      <MoreHorizIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </>
      )}

      <Dialog open={dialogSession !== null} onClose={() => setDialogSession(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ pb: 1 }}>
          <Typography fontWeight={600}>{dialogSession?.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            Not scheduled for today
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          <Typography variant="body2" color="text.secondary">
            This session is not planned for today, but you can still start it.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogSession(null)} size="small">
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            size="small"
            data-cy="start-other-session-btn"
            onClick={() => {
              navigate('/train', { state: { sessionId: dialogSession!.id } });
              setDialogSession(null);
            }}
          >
            Start anyway
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
