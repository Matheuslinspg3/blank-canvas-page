-- Migration: Fix PGRST203 ambiguous function overload on search_properties_advanced
--
-- Context: 20260603030000_add_street_filter.sql used CREATE OR REPLACE FUNCTION
-- but ADDED a new parameter (p_streets text[]). Adding a parameter changes the
-- function signature, so Postgres created a SECOND overload (30 params) instead
-- of replacing the previous one (29 params). PostgREST then cannot choose between
-- the two candidates and returns PGRST203 ("Could not choose the best candidate
-- function"). This drops the stale 29-parameter overload, leaving only the
-- 30-parameter version (with p_streets) live.

DROP FUNCTION IF EXISTS public.search_properties_advanced(
  uuid, text, text, text, text, uuid, numeric, numeric, integer, text, text, numeric,
  integer, integer, integer, integer, numeric, numeric, numeric, text[], text, integer,
  text, text[], text[], text, uuid, text, uuid[]
);
