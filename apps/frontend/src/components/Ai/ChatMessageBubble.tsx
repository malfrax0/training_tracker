import { Box, Paper } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import { AiRole } from '../../types/ai';

interface Props {
  role: AiRole;
  content: string;
}

export function ChatMessageBubble({ role, content }: Props) {
  const isUser = role === 'user';

  // Rounds that only proposed tool calls (no text) have nothing meaningful to
  // show in a bubble — rendering an empty one would leave a floating "…"
  // placeholder above the tool call cards. Skip it; content is filled in once
  // the AI follows up after the tool call(s) are resolved.
  if (!content) return null;

  return (
    <Box sx={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }} data-cy="ai-message">
      <Paper
        variant="outlined"
        sx={{
          p: 1,
          px: 1.5,
          maxWidth: '85%',
          bgcolor: isUser ? 'primary.dark' : 'background.paper',
          wordBreak: 'break-word',
          fontSize: '0.875rem',
          '& > :first-of-type': { mt: 0 },
          '& > :last-child': { mb: 0 },
          '& p': { m: 0, mb: 0.75 },
          '& ul, & ol': { m: 0, mb: 0.75, pl: 2.5 },
          '& li': { mb: 0.25 },
          '& pre': {
            m: 0,
            mb: 0.75,
            p: 1,
            borderRadius: 1,
            overflowX: 'auto',
            bgcolor: 'rgba(0,0,0,0.3)',
          },
          '& code': {
            fontFamily: 'monospace',
            fontSize: '0.85em',
            bgcolor: 'rgba(0,0,0,0.25)',
            borderRadius: 0.5,
            px: 0.5,
          },
          '& pre code': { bgcolor: 'transparent', p: 0 },
          '& a': { color: 'primary.light' },
          '& blockquote': {
            m: 0,
            mb: 0.75,
            pl: 1.5,
            borderLeft: '3px solid rgba(255,255,255,0.2)',
            color: 'text.secondary',
          },
          '& h1, & h2, & h3, & h4, & h5, & h6': { m: 0, mb: 0.5, mt: 1, fontSize: '1em', fontWeight: 700 },
          '& table': { borderCollapse: 'collapse', mb: 0.75 },
          '& th, & td': { border: '1px solid rgba(255,255,255,0.2)', px: 0.75, py: 0.25 },
        }}
      >
        <ReactMarkdown>{content}</ReactMarkdown>
      </Paper>
    </Box>
  );
}
