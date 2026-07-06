/**
 * Whether the AI assistant feature should be hidden entirely.
 *
 * Controlled by the `VITE_NO_AI` build-time env var (see .env / .env.example).
 * Truthy values ("true", "TRUE", "1") disable the feature; anything else
 * (empty, "false", "0", or unset) keeps it enabled — this matches the default,
 * opt-out behavior so existing deployments without the var keep working.
 */
export const AI_DISABLED = /^(true|1)$/i.test((import.meta.env.VITE_NO_AI ?? '').trim());
