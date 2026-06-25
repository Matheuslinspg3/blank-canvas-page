# PROMPT — Painel de Gestão de Backups (self-hosted, Linux + Ollama)

> Cole este prompt no Lovable / Claude  / Cursor / v0 para gerar o projeto.
> Ajuste nomes/paths conforme sua máquina. Tudo roda **localmente na sua máquina Linux**.

---

## CONTEXTO

Quero um **painel web self-hosted** para gerenciar backups da minha infraestrutura, rodando **na minha própria máquina Linux** (que já tem **Ollama** rodando localmente). O painel deve ser acessível **primeiro em `http://localhost`** e, depois, **exposto por uma URL pública** (via Cloudflare Tunnel ou Tailscale). Ele substitui o gerenciamento manual de cron: **a própria máquina executa os backups e o agendamento**, e a UI serve para configurar, monitorar, disparar manualmente e restaurar.

Já tenho um script de backup funcional (`backup-diario.sh`) que faz: `pg_dump` do Postgres/Supabase, `tar` de pastas, criptografia de secrets com `gpg`, organização por pasta/dia (`YYYY-MM-DD`) e rotação (remove backups com +7 dias). O painel deve **orquestrar e estender** esse conceito (não precisa reusar o bash; pode reimplementar em código).

## OBJETIVO

Uma aplicação **full-stack self-hosted** com:
- **UI no navegador** para gestão completa de backups
- **Tela de login** (autenticação local, sem depender de nuvem)
- **Backend que executa os backups** na própria máquina, com **agendador interno** (sem precisar editar cron na mão)
- **Gestão de credenciais** (inserir/editar via UI, armazenadas criptografadas)

## STACK (preferência self-hosted, leve, roda em Linux)

- **Backend:** Node.js + Fastify (ou NestJS). TypeScript.
- **Agendador:** `node-cron` interno (a app agenda e dispara sozinha; opção de também instalar uma entrada systemd timer).
- **Banco local:** SQLite (via Prisma) — guarda configs, jobs, histórico, usuários, credenciais criptografadas.
- **Frontend:** React + Vite + TypeScript + Tailwind + shadcn/ui. Tema claro/escuro.
- **Auth:** login local com usuário/senha (hash `argon2`), sessão via cookie httpOnly + JWT. Suporte a 2FA (TOTP) opcional.
- **Criptografia de credenciais:** AES-256-GCM, com chave mestra derivada de uma senha mestra (nunca salvar segredos em texto puro).
- **Execução:** rodar como serviço (systemd) e também via `docker compose` (oferecer os dois). Porta padrão `8088`.
- **IA local (Ollama):** integrar com a instância Ollama já existente em `http://localhost:11434` para um assistente que: explica logs de erro de backup, sugere o que salvar, e responde dúvidas sobre restauração. Modelo configurável na UI.

## FUNCIONALIDADES DA UI

### 1. Login / Onboarding
- Primeira execução: criar usuário admin + definir **senha mestra** (usada para criptografar credenciais).
- Login com usuário/senha; opção de 2FA TOTP.
- Logout, troca de senha.

### 2. Dashboard
- Status do último backup (sucesso/erro), data/hora, tamanho.
- Próximo backup agendado (countdown).
- Gráfico de uso de disco da pasta de backups.
- Cards: total de backups, espaço usado, jobs ativos, alertas.

### 3. Jobs de Backup (CRUD)
Cada job define **o que** salvar e **quando**:
- Nome do job.
- **Fontes** (múltiplas por job):
  - **Banco Postgres/Supabase**: connection string (porta 5432). Gera dump custom + sql.gz.
  - **Pastas/arquivos**: lista de paths (com exclusões tipo `node_modules`, `.git`).
  - **Secrets/.env**: paths, salvos **criptografados** (gpg/AES).
  - **Links/metadados**: URLs de referência salvas num `INFO.md`.
- **Agendamento**: cron visual (ex.: "todo dia 22:00") + timezone.
- **Retenção**: dias a manter (padrão 7) + rotação automática.
- **Destino**: pasta local + (opcional) **off-site** via `rclone` (R2/S3) configurável na UI.
- Botão **"Rodar agora"** (dispara manualmente) e **"Pausar/Ativar"**.

