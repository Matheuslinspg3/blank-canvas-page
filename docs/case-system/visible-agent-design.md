# Agente Visível vs Papéis Internos

## Visível no seletor

Apenas: `correcoes-web`

## Papéis internos (14)

Documentados em `internal-agents/AGENTS.md`. São etapas de raciocínio, não agentes separados.

## Agentes externos reais

| Agente | Quando usar |
|--------|-------------|
| `codex-builder` | Investigação de código / PR |
| `lovable-sender` | Despacho para Lovable |
| `project-ops` | Contexto de projeto |

## Por quê

14 agentes no seletor = confusão. Um maestro + papéis internos = interface limpa, fluxo organizado.
