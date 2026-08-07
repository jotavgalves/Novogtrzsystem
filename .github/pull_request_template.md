## Módulo proprietário

<!-- Informe a feature principal afetada. -->

## O que mudou

<!-- Descreva objetivamente. -->

## Contratos e regras afetados

- [ ] Nenhum contrato compartilhado foi alterado.
- [ ] Contratos alterados estão identificados e documentados.
- [ ] Regras de negócio alteradas possuem testes atualizados.

## Limpeza e substituição

- [ ] Código substituído foi removido.
- [ ] Não foram mantidas implementações `old`, `legacy`, `V2`, `New`, cópias ou blocos comentados.
- [ ] Não existe segundo handler, store, listener, componente ou fluxo concorrente para a mesma função.
- [ ] Imports, estilos, testes e dependências obsoletos foram removidos.
- [ ] Não foi usado `setTimeout`, reload da janela ou manipulação direta do DOM para contornar sincronização.

## Fronteiras arquiteturais

- [ ] A mudança respeita a API pública das features.
- [ ] Nenhum módulo importa arquivos internos de outro módulo.
- [ ] O renderer não acessa Node, SQLite, `fs` ou Electron diretamente.
- [ ] Regras comerciais não foram colocadas em componentes React.
- [ ] Não foi criado outro `createRoot`, `ReactDOM.render`, roteador ou ponto de montagem.
- [ ] Não foi criada dependência circular.
- [ ] Estado global só foi usado para informação realmente global.

## Testes e verificações

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run format:check`
- [ ] `npm run architecture:check`
- [ ] `npm run deadcode:check`
- [ ] Testes unitários relevantes
- [ ] Testes de integração relevantes
- [ ] Smoke tests relevantes
- [ ] Build local
- [ ] Abas não relacionadas continuam carregando normalmente

## Impacto entre abas

<!-- Explique por que outra aba precisou ser alterada. Escreva "nenhum" quando não houver. -->

## Evidência de remoção da implementação anterior

<!-- Liste arquivos removidos, referências eliminadas ou resultado da busca por código antigo. -->
