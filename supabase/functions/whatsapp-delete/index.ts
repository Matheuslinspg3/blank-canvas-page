import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getWhatsAppProvider } from "../_shared/whatsapp-provider-v2.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
    if (!profile?.organization_id) return new Response('No Org', { status: 400 })

    const { data: connection } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .single()

    if (!connection) return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })

    const providerType = Deno.env.get('EVOLUTION_PROVIDER') || 'evolution_go'
    const provider = getWhatsAppProvider(providerType, {
      baseUrl: Deno.env.get('EVOLUTION_GO_URL') || '',
      apiKey: Deno.env.get('EVOLUTION_GO_TOKEN') || '',
    })

    // Update status to deleting locally first
    await supabase.from('whatsapp_connections').update({ status: 'deleting' }).eq('id', connection.id)

    // Attempt logout and delete in provider
    await provider.logoutInstance(connection.instance_name)
    await provider.deleteInstance(connection.instance_name)

    // Remove local record
    await supabase.from('whatsapp_connections').delete().eq('id', connection.id)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, message: String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
