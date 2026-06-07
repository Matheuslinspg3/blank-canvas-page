# Fluxo Resolver Bug Web

## Gatilho
Mensagem iniciando com `/bug`.

## Guardrails do fluxo

| Regra | Ação |
|-------|------|
| Dado ausente | Marcar `[DADO AUSENTE]`, continuar com hipótese conservadora |
| Sem logs | Prosseguir com evidências visuais + pedir logs |
| Sem repo | Gerar análise local + perguntar repo |
| Projeto ambíguo | BLOQUEAR despacho até confirmação do usuário |
| Hipótese sem evidência | Marcar como hipótese, não tratar como fato |
| Segredo detectado | Mascarar imediatamente, alertar risco |
| Conflito entre análises | Listar ambas, recomendar investigação extra |

## Etapas

```
1. Criar caso → atribuir ID, status "Novo"
2. Coletar relato → estruturar feedback
3. Logs/Sentry → se houver (senão pular com nota)
4. Reprodução → roteiro de passos
5. Frontend + Backend → podem rodar em paralelo
6. Segurança → checar exposição
7. Prompt Codex + Prompt Claude → em paralelo
8. Aguardar respostas externas (se aplicável)
9. Consolidar solução
10. [CONFIRMAÇÃO] Perguntar canal: Lovable/PR/outro
11. Gerar prompt final (Lovable ou PR)
12. Despachar (Lovinho ou GitHub)
13. QA checklist
14. Salvar memória
```

## Saída mínima por rodada

- Status atual
- O que mudou
- Evidências vs hipóteses
- Próximo passo
- Pendências

## Regra de travamento

Nunca travar o caso. Se faltar dado:
1. Marcar lacuna
2. Continuar com hipótese conservadora
3. Gerar pergunta objetiva para desbloquear

## Fallback global

Se qualquer etapa falhar ou retornar vazio:
- Registrar falha no caso com timestamp
- Pular para a próxima etapa viável
- Marcar etapa como "pendente revisita"
