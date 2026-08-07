# Padrão de Código e Proteções Arquiteturais

## 1. Objetivo

O GTRZ System será um **monólito modular**: um único aplicativo desktop e um único banco local, porém dividido em módulos de negócio independentes.

O sistema não poderá evoluir como um arquivo HTML grande, um `App.tsx` centralizador ou um conjunto de correções coladas sobre implementações antigas. Cada aba deverá poder ser criada, alterada, testada e removida sem quebrar módulos não relacionados.

Este documento é normativo. Violações devem bloquear o merge ou o build de produção.

## 2. Regras inegociáveis

1. Haverá somente **uma raiz React** no renderer.
2. Haverá somente **um roteador principal**.
3. Cada aba será uma rota e um módulo carregado de forma independente.
4. Nenhuma aba poderá renderizar manualmente dentro do contêiner de outra aba.
5. Componentes React não acessam SQLite, sistema de arquivos, Electron ou IPC diretamente.
6. Regras de negócio não ficam em componentes, páginas, hooks visuais ou manipuladores de clique.
7. Nenhum módulo poderá importar arquivos internos de outro módulo.
8. Código antigo substituído deverá ser removido no mesmo trabalho; não poderá ficar desativado, comentado ou escondido.
9. Não será permitido duplicar funções, componentes, listeners, stores ou fluxos para “não mexer no antigo”.
10. Toda mutação deve possuir um único caso de uso responsável.
11. Toda funcionalidade nova exige testes no nível adequado.
12. Erros de lint, tipagem, dependências circulares, testes ou arquitetura bloqueiam a integração.

## 3. Estrutura por módulo

Estrutura prevista do renderer:

```text
apps/desktop/src/renderer/
├─ app/
│  ├─ App.tsx
│  ├─ router.tsx
│  ├─ providers.tsx
│  └─ layouts/
├─ features/
│  ├─ events/
│  ├─ inventory/
│  ├─ combos/
│  ├─ tables/
│  ├─ sales/
│  ├─ vouchers/
│  ├─ cash/
│  ├─ expenses/
│  ├─ tickets/
│  ├─ audit/
│  ├─ backups/
│  └─ settings/
├─ shared/
│  ├─ ui/
│  ├─ hooks/
│  ├─ formatting/
│  └─ types/
└─ assets/
```

Estrutura interna padrão de uma feature:

```text
features/inventory/
├─ api/
│  ├─ inventory.gateway.ts
│  └─ inventory.queries.ts
├─ components/
├─ pages/
├─ hooks/
├─ model/
│  ├─ inventory.types.ts
│  ├─ inventory.schemas.ts
│  └─ inventory.view-model.ts
├─ tests/
└─ index.ts
```

`index.ts` será a API pública do módulo. Outros módulos não poderão importar caminhos como:

```ts
// proibido
import { ProductEditor } from '@/features/inventory/components/ProductEditor';
```

Somente será permitido:

```ts
// permitido quando explicitamente exportado
import { InventoryPage } from '@/features/inventory';
```

## 4. Limites entre camadas

Fluxo obrigatório:

```text
Página/Componente
  → hook ou query da feature
    → gateway tipado do renderer
      → preload
        → handler IPC
          → caso de uso
            → repositório/transação
```

É proibido pular camadas.

### Renderer

Pode conhecer:

- componentes;
- rotas;
- view models;
- contratos tipados;
- gateways autorizados.

Não pode conhecer:

- Drizzle;
- SQLite;
- `fs`;
- implementação de backup;
- senha em texto;
- detalhes internos do processo principal.

### Domínio e casos de uso

Não podem importar:

- React;
- Electron;
- componentes;
- CSS;
- APIs do navegador;
- implementações SQLite.

### Infraestrutura

Implementa interfaces do domínio, mas não define regras comerciais.

## 5. Independência das abas

Cada aba deverá possuir:

- rota própria;
- página de entrada própria;
- estado de tela próprio;
- queries próprias;
- formulários próprios;
- testes próprios;
- tratamento de carregamento, erro e estado vazio;
- lazy loading quando aplicável.

Uma alteração na aba Estoque não deverá exigir modificar Mesas, Ingressos ou Despesas, salvo quando houver mudança formal em contrato compartilhado.

Comunicação entre módulos ocorrerá somente por:

1. contratos compartilhados estáveis;
2. casos de uso na camada de aplicação;
3. invalidação ou atualização de queries após uma operação;
4. eventos de domínio tipados quando realmente necessários.

Não será permitido usar variáveis globais, manipulação direta do DOM, IDs HTML compartilhados ou eventos genéricos sem tipo para sincronizar abas.

## 6. Renderização única

Para evitar dois renderers brigando pela mesma tela:

- somente `main.tsx` poderá executar `createRoot`;
- `createRoot` será chamado uma única vez;
- somente o roteador decidirá qual página ocupa a área principal;
- não será permitido usar `ReactDOM.render` legado;
- não será permitido montar aplicações React secundárias dentro das abas;
- portais serão limitados ao sistema central de modal, toast e tooltip;
- event listeners deverão ser registrados em hooks com cleanup explícito;
- subscriptions deverão retornar função de descarte;
- Strict Mode será mantido no desenvolvimento para revelar efeitos impuros.

Um teste de arquitetura deverá procurar chamadas adicionais de `createRoot`, `ReactDOM.render` e montagem manual no DOM.

## 7. Estado e dados

