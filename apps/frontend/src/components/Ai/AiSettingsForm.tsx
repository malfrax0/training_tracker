import { useState } from 'react';
import { Alert, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { useAiConfig } from '../../hooks/useAiConfig';
import { testAiConnection } from '../../api/aiClient';

export function AiSettingsForm() {
  const { config, updateConfig } = useAiConfig();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    const res = await testAiConnection(config);
    setResult(res);
    setTesting(false);
  };

  return (
    <Card data-cy="ai-settings-form">
      <CardContent>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          AI Assistant
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Connect any OpenAI-compatible endpoint — OpenAI, LM Studio, Ollama, etc. Settings are stored only in this
          browser and sent directly to the endpoint below (never through our server).
        </Typography>
        <Stack spacing={2}>
          <TextField
            label="Base URL"
            value={config.baseUrl}
            onChange={(e) => updateConfig({ baseUrl: e.target.value, toolsSupported: null })}
            fullWidth
            placeholder="http://localhost:1234"
            helperText="e.g. https://api.openai.com or a local LM Studio server URL. Enable CORS in LM Studio's server settings."
            inputProps={{ 'data-cy': 'ai-base-url-input' }}
          />
          <TextField
            label="API Key (optional)"
            value={config.apiKey}
            onChange={(e) => updateConfig({ apiKey: e.target.value })}
            fullWidth
            type="password"
            inputProps={{ 'data-cy': 'ai-api-key-input' }}
          />
          <TextField
            label="Model"
            value={config.model}
            onChange={(e) => updateConfig({ model: e.target.value, toolsSupported: null })}
            fullWidth
            placeholder="mistralai/ministral-3-3b"
            inputProps={{ 'data-cy': 'ai-model-input' }}
          />
          <Button variant="outlined" onClick={handleTest} disabled={testing} data-cy="ai-test-connection-btn">
            {testing ? 'Testing…' : 'Test connection'}
          </Button>
          {result && (
            <Alert severity={result.ok ? 'success' : 'error'} data-cy="ai-test-connection-result">
              {result.message}
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
