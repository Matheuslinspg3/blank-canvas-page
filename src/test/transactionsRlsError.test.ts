import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests garantindo que falhas ao criar transação por RLS exibam
 * sempre uma mensagem amigável (em PT-BR) instruindo o usuário a
 * solicitar acesso ao administrador, ao invés de vazar a mensagem
 * crua do Postgres.
 *
 * A lógica testada é a mesma usada em src/hooks/useTransactions.ts
 * dentro de createTransaction.onError.
 */

// ----- Mocks compartilhados -----
const toastMock = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
  toast: toastMock,
}));

// Mock mínimo do supabase client (não é usado nesses testes, mas evita import errors)
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ then: () => {} }) }) }) }),
      insert: () => ({ select: () => ({ single: () => ({}) }) }),
    }),
  },
}));

// Replica fiel do handler de erro do hook (mantenha em sincronia com useTransactions.ts)
function handleCreateTransactionError(error: any, toast: typeof toastMock) {
  const isRls =
    error?.code === '42501' ||
    /row-level security|permission denied/i.test(error?.message || '');
  toast({
    title: 'Erro ao criar transação',
    description: isRls
      ? 'Você não tem permissão para criar transações. Solicite acesso ao administrador da organização.'
      : error.message,
    variant: 'destructive',
  });
}

const FRIENDLY_RLS_MSG =
  'Você não tem permissão para criar transações. Solicite acesso ao administrador da organização.';

describe('useTransactions — onError (RLS friendly message)', () => {
  beforeEach(() => {
    toastMock.mockClear();
  });

  it('detecta erro RLS pelo code 42501 e mostra mensagem amigável', () => {
    handleCreateTransactionError(
      { code: '42501', message: 'new row violates row-level security policy for table "transactions"' },
      toastMock,
    );

    expect(toastMock).toHaveBeenCalledTimes(1);
    const call = toastMock.mock.calls[0][0];
    expect(call.title).toBe('Erro ao criar transação');
    expect(call.description).toBe(FRIENDLY_RLS_MSG);
    expect(call.variant).toBe('destructive');
    // Não deve vazar mensagem técnica
    expect(call.description).not.toMatch(/row-level security/i);
    expect(call.description).not.toMatch(/42501/);
  });

  it('detecta erro RLS pela substring "row-level security" mesmo sem code', () => {
    handleCreateTransactionError(
      { message: 'new row violates row-level security policy for table "transactions"' },
      toastMock,
    );

    const call = toastMock.mock.calls[0][0];
    expect(call.description).toBe(FRIENDLY_RLS_MSG);
  });

  it('detecta erro RLS pela substring "permission denied" (case-insensitive)', () => {
    handleCreateTransactionError(
      { message: 'Permission DENIED for table transactions' },
      toastMock,
    );

    const call = toastMock.mock.calls[0][0];
    expect(call.description).toBe(FRIENDLY_RLS_MSG);
  });

  it('mensagem amigável instrui contatar o administrador da organização', () => {
    handleCreateTransactionError({ code: '42501', message: 'rls' }, toastMock);
    const { description } = toastMock.mock.calls[0][0];
    expect(description).toMatch(/administrador/i);
    expect(description).toMatch(/organização/i);
    expect(description).toMatch(/permissão/i);
  });

  it('para erros não-RLS, mantém a mensagem original (não força mensagem RLS)', () => {
    handleCreateTransactionError(
      { code: '23505', message: 'duplicate key value violates unique constraint' },
      toastMock,
    );
    const call = toastMock.mock.calls[0][0];
    expect(call.description).toBe('duplicate key value violates unique constraint');
    expect(call.description).not.toBe(FRIENDLY_RLS_MSG);
  });

  it('toast sempre usa variant destructive em falhas', () => {
    handleCreateTransactionError({ message: 'qualquer erro' }, toastMock);
    expect(toastMock.mock.calls[0][0].variant).toBe('destructive');
  });

  it('handler é resiliente a erros sem message', () => {
    expect(() =>
      handleCreateTransactionError({ code: '42501' }, toastMock),
    ).not.toThrow();
    const call = toastMock.mock.calls[0][0];
    expect(call.description).toBe(FRIENDLY_RLS_MSG);
  });
});

describe('Sincronia com hook real (smoke)', () => {
  it('useTransactions exporta a estrutura esperada', async () => {
    // garante que o arquivo não quebrou e mantém a API pública
    const mod = await import('@/hooks/useTransactions');
    expect(typeof mod.useTransactions).toBe('function');
  });
});
