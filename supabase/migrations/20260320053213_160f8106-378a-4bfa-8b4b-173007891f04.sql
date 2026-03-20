-- Move all relevant members to Porto Caiçara organization (cdf3f0e6-da64-4090-bc76-1758796bea28)

-- Step 1: Update profiles to Porto Caiçara org
UPDATE public.profiles 
SET organization_id = 'cdf3f0e6-da64-4090-bc76-1758796bea28'
WHERE user_id IN (
  'c3041f22-1d96-4e0c-916e-660ac387b103',
  'bb7d85b0-a586-4bb3-9ab4-3f3b86887b8c',
  'f73d57ec-e410-42cc-a866-c7d93e7c8893',
  '7dfe11ab-aa4d-4277-81b7-9646130c2582',
  '9ddd8bf1-745c-44ab-8d4c-4c8fc0c5d0a3',
  'b93b4b0e-1d76-43fe-993b-50dc5fce7694',
  'bd9b647b-678f-4ca3-851b-4cc28c6a8a4f'
);

-- Step 2: Update roles to corretor
UPDATE public.user_roles 
SET role = 'corretor'
WHERE user_id IN (
  'c3041f22-1d96-4e0c-916e-660ac387b103',
  'bb7d85b0-a586-4bb3-9ab4-3f3b86887b8c',
  'f73d57ec-e410-42cc-a866-c7d93e7c8893',
  '7dfe11ab-aa4d-4277-81b7-9646130c2582',
  '9ddd8bf1-745c-44ab-8d4c-4c8fc0c5d0a3',
  'b93b4b0e-1d76-43fe-993b-50dc5fce7694',
  'bd9b647b-678f-4ca3-851b-4cc28c6a8a4f'
);

-- Step 3: Remove the now-empty orphan organizations (keeping test accounts' orgs)
DELETE FROM public.organizations 
WHERE id IN (
  'a83d94ec-5023-4cbf-8c0f-246ed27924df',
  'b8805994-0a10-4dd9-8535-06da8f7473c3',
  '1a158088-7c95-49e3-8255-3cfdaca60445',
  '46d92ee1-baaf-47bf-b399-edb0ceb6a18b',
  '074434a9-74ca-40fd-bdc6-a83487d59eef',
  '77dfc84e-addd-4856-879d-dbb9a49e2d1c',
  '19a26382-8b56-4809-b3e3-cf44c4467df3'
);