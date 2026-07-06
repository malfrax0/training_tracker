import { useCallback, useEffect, useState } from 'react';
import { AiConfig, DEFAULT_AI_CONFIG } from '../types/ai';

const STORAGE_KEY = 'tt.aiConfig';

function readConfig(): AiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AI_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_AI_CONFIG, ...parsed };
  } catch {
    return DEFAULT_AI_CONFIG;
  }
}

function writeConfig(config: AiConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // localStorage unavailable/full — config just won't persist across reloads
  }
}

export function useAiConfig() {
  const [config, setConfig] = useState<AiConfig>(readConfig);

  useEffect(() => {
    writeConfig(config);
  }, [config]);

  const updateConfig = useCallback((patch: Partial<AiConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const setToolsSupported = useCallback((value: boolean | null) => {
    setConfig((prev) => ({ ...prev, toolsSupported: value }));
  }, []);

  const isConfigured = Boolean(config.baseUrl.trim() && config.model.trim());

  return { config, updateConfig, setToolsSupported, isConfigured };
}
