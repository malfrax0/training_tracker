import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Fab } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useSessions } from '../hooks/useSessions';
import { useSessionsApi } from '../api/sessions';
import { SessionCard } from '../components/Sessions/SessionCard';
import { LoadingSpinner } from '../components/Common/LoadingSpinner';
import { ErrorAlert } from '../components/Common/ErrorAlert';

export function Sessions() {
  const navigate = useNavigate();
  const { sessions, loading, error, refetch } = useSessions();
  const api = useSessionsApi();

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this session?')) return;
    await api.deleteSession(id);
    refetch();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} />;

  return (
    <Box sx={{ p: 2 }} data-cy="sessions-page">
      <Typography variant="h5" fontWeight={700} gutterBottom>
        My Sessions
      </Typography>

      {sessions.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography color="text.secondary" gutterBottom>
            No sessions yet.
          </Typography>
          <Button variant="contained" onClick={() => navigate('/sessions/new')}>
            Create your first session
          </Button>
        </Box>
      ) : (
        sessions.map((session) => (
          <SessionCard key={session.id} session={session} onDelete={handleDelete} />
        ))
      )}

      <Fab
        color="primary"
        aria-label="add session"
        onClick={() => navigate('/sessions/new')}
        data-cy="add-session-fab"
        sx={{ position: 'fixed', bottom: 80, right: 16 }}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
}
