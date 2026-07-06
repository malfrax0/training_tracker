import { useLocation, useNavigate } from 'react-router-dom';
import {
  BottomNavigation,
  BottomNavigationAction,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import PersonIcon from '@mui/icons-material/Person';
import { useTrainingGuard } from '../../contexts/TrainingGuardContext';

const NAV_ITEMS = [
  { label: 'Home', icon: <HomeIcon />, path: '/' },
  { label: 'Sessions', icon: <FitnessCenterIcon />, path: '/sessions' },
  { label: 'Calendar', icon: <CalendarMonthIcon />, path: '/calendar' },
  { label: 'Profile', icon: <PersonIcon />, path: '/profile' },
];

export function NavBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { guardedAction } = useTrainingGuard();

  const activeIndex = NAV_ITEMS.findIndex((item) =>
    item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)
  );

  return (
    <BottomNavigation
      value={activeIndex === -1 ? false : activeIndex}
      onChange={(_, value: number) => guardedAction(() => navigate(NAV_ITEMS[value].path))}
    >
      {NAV_ITEMS.map((item) => (
        <BottomNavigationAction
          key={item.path}
          label={item.label}
          icon={item.icon}
          sx={{ color: 'text.secondary', '&.Mui-selected': { color: 'primary.main' } }}
        />
      ))}
    </BottomNavigation>
  );
}
