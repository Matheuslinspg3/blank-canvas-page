// Lógica pura de junção entre auth.users e profiles para o painel developer.
// Extraída de UsersTab para permitir teste unitário e garantir que
// usuários SEM profile continuem visíveis (fonte de verdade = auth.users).

export const NEW_USER_WINDOW_MS = 48 * 60 * 60 * 1000; // 48h

export interface AuthUserLike {
  id: string;
  email?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
}

export interface ProfileLike {
  user_id: string;
  full_name?: string | null;
  phone?: string | null;
  organization_id?: string | null;
  onboarding_completed?: boolean | null;
}

export interface UserRow {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  organization_id: string | null;
  onboarding_completed: boolean;
  __hasProfile: boolean;
  __isNew: boolean;
}

/**
 * Junta auth.users (fonte de verdade) com profiles (lookup).
 * Todo usuário em authUsers vira uma linha, mesmo sem profile.
 */
export function buildUserRows(
  authUsers: AuthUserLike[],
  profiles: ProfileLike[],
  nowMs: number = Date.now(),
): UserRow[] {
  const profileByUser = new Map<string, ProfileLike>();
  for (const p of profiles) profileByUser.set(p.user_id, p);

  return authUsers.map((au) => {
    const profile = profileByUser.get(au.id);
    const createdMs = au.created_at ? new Date(au.created_at).getTime() : 0;
    return {
      user_id: au.id,
      full_name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      organization_id: profile?.organization_id ?? null,
      onboarding_completed: profile?.onboarding_completed ?? false,
      __hasProfile: !!profile,
      __isNew: createdMs > 0 && nowMs - createdMs < NEW_USER_WINDOW_MS,
    };
  });
}

/** Filtro de presença: all | new | no_profile */
export function passesPresenceFilter(row: UserRow, filterPresence: string): boolean {
  if (filterPresence === "no_profile" && row.__hasProfile) return false;
  if (filterPresence === "new" && !row.__isNew) return false;
  return true;
}
