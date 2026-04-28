
-- Fortalece get_user_organization_id para excluir usuários removidos.
-- Como essa função é usada em todas as políticas RLS multi-tenant,
-- retornar NULL aqui bloqueia automaticamente acesso a TODOS os dados da org.
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT organization_id 
    FROM public.profiles 
    WHERE user_id = auth.uid()
      AND removed_at IS NULL
      AND organization_id IS NOT NULL
    LIMIT 1
$function$;

-- Helper explícito para uso em novas políticas / edge functions
CREATE OR REPLACE FUNCTION public.is_active_member()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid()
          AND removed_at IS NULL
          AND organization_id IS NOT NULL
    )
$function$;

-- Bloqueia que um usuário removido leia o próprio profile (e descubra a org antiga)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  AND removed_at IS NULL
  AND organization_id IS NOT NULL
);

-- Bloqueia updates por usuários removidos
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND removed_at IS NULL
  AND organization_id IS NOT NULL
)
WITH CHECK (
  auth.uid() = user_id
  AND removed_at IS NULL
);
