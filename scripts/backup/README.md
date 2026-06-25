# Backup Diário — Porta do Corretor

Sistema de backup automático para rodar **no seu PC Linux de backup**.
Faz backup **todo dia às 22:00** de: banco Supabase, arquivos/projetos, secrets/.env e links.
Organiza **por pasta e por dia** e **apaga sozinho** backups com mais de 7 dias.

## Estrutura dos backups gerados

```
~/backups/porta-do-corretor/
├── 2026-06-25/
│   ├── database/
│   │   ├── supabase_2026-06-25_22-00-01.dump      ← pg_dump (restaurável)
│   │   └── supabase_2026-06-25_22-00-01.sql.gz    ← SQL legível
│   ├── arquivos/
│   │   └── porta-do-corretor_2026-06-25_22-00-01.tar.gz
│   ├── secrets/
│   │   └── secrets_2026-06-25_22-00-01.tar.gz.gpg ← criptografado
│   └── INFO_2026-06-25_22-00-01.md                ← links + inventário
├── 2026-06-26/
│   └── ...
└── _logs/
    └── backup_*.log
```

## Instalação (no PC Linux de backup)

```bash
# 1. Dependências
sudo apt update
sudo apt install -y postgresql-client gzip tar cron gnupg
#    (opcional, p/ off-site) sudo apt install -y rclone

# 2. Copiar esta pasta para o PC (ex.: ~/backup-porta) e entrar nela
cd ~/backup-porta

# 3. Criar a config e preencher
cp backup.config.example backup.config
chmod 600 backup.config
nano backup.config          # preencha SUPABASE_DB_URL, caminhos, GPG_PASSPHRASE...

# 4. Testar uma vez manualmente
chmod +x backup-diario.sh
./backup-diario.sh

# 5. Agendar para 22:00 todo dia
./instalar-cron.sh
```

## O que preencher no `backup.config`

| Campo | O que é |
|---|---|
| `SUPABASE_DB_URL` | Connection string do Postgres (Supabase → Settings → Database → URI, porta 5432) |
| `BACKUP_PATHS` | Lista de pastas/arquivos a salvar (repos, projetos…) |
| `SECRET_PATHS` | Arquivos `.env`/secrets a salvar (criptografados) |
| `GPG_PASSPHRASE` | Senha para criptografar os secrets (recomendado) |
| `LINKS` | URLs de referência (vão pro INFO.md) |
| `RETENTION_DAYS` | Dias a manter (padrão 7) |
| `RCLONE_REMOTE` | (opcional) destino off-site R2/S3 |

## Como restaurar

**Banco (dump custom):**
```bash
pg_restore --no-owner --no-privileges -d "postgresql://...:5432/postgres" \
  ~/backups/porta-do-corretor/2026-06-25/database/supabase_*.dump
```

**Banco (sql.gz):**
```bash
gunzip -c supabase_*.sql.gz | psql "postgresql://...:5432/postgres"
```

**Secrets (descriptografar):**
```bash
gpg --decrypt secrets_*.tar.gz.gpg | tar xz
```

## Segurança
- `backup.config` contém a senha do banco → mantenha em `chmod 600`.
- Os secrets são criptografados com AES-256 (se `GPG_PASSPHRASE` definido).
- Guarde a `GPG_PASSPHRASE` em lugar seguro — sem ela não dá pra restaurar os secrets.
