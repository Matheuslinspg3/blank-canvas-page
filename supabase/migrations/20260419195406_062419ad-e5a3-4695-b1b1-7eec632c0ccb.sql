-- Phase 3A: read state + RLS alignment for active assignee

-- 1) conversation_reads table
CREATE TABLE public.conversation_reads (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_conversation_reads_user_org
  ON public.conversation_reads (user_id, organization_id);
CREATE INDEX idx_conversation_reads_org
  ON public.conversation_reads (organization_id);

ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversation_reads_self_select
  ON public.conversation_reads FOR SELECT
  USING (user_id = auth.uid()
     AND organization_id = public.get_user_organization_id());

CREATE POLICY conversation_reads_self_insert
  ON public.conversation_reads FOR INSERT
  WITH CHECK (user_id = auth.uid()
          AND organization_id = public.get_user_organization_id());

CREATE POLICY conversation_reads_self_update
  ON public.conversation_reads FOR UPDATE
  USING (user_id = auth.uid()
     AND organization_id = public.get_user_organization_id())
  WITH CHECK (user_id = auth.uid()
          AND organization_id = public.get_user_organization_id());

-- 2) Aditive SELECT policies: active assignee can see conversation/messages
CREATE POLICY conversations_active_assignee_select
  ON public.conversations FOR SELECT
  USING (
    organization_id = public.get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.inbox_assignments ia
      WHERE ia.conversation_id = conversations.id
        AND ia.assigned_to = auth.uid()
        AND ia.role = 'owner'
        AND ia.unassigned_at IS NULL
    )
  );

CREATE POLICY messages_active_assignee_select
  ON public.messages FOR SELECT
  USING (
    organization_id = public.get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.inbox_assignments ia
      WHERE ia.conversation_id = messages.conversation_id
        AND ia.assigned_to = auth.uid()
        AND ia.role = 'owner'
        AND ia.unassigned_at IS NULL
    )
  );

-- 3) RPC: mark_conversation_read (monotonic + authorization mirroring SELECT)
CREATE OR REPLACE FUNCTION public.mark_conversation_read(
  p_conversation_id uuid,
  p_read_at timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_org uuid := public.get_user_organization_id();
  v_conv_org uuid;
  v_conv_lead uuid;
  v_can_access boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT organization_id, lead_id
    INTO v_conv_org, v_conv_lead
    FROM public.conversations
   WHERE id = p_conversation_id;

  IF v_conv_org IS NULL THEN
    RAISE EXCEPTION 'conversation not found';
  END IF;

  IF v_conv_org <> v_user_org THEN
    RAISE EXCEPTION 'cross-tenant access denied';
  END IF;

  -- Authorization mirrors SELECT visibility on conversations:
  -- (a) manager/admin/sub_admin/leader/developer
  IF public.is_org_manager_or_above(v_user_id) THEN
    v_can_access := true;
  END IF;

  -- (b) broker of the linked lead
  IF NOT v_can_access AND v_conv_lead IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.leads l
       WHERE l.id = v_conv_lead AND l.broker_id = v_user_id
    ) THEN
      v_can_access := true;
    END IF;
  END IF;

  -- (c) active assignee (owner)
  IF NOT v_can_access THEN
    IF EXISTS (
      SELECT 1 FROM public.inbox_assignments ia
       WHERE ia.conversation_id = p_conversation_id
         AND ia.assigned_to = v_user_id
         AND ia.role = 'owner'
         AND ia.unassigned_at IS NULL
    ) THEN
      v_can_access := true;
    END IF;
  END IF;

  IF NOT v_can_access THEN
    RAISE EXCEPTION 'forbidden: no access to conversation';
  END IF;

  INSERT INTO public.conversation_reads
    (conversation_id, user_id, organization_id, last_read_at, updated_at)
  VALUES
    (p_conversation_id, v_user_id, v_conv_org, p_read_at, now())
  ON CONFLICT (conversation_id, user_id) DO UPDATE
    SET last_read_at = GREATEST(conversation_reads.last_read_at, EXCLUDED.last_read_at),
        updated_at   = now();
END;
$$;

REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid, timestamptz) TO authenticated;