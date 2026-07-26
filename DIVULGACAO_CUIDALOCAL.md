# Divulgação verificável do CuidaLocal

Este registro separa publicação, divulgação, tráfego e venda. Uma ação só aparece como realizada quando existe uma URL ou resposta verificável.

## Baseline — 2026-07-26

- Release público: `cuidalocal-v1.2.0`.
- Às 22:09 UTC, o release registrava 1 ZIP e 3 APKs; esses acessos incluíam verificações internas do lançamento.
- Às 22:18 UTC, logo após duas submissões ao Internet Archive, os totais passaram para 3 ZIPs e 5 APKs. Como os incrementos de +2 em cada ativo coincidiram com o arquivamento e não têm atribuição humana, o baseline operacional foi movido para **3 ZIPs e 5 APKs**.
- Todo o baseline é tratado como **não atribuível**, não como compradores ou audiência.
- GitHub Traffic nos 14 dias anteriores: 0 visualizações do repositório; 122 clones/71 cloners únicos, sem atribuição humana confiável.
- Estrelas, forks e assinantes do repositório: 0.
- Vendas confirmadas: 0.

## Ações realizadas

| Data UTC | Camada | Ação | Evidência | Estado |
|---|---|---|---|---|
| 2026-07-26 | Audiência externa | Submissão do CuidaLocal à lista `hemanth/awesome-pwa`, seção Health and Lifestyle, repositório com cerca de 4,8 mil estrelas | https://github.com/hemanth/awesome-pwa/pull/450 | PR aberto; ainda não aceito |
| 2026-07-26 | Descoberta | Descrição e tópicos do repositório ampliados com `pwa`, `android`, `offline-first`, `local-first`, `accessibility`, `medication-reminder` e `caregiver-app` | https://github.com/marcosmmjr2023/kit-organizacao-cuidados | Publicado |
| 2026-07-26 | Medição | Dashboard atualizado para a versão 1.2.0, separando cliques/downloads do ZIP e APK e subtraindo o baseline não atribuível | https://marcosmmjr2023.github.io/kit-organizacao-cuidados/metricas.html | Publicado e verificado |
| 2026-07-26 | Descoberta | PWA adicionada ao sitemap e três URLs submetidas ao protocolo IndexNow | https://marcosmmjr2023.github.io/kit-organizacao-cuidados/sitemap.xml | HTTP 202 — aceita para processamento; não prova ranking nem audiência |
| 2026-07-26 | Distribuição externa durável | Página comercial e PWA enviadas ao Internet Archive | https://web.archive.org/web/https://marcosmmjr2023.github.io/kit-organizacao-cuidados/cuidalocal.html | Duas respostas HTTP 200; possíveis acessos automatizados separados do baseline |

## Canais bloqueados ou não utilizados

- X/Twitter: a ferramenta oficial `xurl` não está instalada nem autenticada neste ambiente; nenhum post foi feito.
- Facebook, Instagram, WhatsApp, Reddit e e-mail pessoal: não foram usados para preservar a privacidade e evitar postagem sem autorização de conta.
- Nenhuma mensagem em massa, comentário promocional ou formulário sem permissão foi enviado.

## Como medir a partir deste baseline

- `v2-cuidalocal-open`: abertura do aplicativo a partir da página comercial.
- `v2-pix-copy-cuidalocal`: intenção de pagamento; não confirma Pix.
- `v2-download-click-cuidalocal-zip` e `v2-download-click-cuidalocal-apk`: cliques nos botões.
- Downloads do release após os baselines de 3 ZIPs e 5 APKs: arquivos servidos, não vendas.
- Pagamento confirmado: somente extrato bancário, PSP ou webhook pode comprovar.
