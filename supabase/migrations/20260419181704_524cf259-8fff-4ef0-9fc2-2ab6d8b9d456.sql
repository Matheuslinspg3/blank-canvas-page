-- Fase 2 Inbox: RPC atômica de atribuição de owner em conversas omnichannel.
-- Usa lock pessimista (SELECT FOR UPDATE) na conversa para serializar
-- atribuições concorrentes. Política: último vence, owner único ativo.

CREATE OR REPLACE FUNCTION public.assign_conversation_owner(
  p_conversation_id uuid,
  p_assignee_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_conv_org uuid;
  v_assignee_org uuid;
  v_new_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;

  -- Lock pessimista da conversa: serializa atribuições concorrentes.
  SELECT organization_id INTO v_conv_org
    FROM public.conversations
   WHERE id = p_conversation_id
   FOR UPDATE;

  IF v_conv_org IS NULL THEN
    RAISE EXCEPTION 'conversation_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Ator pertence à org da conversa?
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE user_id = v_actor AND organization_id = v_conv_org
  ) THEN
    RAISE EXCEPTION 'actor_not_in_org' USING ERRCODE = '42501';
  END IF;

  -- Ator tem papel autorizado a atribuir?
  IF NOT (
    public.has_role(v_actor, 'developer'::app_role)
    OR public.has_role(v_actor, 'admin'::app_role)
    OR public.has_role(v_actor, 'sub_admin'::app_role)
    OR public.has_role(v_actor, 'leader'::app_role)
  ) THEN
    RAISE EXCEPTION 'actor_not_authorized' USING ERRCODE = '42501';
  END IF;

  -- Assignee na mesma org?
  SELECT organization_id INTO v_assignee_org
    FROM public.profiles
   WHERE user_id = p_assignee_id;

  IF v_assignee_org IS NULL OR v_assignee_org <> v_conv_org THEN
    RAISE EXCEPTION 'assignee_org_mismatch' USING ERRCODE = '42501';
  END IF;

  -- Assignee elegível para owner?
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = p_assignee_id
       AND role IN (
         'corretor'::app_role,
         'assistente'::app_role,
         'leader'::app_role,
         'sub_admin'::app_role,
         'admin'::app_role,
         'developer'::app_role
       )
  ) THEN
    RAISE EXCEPTION 'assignee_not_eligible' USING ERRCODE = '42501';
  END IF;

  -- Encerra owner ativo anterior (se existir)
  UPDATE public.inbox_assignments
     SET unassigned_at = now()
   WHERE conversation_id = p_conversation_id
     AND role = 'owner'
     AND unassigned_at IS NULL;

  -- Cria novo owner
  INSERT INTO public.inbox_assignments
    (organization_id, conversation_id, assigned_to, assigned_by, role, assigned_at)
  VALUES
    (v_conv_org, p_conversation_id, p_assignee_id, v_actor, 'owner', now())
  RETURNING id INTO v_new_id;

  -- Reflete na conversa
  UPDATE public.conversations
     SET status = 'assigned'
   WHERE id = p_conversation_id
     AND status IN ('open', 'pending');

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_conversation_owner(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.assign_conversation_owner(uuid, uuid) TO authenticated;