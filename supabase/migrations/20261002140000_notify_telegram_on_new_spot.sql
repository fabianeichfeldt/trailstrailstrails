-- =============================================================================
-- Admin notification: a Telegram message for every new trail, bike park and
-- dirt park row.
-- =============================================================================
-- One AFTER INSERT trigger per spot table, all on the same function. Catches
-- every insert path (add-trail, direct anon inserts, SpotManager), including
-- admin-created spots; the message says whether the row still needs approval.
-- Sends via public.send_telegram_message() (20261002130000), so it needs the
-- same two Vault secrets.
--
-- Columns that only some tables have (pumptrack/dirtpark on dirt_parks) are read
-- via to_jsonb(NEW), so one function serves all three tables.
--
-- A spot insert must never fail because of this: the trigger swallows any error.
-- NOT APPLIED automatically by anything but `supabase db push` / SQL editor.

CREATE OR REPLACE FUNCTION "public"."notify_telegram_on_new_spot"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  spot    jsonb := to_jsonb(NEW);
  kind    text;
  kinds   text;
  message text;
BEGIN
  kind := CASE TG_TABLE_NAME
    WHEN 'trails'     THEN '🌲 New trail'
    WHEN 'parks'      THEN '🚠 New bike park'
    WHEN 'dirt_parks' THEN '🏁 New dirt park'
    ELSE format('New %s row', TG_TABLE_NAME)
  END;
  IF TG_TABLE_NAME = 'dirt_parks' THEN
    kinds := nullif(concat_ws(' + ',
      CASE WHEN (spot ->> 'dirtpark')::boolean  THEN 'dirt' END,
      CASE WHEN (spot ->> 'pumptrack')::boolean THEN 'pumptrack' END
    ), '');
  END IF;

  message := concat_ws(E'\n',
    format('%s: %s', kind, coalesce(nullif(NEW."name", ''), '(no name)')),
    CASE WHEN kinds IS NOT NULL THEN format('Type: %s', kinds) END,
    format('Status: %s', CASE WHEN NEW."approved" THEN 'approved' ELSE 'needs review' END),
    format('Creator: %s', coalesce(nullif(NEW."creator", ''), NEW."creator_id"::text, 'anonymous')),
    CASE WHEN nullif(NEW."url", '') IS NOT NULL THEN format('Web: %s', NEW."url") END,
    CASE WHEN nullif(NEW."instagram", '') IS NOT NULL THEN format('Instagram: %s', NEW."instagram") END,
    format('Map: https://www.google.com/maps?q=%s,%s', NEW."latitude", NEW."longitude"),
    format('Id: %s', NEW."id")
  );

  PERFORM "public"."send_telegram_message"(message);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block a spot insert over a notification.
  RAISE WARNING 'notify_telegram_on_new_spot failed for %.%: %', TG_TABLE_NAME, NEW."id", SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."notify_telegram_on_new_spot"() OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."notify_telegram_on_new_spot"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "notify_telegram_on_new_spot" AFTER INSERT ON "public"."trails"
    FOR EACH ROW EXECUTE FUNCTION "public"."notify_telegram_on_new_spot"();
CREATE TRIGGER "notify_telegram_on_new_spot" AFTER INSERT ON "public"."parks"
    FOR EACH ROW EXECUTE FUNCTION "public"."notify_telegram_on_new_spot"();
CREATE TRIGGER "notify_telegram_on_new_spot" AFTER INSERT ON "public"."dirt_parks"
    FOR EACH ROW EXECUTE FUNCTION "public"."notify_telegram_on_new_spot"();
