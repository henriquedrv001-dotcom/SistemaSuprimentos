CREATE TABLE IF NOT EXISTS app_workspace (id integer PRIMARY KEY CHECK(id=1), revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0));
INSERT INTO app_workspace(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE app_users (
  id text PRIMARY KEY, email text NOT NULL UNIQUE CHECK(email=lower(email)), name text NOT NULL,
  password_hash text NOT NULL, role text NOT NULL CHECK(role IN ('admin','editor','reader')),
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app_sessions (
  token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON app_sessions(expires_at);
CREATE TABLE app_login_limits (bucket text PRIMARY KEY, attempts integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE catalog_items (
  id text PRIMARY KEY, code text NOT NULL, unit text NOT NULL, payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
  deleted_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(payload->>'id'=id AND payload->>'code'=code AND payload->>'unit'=unit)
);
CREATE UNIQUE INDEX catalog_active_code ON catalog_items(upper(btrim(code))) WHERE deleted_at IS NULL;
CREATE TABLE catalog_history (
  position bigserial UNIQUE,
  id text PRIMARY KEY, item_id text NOT NULL REFERENCES catalog_items(id),
  actor_id text NOT NULL REFERENCES app_users(id), payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE expiry_lots (
  id text PRIMARY KEY, item_id text NOT NULL REFERENCES catalog_items(id) ON DELETE RESTRICT,
  initial_milli bigint NOT NULL CHECK(initial_milli>0 AND initial_milli<=9007199254740991),
  remaining_milli bigint NOT NULL CHECK(remaining_milli>=0 AND remaining_milli<=9007199254740991),
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
  CHECK(payload->>'id'=id AND payload->>'itemId'=item_id AND (payload->>'initialMilli')::bigint=initial_milli AND (payload->>'remainingMilli')::bigint=remaining_milli)
);
CREATE INDEX ON expiry_lots(item_id);
CREATE TABLE expiry_movements (
  position bigserial UNIQUE,
  id text PRIMARY KEY, lot_id text NOT NULL REFERENCES expiry_lots(id) ON DELETE RESTRICT,
  counterpart_lot_id text REFERENCES expiry_lots(id) ON DELETE RESTRICT,
  actor_id text NOT NULL REFERENCES app_users(id), reference_id text UNIQUE, transfer_id text,
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'), created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(payload->>'id'=id AND payload->>'lotId'=lot_id)
);
CREATE INDEX ON expiry_movements(lot_id,created_at);
CREATE TABLE app_audit (
  id text PRIMARY KEY, actor_id text NOT NULL REFERENCES app_users(id), action text NOT NULL,
  revision bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION preserve_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Historical records are append-only'; END $$;
CREATE TRIGGER immutable_catalog_history BEFORE UPDATE OR DELETE ON catalog_history FOR EACH ROW EXECUTE FUNCTION preserve_event();
CREATE TRIGGER immutable_expiry_movements BEFORE UPDATE OR DELETE ON expiry_movements FOR EACH ROW EXECUTE FUNCTION preserve_event();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON app_audit FOR EACH ROW EXECUTE FUNCTION preserve_event();
