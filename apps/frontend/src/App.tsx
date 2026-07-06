import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { Box, CircularProgress } from '@mui/material';
import { Layout } from './components/Layout/Layout';
import { TrainingGuardProvider } from './contexts/TrainingGuardContext';
import { Dashboard } from './pages/Dashboard';
import { Sessions } from './pages/Sessions';
import { SessionEditor } from './pages/SessionEditor';
import { EquipmentSummary } from './pages/EquipmentSummary';
import { TrainingMode } from './pages/TrainingMode';
import { CalendarPage } from './pages/CalendarPage';
import { Profile } from './pages/Profile';

export default function App() {
  const { isLoading, isAuthenticated, loginWithRedirect } = useAuth0();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!isAuthenticated) {
    loginWithRedirect();
    return null;
  }

  return (
    <TrainingGuardProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/sessions/new" element={<SessionEditor />} />
          <Route path="/sessions/:id" element={<SessionEditor />} />
          <Route path="/sessions/:id/equipment" element={<EquipmentSummary />} />
          <Route path="/train" element={<TrainingMode />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </TrainingGuardProvider>
  );
}
