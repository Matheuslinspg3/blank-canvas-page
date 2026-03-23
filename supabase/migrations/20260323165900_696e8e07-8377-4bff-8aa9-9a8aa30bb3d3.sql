-- Fix S3: Privilege escalation in user_roles
-- Problem: UPDATE USING clause queries user_roles directly (recursion risk)
-- Problem: DELETE allows admin to remove developer roles (reverse escalation)

-- 1. Drop existing problematic policies
DROP POLICY IF EXISTS "Dev or admin can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Org admins can delete roles" ON public.user_roles;

-- 2. Recreated UPDATE policy using has_role() to prevent recursion
-- Only developers can update roles to admin/developer/sub_admin/leader
-- Admins can update roles to corretor/assistente only within their org
CREATE POLICY "Secure role updates"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'developer')
    OR (
      has_role(auth.uid(), 'admin')
      AND user_id IN (
        SELECT p.user_id FROM profiles p
        WHERE p.organization_id = get_user_organization_id()
      )
    )
  )
  WITH CHECK (
    CASE
      WHEN role IN ('developer', 'admin', 'sub_admin', 'leader')
        THEN has_role(auth.uid(), 'developer')
      ELSE
        has_role(auth.uid(), 'admin')
        AND user_id IN (
          SELECT p.user_id FROM profiles p
          WHERE p.organization_id = get_user_organization_id()
        )
    END
  );

-- 3. Recreated DELETE policy: admin cannot delete developer/leader roles
CREATE POLICY "Secure role deletion"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (
    CASE
      WHEN role IN ('developer', 'leader')
        THEN has_role(auth.uid(), 'developer')
      ELSE
        has_role(auth.uid(), 'developer')
        OR has_role(auth.uid(), 'leader')
        OR (
          has_role(auth.uid(), 'admin')
          AND user_id IN (
            SELECT p.user_id FROM profiles p
            WHERE p.organization_id = get_user_organization_id()
          )
        )
    END
  );