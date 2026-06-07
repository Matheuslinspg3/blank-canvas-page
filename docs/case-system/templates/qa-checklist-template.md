# Checklist QA

> Guardrail: não declarar validado sem critério verificável.

---

## Fluxo quebrado
- [ ] Reproduzir bug original → não ocorre mais
- [ ] Comportamento esperado confirmado
- [ ] Mensagens de erro/sucesso adequadas

## Técnico
- [ ] Console sem erros novos
- [ ] Network/API sem falhas
- [ ] Sentry sem novos eventos correlatos

## Mobile
- [ ] Fluxo principal ok em viewport mobile
- [ ] Formulários, botões, loading funcionais

## Desktop
- [ ] Fluxo principal ok em viewport desktop
- [ ] Rotas e interações afetadas ok

## Regressão
- [ ] Fluxos adjacentes testados
- [ ] Auth/permissões ok
- [ ] Persistência de dados ok

## Aceite
- [ ] Bug original resolvido
- [ ] Fluxo completo do início ao fim
- [ ] Sem regressão nas áreas correlatas

## Sinais de problema remanescente
- Erro parcial continua
- Novo erro em rota adjacente
- Sentry/console ainda registram falha

## Fallback
Se não for possível testar (sem acesso ao ambiente):
→ Marcar como "pendente execução" e listar o que precisa ser testado quando houver acesso.
