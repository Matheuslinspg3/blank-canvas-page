import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const debugRef = `ERR-${crypto.randomUUID().split('-')[0].toUpperCase()}`

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
    
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey
    )

    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ 
        ok: false, 
        code: 'UNAUTHORIZED', 
        message: 'Falha na autenticação.',
        debug_ref: debugRef
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      })
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, full_name, organization_id')
      .or(`user_id.eq.${user.id},id.eq.${user.id}`)
      .maybeSingle()

    if (profileError) {
      console.error(`[${debugRef}] Profile lookup error:`, profileError)
    }

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ 
        ok: false, 
        code: 'NO_ORG', 
        message: 'Organização não encontrada.',
        debug_ref: debugRef
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const { data: organization } = await adminClient
      .from('organizations')
      .select('name')
      .eq('id', profile.organization_id)
      .maybeSingle()

    const body = await req.json()
    const { action, phoneNumber } = body

    if (!action) {
      return new Response(JSON.stringify({ ok: false, message: 'Ação não informada' }), { status: 400 })
    }

    // Normalizing phone number (digits only)
    const phoneNumberOnlyDigits = phoneNumber ? phoneNumber.replace(/\D/g, '') : ''

    // Payload for n8n
    const n8nPayload = {
      action: action,
      channel: "whatsapp",
      source: "broker_whatsapp",
      orgId: profile.organization_id,
      orgName: organization?.name || "N/A",
      userId: user.id,
      userName: profile.full_name || profile.name || user.email,
      userEmail: user.email,
      brokerId: profile.id,
      phoneNumber: phoneNumberOnlyDigits,
      timestamp: new Date().toISOString(),
      environment: Deno.env.get("APP_ENV") || "production"
    }

    // Decide which webhook to call
    let n8nUrl = ""
    const createActions = ['create', 'connect', 'qr', 'pairing', 'reconnect']
    const statusActions = ['status', 'check_connected', 'verify_connection']

    if (createActions.includes(action)) {
      n8nUrl = Deno.env.get('N8N_WHATSAPP_CREATE_WEBHOOK_URL') || ""
    } else if (statusActions.includes(action)) {
      n8nUrl = Deno.env.get('N8N_WHATSAPP_STATUS_WEBHOOK_URL') || ""
    }

    if (!n8nUrl) {
      console.error(`[${debugRef}] Webhook URL not configured for action: ${action}. Checked ENV variables.`)
      throw new Error(`Configuração do webhook n8n ausente para a ação: ${action}`)
    }

    console.log(`[whatsapp-n8n-controller] Calling n8n: ${n8nUrl} with action ${action}`)

    const n8nResponse = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(n8nPayload)
    })

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text()
      throw new Error(`n8n error (${n8nResponse.status}): ${errorText}`)
    }

    const n8nData = await n8nResponse.json()
    console.log(`[whatsapp-n8n-controller] n8n response received:`, JSON.stringify(n8nData))

    // Normalize response from n8n
    console.log(`[whatsapp-n8n-controller] n8n raw response keys: ${Object.keys(n8nData).join(', ')}`)
    
    // Look for QR code in common fields, handling nested objects if necessary
    let qrCode = ""
    const possibleQrKeys = ['Qrcode', 'qrcode', 'qrCode', 'qr_code', 'base64', 'qr', 'code']
    
    for (const key of possibleQrKeys) {
      if (n8nData[key]) {
        if (typeof n8nData[key] === 'string') {
          qrCode = n8nData[key]
          break
        } else if (typeof n8nData[key] === 'object' && n8nData[key] !== null) {
          // Try common subkeys in nested objects
          qrCode = n8nData[key].base64 || n8nData[key].qrcode || n8nData[key].qr || n8nData[key].code || ""
          if (qrCode) break
        }
      }
    }

    // Look for pairing code
    let pairingCode = ""
    const possiblePairingKeys = ['PairingCode', 'pairingCode', 'pairing_code', 'code']
    for (const key of possiblePairingKeys) {
       // Skip if we already used 'code' for QR
       if (key === 'code' && qrCode && qrCode.length > 20) continue
       if (n8nData[key] && typeof n8nData[key] === 'string') {
         pairingCode = n8nData[key]
         break
       }
    }

    // Normalize connected status
    let isConnected = false
    if (n8nData.connected === true || n8nData.status === "connected" || n8nData.state === "connected" || n8nData.data?.status === "connected") {
      isConnected = true
    }

    // Normalize phone number from status response
    let normalizedPhone = n8nData.phoneNumber || n8nData.phone_number || n8nData.jid || (n8nData.data && n8nData.data.jid) || ""

    if (normalizedPhone && typeof normalizedPhone === 'string' && normalizedPhone.includes('@')) {
      normalizedPhone = normalizedPhone.split('@')[0]
    }

    // Persist status locally in whatsapp_connections
    let status = 'disconnected'
    if (isConnected) {
      status = 'connected'
    } else if (qrCode) {
      status = 'qr_pending'
    } else if (pairingCode) {
      status = 'pairing_pending'
    } else if (action === 'create' || action === 'reconnect') {
      status = 'provisioning'
    }

    // Save/Update local state
    const { data: existingConn } = await adminClient
      .from('whatsapp_connections')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .maybeSingle()

    const connectionPayload = {
      organization_id: profile.organization_id,
      provider: 'n8n_evolution_go',
      instance_name: profile.organization_id,
      status: status,
      phone_number: normalizedPhone || phoneNumberOnlyDigits,
      qr_code: qrCode,
      pairing_code: pairingCode,
      last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    if (isConnected) {
      // @ts-ignore
      connectionPayload.last_connected_at = new Date().toISOString()
    }

    if (existingConn) {
      await adminClient
        .from('whatsapp_connections')
        .update(connectionPayload)
        .eq('id', existingConn.id)
    } else {
      await adminClient
        .from('whatsapp_connections')
        .insert(connectionPayload)
    }

    return new Response(JSON.stringify({
      ok: true,
      provider: "n8n_evolution_go",
      status: status,
      connected: isConnected,
      phoneNumber: normalizedPhone || (isConnected ? phoneNumberOnlyDigits : ""),
      qrCode: qrCode,
      pairingCode: pairingCode,
      createdAt: n8nData.createdAt || n8nData.created_at || new Date().toISOString(),
      debug_ref: null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error(`[${debugRef}] Error in whatsapp-n8n-controller:`, err)
    return new Response(JSON.stringify({
      ok: false,
      provider: "n8n_evolution_go",
      code: "WHATSAPP_N8N_ERROR",
      message: "Erro ao processar conexão com WhatsApp.",
      debug_ref: debugRef,
      recoverable: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 // Returning 200 with ok:false as requested to avoid Lovable crash
    })
  }
})
