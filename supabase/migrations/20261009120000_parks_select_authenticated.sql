-- The legacy parks SELECT policy is anon/service_role only, so the SpotManager
-- (which queries with the user's JWT) silently got zero bikeparks.
DROP POLICY IF EXISTS "select authenticated" ON public.parks;
CREATE POLICY "select authenticated" ON public.parks
  FOR SELECT TO authenticated USING (true);
