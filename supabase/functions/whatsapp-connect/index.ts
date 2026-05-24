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
    const authHeader = req.headers.get('Authorization')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!serviceRoleKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
    }

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: authHeader ? { Authorization: authHeader } : {} } }
    )
    // Service-role client for DB writes (bypasses RLS); auth is validated above.
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey
    )

    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ ok: false, code: 'UNAUTHORIZED', message: 'Não autorizado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      })
    }

    const { data: profile } = await adminClient.from('profiles').select('organization_id').eq('user_id', user.id).maybeSingle()
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
    let { data: connection } = await adminClient
      .from('whatsapp_connections')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .maybeSingle()

    if (!connection) {
      const { data: newConn, error: createError } = await adminClient
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
      if (!pairingCode) {
        return new Response(JSON.stringify({
          ok: false,
          code: 'WHATSAPP_PAIRING_NOT_AVAILABLE',
          message: 'Não foi possível obter o código de pareamento. Verifique o número e tente novamente.',
          debug_ref: `ERR-${crypto.randomUUID().split('-')[0].toUpperCase()}`,
          recoverable: true
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      status = 'pairing_pending'
    } else {
      const connectRes = await provider.connectInstance(instanceName)
      qrCode = extractQrBase64(connectRes.data)
      if (!qrCode) {
        const remoteStatus = classifyConnectionStatus(connectRes.raw)
        if (remoteStatus === 'connected') {
          status = 'connected'
        } else {
          // If not connected and no QR, it's an error state
          return new Response(JSON.stringify({
            ok: false,
            code: 'WHATSAPP_QR_NOT_AVAILABLE',
            message: 'Não foi possível obter o QR Code do servidor. Tente novamente em alguns instantes.',
            debug_ref: `ERR-${crypto.randomUUID().split('-')[0].toUpperCase()}`,
            recoverable: true
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
      }
    }

    // 4. Update local state
    const { error: updateError } = await adminClient.from('whatsapp_connections').update({
      status,
      qr_code: qrCode,
      pairing_code: pairingCode,
      phone_number: phoneNumber || connection.phone_number
    }).eq('id', connection.id)

    if (updateError) throw updateError

    return new Response(JSON.stringify({
      ok: true,
      status,
      qr_code: qrCode,
      pairing_code: pairingCode,
      connection: {
        ...connection,
        status,
        qr_code: qrCode,
        pairing_code: pairingCode,
        instance_name: instanceName,
        provider: providerType
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    const debugRef = `ERR-${crypto.randomUUID().split('-')[0].toUpperCase()}`
    console.error(debugRef, err)
    return new Response(JSON.stringify({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'Erro interno ao processar conexão.',
      debug_ref: debugRef
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
