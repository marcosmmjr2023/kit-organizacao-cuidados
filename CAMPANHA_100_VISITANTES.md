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
