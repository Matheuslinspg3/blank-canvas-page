INSERT INTO public.user_roles (user_id, role)
VALUES ('ec8dfbc5-e543-40f2-b61e-eca1a3ae43e6', 'developer')
ON CONFLICT (user_id, role) DO NOTHING;