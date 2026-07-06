import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardActionArea,
  CardContent,
  CardActions,
  Typography,
  Chip,
  Box,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { Session, DAY_LABELS, DayOfWeek } from '../../types';

interface Props {
  session: Session;
  onDelete: (id: string) => void;
}

export function SessionCard({ session, onDelete }: Props) {
  const navigate = useNavigate();

  return (
    <Card sx={{ mb: 2 }}>
      <CardActionArea onClick={() => navigate(`/sessions/${session.id}`)}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {session.name}
          </Typography>
          {session.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {session.description}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            {session.exercises.length} exercise{session.exercises.length !== 1 ? 's' : ''}
          </Typography>
          {session.schedule.length > 0 && (
            <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {session.schedule
                .slice()
                .sort((a, b) => a - b)
                .map((day) => (
                  <Chip
                    key={day}
                    label={DAY_LABELS[day as DayOfWeek]}
                    size="small"
                    color="secondary"
                    variant="outlined"
                  />
                ))}
            </Box>
          )}
        </CardContent>
      </CardActionArea>
      <CardActions sx={{ justifyContent: 'space-between', pt: 0 }}>
        <IconButton
          color="error"
          size="small"
          data-cy="delete-session-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(session.id);
          }}
        >
          <DeleteIcon />
        </IconButton>
        <IconButton
          color="primary"
          data-cy="start-training-btn"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/sessions/${session.id}/equipment`);
          }}
        >
          <PlayArrowIcon />
        </IconButton>
      </CardActions>
    </Card>
  );
}
