-- =============================================================================
-- Admin notification: a Telegram message for every new signup, plus the
-- send_telegram_message() helper every notification trigger uses.
-- =============================================================================
-- An AFTER INSERT trigger on auth.users queues a pg_net request to the Telegram
-- Bot API. pg_net only enqueues inside the transaction; its background worker
-- sends after commit, so a rolled-back signup sends nothing and the signup never
-- waits on Telegram.
--
-- Secrets live in Supabase Vault, NOT in this file. Create them once (SQL editor):
--   select vault.create_secret('<bot token>', 'telegram_bot_token');
--   select vault.create_secret('<chat id>',   'telegram_chat_id');
-- Without them send_telegram_message() logs a warning and skips.
--
-- The message deliberately carries no email address (no personal data sent to
-- Telegram); look the user up by id in the dashboard. Email signups have no name
-- yet at insert time (the nickname is set by a later updateUser call), OAuth
-- signups carry the provider's name.
--
-- Signup must never fail because of this: the trigger swallows any error.
-- NOT APPLIED automatically by anything but `supabase db push` / SQL editor.

CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Shared by every admin-notification trigger (signups, new spots). Queues one
-- plain-text message (no parse_mode, so user-written text needs no escaping).
CREATE OR REPLACE FUNCTION "public"."send_telegram_message"("p_text" text) RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  bot_token text;
  chat_id   text;
BEGIN
  SELECT s."decrypted_secret" INTO bot_token FROM "vault"."decrypted_secrets" s WHERE s."name" = 'telegram_bot_token';
  SELECT s."decrypted_secret" INTO chat_id   FROM "vault"."decrypted_secrets" s WHERE s."name" = 'telegram_chat_id';
  IF bot_token IS NULL OR chat_id IS NULL THEN
    RAISE WARNING 'send_telegram_message: telegram_bot_token / telegram_chat_id missing in vault, skipping';
    RETURN;
  END IF;

  PERFORM "net"."http_post"(
    url     := format('https://api.telegram.org/bot%s/sendMessage', bot_token),
    -- Telegram's limit is 4096 characters.
    body    := jsonb_build_object('chat_id', chat_id, 'text', left(p_text, 4096), 'disable_web_page_preview', true),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
END;
$$;

ALTER FUNCTION "public"."send_telegram_message"(text) OWNER TO "postgres";
-- Internal helper: only the notification triggers call it.
REVOKE ALL ON FUNCTION "public"."send_telegram_message"(text) FROM PUBLIC, "anon", "authenticated";


CREATE OR REPLACE FUNCTION "public"."notify_telegram_on_signup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  user_count bigint;
  user_name  text;
  message    text;
BEGIN
  SELECT count(*) INTO user_count FROM "auth"."users";
  user_name := coalesce(NEW."raw_user_meta_data" ->> 'name', NEW."raw_user_meta_data" ->> 'full_name');

  message := concat_ws(E'\n',
    format('👤 New TrailRadar sign-up (#%s)', user_count),
    format('Via: %s', coalesce(NEW."raw_app_meta_data" ->> 'provider', 'unknown')),
    CASE WHEN user_name IS NOT NULL THEN format('Name: %s', user_name) END,
    format('User: %s', NEW."id")
  );

  PERFORM "public"."send_telegram_message"(message);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block a signup over a notification.
  RAISE WARNING 'notify_telegram_on_signup failed for user %: %', NEW."id", SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."notify_telegram_on_signup"() OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."notify_telegram_on_signup"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "notify_telegram_on_signup" AFTER INSERT ON "auth"."users"
    FOR EACH ROW EXECUTE FUNCTION "public"."notify_telegram_on_signup"();
