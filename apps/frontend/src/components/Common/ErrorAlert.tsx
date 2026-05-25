import { Alert, Box } from '@mui/material';

interface Props {
  message: string;
}

export function ErrorAlert({ message }: Props) {
  return (
    <Box sx={{ p: 2 }}>
      <Alert severity="error">{message}</Alert>
    </Box>
  );
}
