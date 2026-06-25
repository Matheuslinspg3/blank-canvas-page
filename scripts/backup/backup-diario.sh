#!/usr/bin/env bash
#
# backup-diario.sh — Backup diário completo (Supabase + arquivos + secrets + configs)
# Organiza por pasta/dia e remove backups com mais de RETENTION_DAYS dias.
#
# Uso:   ./backup-diario.sh
# Cron:  roda todo dia às 22:00 (ver instalar-cron.sh)
#
set -Eeuo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# 0. Carregar configuração
# ─────────────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/backup.config"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "ERRO: arquivo de configuração não encontrado: $CONFIG_FILE" >&2
  echo "Copie backup.config.example para backup.config e preencha." >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$CONFIG_FILE"

# Valores padrão se não definidos no config
BACKUP_ROOT="${BACKUP_ROOT:-$HOME/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
# Garante que arrays existam mesmo se o config não definir (evita erro com set -u)
BACKUP_PATHS=( "${BACKUP_PATHS[@]:-}" ); [[ "${BACKUP_PATHS[0]:-}" == "" ]] && BACKUP_PATHS=()
SECRET_PATHS=( "${SECRET_PATHS[@]:-}" ); [[ "${SECRET_PATHS[0]:-}" == "" ]] && SECRET_PATHS=()
LINKS=( "${LINKS[@]:-}" ); [[ "${LINKS[0]:-}" == "" ]] && LINKS=()
DATE_DIR="$(date +%Y-%m-%d)"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
DEST="${BACKUP_ROOT}/${DATE_DIR}"
LOG_DIR="${BACKUP_ROOT}/_logs"
LOG_FILE="${LOG_DIR}/backup_${TIMESTAMP}.log"

