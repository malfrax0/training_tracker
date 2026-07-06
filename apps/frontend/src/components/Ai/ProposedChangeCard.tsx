import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { Session } from '../../types';
import { AiToolName, ProposedChange } from '../../types/ai';

interface Props {
  change: ProposedChange;
  session: Session;
  onApprove: () => void;
  onReject: () => void;
  disabled?: boolean;
}

const TOOL_LABELS: Record<AiToolName, string> = {
  update_session_meta: 'Update session details',
  update_schedule: 'Update schedule',
  add_exercise: 'Add exercise',
  update_exercise: 'Update exercise',
  delete_exercise: 'Delete exercise',
  reorder_exercises: 'Reorder exercises',
  search_exercise_image: 'Search exercise image',
  get_exercises: 'Get exercises',
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function describeChange(change: ProposedChange, session: Session): string {
  const { toolName, args } = change;
  switch (toolName) {
    case 'update_session_meta':
      return [
        typeof args.name === 'string' ? `name → "${args.name}"` : null,
        typeof args.description === 'string' ? `description → "${args.description}"` : null,
      ]
        .filter(Boolean)
        .join(', ') || 'No changes specified';
    case 'update_schedule': {
      const days = Array.isArray(args.days) ? args.days.map((d) => DAY_NAMES[Number(d)] ?? d).join(', ') : '';
      return `Days: ${days || 'none'}`;
    }
    case 'add_exercise':
      return typeof args.name === 'string' ? `"${args.name}"` : 'New exercise';
    case 'update_exercise': {
      const exercise = session.exercises.find((e) => e.id === args.exerciseId);
      const fields = Object.keys(args).filter((k) => k !== 'exerciseId');
      return `${exercise?.name ?? args.exerciseId ?? 'unknown exercise'} — ${fields.length ? fields.join(', ') : 'no fields'}`;
    }
    case 'delete_exercise': {
      const exercise = session.exercises.find((e) => e.id === args.exerciseId);
      return exercise?.name ?? String(args.exerciseId ?? 'unknown exercise');
    }
    case 'reorder_exercises': {
      const ids = Array.isArray(args.orderedIds) ? args.orderedIds : [];
      const names = ids.map((id) => session.exercises.find((e) => e.id === id)?.name ?? id);
      return names.join(' → ');
    }
    default:
      return JSON.stringify(args);
  }
}

const STATUS_CHIP: Record<ProposedChange['status'], { label: string; color: 'default' | 'success' | 'error' | 'warning' }> = {
  pending: { label: 'Pending approval', color: 'warning' },
  approved: { label: 'Applied', color: 'success' },
  rejected: { label: 'Rejected', color: 'default' },
  error: { label: 'Failed', color: 'error' },
};

export function ProposedChangeCard({ change, session, onApprove, onReject, disabled }: Props) {
  const chip = STATUS_CHIP[change.status];
  const isImageCandidate = Boolean(change.groupId);
  const imageUrl = isImageCandidate && typeof change.args.imageData === 'string' ? change.args.imageData : undefined;

  return (
    <Paper
      variant="outlined"
      sx={{ p: 1.5, mt: 1, bgcolor: 'background.default' }}
      data-cy="ai-proposed-change"
      data-status={change.status}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Typography variant="subtitle2" fontWeight={600}>
          {isImageCandidate && change.groupTotal
            ? `Image option ${change.groupIndex} of ${change.groupTotal}`
            : (TOOL_LABELS[change.toolName] ?? change.toolName)}
        </Typography>
        <Chip size="small" label={chip.label} color={chip.color} data-cy="ai-proposed-change-status" />
      </Stack>

      {imageUrl && (
        <Box
          component="img"
          src={imageUrl}
          alt="Exercise photo preview"
          data-cy="ai-image-candidate-preview"
          sx={{ display: 'block', mt: 1, maxWidth: '100%', maxHeight: 160, borderRadius: 1, mx: 'auto' }}
        />
      )}

      {!isImageCandidate && (
        <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-word' }}>
          {describeChange(change, session)}
        </Typography>
      )}

      {change.status === 'error' && change.errorMessage && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
          {change.errorMessage}
        </Typography>
      )}

      {change.status === 'pending' && (
        <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
          <Button size="small" variant="contained" onClick={onApprove} disabled={disabled} data-cy="ai-approve-change-btn">
            {isImageCandidate ? 'Use this photo' : 'Approve'}
          </Button>
          <Button size="small" variant="outlined" onClick={onReject} disabled={disabled} data-cy="ai-reject-change-btn">
            {isImageCandidate ? 'Not this one' : 'Reject'}
          </Button>
        </Box>
      )}
    </Paper>
  );
}
