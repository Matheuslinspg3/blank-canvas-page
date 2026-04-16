
-- Fix marketplace_properties_public - it wraps a security definer function, 
-- but the view itself should be security invoker since the function handles security
ALTER VIEW public.marketplace_properties_public SET (security_invoker = true);

-- Fix WhatsApp AI cost views
ALTER VIEW public.v_whatsapp_ai_costs_daily SET (security_invoker = true);
ALTER VIEW public.v_whatsapp_ai_costs_monthly SET (security_invoker = true);
ALTER VIEW public.v_whatsapp_ai_costs_per_conversation SET (security_invoker = true);
ALTER VIEW public.v_whatsapp_ai_costs_per_message SET (security_invoker = true);
ALTER VIEW public.v_whatsapp_ai_top_conversations SET (security_invoker = true);
ALTER VIEW public.whatsapp_ai_cost_per_conversation SET (security_invoker = true);
ALTER VIEW public.whatsapp_ai_cost_summary SET (security_invoker = true);
