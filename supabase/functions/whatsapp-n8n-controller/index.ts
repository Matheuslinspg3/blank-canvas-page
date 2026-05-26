import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const normalizeN8nPayload = (payload: any): any => {
  if (Array.isArray(payload)) {
    return payload.find((item) => item && typeof item === 'object') ?? payload[0] ?? {}
  }
  return payload ?? {}
}

const findStringByKeys = (payload: any, keys: string[], maxDepth = 5): string => {
  if (!payload || maxDepth < 0) return ""

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = findStringByKeys(item, keys, maxDepth - 1)
      if (found) return found
    }
    return ""
  }

  if (typeof payload !== 'object') return ""

  const normalizedKeys = keys.map((key) => key.toLowerCase())

  for (const [key, value] of Object.entries(payload)) {
    if (normalizedKeys.includes(key.toLowerCase())) {
      if (typeof value === 'string' && value.trim()) return value.trim()
      if (value && typeof value === 'object') {
        const nested = findStringByKeys(value, ['base64', 'qrcode', 'qrCode', 'qr_code', 'qr', 'code'], maxDepth - 1)
        if (nested) return nested
      }
    }
  }

  for (const value of Object.values(payload)) {
    const found = findStringByKeys(value, keys, maxDepth - 1)
    if (found) return found
  }

  return ""
}

const extractQrCode = (payload: any): string => {
  const directQr = findStringByKeys(payload, ['Qrcode', 'qrcode', 'qrCode', 'qr_code', 'base64', 'qr'])
  if (directQr) return directQr

  const longCode = findStringByKeys(payload, ['code'])
  if (longCode.length > 100 || longCode.startsWith('data:image')) return longCode

  return ""
}

const extractPairingCode = (payload: any, qrCode: string): string => {
  const code = findStringByKeys(payload, ['PairingCode', 'pairingCode', 'pairing_code', 'code'])
  if (!code || code === qrCode || code.startsWith('data:image') || code.length > 32) return ""
  return code
}

const findConnected = (payload: any): boolean => {
  const normalized = normalizeN8nPayload(payload)
  return normalized.connected === true ||
    normalized.status === "connected" ||
    normalized.state === "connected" ||
    normalized.data?.status === "connected"
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
    // source = 2 → AI Agent (Automações) | source = 1 → Meu WhatsApp (broker individual)
    const n8nPayload = {
      action: action,
      channel: "whatsapp",
      source: 2,
      source_label: "ai_agent_automation",
      orgId: profile.organization_id,
      orgName: organization?.name || "N/A",
      userId: user.id,
      requested_by_user_id: user.id,
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
      console.error(`[${debugRef}] n8n error (${n8nResponse.status}):`, errorText)
      throw new Error(`n8n error (${n8nResponse.status}): ${errorText}`)
    }

    const n8nRawData = await n8nResponse.json()
    const n8nData = normalizeN8nPayload(n8nRawData)
    console.log(`[whatsapp-n8n-controller] n8n response received:`, JSON.stringify(n8nRawData))

    // Normalize response from n8n
    console.log(`[whatsapp-n8n-controller] n8n raw response keys: ${Object.keys(n8nData).join(', ')}`)
    
    // Look for QR code in common fields, handling nested objects if necessary
    let qrCode = extractQrCode(n8nRawData)

    // Look for pairing code
    let pairingCode = extractPairingCode(n8nRawData, qrCode)

    // Normalize connected status
    let isConnected = findConnected(n8nRawData)

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
      .select('id, status, qr_code, pairing_code, phone_number')
      .eq('organization_id', profile.organization_id)
      .maybeSingle()

    if (action === 'status' && !isConnected && !qrCode && !pairingCode && existingConn && ['qr_pending', 'pairing_pending', 'provisioning', 'connecting'].includes(existingConn.status)) {
      qrCode = existingConn.qr_code || ""
      pairingCode = existingConn.pairing_code || ""
      status = existingConn.status || status
    }

    const connectionPayload = {
      organization_id: profile.organization_id,
      provider: 'n8n_evolution_go',
      instance_name: profile.organization_id,
      status: status,
      phone_number: normalizedPhone || phoneNumberOnlyDigits || existingConn?.phone_number || "",
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
      source: 2,
      source_label: "ai_agent_automation",
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
