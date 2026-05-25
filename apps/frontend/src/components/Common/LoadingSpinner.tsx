import { Box, CircularProgress } from '@mui/material';

export function LoadingSpinner() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
      <CircularProgress color="primary" />
    </Box>
  );
}