### 4. Histórico & Logs
- Lista de execuções com status, duração, tamanho, fonte de cada item.
- Ver log completo de cada execução (stream em tempo real durante a execução, via WebSocket/SSE).
- Filtrar por job/data/status. Exportar log.

### 5. Explorador de Backups & Restauração
- Navegar pelas pastas `YYYY-MM-DD` geradas.
- Ver conteúdo (database/arquivos/secrets/INFO.md) e tamanhos.
- **Download** de qualquer artefato.
- **Restaurar** com 1 clique guiado:
  - Banco: `pg_restore` para uma connection string informada (com confirmação dupla).
  - Secrets: descriptografar com a senha mestra.
  - Arquivos: extrair para um path escolhido.

### 6. Credenciais (cofre)
- Tela para **inserir/editar credenciais** necessárias, todas **criptografadas** com a senha mestra:
  - `SUPABASE_DB_URL` (string do Postgres)
  - `GITHUB_PAT` (se for fazer backup/sync de repos)
  - `R2/S3`: access key, secret, endpoint, bucket (off-site)
  - `GPG_PASSPHRASE` (criptografia dos secrets)
  - Credenciais de SMTP/Telegram/Discord (para notificações)
- Mascarar valores na UI, mostrar só com a senha mestra. Teste de conexão por credencial (botão "Testar").

### 7. Configurações
- Pasta raiz dos backups, porta, timezone.
- **Exposição externa**: instruções e toggle para gerar config de **Cloudflare Tunnel** ou **Tailscale Funnel** (gerar o comando/arquivo pronto).
- **Notificações**: ao falhar/concluir backup → e-mail (SMTP), Telegram ou Discord webhook.
- **Ollama**: URL (`http://localhost:11434`), modelo padrão, ligar/desligar o assistente.

### 8. Assistente IA (Ollama)
- Chat lateral que usa o Ollama local.
- Ações úteis: "explique este erro de backup", "como restauro o banco de ontem?", "o que devo incluir no backup deste projeto?".
- Nunca enviar segredos pro modelo; trabalhar só com metadados/logs.

## REQUISITOS NÃO-FUNCIONAIS

- **100% self-hosted**, sem dependência de serviço externo para funcionar (a nuvem é só destino opcional de off-site).
- Segurança: senha mestra nunca persistida em texto; credenciais AES-256-GCM; sessões httpOnly; rate-limit no login; CORS travado.
- Rodar como **systemd service** (auto-start no boot) e via **docker-compose**. Fornecer ambos.
- A própria app agenda e executa os jobs (não depender de eu editar cron manualmente), mas oferecer **opção** de exportar para systemd-timer/cron se eu quiser.
- Funcionar **offline** (rede local). Exposição por URL é um passo opcional posterior.
- Logs estruturados e healthcheck em `/health`.

## ENTREGÁVEIS

1. Estrutura completa do projeto (backend + frontend num monorepo, ou pastas `server/` e `web/`).
2. `docker-compose.yml` + `Dockerfile` e, alternativamente, um `systemd` unit + script de instalação (`install.sh`).
3. Migrations do SQLite (Prisma) e seed do usuário admin no primeiro run.
4. README com: instalação na máquina Linux, primeiro acesso em `localhost:8088`, como criar o primeiro job de backup, como expor por URL (Cloudflare Tunnel/Tailscale), e como restaurar.
5. `.env.example` e validação de ambiente.
6. Testes básicos (execução de um job de backup de pasta + rotação).

## PASSO A PASSO ESPERADO NA PRIMEIRA EXECUÇÃO

1. Subo com `docker compose up -d` (ou `./install.sh` para systemd).
2. Abro `http://localhost:8088`.
3. Crio o admin + senha mestra.
4. Cadastro as credenciais (Supabase DB URL, GPG passphrase, R2 opcional) no cofre.
5. Crio um job "Backup Diário" com fontes (banco + pastas + secrets), agendamento 22:00, retenção 7 dias.
6. Clico "Rodar agora" para testar; vejo o log em tempo real e o resultado no explorador.
7. (Depois) Ligo a exposição por Cloudflare Tunnel para acessar por uma URL com login.

---

### Observações para quem for gerar
- Priorize **simplicidade de deploy** numa máquina Linux pessoal.
- Não invente serviço de nuvem obrigatório; o off-site (R2/S3) é opcional e configurável.
- O agendador é **interno** à aplicação; o usuário não deve precisar mexer em crontab.
