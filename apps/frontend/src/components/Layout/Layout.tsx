import { ReactNode } from 'react';
import { Box } from '@mui/material';
import { NavBar } from './NavBar';

interface Props {
  children: ReactNode;
}

export function Layout({ children }: Props) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        bgcolor: 'background.default',
        maxWidth: 600,
        mx: 'auto',
        position: 'relative',
      }}
    >
      <Box sx={{ flex: 1, pb: 8, overflow: 'auto' }}>{children}</Box>
      <Box sx={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 600, zIndex: 100 }}>
        <NavBar />
      </Box>
    </Box>
  );
}
