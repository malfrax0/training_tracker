export const INITIAL_MIGRATION = `
  CREATE TABLE IF NOT EXISTS users (
    id          VARCHAR(255) PRIMARY KEY,
    created_at  TIMESTAMPTZ  DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ  DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS session_schedules (
    session_id  UUID     NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    PRIMARY KEY (session_id, day_of_week)
  );

  CREATE TABLE IF NOT EXISTS exercises (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID         NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    nb_series           INTEGER      NOT NULL DEFAULT 3,
    default_weight_kg   DECIMAL(6,2) NOT NULL DEFAULT 0,
    rest_timer_seconds  INTEGER      NOT NULL DEFAULT 60,
    sort_order          INTEGER      NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ  DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS workout_logs (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id  UUID         REFERENCES sessions(id) ON DELETE SET NULL,
    started_at  TIMESTAMPTZ  DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    is_complete BOOLEAN      DEFAULT FALSE
  );

  CREATE TABLE IF NOT EXISTS workout_set_logs (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_log_id  UUID         NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
    exercise_id     UUID         REFERENCES exercises(id) ON DELETE SET NULL,
    set_number      INTEGER      NOT NULL,
    weight_kg       DECIMAL(6,2),
    done_at         TIMESTAMPTZ  DEFAULT NOW()
  );
`;
