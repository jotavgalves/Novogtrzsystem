# ADR-001 — Monólito modular com fronteiras obrigatórias

- **Status:** aprovado
- **Data:** 2026-08-05
- **Escopo:** aplicação inteira

## Contexto

O GTRZ System precisa funcionar offline em um único computador e ser distribuído como um único aplicativo. Ao mesmo tempo, o projeto não pode se transformar em um HTML central, um `App.tsx` gigante, uma store global contendo todos os módulos ou um conjunto de versões antigas empilhadas.

O risco principal é uma alteração em uma aba quebrar outra por compartilhamento informal de estado, imports internos, listeners duplicados, duas renderizações concorrentes ou regras de negócio espalhadas na interface.

## Decisão

Adotar um **monólito modular orientado a domínios**.

O aplicativo será único, mas possuirá módulos independentes para:

- eventos;
- estoque;
- combos;
- mesas;
- vendas;
- pagamentos;
- vouchers;
- caixa;
- despesas;
- ingressos;
- auditoria;
- backups;
- configurações.

Cada módulo terá API pública explícita, testes próprios e propriedade clara sobre seus componentes e estado.

## Consequências obrigatórias

1. Uma única raiz React.
2. Um único roteador.
3. Cada aba representada por rota própria.
4. Proibição de importação de arquivos internos entre features.
5. Regras de negócio fora da camada visual.
6. Um único caso de uso para cada mutação comercial.
7. Uma única fonte de verdade para cada dado.
8. Código substituído removido no mesmo pull request.
9. Dependências circulares bloqueadas.
10. Código morto e exports sem uso detectados automaticamente.
11. Renderer sem acesso a Node, SQLite ou sistema de arquivos.
12. Build e merge bloqueados em caso de violação arquitetural.

## Alternativas rejeitadas

### HTML ou componente central monolítico

Rejeitado porque aumenta acoplamento, conflitos de renderização, dificuldade de teste e risco de regressão entre abas.

### Microfrontends

Rejeitado porque adicionaria complexidade desnecessária para um aplicativo local, offline e executado em um único computador.

### Stores globais por conveniência

Rejeitado como padrão. Estado global somente será aceito para dados verdadeiramente globais, como evento ativo, perfil e preferências gerais.

### Manter versões antiga e nova simultaneamente

Rejeitado. Migrações temporárias deverão possuir prazo, responsável e remoção prevista. Não poderão permanecer como arquitetura permanente.

## Fiscalização

A decisão será fiscalizada por:

- TypeScript estrito;
- ESLint e regras de boundaries;
- verificação de ciclos;
- verificação de código morto;
- teste de ponto único de montagem React;
- testes unitários, integração, smoke e E2E;
- checklist obrigatório de pull request;
- revisão de mudanças em contratos compartilhados.

Os detalhes operacionais estão em [`PADRAO_DE_CODIGO.md`](PADRAO_DE_CODIGO.md).
