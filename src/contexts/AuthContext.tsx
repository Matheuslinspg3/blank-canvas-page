import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { loginOneSignal, logoutOneSignal } from '@/lib/onesignal';
import { identifyUser, resetPostHog } from '@/lib/posthog';
import { toast } from 'sonner';

interface Profile {
  id: string;
  user_id: string;
  organization_id: string | null;
  full_name: string;
  phone: string | null;
  creci: string | null;
  onboarding_completed: boolean | null;
  avatar_url: string | null;
  email_verified: boolean | null;
  phone_verified: boolean | null;
  creci_verified: boolean | null;
  creci_verified_at: string | null;
  creci_verified_name: string | null;
}

interface TrialInfo {
  trial_started_at: string | null;
  trial_ends_at: string | null;
  is_active: boolean;
  is_trial_expired: boolean;
}

interface SignUpParams {
  email: string;
  password: string;
  name: string;
  phone: string;
  document?: string;
  accountType: 'corretor_individual' | 'imobiliaria';
  companyName?: string;
  selectedPlan?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  organizationType: 'imobiliaria' | 'corretor_individual' | null;
  trialInfo: TrialInfo | null;
  loading: boolean;
  signUp: (params: SignUpParams) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organizationType, setOrganizationType] = useState<'imobiliaria' | 'corretor_individual' | null>(null);
  const [trialInfo, setTrialInfo] = useState<TrialInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Prevent duplicate fetchProfile from both getSession and onAuthStateChange
  const profileFetchedForRef = useRef<string | null>(null);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .abortSignal(controller.signal)
        .single();

      clearTimeout(timeout);

      if (!error && data) {
        setProfile(data as Profile);
        // Fetch organization in parallel-ready way
        if (data.organization_id) {
          const orgController = new AbortController();
          const orgTimeout = setTimeout(() => orgController.abort(), 8_000);
          const { data: orgData } = await supabase
            .from('organizations')
            .select('type, trial_started_at, trial_ends_at, is_active')
            .eq('id', data.organization_id)
            .abortSignal(orgController.signal)
            .single();
          clearTimeout(orgTimeout);
          if (orgData) {
            setOrganizationType(orgData.type as 'imobiliaria' | 'corretor_individual');
            const trialEnds = orgData.trial_ends_at ? new Date(orgData.trial_ends_at) : null;
            const isTrialExpired = trialEnds !== null && trialEnds < new Date();
            setTrialInfo({
              trial_started_at: orgData.trial_started_at,
              trial_ends_at: orgData.trial_ends_at,
              is_active: orgData.is_active,
              is_trial_expired: isTrialExpired && orgData.is_active,
            });
          }
        }
        return data as Profile;
      }
      return null;
    } catch (err) {
      console.error('[Auth] fetchProfile failed (timeout or network):', err);
      return null;
    }
  };

  // Função para corrigir usuários legados sem organização
  const fixLegacyUser = async (userId: string, email: string, fullName: string) => {

    
    const { data, error } = await supabase.rpc('fix_user_without_organization', {
      p_user_id: userId,
      p_email: email,
      p_full_name: fullName
    });

    if (error) {
      console.error('Erro ao corrigir usuário legado:', error);
      return null;
    }

    // Buscar perfil atualizado
    await fetchProfile(userId);
    return data;
  };

  // Track if user was previously logged in to detect session expiry
  const hadSessionRef = useRef(false);

  const setupSession = async (sessionUser: { id: string; email?: string; user_metadata?: any }) => {
    try {
      const existingProfile = await fetchProfile(sessionUser.id);
      
      // Fallback para usuários legados sem organização
      if (!existingProfile?.organization_id) {
        const metadata = sessionUser.user_metadata;
        const fullName = metadata?.full_name || 'Usuário';
        await fixLegacyUser(sessionUser.id, sessionUser.email!, fullName);
      }
      
      // Vincular usuário ao OneSignal e PostHog (fire-and-forget)
      loginOneSignal(sessionUser.id).catch(e => console.error("[Auth] OneSignal login error:", e));
      identifyUser(sessionUser.id, sessionUser.email, existingProfile?.full_name || sessionUser.user_metadata?.full_name);
    } catch (err) {
      console.error('[Auth] Error during session setup:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 0. Intercepta erros do callback OAuth (vêm no hash da URL após redirect do Supabase)
    try {
      const rawHash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
      if (rawHash) {
        const params = new URLSearchParams(rawHash);
        const errorParam = params.get('error');
        const errorCode = params.get('error_code');
        const errorDescription = params.get('error_description');
        if (errorParam || errorCode || errorDescription) {
          const desc = decodeURIComponent(errorDescription ?? '');
          const isEmailCollision =
            /EMAIL_ALREADY_REGISTERED/i.test(desc) ||
            /Database error saving new user/i.test(desc);

          if (isEmailCollision) {
            toast.error('Já existe uma conta com este email', {
              description:
                'Faça login com sua senha original ou use "Esqueci minha senha" para recuperar o acesso. Depois de entrar, você pode vincular o Google nas configurações.',
              duration: 10000,
            });
            setTimeout(() => {
              window.history.replaceState(null, '', '/auth');
            }, 0);
          } else if (errorParam) {
            toast.error('Erro ao entrar com Google', {
              description: desc || 'Tente novamente em instantes.',
              duration: 8000,
            });
            window.history.replaceState(null, '', window.location.pathname);
          }
        }
      }
    } catch (e) {
      console.error('[Auth] Failed to parse OAuth error hash:', e);
    }

    // 1. getSession runs first and sets the profile
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        hadSessionRef.current = true;
        profileFetchedForRef.current = session.user.id;
        await setupSession(session.user);
      } else {
        setLoading(false);
      }
    }).catch(() => {
      setLoading(false);
    });

    // 2. onAuthStateChange handles subsequent changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          hadSessionRef.current = true;
          // Skip if getSession already fetched profile for this user
          if (profileFetchedForRef.current === session.user.id) {
            return;
          }
          profileFetchedForRef.current = session.user.id;
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(() => setupSession(session.user), 0);
        } else {
          if (hadSessionRef.current && event === 'SIGNED_OUT') {
            toast.warning('Sua sessão expirou. Faça login novamente.');
          }
          hadSessionRef.current = false;
          profileFetchedForRef.current = null;
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async ({ email, password, name, phone, document, accountType, companyName, selectedPlan }: SignUpParams) => {
    const redirectUrl = `${window.location.origin}/`;
    
    // Trigger no banco de dados vai criar organização/perfil/role/subscription automaticamente
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: name,
          phone: phone,
          document: document || '',
          account_type: accountType,
          company_name: companyName,
          selected_plan: selectedPlan || 'gratuito',
        }
      }
    });
    
    return { error: error as Error | null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error: error as Error | null };
  }, []);

  // OAuth com Google. O retorno é tratado pelo onAuthStateChange após o redirect.
  // redirectTo usa window.location.origin para suportar multi-tenant (subdomínios + domínios custom).
  // Cada origin precisa estar registrada em Authentication > URL Configuration no Supabase
  // e em "Authorized JavaScript origins / redirect URIs" no Google Cloud Console.
  const signInWithGoogle = useCallback(async () => {
    // Redireciona para /dashboard — o ProtectedRoute encaminha para /onboarding
    // automaticamente se onboarding_completed=false. Evita pousar na LandingPage.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });
    return { error: error as Error | null };
  }, []);

  const signOut = useCallback(async () => {
    setProfile(null);
    setOrganizationType(null);
    logoutOneSignal();
    resetPostHog();
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user]);

  // Envia email de recuperação de senha. Mensagem genérica no UI evita enumeração de emails.
  const forgotPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error as Error | null };
  }, []);

  const contextValue = useMemo(() => ({ 
    user, 
    session, 
    profile, 
    organizationType,
    trialInfo,
    loading, 
    signUp, 
    signIn, 
    signInWithGoogle,
    signOut, 
    refreshProfile,
    forgotPassword,
  }), [user, session, profile, organizationType, trialInfo, loading, signUp, signIn, signInWithGoogle, signOut, refreshProfile, forgotPassword]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // During HMR or edge cases, return safe defaults instead of crashing
    if (import.meta.hot) {
      console.warn('[AuthContext] Context not available (HMR reload). Returning defaults.');
      return {
        user: null,
        session: null,
        profile: null,
        organizationType: null,
        trialInfo: null,
        loading: true,
        signUp: async () => ({ error: new Error('Auth not ready') }),
        signIn: async () => ({ error: new Error('Auth not ready') }),
        signInWithGoogle: async () => ({ error: new Error('Auth not ready') }),
        signOut: async () => {},
        refreshProfile: async () => {},
        forgotPassword: async () => ({ error: new Error('Auth not ready') }),
      } as AuthContextType;
    }
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
