import { ToggleButton, ToggleButtonGroup, Typography, Box } from '@mui/material';
import { DAY_LABELS, DayOfWeek } from '../../types';

interface Props {
  value: number[];
  onChange: (days: number[]) => void;
}

const DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

export function ScheduleDayPicker({ value, onChange }: Props) {
  const toggle = (day: DayOfWeek) => {
    if (value.includes(day)) {
      onChange(value.filter((d) => d !== day));
    } else {
      onChange([...value, day].sort((a, b) => a - b));
    }
  };

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" gutterBottom display="block">
        Recurring days
      </Typography>
      <ToggleButtonGroup value={value} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {DAYS.map((day) => (
          <ToggleButton
            key={day}
            value={day}
            selected={value.includes(day)}
            onClick={() => toggle(day)}
            size="small"
            sx={{ minWidth: 44 }}
          >
            {DAY_LABELS[day]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}