mkdir -p "$DEST" "$LOG_DIR"

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────
log()  { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
fail() { echo "[$(date '+%H:%M:%S')] ❌ $*" | tee -a "$LOG_FILE" >&2; }

# Captura erros mas NÃO aborta o backup todo: registra e segue para a próxima fonte
ERRORS=0
trap 'fail "Erro inesperado na linha $LINENO (comando: $BASH_COMMAND)"; ERRORS=$((ERRORS+1))' ERR

log "════════════════════════════════════════════════════════"
log "🗄️  BACKUP DIÁRIO — ${TIMESTAMP}"
log "Destino: ${DEST}"
log "Retenção: ${RETENTION_DAYS} dias"
log "════════════════════════════════════════════════════════"

# ─────────────────────────────────────────────────────────────────────────────
# 1. BANCO DE DADOS SUPABASE (pg_dump — schema + dados)
# ─────────────────────────────────────────────────────────────────────────────
if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  log "▶ [1/5] Backup do banco Supabase (pg_dump)..."
  DB_OUT="${DEST}/database"
  mkdir -p "$DB_OUT"

  if command -v pg_dump >/dev/null 2>&1; then
    # Dump completo (formato custom, comprimido, restaurável com pg_restore)
    if pg_dump "${SUPABASE_DB_URL}" \
         --format=custom --no-owner --no-privileges \
         --file="${DB_OUT}/supabase_${TIMESTAMP}.dump" 2>>"$LOG_FILE"; then
      log "  ✓ dump custom: supabase_${TIMESTAMP}.dump"
    else
      fail "  pg_dump (custom) falhou — ver log"; ERRORS=$((ERRORS+1))
    fi

    # Dump SQL plano (legível, fácil de inspecionar/migrar)
    if pg_dump "${SUPABASE_DB_URL}" \
         --no-owner --no-privileges \
         | gzip > "${DB_OUT}/supabase_${TIMESTAMP}.sql.gz" 2>>"$LOG_FILE"; then
      log "  ✓ dump SQL: supabase_${TIMESTAMP}.sql.gz"
    else
      fail "  pg_dump (sql) falhou — ver log"; ERRORS=$((ERRORS+1))
    fi
  else
    fail "  pg_dump não instalado. Instale: sudo apt install postgresql-client"
    ERRORS=$((ERRORS+1))
  fi
else
  log "▶ [1/5] (pulado) SUPABASE_DB_URL não configurado."
fi

# ─────────────────────────────────────────────────────────────────────────────
# 2. ARQUIVOS / PASTAS (repos, projetos, qualquer diretório listado)
# ─────────────────────────────────────────────────────────────────────────────
log "▶ [2/5] Backup de arquivos/pastas..."
FILES_OUT="${DEST}/arquivos"
mkdir -p "$FILES_OUT"

if [[ "${#BACKUP_PATHS[@]}" -gt 0 ]]; then
  for path in "${BACKUP_PATHS[@]}"; do
    if [[ -e "$path" ]]; then
      base="$(basename "$path")"
      # tar comprimido; exclui node_modules/.git/caches por padrão (configurável)
      if tar czf "${FILES_OUT}/${base}_${TIMESTAMP}.tar.gz" \
           ${TAR_EXCLUDES:-} \
           -C "$(dirname "$path")" "$base" 2>>"$LOG_FILE"; then
        sz=$(du -h "${FILES_OUT}/${base}_${TIMESTAMP}.tar.gz" | cut -f1)
        log "  ✓ ${base} (${sz})"
      else
        fail "  falha ao arquivar: ${path}"; ERRORS=$((ERRORS+1))
      fi
    else
      fail "  caminho não existe (pulado): ${path}"
    fi
  done
else
  log "  (nenhum caminho em BACKUP_PATHS)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 3. SECRETS / .env / CONFIGS (criptografado se houver senha GPG)
# ─────────────────────────────────────────────────────────────────────────────
log "▶ [3/5] Backup de secrets/configs..."
SECRETS_OUT="${DEST}/secrets"
mkdir -p "$SECRETS_OUT"
chmod 700 "$SECRETS_OUT"

if [[ "${#SECRET_PATHS[@]}" -gt 0 ]]; then
  STAGE="$(mktemp -d)"
  for sp in "${SECRET_PATHS[@]}"; do
    if [[ -e "$sp" ]]; then
      cp -a "$sp" "$STAGE/" 2>>"$LOG_FILE" && log "  ✓ coletado: $sp"
    else
      fail "  secret não existe (pulado): $sp"
    fi
  done
  TARBALL="${SECRETS_OUT}/secrets_${TIMESTAMP}.tar.gz"
  tar czf "$TARBALL" -C "$STAGE" . 2>>"$LOG_FILE"

  if [[ -n "${GPG_PASSPHRASE:-}" ]] && command -v gpg >/dev/null 2>&1; then
    gpg --batch --yes --passphrase "$GPG_PASSPHRASE" \
        -c --cipher-algo AES256 -o "${TARBALL}.gpg" "$TARBALL" 2>>"$LOG_FILE" \
      && rm -f "$TARBALL" \
      && log "  🔒 secrets criptografados: $(basename "${TARBALL}.gpg")"
  else
    chmod 600 "$TARBALL"
    log "  ⚠ secrets NÃO criptografados (defina GPG_PASSPHRASE no config para criptografar)"
  fi
  rm -rf "$STAGE"
else
  log "  (nenhum caminho em SECRET_PATHS)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 4. LINKS / METADADOS (URLs de projetos, refs do Supabase, etc.)
# ─────────────────────────────────────────────────────────────────────────────
log "▶ [4/5] Salvando links/metadados..."
META="${DEST}/INFO_${TIMESTAMP}.md"
{
  echo "# Backup ${TIMESTAMP}"
  echo
  echo "## Links e referências"
  if [[ "${#LINKS[@]}" -gt 0 ]]; then
    for l in "${LINKS[@]}"; do echo "- $l"; done
  else
    echo "_(nenhum link em LINKS)_"
  fi
  echo
  echo "## Conteúdo deste backup"
  echo '```'
  find "$DEST" -type f -printf '%P  (%s bytes)\n' 2>/dev/null | sort
  echo '```'
  echo
  echo "## Tamanho total"
  du -sh "$DEST" 2>/dev/null | cut -f1
} > "$META"
log "  ✓ metadados: $(basename "$META")"

# ─────────────────────────────────────────────────────────────────────────────
# 5. ROTAÇÃO — remover backups com mais de RETENTION_DAYS dias
# ─────────────────────────────────────────────────────────────────────────────
log "▶ [5/5] Limpando backups com +${RETENTION_DAYS} dias..."
REMOVED=0
# Apaga pastas de dia (YYYY-MM-DD) mais antigas que a retenção
while IFS= read -r -d '' olddir; do
  log "  🗑  removendo: $(basename "$olddir")"
  rm -rf "$olddir"
  REMOVED=$((REMOVED+1))
done < <(find "$BACKUP_ROOT" -maxdepth 1 -type d \
           -regextype posix-extended -regex '.*/[0-9]{4}-[0-9]{2}-[0-9]{2}$' \
           -mtime "+${RETENTION_DAYS}" -print0 2>/dev/null)
# Limpa logs antigos também
find "$LOG_DIR" -type f -name 'backup_*.log' -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true
log "  ✓ ${REMOVED} backup(s) antigo(s) removido(s)"

# ─────────────────────────────────────────────────────────────────────────────
# 6. (Opcional) Cópia off-site para R2/S3 via rclone
# ─────────────────────────────────────────────────────────────────────────────
if [[ -n "${RCLONE_REMOTE:-}" ]] && command -v rclone >/dev/null 2>&1; then
  log "▶ (extra) Enviando para off-site: ${RCLONE_REMOTE}/${DATE_DIR}"
  if rclone copy "$DEST" "${RCLONE_REMOTE}/${DATE_DIR}" 2>>"$LOG_FILE"; then
    log "  ☁ enviado para ${RCLONE_REMOTE}"
  else
    fail "  rclone falhou — ver log"; ERRORS=$((ERRORS+1))
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Resumo final
# ─────────────────────────────────────────────────────────────────────────────
TOTAL_SIZE="$(du -sh "$DEST" 2>/dev/null | cut -f1)"
log "════════════════════════════════════════════════════════"
if [[ "$ERRORS" -eq 0 ]]; then
  log "✅ BACKUP CONCLUÍDO — ${TOTAL_SIZE} em ${DEST}"
else
  fail "⚠ BACKUP CONCLUÍDO COM ${ERRORS} ERRO(S) — ${TOTAL_SIZE} em ${DEST}"
fi
log "Log: ${LOG_FILE}"
log "════════════════════════════════════════════════════════"

exit "$([[ "$ERRORS" -eq 0 ]] && echo 0 || echo 1)"
