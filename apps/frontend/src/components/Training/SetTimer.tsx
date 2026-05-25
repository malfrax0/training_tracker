import { Box, Typography, CircularProgress, Button } from '@mui/material';
import SkipNextIcon from '@mui/icons-material/SkipNext';

interface Props {
  secondsLeft: number;
  totalSeconds: number;
  onSkip: () => void;
}

export function SetTimer({ secondsLeft, totalSeconds, onSkip }: Props) {
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <Box
      data-cy="rest-timer"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
        gap: 2,
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
      <Button
        variant="outlined"
        startIcon={<SkipNextIcon />}
        onClick={onSkip}
        color="secondary"
        data-cy="skip-rest-btn"
      >
        Skip rest
      </Button>
    </Box>
  );
}
