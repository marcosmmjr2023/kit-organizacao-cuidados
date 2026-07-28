# Campanha de alcance CuidaLocal — meta 100

## Meta operacional

- **Alvo:** pelo menos **100 navegadores únicos aproximados** na série `v2` antes de encerrar os ciclos de melhoria.
- **Não equivale a:** 100 pessoas verificadas, leads, cuidadores, downloads, pagamentos ou vendas. A deduplicação é por `localStorage` e navegadores podem bloquear, limpar ou compartilhar armazenamento.
- **Métrica de decisão:** `approx_unique_browsers` de `scripts/collect_metrics.py` / contador `v2-unique-browser`.
- **Foco:** aumentar descoberta legítima e tráfego humano sem mensagens em massa, contas falsas, automação de interações ou publicação em perfis pessoais.

## Baseline

Coletado em **2026-07-26T23:05:36Z**:

| Métrica | Valor |
|---|---:|
| Pageviews qualificados | 7 |
| Sessões aproximadas | 6 |
| Navegadores únicos aproximados | 4 |
| Visitas externas qualificadas | 1 |
| Meta restante (aproximada) | 96 |

O baseline não prova pessoas distintas. A campanha usa a série v2 porque séries anteriores foram contaminadas por verificações, arquivadores e navegação interna.

## Regra de cada ciclo

1. Coletar as métricas atuais, sem gerar visualizações artificiais.
2. Se `approx_unique_browsers >= 100`, registrar a evidência, **parar alterações de produto/distribuição** e entregar apenas o relatório final.
3. Se houver tráfego sem intenção, melhorar uma única hipótese de página/CTA/conteúdo e verificar.
4. Se não houver tráfego suficiente, executar **uma** ação durável e permitida: conteúdo útil indexável, melhoria de descoberta ou submissão a diretório estritamente relevante que aceite contribuições.
5. Para diretórios: verificar regras antes, não criar contas, não resolver CAPTCHA, não alegar aceitação antes de merge/listagem e registrar URL/estado.
6. Nunca usar redes sociais, e-mail, grupos, DMs ou contas pessoais sem uma autorização e conta comercial explícitas.
7. Testar qualquer alteração, publicar somente artefatos verificados e registrar o resultado abaixo.

## Registro de ciclos

