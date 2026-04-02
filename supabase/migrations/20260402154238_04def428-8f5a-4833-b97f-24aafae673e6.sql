
-- Fix known duplicate neighborhoods via data normalization
-- "Guilermina" → "Guilhermina" (typo)
UPDATE properties SET address_neighborhood = 'Guilhermina' WHERE LOWER(TRIM(address_neighborhood)) = 'guilermina';

-- "Parque Sao Vicente" → "Parque São Vicente" (missing accent)
UPDATE properties SET address_neighborhood = 'Parque São Vicente' WHERE LOWER(TRIM(address_neighborhood)) = 'parque sao vicente';

-- "Jardim Gloria" → "Jardim Glória" (missing accent)
UPDATE properties SET address_neighborhood = 'Jardim Glória' WHERE LOWER(TRIM(address_neighborhood)) = 'jardim gloria';

-- "Jd. Praia Grande" → "Jardim Praia Grande" (abbreviation)
UPDATE properties SET address_neighborhood = 'Jardim Praia Grande' WHERE LOWER(TRIM(address_neighborhood)) IN ('jd. praia grande', 'jd praia grande');

-- "Nautica" → "Cidade Náutica" (missing accent + abbreviation)
UPDATE properties SET address_neighborhood = 'Cidade Náutica' WHERE LOWER(TRIM(address_neighborhood)) = 'nautica';

-- "Cidade Náutica Lll" → "Cidade Náutica III" (fix L→I)
UPDATE properties SET address_neighborhood = 'Cidade Náutica III' WHERE LOWER(TRIM(address_neighborhood)) = 'cidade náutica lll';

-- Clean up empty neighborhoods
UPDATE properties SET address_neighborhood = NULL WHERE TRIM(COALESCE(address_neighborhood, '')) = '';

-- Also normalize marketplace_properties to match
UPDATE marketplace_properties SET address_neighborhood = 'Guilhermina' WHERE LOWER(TRIM(address_neighborhood)) = 'guilermina';
UPDATE marketplace_properties SET address_neighborhood = 'Parque São Vicente' WHERE LOWER(TRIM(address_neighborhood)) = 'parque sao vicente';
UPDATE marketplace_properties SET address_neighborhood = 'Jardim Glória' WHERE LOWER(TRIM(address_neighborhood)) = 'jardim gloria';
UPDATE marketplace_properties SET address_neighborhood = 'Jardim Praia Grande' WHERE LOWER(TRIM(address_neighborhood)) IN ('jd. praia grande', 'jd praia grande');
UPDATE marketplace_properties SET address_neighborhood = 'Cidade Náutica' WHERE LOWER(TRIM(address_neighborhood)) = 'nautica';
UPDATE marketplace_properties SET address_neighborhood = NULL WHERE TRIM(COALESCE(address_neighborhood, '')) = '';
