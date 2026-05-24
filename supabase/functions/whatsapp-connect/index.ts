import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getWhatsAppProvider } from "../_shared/whatsapp-provider-v2.ts"
import { classifyConnectionStatus, extractQrBase64, extractPairingCode } from "../_shared/whatsapp.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ ok: false, code: 'UNAUTHORIZED', message: 'Não autorizado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      })
    }

    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ ok: false, code: 'NO_ORG', message: 'Organização não encontrada' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const body = await req.json()
    const mode = body.mode // 'qr' or 'pairing'
    const phoneNumber = body.phone_number

    const providerType = Deno.env.get('EVOLUTION_PROVIDER') || 'evolution_go'
    const provider = getWhatsAppProvider(providerType, {
      baseUrl: Deno.env.get('EVOLUTION_GO_URL') || '',
      apiKey: Deno.env.get('EVOLUTION_GO_TOKEN') || '',
    })

    const instanceName = `org-${profile.organization_id.split('-')[0]}-${profile.organization_id.split('-')[4]}`

    // 1. Check or Create local connection
    let { data: connection } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .single()

    if (!connection) {
      const { data: newConn, error: createError } = await supabase
        .from('whatsapp_connections')
        .insert({
          organization_id: profile.organization_id,
          instance_name: instanceName,
          status: 'provisioning',
          provider: providerType
        })
        .select()
        .single()
      
      if (createError) throw createError
      connection = newConn
    }

    // 2. Create Instance in Provider
    const createRes = await provider.createInstance(instanceName)
    if (!createRes.ok && !/already/i.test(createRes.raw)) {
      return new Response(JSON.stringify({
        ok: false,
        code: 'WHATSAPP_CREATE_FAILED',
        message: 'Falha ao criar instância no servidor.',
        debug_ref: `ERR-${crypto.randomUUID().split('-')[0].toUpperCase()}`,
        recoverable: true
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 3. Request Connection (QR or Pairing)
    let status = 'qr_pending'
    let qrCode = null
    let pairingCode = null

    if (mode === 'pairing') {
      if (!phoneNumber) {
        return new Response(JSON.stringify({ ok: false, message: 'Telefone obrigatório para pareamento' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const pairRes = await provider.pairInstance(instanceName, phoneNumber)
      if (!pairRes.ok) {
         return new Response(JSON.stringify({
            ok: false,
            code: 'WHATSAPP_PAIRING_FAILED',
            message: 'Falha ao gerar código de pareamento.',
            debug_ref: `ERR-${crypto.randomUUID().split('-')[0].toUpperCase()}`,
            recoverable: true
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      pairingCode = extractPairingCode(pairRes.data)
      status = 'pairing_pending'
    } else {
      const connectRes = await provider.connectInstance(instanceName)
      qrCode = extractQrBase64(connectRes.data)
      if (!qrCode && classifyConnectionStatus(connectRes.raw) === 'connected') {
        status = 'connected'
      }
    }

    // 4. Update local state
    await supabase.from('whatsapp_connections').update({
      status,
      qr_code: qrCode,
      pairing_code: pairingCode,
      phone_number: phoneNumber || connection.phone_number
    }).eq('id', connection.id)

    return new Response(JSON.stringify({
      ok: true,
      status,
      qrCode,
      pairingCode,
      connection: {
        instance_name: instanceName,
        provider: providerType
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Erro interno ao processar conexão.',
      debug_ref: `ERR-${crypto.randomUUID().split('-')[0].toUpperCase()}`
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