- Não haverá store global única contendo todo o sistema.
- Estado global será restrito a sessão, evento ativo, perfil e preferências realmente globais.
- Dados persistidos serão lidos por queries tipadas.
- Formulários manterão estado local.
- Carrinho será isolado por fluxo de venda.
- Após mutação, somente as queries afetadas serão invalidadas.
- Um módulo não poderá alterar diretamente o estado interno de outro.

## 8. Proibição de código empilhado e legado

Não serão aceitos:

- arquivos `old`, `legacy`, `backup`, `copy`, `final2` ou equivalentes dentro de `src`;
- grandes blocos comentados;
- código morto;
- flags permanentes para manter duas implementações da mesma função;
- componentes duplicados com pequenas diferenças;
- funções sufixadas com `V2`, `New`, `Updated` ou similares sem plano formal de migração;
- dois handlers IPC para a mesma intenção de negócio;
- duas fontes de verdade para o mesmo dado;
- correções por sobreposição de CSS para esconder estrutura incorreta;
- `!important` como solução padrão;
- `setTimeout` usado para sincronizar telas ou contornar condição de corrida;
- `window.location.reload()` para atualizar dados após operação;
- acesso direto ao DOM para substituir o fluxo React.

Ao substituir uma implementação:

1. criar ou ajustar testes;
2. migrar consumidores;
3. remover a implementação anterior;
4. remover imports, estilos e testes obsoletos;
5. executar busca por referências remanescentes;
6. registrar eventual migração no changelog.

## 9. Qualidade obrigatória

### TypeScript

Configuração obrigatória:

- `strict: true`;
- `noImplicitAny: true`;
- `noUncheckedIndexedAccess: true`;
- `exactOptionalPropertyTypes: true`;
- `noImplicitOverride: true`;
- `noFallthroughCasesInSwitch: true`;
- `useUnknownInCatchVariables: true`.

`any` explícito será proibido, salvo adaptação externa documentada e isolada.

### ESLint

Deverá bloquear:

- imports internos entre features;
- ciclos de dependência;
- variáveis e imports não utilizados;
- promises ignoradas;
- hooks React incorretos;
- dependências incompletas de effects;
- uso de APIs Node no renderer;
- `console.log` fora da camada de logging;
- `@ts-ignore` sem justificativa;
- código inalcançável;
- componentes anônimos exportados sem necessidade.

### Formatação

Prettier será executado de forma automática e validado no CI.

### Complexidade

O projeto adotará limites iniciais:

- função: máximo recomendado de 40 linhas;
- componente: máximo recomendado de 250 linhas;
- complexidade ciclomática: máximo 10;
- parâmetros por função: máximo 5;
- profundidade de blocos: máximo 4.

Ultrapassar um limite exigirá refatoração ou justificativa técnica registrada no pull request. Os limites podem ser ajustados por decisão arquitetural, nunca ignorados silenciosamente.

## 10. Ferramentas de fiscalização

Serão configuradas na fundação:

- ESLint com TypeScript e React;
- regras de boundaries para imports;
- `dependency-cruiser` ou ferramenta equivalente para validar camadas;
- detector de dependências circulares;
- `knip` ou equivalente para código, exports e dependências não utilizados;
- Vitest;
- Playwright;
- TypeScript em modo `noEmit`;
- Prettier em modo check.

Comandos obrigatórios planejados:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run architecture:check
npm run deadcode:check
npm run test
npm run test:integration
npm run test:smoke
npm run build
```

## 11. Portões de qualidade

Nenhum pull request poderá ser integrado se ocorrer:

- erro de compilação;
- erro de lint;
- formatação inválida;
- dependência circular;
- violação entre camadas;
- import interno de outra feature;
- código morto detectado;
- teste obrigatório falhando;
- cobertura reduzida sem justificativa;
- duplicação relevante introduzida;
- recurso visual remoto obrigatório;
- segundo ponto de montagem React;
- migração de banco sem teste;
- mudança de regra sem atualização dos testes e da documentação.

## 12. Processo para alterar uma aba

1. identificar a feature proprietária;
2. atualizar contrato apenas se necessário;
3. alterar domínio ou caso de uso antes da interface quando houver regra;
4. criar ou ajustar testes unitários;
5. alterar gateway e IPC, quando necessário;
6. alterar somente a página e componentes da feature;
7. executar testes da feature;
8. executar verificações arquiteturais globais;
9. confirmar que outras abas continuam carregando;
10. remover qualquer implementação substituída.

## 13. Revisão de pull request

Cada PR deverá responder:

- qual módulo é o proprietário da mudança;
- quais contratos foram alterados;
- quais regras de negócio foram alteradas;
- quais testes foram adicionados ou modificados;
- qual código antigo foi removido;
- se houve aumento de acoplamento;
- se outra aba precisou ser alterada e por quê;
- como foi verificado que não existe segunda implementação concorrente.

Pull requests deverão ser pequenos e focados. Não será permitido misturar funcionalidades independentes, refatoração ampla e mudança visual sem relação no mesmo PR.

## 14. Critérios de aceite arquitetural

A fundação somente será aprovada quando houver prova automatizada de que:

- existe uma única raiz React;
- rotas carregam módulos separados;
- imports entre features respeitam APIs públicas;
- renderer não acessa Node ou banco;
- domínio não depende de React ou Electron;
- ciclos de dependência são bloqueados;
- código morto é detectado;
- uma feature pode ser testada isoladamente;
- alterar uma feature não exige recompilar contratos internos de todas as outras;
- o pipeline rejeita exemplos intencionais de violação arquitetural.
