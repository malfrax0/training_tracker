import { useAuth0 } from '@auth0/auth0-react';
import {
  Box,
  Typography,
  Avatar,
  Button,
  Card,
  CardContent,
  Stack,
  Divider,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';

export function Profile() {
  const { user, logout } = useAuth0();

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Profile
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar
              src={user?.picture}
              alt={user?.name}
              sx={{ width: 64, height: 64 }}
            />
            <Box>
              <Typography variant="h6" fontWeight={600}>
                {user?.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user?.email}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Divider sx={{ mb: 3 }} />

      <Button
        variant="outlined"
        color="error"
        startIcon={<LogoutIcon />}
        data-cy="logout-btn"
        onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
        fullWidth
      >
        Log out
      </Button>
    </Box>
  );
}
