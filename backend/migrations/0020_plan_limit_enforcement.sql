-- Plan limits enforced atomically in the database, plus the downgrade policy.
--
-- The application keeps the friendly pre-checks; these triggers are the backstop that makes the
-- limits race-free (a per-team advisory lock serialises concurrent inserts) and covers every insert path.

CREATE TABLE IF NOT EXISTS plan_limits (
    plan         VARCHAR(20) PRIMARY KEY,
    max_monitors BIGINT NOT NULL,
    max_members  BIGINT NOT NULL
);

-- Rust (plans.rs) stays the source of truth and re-syncs these rows on every start.
INSERT INTO plan_limits (plan, max_monitors, max_members) VALUES
    ('FREE', 20, 1),
    ('PRO', 100, 10)
ON CONFLICT (plan) DO NOTHING;

-- Downgrade policy: a Pro -> Free change starts a grace period; afterwards the background
-- enforcer pauses monitors / suspends members over the Free limits and raises short intervals.
-- Everything it touches is flagged so an upgrade restores it exactly.
ALTER TABLE teams    ADD COLUMN IF NOT EXISTS plan_downgraded_at TIMESTAMPTZ;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS paused_by_plan BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS original_interval_seconds INTEGER;
ALTER TABLE users    ADD COLUMN IF NOT EXISTS suspended_by_plan BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION enforce_monitor_limit() RETURNS trigger AS $$
DECLARE
    team_plan TEXT;
    lim BIGINT;
    cnt BIGINT;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('monitors:' || NEW.team_id::text, 0));
    SELECT plan INTO team_plan FROM teams WHERE id = NEW.team_id;
    SELECT max_monitors INTO lim FROM plan_limits
        WHERE plan = CASE WHEN team_plan = 'PRO' THEN 'PRO' ELSE 'FREE' END;
    IF lim IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT COUNT(*) INTO cnt FROM monitors WHERE team_id = NEW.team_id;
    IF cnt >= lim THEN
        RAISE EXCEPTION 'Monitor limit reached (% max on the % plan).', lim, COALESCE(team_plan, 'FREE')
            USING ERRCODE = 'check_violation', HINT = 'plan_limit';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS monitors_limit_trigger ON monitors;
CREATE TRIGGER monitors_limit_trigger BEFORE INSERT ON monitors
    FOR EACH ROW EXECUTE FUNCTION enforce_monitor_limit();

CREATE OR REPLACE FUNCTION enforce_member_limit() RETURNS trigger AS $$
DECLARE
    team_plan TEXT;
    lim BIGINT;
    cnt BIGINT;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('members:' || NEW.team_id::text, 0));
    SELECT plan INTO team_plan FROM teams WHERE id = NEW.team_id;
    SELECT max_members INTO lim FROM plan_limits
        WHERE plan = CASE WHEN team_plan = 'PRO' THEN 'PRO' ELSE 'FREE' END;
    IF lim IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT COUNT(*) INTO cnt FROM users WHERE team_id = NEW.team_id;
    IF cnt >= lim THEN
        RAISE EXCEPTION 'Team member limit reached (% max on the % plan).', lim, COALESCE(team_plan, 'FREE')
            USING ERRCODE = 'check_violation', HINT = 'plan_limit';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_limit_trigger ON users;
CREATE TRIGGER users_limit_trigger BEFORE INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION enforce_member_limit();

-- Resuming a monitor on a non-Pro team must not push the number of running monitors over the limit
-- (this is what stops a downgraded team from un-pausing everything the enforcer paused).
CREATE OR REPLACE FUNCTION enforce_resume_limit() RETURNS trigger AS $$
DECLARE
    team_plan TEXT;
    lim BIGINT;
    active BIGINT;
BEGIN
    IF OLD.is_paused AND NOT NEW.is_paused THEN
        NEW.paused_by_plan := FALSE;
        PERFORM pg_advisory_xact_lock(hashtextextended('monitors:' || NEW.team_id::text, 0));
        SELECT plan INTO team_plan FROM teams WHERE id = NEW.team_id;
        IF team_plan IS DISTINCT FROM 'PRO' THEN
            SELECT max_monitors INTO lim FROM plan_limits WHERE plan = 'FREE';
            SELECT COUNT(*) INTO active FROM monitors
                WHERE team_id = NEW.team_id AND NOT is_paused AND id <> NEW.id;
            IF lim IS NOT NULL AND active >= lim THEN
                RAISE EXCEPTION 'Cannot resume: % monitors are already running (% max on the FREE plan).', active, lim
                    USING ERRCODE = 'check_violation', HINT = 'plan_limit';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS monitors_resume_trigger ON monitors;
CREATE TRIGGER monitors_resume_trigger BEFORE UPDATE OF is_paused ON monitors
    FOR EACH ROW EXECUTE FUNCTION enforce_resume_limit();

-- Every plan change path (checkout webhook, cancellation, admin, API) goes through the teams row,
-- so the downgrade bookkeeping lives here instead of in each handler.
CREATE OR REPLACE FUNCTION track_plan_change() RETURNS trigger AS $$
BEGIN
    IF NEW.plan IS DISTINCT FROM OLD.plan THEN
        IF NEW.plan = 'PRO' THEN
            NEW.plan_downgraded_at := NULL;
        ELSIF OLD.plan = 'PRO' THEN
            NEW.plan_downgraded_at := NOW();
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS teams_plan_change_before ON teams;
CREATE TRIGGER teams_plan_change_before BEFORE UPDATE OF plan ON teams
    FOR EACH ROW EXECUTE FUNCTION track_plan_change();

-- Upgrade: undo everything the enforcer did.
CREATE OR REPLACE FUNCTION restore_after_upgrade() RETURNS trigger AS $$
BEGIN
    IF NEW.plan = 'PRO' AND OLD.plan IS DISTINCT FROM 'PRO' THEN
        UPDATE monitors
            SET interval_seconds = original_interval_seconds, original_interval_seconds = NULL
            WHERE team_id = NEW.id AND original_interval_seconds IS NOT NULL;
        UPDATE monitors
            SET is_paused = FALSE, paused_by_plan = FALSE, status = 'PENDING', updated_at = NOW()
            WHERE team_id = NEW.id AND paused_by_plan;
        UPDATE users
            SET is_active = TRUE, suspended_by_plan = FALSE
            WHERE team_id = NEW.id AND suspended_by_plan;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS teams_plan_change_after ON teams;
CREATE TRIGGER teams_plan_change_after AFTER UPDATE OF plan ON teams
    FOR EACH ROW EXECUTE FUNCTION restore_after_upgrade();
