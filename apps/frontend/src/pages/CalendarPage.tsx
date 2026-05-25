import { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { WorkoutCalendar } from '../components/Calendar/WorkoutCalendar';
import { useWorkoutsApi } from '../api/workouts';
import { WorkoutLog } from '../types';
import { LoadingSpinner } from '../components/Common/LoadingSpinner';
import { ErrorAlert } from '../components/Common/ErrorAlert';

export function CalendarPage() {
  const api = useWorkoutsApi();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const from = new Date(year, month, 1);
    const to = new Date(year, month + 1, 0, 23, 59, 59);
    api.listWorkouts(from, to)
      .then((data) => {
        setWorkouts(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [year, month]);

  return (
    <Box sx={{ p: 2 }} data-cy="calendar-page">
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Calendar
      </Typography>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorAlert message={error} />
      ) : (
        <WorkoutCalendar
          workouts={workouts}
          year={year}
          month={month}
          onMonthChange={(y, m) => { setYear(y); setMonth(m); }}
        />
      )}
    </Box>
  );
}