- 2026-07-26 — ciclo inicial: métrica corrigida para acompanhar a meta de 100 navegadores únicos aproximados; baseline registrado. Próxima ação: buscar um diretório técnico/privacidade/cuidado adicional com contribuição permitida.
- 2026-07-26 — distribuição adicional: enviada a PR [alexanderop/awesome-local-first#57](https://github.com/alexanderop/awesome-local-first/pull/57), seção **Health & Fitness**, apontando para a PWA em inglês. Estado: `submitted`/aberta; não aceita nem comprova alcance.
- 2026-07-26 — conteúdo indexável: publicado o guia imprimível [Como organizar a lista de medicamentos para uma consulta](https://marcosmmjr2023.github.io/kit-organizacao-cuidados/como-organizar-lista-de-medicamentos.html), com modelo administrativo, limites explícitos contra alteração de prescrição e link contextual para o CuidaLocal. Métrica antes da ação: 7 pageviews qualificados, 6 sessões aproximadas, **4 navegadores únicos aproximados**, 1 visita externa qualificada e 0 cliques de abertura/ZIP do CuidaLocal. Evidência: [deploy Pages 30224873290](https://github.com/marcosmmjr2023/kit-organizacao-cuidados/actions/runs/30224873290) concluído com sucesso e URL, sitemap e feed respondendo HTTP 200. Estado: `listed/published`; não comprova alcance, intenção, download ou venda.
- 2026-07-26 — conteúdo indexável internacional: publicada a versão em inglês [Medication list for a healthcare appointment](https://marcosmmjr2023.github.io/kit-organizacao-cuidados/medication-list-for-appointment.html), com checklist imprimível, link para a PWA em inglês e schema de artigo. A atribuição interna `utm_source=content` foi classificada como interna para não inflar visitas externas. Evidência: [deploy Pages 30225180636](https://github.com/marcosmmjr2023/kit-organizacao-cuidados/actions/runs/30225180636) concluído com sucesso, URL/sitemap responderam HTTP 200 e a submissão IndexNow retornou HTTP 200 (aceite para processamento, não indexação). Estado: `listed/published`; não comprova alcance, intenção, download ou venda.
- 2026-07-27 — conteúdo indexável: publicado o [Diário de cuidados: modelo gratuito para imprimir](https://marcosmmjr2023.github.io/kit-organizacao-cuidados/diario-de-cuidados-modelo.html), uma folha por turno com agenda, fatos observados, contatos e pendências, além de limites explícitos contra decisões clínicas e link contextual para o CuidaLocal. Métrica antes da ação (2026-07-27T05:19:22Z): 7 pageviews qualificados, 6 sessões aproximadas, **4 navegadores únicos aproximados**, 1 visita externa qualificada e 0 cliques de abertura/ZIP do CuidaLocal. Evidência: [deploy Pages 30239555297](https://github.com/marcosmmjr2023/kit-organizacao-cuidados/actions/runs/30239555297) concluído com sucesso; página respondeu HTTP 200 com título esperado e apareceu no sitemap. Estado: `listed/published`; não comprova alcance, intenção, download, pagamento ou venda.
- 2026-07-27 — conteúdo indexável: publicado o [Calendário de consultas e exames: modelo gratuito para imprimir](https://marcosmmjr2023.github.io/kit-organizacao-cuidados/calendario-consultas-exames-modelo.html), com visão mensal, ficha por compromisso, logística, documentos, perguntas e próximos passos, limites explícitos contra decisões clínicas e link contextual para o CuidaLocal. Métrica antes da ação (2026-07-27T11:28:21Z): 8 pageviews qualificados, 7 sessões aproximadas, **5 navegadores únicos aproximados**, 1 visita externa qualificada e 0 cliques de abertura/ZIP do CuidaLocal. Evidência: [deploy Pages 30262207457](https://github.com/marcosmmjr2023/kit-organizacao-cuidados/actions/runs/30262207457) concluído com sucesso; página e sitemap responderam HTTP 200, com título e URL esperados. Estado: `listed/published`; não comprova alcance, intenção, download, pagamento ou venda.
- 2026-07-27 — conteúdo indexável: publicada a [Escala de cuidadores: modelo semanal gratuito para imprimir](https://marcosmmjr2023.github.io/kit-organizacao-cuidados/escala-de-cuidadores-modelo.html), com turnos, responsáveis, contatos, trocas confirmadas, lacunas de cobertura, cuidados de privacidade e link contextual para o CuidaLocal. Métrica antes da ação (2026-07-27T17:35:33Z): 8 pageviews qualificados, 7 sessões aproximadas, **5 navegadores únicos aproximados**, 1 visita externa qualificada e 0 cliques de abertura/ZIP do CuidaLocal. Evidência: [deploy Pages 30290084796](https://github.com/marcosmmjr2023/kit-organizacao-cuidados/actions/runs/30290084796) concluído com sucesso; página, sitemap e feed responderam HTTP 200 com o conteúdo esperado. Estado: `listed/published`; não comprova alcance, intenção, download, pagamento ou venda.
- 2026-07-27 — conteúdo indexável: publicado o [Checklist de alta hospitalar: modelo gratuito para imprimir](https://marcosmmjr2023.github.io/kit-organizacao-cuidados/checklist-alta-hospitalar-cuidados-em-casa.html), com duas folhas para conferir documentos, contatos, orientações confirmadas e pendências na transição para casa, limites explícitos contra decisões clínicas e link contextual para o CuidaLocal. Métrica antes da ação (2026-07-27T23:41:54Z): 9 pageviews qualificados, 8 sessões aproximadas, **5 navegadores únicos aproximados**, 2 visitas externas qualificadas e 0 cliques de abertura/ZIP do CuidaLocal. Evidência: [deploy Pages 30315113093](https://github.com/marcosmmjr2023/kit-organizacao-cuidados/actions/runs/30315113093) concluído com sucesso; página e sitemap responderam HTTP 200 com título e URL esperados. Estado: `listed/published`; não comprova alcance, intenção, download, pagamento ou venda.
- 2026-07-28 — conteúdo indexável: publicado o [Controle de estoque de medicamentos: modelo para imprimir](https://marcosmmjr2023.github.io/kit-organizacao-cuidados/controle-estoque-medicamentos-modelo.html), com inventário de quantidades conferidas, validade e armazenamento, folha de reposições e limites explícitos contra decisões sobre uso ou prescrição, além de link contextual para o CuidaLocal. Métrica antes da ação (2026-07-28T05:48:10Z): 9 pageviews qualificados, 8 sessões aproximadas, **5 navegadores únicos aproximados**, 2 visitas externas qualificadas e 0 cliques de abertura/ZIP do CuidaLocal. Evidência: [deploy Pages 30332874371](https://github.com/marcosmmjr2023/kit-organizacao-cuidados/actions/runs/30332874371) concluído com sucesso; página, sitemap e feed responderam HTTP 200 com título, CTA e URL esperados. Estado: `listed/published`; não comprova alcance, intenção, download, pagamento ou venda.
