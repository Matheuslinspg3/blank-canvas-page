import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const SESSION_TOKEN_KEY = 'habitae_session_token';
const HEARTBEAT_INTERVAL = 60_000; // 1 min
const CHECK_INTERVAL = 30_000; // 30s

/**
 * Uses localStorage so all tabs in the same browser share one session token.
 * sessionStorage was causing each tab to register a separate "device",
 * hitting the 2-session limit and logging the user out.
 */
function getOrCreateSessionToken(): string {
  let token = localStorage.getItem(SESSION_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  }
  return token;
}

function detectDeviceType(): 'mobile' | 'desktop' {
  const ua = navigator.userAgent.toLowerCase();
  return /android|iphone|ipad|ipod|mobile/.test(ua) ? 'mobile' : 'desktop';
}

function getDeviceInfo(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown';
}

export function useSessionGuard(userId: string | undefined) {
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>();
  const checkRef = useRef<ReturnType<typeof setInterval>>();
  const registeredRef = useRef(false);

  const registerSession = useCallback(async () => {
    if (!userId) return;
    const token = getOrCreateSessionToken();
    try {
      await supabase.rpc('register_session', {
        p_session_token: token,
        p_device_type: detectDeviceType(),
        p_device_info: getDeviceInfo(),
      });
      registeredRef.current = true;
    } catch (err) {
      console.error('[SessionGuard] register failed:', err);
    }
  }, [userId]);

  const checkValidity = useCallback(async () => {
    if (!userId || !registeredRef.current) return;
    const token = localStorage.getItem(SESSION_TOKEN_KEY);

    try {
      const { data } = await supabase.rpc('is_session_valid', {
        p_session_token: token,
      });

      if (data === false) {
        toast.error('Sua sessão foi encerrada pois outro dispositivo fez login.', {
          duration: 8000,
        });
        // Clean up and sign out
        localStorage.removeItem(SESSION_TOKEN_KEY);
        registeredRef.current = false;
        await supabase.auth.signOut();
      }
    } catch {
      // Network error, skip
    }
  }, [userId]);

  const heartbeat = useCallback(async () => {
    if (!userId || !registeredRef.current) return;
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    try {
      await supabase.rpc('session_heartbeat', { p_session_token: token });
    } catch {
      // Ignore
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      registeredRef.current = false;
      return;
    }

    // Register on mount / user change
    registerSession();

    // Heartbeat every 1 min
    heartbeatRef.current = setInterval(heartbeat, HEARTBEAT_INTERVAL);

    // Check validity every 30s
    checkRef.current = setInterval(checkValidity, CHECK_INTERVAL);

    return () => {
      clearInterval(heartbeatRef.current);
      clearInterval(checkRef.current);
    };
  }, [userId, registerSession, heartbeat, checkValidity]);

  // Cleanup session on sign out
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
        if (token) {
          try {
            await supabase.from('user_sessions').delete().eq('session_token', token);
          } catch {
            // Ignore
          }
          sessionStorage.removeItem(SESSION_TOKEN_KEY);
        }
        registeredRef.current = false;
      }
    });
    return () => subscription.unsubscribe();
  }, []);
}
