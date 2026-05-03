BEGIN;

CREATE OR REPLACE FUNCTION public.transition_war_states()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _now timestamptz := now();
  _started integer := 0;
  _resolved integer := 0;
  _cooled integer := 0;
  _ch record;
  _attacker_kills integer;
  _defender_kills integer;
  _attacker_wins boolean;
  _winner_clan_id uuid;
  _winner_name text;
  _winner_color text;
  _territory record;
BEGIN
  -- 1. pending -> active
  FOR _ch IN
    SELECT * FROM territory_challenges
     WHERE status = 'pending' AND war_starts_at <= _now
     FOR UPDATE
  LOOP
    UPDATE territory_challenges
       SET status = 'active', updated_at = _now
     WHERE id = _ch.id;
    UPDATE territories
       SET war_state = 'active_war', updated_at = _now
     WHERE id = _ch.territory_id;
    INSERT INTO territory_history
      (territory_id, territory_name, clan_id, clan_name, clan_color, event_type)
    VALUES
      (_ch.territory_id,
       (SELECT name FROM territories WHERE id = _ch.territory_id),
       _ch.attacker_clan_id, _ch.attacker_clan_name, _ch.attacker_clan_color,
       'war_started');
    _started := _started + 1;
  END LOOP;

  -- 2. active -> resolved (auto from kill count)
  FOR _ch IN
    SELECT * FROM territory_challenges
     WHERE status = 'active' AND war_ends_at <= _now
     FOR UPDATE
  LOOP
    SELECT COALESCE(SUM(CASE WHEN killer_clan_id = _ch.attacker_clan_id THEN 1 ELSE 0 END), 0),
           COALESCE(SUM(CASE WHEN killer_clan_id = _ch.defender_clan_id THEN 1 ELSE 0 END), 0)
      INTO _attacker_kills, _defender_kills
      FROM war_kills
     WHERE challenge_id = _ch.id;

    _attacker_wins := _attacker_kills > _defender_kills;

    IF _attacker_wins THEN
      _winner_clan_id := _ch.attacker_clan_id;
      _winner_name    := _ch.attacker_clan_name;
      _winner_color   := _ch.attacker_clan_color;
    ELSE
      _winner_clan_id := _ch.defender_clan_id;
      _winner_name    := _ch.defender_clan_name;
      _winner_color   := _ch.defender_clan_color;
    END IF;

    UPDATE territory_challenges
       SET status      = 'resolved',
           resolution  = CASE WHEN _attacker_wins THEN 'attacker_won' ELSE 'defender_held' END,
           resolved_at = _now,
           updated_at  = _now
     WHERE id = _ch.id AND status = 'active';
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    SELECT * INTO _territory FROM territories WHERE id = _ch.territory_id;

    IF _attacker_wins THEN
      UPDATE territories
         SET owning_clan_id    = _ch.attacker_clan_id,
             claimed_at        = _now,
             war_state         = 'cooldown',
             war_cooldown_until = _ch.cooldown_ends_at,
             updated_at        = _now
       WHERE id = _ch.territory_id;
    ELSE
      UPDATE territories
         SET war_state         = 'cooldown',
             war_cooldown_until = _ch.cooldown_ends_at,
             updated_at        = _now
       WHERE id = _ch.territory_id;
    END IF;

    INSERT INTO territory_history
      (territory_id, territory_name, clan_id, clan_name, clan_color, event_type)
    VALUES
      (_ch.territory_id,
       COALESCE(_territory.name, _ch.territory_id),
       _winner_clan_id, _winner_name, _winner_color,
       CASE WHEN _attacker_wins THEN 'territory_captured' ELSE 'territory_defended' END);

    _resolved := _resolved + 1;
  END LOOP;

  -- 3. cooldown -> peaceful
  UPDATE territories
     SET war_state = 'peaceful', updated_at = _now
   WHERE war_state = 'cooldown'
     AND war_cooldown_until IS NOT NULL
     AND war_cooldown_until <= _now;
  GET DIAGNOSTICS _cooled = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'started', _started,
    'resolved', _resolved,
    'cooled', _cooled,
    'now', _now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transition_war_states() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_war_states()
  TO anon, authenticated, service_role;

COMMIT;