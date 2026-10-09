# Desafio 6 — Origem do cadastro no app

Atribuição no **app**, sem depender de `referrer` do webview. O app registra a primeira abertura por `POST /opens`, inclusive acessos orgânicos. Os links carregam `campaign`, `referral` ou `src`; cada toque grava `click_id`, URL, `install_id` e `opened_at`. O cadastro consome os toques auditáveis. Para compatibilidade com eventos antigos sem `/opens`, o primeiro toque fornece uma abertura inferida; uma abertura explícita posterior prevalece.

Exemplo campanha: `https://app.conty.example/open?campaign=spring&src=community`
Exemplo indicação: `https://app.conty.example/open?referral=creator_123`

Regra: **último toque elegível vence**; empate de milissegundo: `click_id` ascendente. Janela inclusiva de sete dias de 24 horas contada de `first_open_at`, nunca reiniciada por outro clique; depois do cadastro nenhum novo toque vence. Cliques duplicados não geram nova origem. Se nada vence, é `organic` com `reason: no_eligible_touch`. A resposta de registro inclui todos os toques, suas razões e o vencedor.

Aberturas recebidas fora de ordem usam o instante do evento: antes do cadastro, prevalece a menor data entre as aberturas explícitas, independentemente da ordem de chegada. A primeira abertura explícita substitui a estimativa por toque; outras aberturas posteriores não reiniciam a janela. Na ausência de eventos explícitos, a estimativa usa o toque mais antigo. Datas equivalentes com fusos diferentes são tratadas como o mesmo instante. Depois do cadastro, um replay da abertura é aceito e qualquer mudança retorna 409 para preservar a atribuição registrada. Cadastro anterior à abertura também retorna 409.

```bash
npm test && npm run typecheck
npm start
curl -X POST http://localhost:3006/opens -H 'content-type: application/json' -d '{"install_id":"i1","first_open_at":"2026-10-01T12:00:00Z"}'
curl -X POST http://localhost:3006/touches -H 'content-type: application/json' -d '{"install_id":"i1","click_id":"clk1","opened_at":"2026-10-01T12:00:00Z","url":"https://app.conty.example/open?campaign=spring"}'
curl -X POST http://localhost:3006/registrations -H 'content-type: application/json' -d '{"install_id":"i1","user_id":"u1","registered_at":"2026-10-02T12:00:00Z"}'
# response: {"attribution":{"kind":"campaign","source":"spring","click_id":"clk1","reason":"last_eligible_touch"},"touches":[{"click_id":"clk1","winner":true,"reason":"selected_last_touch",...}],...}
```

Prova de conceito sem banco, criptografia do link, assinatura de clique ou controles antifraude; em produção seriam necessários IDs emitidos pelo servidor e sincronização segura entre deep-link/app/backend.

## Planejamento, execução e revisão

Planejamento e execução utilizando Codex GPT Sol 6.1. As implementações iniciais tiveram assistência de ChatGPT. O Codex realizou a revisão técnica e a análise dos requisitos, inspecionou o código e executou a validação automatizada registrada nesta entrega.

O autor realizou a revisão pessoal dos nove desafios, conforme declarado nesta execução. Os pontos abaixo documentam os critérios de análise da estrutura, da geração de testes e da qualidade do código.

| Área | Pontos de análise e revisão |
|---|---|
| Geração da estrutura | Registrar primeira abertura por /opens independentemente do toque; manter cliques auditáveis e um vencedor determinístico. |
| Geração e revisão dos testes | Cobrir dois links, empate de timestamps, replay de clique, janela inclusiva, toque após cadastro, acesso orgânico, aberturas em ordem invertida, fusos equivalentes, estimativa por toque e congelamento no cadastro. |
| Qualidade estrutural | Conferir reconciliação entre abertura explícita e abertura inferida, regra de último toque e motivos de descarte. |

**Ponto identificado na revisão pessoal e corrigido:** a reconciliação da primeira abertura agora é determinística pela data do evento, com testes de regressão para ordens de chegada diferentes e para eventos recebidos após o cadastro.

A suíte passou em 15 testes, além de `npm run typecheck` (checagem sintática).


## Verificação completa em 09/10/2026

Datas dos toques são normalizadas para UTC. Replay do mesmo click_id em outro fuso, representando o mesmo instante e link, é idempotente.

O transporte HTTP rejeita JSON nulo, arrays e valores primitivos com 400 antes de chamar o serviço. Parâmetros de rota são decodificados uma vez; escape inválido retorna 400. Dois testes de transporte verificam esses comportamentos, incluindo códigos com caracteres especiais.

Resultado desta rodada: 15 testes aprovados, zero falhas; checagem sintática aprovada e smoke HTTP com entrada válida 200 e inválida 400. As correções e a nova validação foram realizadas pelo Codex; não são atribuídas como revisão manual do autor.
