-- Drop the existing incorrect policy
DROP POLICY IF EXISTS "Users can view their organization's WhatsApp connection" ON public.whatsapp_connections;

-- Create the corrected view policy
CREATE POLICY "Users can view their organization's WhatsApp connection" 
ON public.whatsapp_connections 
FOR SELECT 
USING (
  organization_id IN (
    SELECT profiles.organization_id 
    FROM profiles 
    WHERE profiles.user_id = auth.uid()
  )
);

-- Add policies for other operations (though mostly handled by edge functions with service role)
CREATE POLICY "Users can create their organization's WhatsApp connection" 
ON public.whatsapp_connections 
FOR INSERT 
WITH CHECK (
  organization_id IN (
    SELECT profiles.organization_id 
    FROM profiles 
    WHERE profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their organization's WhatsApp connection" 
ON public.whatsapp_connections 
FOR UPDATE 
USING (
  organization_id IN (
    SELECT profiles.organization_id 
    FROM profiles 
    WHERE profiles.user_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT profiles.organization_id 
    FROM profiles 
    WHERE profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their organization's WhatsApp connection" 
ON public.whatsapp_connections 
FOR DELETE 
USING (
  organization_id IN (
    SELECT profiles.organization_id 
    FROM profiles 
    WHERE profiles.user_id = auth.uid()
  )
);
