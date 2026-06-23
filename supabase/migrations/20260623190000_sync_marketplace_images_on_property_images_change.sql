-- =============================================================================
-- Fix: imagens enviadas não aparecem nos imóveis do marketplace (Portal do corretor)
-- =============================================================================
--
-- Contexto / causa raiz:
--   O marketplace público (vitrine "Portal do corretor") é servido a partir da
--   tabela materializada `marketplace_properties`, cujo array `images` é
--   reconstruído apenas pelo trigger `trg_sync_marketplace_on_property_update`,
--   que dispara em `AFTER UPDATE ON properties`.
--
--   As fotos, porém, vivem em `property_images`. O único trigger sobre essa
--   tabela (`trg_sync_cover_image`) atualiza apenas `properties.cover_image_url`,
--   nunca `marketplace_properties.images`.
--
--   Resultado: quando o usuário apenas envia/remove/reordena fotos (sem editar o
--   imóvel), o array `images` da vitrine não é atualizado. Após a transição de
--   storage (Cloudinary -> Cloudflare R2), os novos uploads passaram a gravar em
--   `property_images` sem nunca propagar para o marketplace -> "imagens enviadas
--   não aparecem nos imóveis".
--
-- Correção:
--   1. Função que reagrega `property_images.url` em `marketplace_properties.images`
--      para um dado property_id (mesma ordenação usada no restante do projeto:
--      display_order ASC NULLS LAST).
--   2. Trigger em `property_images` (INSERT/UPDATE/DELETE) que chama a função.
--   3. Backfill único para corrigir os imóveis já afetados.
-- =============================================================================

-- 1. Função utilitária: reconstrói o array de imagens do marketplace para 1 imóvel
CREATE OR REPLACE FUNCTION public.refresh_marketplace_images(p_property_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_image_urls text[];
BEGIN
  -- Só faz sentido se o imóvel está publicado no marketplace
  IF NOT EXISTS (SELECT 1 FROM public.marketplace_properties WHERE id = p_property_id) THEN
    RETURN;
  END IF;

  SELECT array_agg(pi.url ORDER BY pi.display_order ASC NULLS LAST)
  INTO v_image_urls
  FROM public.property_images pi
  WHERE pi.property_id = p_property_id
    AND pi.url IS NOT NULL
    AND pi.url <> '';

  UPDATE public.marketplace_properties
  SET images = COALESCE(v_image_urls, '{}'),
      updated_at = now()
  WHERE id = p_property_id;
END;
$$;

-- 2. Trigger function sobre property_images
CREATE OR REPLACE FUNCTION public.tg_sync_marketplace_images()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_property_id uuid;
BEGIN
  v_property_id := COALESCE(NEW.property_id, OLD.property_id);
  IF v_property_id IS NOT NULL THEN
    PERFORM public.refresh_marketplace_images(v_property_id);
  END IF;
  RETURN NULL; -- AFTER trigger, valor de retorno é ignorado
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_marketplace_images ON public.property_images;
CREATE TRIGGER trg_sync_marketplace_images
AFTER INSERT OR UPDATE OR DELETE ON public.property_images
FOR EACH ROW
EXECUTE FUNCTION public.tg_sync_marketplace_images();

-- 3. Backfill: corrige todos os imóveis já publicados que ficaram com images
--    desatualizado/vazio após a transição de storage.
UPDATE public.marketplace_properties mp
SET images = COALESCE(sub.urls, '{}'),
    updated_at = now()
FROM (
  SELECT pi.property_id,
         array_agg(pi.url ORDER BY pi.display_order ASC NULLS LAST) AS urls
  FROM public.property_images pi
  WHERE pi.url IS NOT NULL
    AND pi.url <> ''
  GROUP BY pi.property_id
) sub
WHERE mp.id = sub.property_id
  AND mp.images IS DISTINCT FROM sub.urls;
