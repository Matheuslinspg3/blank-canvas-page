# Backup no Google Drive (por organização, opt-in)

Feature que permite a cada imobiliária/corretor **administrador** conectar o
**próprio Google Drive** e ativar um backup automático de **leads e imóveis**
(e, opcionalmente, **fotos**) na conta de Drive da organização.

## Decisões de produto (travadas)

| Item | Decisão |
|---|---|
| Disponibilidade | Todos os planos |
| Quem conecta/configura/dispara | **Somente admin** da organização |
| OAuth scope | `drive.file` (o app só enxerga a pasta que cria) |
| Onde fica o backup | **Google Drive do cliente** (não no nosso banco) |
| Conteúdo | Dados **sempre** + fotos **opcionais** (original e/ou miniatura) |
| Frequência | **Horário fixo (1×/dia)** ou **de hora em hora** |
| **Trava** | "De hora em hora" **só sem fotos**; com fotos → fixo diário |
| Espelho | Pasta `atual/` reflete exclusões; `historico/` preserva snapshots |
| Retenção do histórico | 7 / 30 / 90 dias |
| Estimativa | **Precisa** (bytes reais do R2 p/ fotos + serialização real p/ dados) |

### Estrutura no Drive do cliente

```
Portal Corretor Backups/
  atual/                 # espelho fiel do banco hoje
    leads.(csv|json)
    imoveis.(csv|json)
    fotos/<imovel-id>/(original|thumb)/
  historico/
    <YYYY-MM-DD>/        # snapshot diário, removido ao vencer a retenção
```

## O que este PR entrega (PR 1 — fundação)

1. **Migration** `..._drive_backup_foundation.sql`
   - tabelas `backup_settings` e `backup_runs` + enums `backup_frequency`, `backup_run_status`
   - RLS **admin-only por org** (usando `get_user_organization_id()` e `is_org_admin()`)
   - CHECK que impede `frequency='hourly'` quando `include_photos=true` (a trava)
2. **Edge functions**
   - `drive-oauth-start` — inicia OAuth (admin-only, `access_type=offline`, `prompt=consent`)
   - `drive-oauth-callback` — troca o code, cria a pasta raiz no Drive do cliente e salva tokens
   - `estimate-backup-size` — estimativa precisa por escopo (R2 ListObjects + serialização)
3. **UI** `BackupSettingsCard` na aba **Configurações → Empresa** (visível só p/ admin)
   - conectar/reconectar Drive, ativar, escopo de fotos, frequência (com a trava na UI),
     horário, retenção, toggle "refletir exclusões" e a estimativa ao vivo.
4. `Settings` passa a respeitar `?tab=` para o redirect do callback abrir a aba certa.

## Secrets necessários (Supabase → Functions secrets)

Já existentes e reutilizados: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `R2_ENDPOINT`, `R2_BUCKET_NAME`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `APP_URL`.

**Novos (criar):**
- `GOOGLE_DRIVE_OAUTH_CLIENT_ID`
- `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET`

No Google Cloud Console, crie um OAuth Client (tipo *Web application*) e
adicione como **Authorized redirect URI**:

```
https://<PROJECT_REF>.supabase.co/functions/v1/drive-oauth-callback
```

Habilite a **Google Drive API** no projeto e adicione o scope `drive.file`
na tela de consentimento.

## Próximos PRs (roadmap)

- **PR 2 — Engine + cron**
  - função `run-backup` (serializa dados, espelha `atual/`, cria snapshot em
    `historico/`, aplica retenção; envia fotos com dedup quando habilitado)
  - refresh automático do `oauth_access_token` via `oauth_refresh_token`
  - cron `0 * * * *` que seleciona orgs "na hora" (fuso + `run_hour`, ou `hourly`)
  - escrita em `backup_runs`
- **PR 3 — Histórico/observabilidade na UI** (lista de execuções, status, erros, disparo manual)
