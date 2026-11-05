# Painel de Malhas Fiscais

**Produto Indra** para gestão de malhas fiscais de administrações tributárias estaduais. Primeiro cliente: **SEFAZ/AP**.

> **Versão experimental de demonstração:** https://rodrigomviana.github.io/SCM/
> Usuário `sergio.lages` (todos os perfis) ou qualquer outro da tela de login, senha `123456`.
> Todos os dados são **fictícios**, e a demonstração roda inteiramente no navegador: as alterações valem até recarregar a página.

O Painel substitui o trabalho manual em planilhas e controla o ciclo completo de uma malha:

- planejamento e execução de indicadores (cruzamentos na base analítica) e ranking de contribuintes;
- publicação no Portal de Autorregularização;
- notificação, ciência, contestação e prorrogação;
- suspensão e reativação do CAD-ICMS;
- ação fiscal (MPF, TIF, Auto de Infração) e encerramento.

Os atos formais (RF-01 a RF-22) são executados no sistema legado (SATE) por uma fila de integração assíncrona, rastreável e reprocessável.

| | |
|---|---|
| Backend | Java 21 · Spring Boot 4.1.2 · JPA/Hibernate · Flyway · Spring Security (JWT/OIDC) · ShedLock |
| Frontend | Angular 22.2 · NG-ZORRO 22.2 (Ant Design, licença MIT) |
| Banco | Oracle 19c+ (produção) · H2 em modo Oracle (desenvolvimento) |

## O que está neste repositório

Este repositório contém **apenas o necessário para a demonstração no ar**:

```
frontend/              Aplicação Angular
  src/app/demo/        API simulada no navegador (usada só no build "demo")
  demo/dados.json      Massa fictícia da demonstração
  scripts/             Gerador da massa a partir do back-end de desenvolvimento
.github/workflows/     Build e publicação no GitHub Pages
```

O back-end Java, a documentação (arquitetura, manual técnico, manual do usuário) e os materiais do cliente são distribuídos internamente.

## Executando a demonstração localmente

Pré-requisito: Node.js 24. Na pasta `frontend`:

```bash
npm ci
```
```bash
npx ng build --configuration demo
```

O resultado fica em `frontend/dist/frontend/browser` e deve ser servido no caminho `/SCM/`.

Com o back-end Java em execução, `npm start` sobe o front-end em http://localhost:4200 conectado à API real.

## Publicação

Cada push na `main` dispara o workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml), que gera o build de demonstração e publica no GitHub Pages. Na primeira vez, ative em **Settings → Pages → Source: GitHub Actions**.
