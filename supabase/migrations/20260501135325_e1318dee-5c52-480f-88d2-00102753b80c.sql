DO $$
DECLARE
  current_len int;
BEGIN
  SELECT character_maximum_length
    INTO current_len
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'property_share_links'
     AND column_name  = 'slug';

  IF current_len IS NULL OR current_len < 120 THEN
    ALTER TABLE public.property_share_links
      ALTER COLUMN slug TYPE varchar(120);
  END IF;
END
$$;