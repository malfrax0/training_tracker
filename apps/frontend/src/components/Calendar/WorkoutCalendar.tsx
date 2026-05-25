import { useState } from 'react';
import { Box, Typography, Paper, Chip, Dialog, DialogTitle, DialogContent, List, ListItem, ListItemText, Divider } from '@mui/material';
import { WorkoutLog } from '../../types';

interface Props {
  workouts: WorkoutLog[];
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WorkoutCalendar({ workouts, year, month, onMonthChange }: Props) {
  const [selected, setSelected] = useState<WorkoutLog[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const workoutsByDay = workouts.reduce<Record<number, WorkoutLog[]>>((acc, w) => {
    const d = new Date(w.startedAt);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      acc[day] = [...(acc[day] ?? []), w];
    }
    return acc;
  }, {});

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const goToPrev = () => {
    if (month === 0) onMonthChange(year - 1, 11);
    else onMonthChange(year, month - 1);
  };

  const goToNext = () => {
    if (month === 11) onMonthChange(year + 1, 0);
    else onMonthChange(year, month + 1);
  };

  const handleDayClick = (day: number) => {
    const dayWorkouts = workoutsByDay[day];
    if (!dayWorkouts?.length) return;
    setSelected(dayWorkouts);
    setDialogOpen(true);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Chip label="‹" onClick={goToPrev} clickable sx={{ fontSize: '1.25rem' }} />
        <Typography variant="h6" fontWeight={700}>
          {MONTH_NAMES[month]} {year}
        </Typography>
        <Chip label="›" onClick={goToNext} clickable sx={{ fontSize: '1.25rem' }} />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5, mb: 1 }}>
        {DAY_HEADERS.map((d) => (
          <Typography key={d} variant="caption" align="center" color="text.secondary" fontWeight={600}>
            {d}
          </Typography>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
        {cells.map((day, idx) => {
          const hasWorkout = day !== null && (workoutsByDay[day]?.length ?? 0) > 0;
          const isToday =
            day !== null &&
            new Date().getDate() === day &&
            new Date().getMonth() === month &&
            new Date().getFullYear() === year;

          return (
            <Paper
              key={idx}
              elevation={0}
              onClick={() => day && handleDayClick(day)}
              data-cy={day !== null ? (hasWorkout ? 'workout-day' : 'calendar-day') : undefined}
              sx={{
                aspectRatio: '1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: hasWorkout ? 'pointer' : 'default',
                bgcolor: isToday ? 'primary.main' : hasWorkout ? 'rgba(255,107,53,0.15)' : 'background.paper',
                borderRadius: 2,
                border: isToday ? 'none' : hasWorkout ? '1px solid rgba(255,107,53,0.4)' : '1px solid transparent',
                '&:hover': hasWorkout ? { bgcolor: 'rgba(255,107,53,0.25)' } : {},
              }}
            >
              {day !== null && (
                <>
                  <Typography variant="body2" fontWeight={isToday ? 700 : 400}>
                    {day}
                  </Typography>
                  {hasWorkout && (
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: isToday ? 'white' : 'primary.main',
                        mt: 0.25,
                      }}
                    />
                  )}
                </>
              )}
            </Paper>
          );
        })}
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Workouts</DialogTitle>
        <DialogContent>
          <List>
            {selected.map((w, i) => (
              <Box key={w.id}>
                {i > 0 && <Divider />}
                <ListItem>
                  <ListItemText
                    primary={w.sessionName ?? 'Free workout'}
                    secondary={`${new Date(w.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${w.isComplete ? 'Completed' : 'Partial'}`}
                  />
                </ListItem>
              </Box>
            ))}
          </List>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
