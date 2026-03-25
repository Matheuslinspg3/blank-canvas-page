-- Reorder plans so Correspondente appears between Starter and Essencial
UPDATE subscription_plans SET display_order = 3 WHERE slug = 'correspondente';
UPDATE subscription_plans SET display_order = 4 WHERE slug = 'essencial';
UPDATE subscription_plans SET display_order = 5 WHERE slug = 'profissional';
UPDATE subscription_plans SET display_order = 6 WHERE slug = 'business';
-- Enterprise stays at 3 (inactive, won't show)