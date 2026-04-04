
-- External listings table (cache of scraped portal data)
CREATE TABLE public.external_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('olx', 'vivareal', 'chavesnamao', 'zapimoveis')),
  source_url TEXT NOT NULL,
  source_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  address_city TEXT,
  address_neighborhood TEXT,
  address_state TEXT,
  transaction_type TEXT CHECK (transaction_type IN ('venda', 'aluguel')),
  sale_price NUMERIC,
  rent_price NUMERIC,
  bedrooms INTEGER,
  bathrooms INTEGER,
  parking_spots INTEGER,
  area_total NUMERIC,
  images TEXT[] DEFAULT '{}',
  contact_phone TEXT,
  contact_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '6 hours'),
  UNIQUE (source, source_id)
);

CREATE INDEX idx_external_listings_city ON public.external_listings (address_city);
CREATE INDEX idx_external_listings_transaction ON public.external_listings (transaction_type);
CREATE INDEX idx_external_listings_expires ON public.external_listings (expires_at);
CREATE INDEX idx_external_listings_source ON public.external_listings (source);

ALTER TABLE public.external_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read external listings"
  ON public.external_listings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage external listings"
  ON public.external_listings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- External search cache table
CREATE TABLE public.external_search_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  search_hash TEXT NOT NULL UNIQUE,
  filters_json JSONB NOT NULL,
  listing_ids UUID[] DEFAULT '{}',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '6 hours')
);

CREATE INDEX idx_external_search_cache_hash ON public.external_search_cache (search_hash);
CREATE INDEX idx_external_search_cache_expires ON public.external_search_cache (expires_at);

ALTER TABLE public.external_search_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read search cache"
  ON public.external_search_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage search cache"
  ON public.external_search_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
