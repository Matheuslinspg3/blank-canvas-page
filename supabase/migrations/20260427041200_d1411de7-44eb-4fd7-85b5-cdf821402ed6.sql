-- Revoga acesso anônimo às funções SECURITY DEFINER da Fase 3
REVOKE EXECUTE ON FUNCTION public.search_properties_advanced(
  uuid, text, text, text, text, uuid, numeric, numeric, integer, text, text, numeric,
  integer, integer, integer, integer, numeric, numeric, numeric, text[], text, integer,
  text, text[], text[], text, uuid, text
) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.search_properties_advanced(
  uuid, text, text, text, text, uuid, numeric, numeric, integer, text, text, numeric,
  integer, integer, integer, integer, numeric, numeric, numeric, text[], text, integer,
  text, text[], text[], text, uuid, text
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_property_review_dashboard(int) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_property_review_dashboard(int) TO authenticated;