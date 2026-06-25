#!/usr/bin/env bash
#
# instalar-cron.sh — agenda o backup-diario.sh para rodar todo dia às 22:00
#
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="${SCRIPT_DIR}/backup-diario.sh"
HORARIO_MIN=0
HORARIO_HORA=22

if [[ ! -f "$BACKUP_SCRIPT" ]]; then
  echo "ERRO: não encontrei $BACKUP_SCRIPT" >&2; exit 1
fi
if [[ ! -f "${SCRIPT_DIR}/backup.config" ]]; then
  echo "⚠ Falta o backup.config. Crie a partir do exemplo:" >&2
  echo "   cp ${SCRIPT_DIR}/backup.config.example ${SCRIPT_DIR}/backup.config" >&2
  echo "   chmod 600 ${SCRIPT_DIR}/backup.config" >&2
  echo "   nano ${SCRIPT_DIR}/backup.config   # preencha credenciais/caminhos" >&2
  exit 1
fi

chmod +x "$BACKUP_SCRIPT"

# Linha do cron: 22:00 todo dia. Saída vai para o log do próprio script.
CRON_LINE="${HORARIO_MIN} ${HORARIO_HORA} * * * ${BACKUP_SCRIPT} >> \$HOME/backups/_cron.log 2>&1"
MARK="# backup-porta-do-corretor"

# Remove entrada antiga (se existir) e adiciona a nova — idempotente
( crontab -l 2>/dev/null | grep -v -F "$MARK" ; \
  echo "${CRON_LINE} ${MARK}" ) | crontab -

echo "✅ Cron instalado: backup todo dia às $(printf '%02d:%02d' "$HORARIO_HORA" "$HORARIO_MIN")"
echo
echo "Agendamento atual:"
crontab -l | grep -F "$MARK"
echo
echo "Dicas:"
echo "  • Testar agora:        ${BACKUP_SCRIPT}"
echo "  • Ver agendamentos:    crontab -l"
echo "  • Remover agendamento: crontab -l | grep -v '${MARK}' | crontab -"
