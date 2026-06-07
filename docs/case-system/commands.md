# Comandos

## Validação global

Todo comando deve:
1. Verificar se existe caso ativo (exceto `/bug` que cria novo).
2. Se não houver caso ativo e o comando não for `/bug` → perguntar: "Criar novo caso ou associar a qual?"
3. Registrar timestamp de cada adição.

---

| Comando | Função | Fallback se incompleto |
|---------|--------|----------------------|
| `/bug` | Cria caso novo | Se faltar nome/projeto → pedir antes de prosseguir |
| `/cliente` | Adiciona feedback | Se vago → registrar + gerar perguntas |
| `/sentry` | Adiciona log Sentry | Se ilegível → pedir formato/link |
| `/console` | Adiciona erro console | Se parcial → registrar + pedir mais contexto |
| `/codex` | Adiciona resposta Codinho | Se conflita com caso → marcar divergência |
| `/claude` | Adiciona resposta Claude | Idem |
| `/openclaw` | Adiciona auditoria OpenClaw | Idem |
| `/lovable` | Gera prompt Lovable | Se solução incompleta → marcar `[RASCUNHO]` |
| `/lovinho` | Despacha para Lovinho | Se projeto ambíguo → BLOQUEAR + perguntar |
| `/qa` | Gera checklist QA | Se sem solução → gerar checklist de investigação |
| `/solucao` | Consolida solução | Se evidências conflitantes → listar ambas |
| `/memoria` | Salva/atualiza memória | Nunca sobrescrever → apenas append |
| `/status` | Mostra status atual | Se caso vazio → informar e sugerir `/bug` |
| `/fechar` | Fecha caso | Se pendências abertas → listar antes de fechar |
