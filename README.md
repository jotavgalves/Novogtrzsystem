# GTRZ System

PDV desktop offline para operação e gestão completa de eventos da GTRZ.

## Situação do projeto

O sistema está funcional e cobre o ciclo operacional do evento, do cadastro ao encerramento com backup. A interface, o banco SQLite e os recursos necessários ao funcionamento são empacotados localmente, sem dependência de internet durante a operação.

## Funcionalidades

### Eventos e acesso

- criação, seleção, renomeação, encerramento e arquivamento de eventos;
- separação integral dos dados por evento;
- perfis **Produção** e **Caixa**;
- senha obrigatória para retornar ao perfil Produção;
- troca segura de senha administrativa;
- auditoria das alterações e dos acessos protegidos.

### Catálogo e estoque

- categorias, produtos e combos;
- preço de custo, preço de venda, lucro bruto e margem;
- saldo independente por evento;
- compras, perdas, quebras, consumo interno, cortesias, devoluções e correções;
- transferências atômicas entre eventos;
- alertas de estoque baixo;
- baixa automática nas vendas e devolução exata nos estornos;
- custos e margens ocultos no perfil Caixa.

### Mesas, balcão e vendas

- balcão automático por evento;
- mesas e comandas independentes;
- produtos e combos no carrinho;
- descontos;
- dinheiro, PIX, crédito, débito e voucher;
- pagamentos simples ou mistos;
- cálculo e registro de troco;
- fechamento transacional da venda e do estoque;
- cancelamento de comandas abertas;
- estorno auditado de vendas pagas;
- histórico recente de operações.

### Vouchers

- emissão com código automático ou informado;
- saldo inicial e consumo parcial;
- bloqueio, reativação e esgotamento;
- razão imutável de saldo;
- combinação com outros meios de pagamento;
- restituição automática em estornos.

### Caixa e despesas

- abertura e fechamento do caixa;
- suprimentos e retiradas;
- recebimentos consolidados por meio de pagamento;
- caixa físico esperado;
- valor contado e diferença de fechamento;
- despesas por categoria e forma de pagamento;
- cancelamento auditado de despesas;
- resultado projetado do evento.

### Ingressos

- lotes com preço, capacidade e status;
- venda individual ou em grupo;
- origens Sympla, WhatsApp, porta e cortesia;
- códigos automáticos ou manuais, individuais e únicos;
- cortesias separadas do faturamento;
- cancelamento lógico com invalidação de códigos;
- restauração da capacidade após cancelamento;
- integração automática da receita ao caixa.

### Consolidação, auditoria e encerramento

- visão geral com faturamento, despesas, resultado, caixa, estoque, ingressos e vouchers;
- indicadores de saúde operacional;
- atividade recente do evento;
- auditoria pesquisável por evento, perfil, ação, texto e período;
- detalhes técnicos somente leitura;
- bloqueio do encerramento enquanto houver pendências;
- conciliação do caixa físico;
- backup final obrigatório e verificado;
- remoção do evento da operação ativa somente após o fechamento completo.

### Backups

- backup automático ao iniciar o aplicativo;
- backup manual;
- backup obrigatório ao encerrar o evento;
- verificação de integridade;
- escolha da pasta de destino;
- importação e restauração protegidas por backup preventivo.

## Perfis de acesso

- **Produção:** acesso administrativo completo, incluindo eventos, custos, despesas, ingressos, auditoria, visão geral, backups e configurações.
- **Caixa:** acesso às mesas, ao balcão e à consulta operacional do estoque, sem custos, margens ou módulos administrativos.

A senha inicial do perfil Produção é `121225`. Altere-a em **Configurações** antes de utilizar o sistema em um evento real.

## Instalação no Windows

O pipeline da branch `main` gera o instalador no formato:

```text
GTRZ-System-<versão>-Setup.exe
```

O instalador é publicado como artefato do workflow **Qualidade e arquitetura** com o nome **GTRZ-System-Windows**.

Requisitos de uso:

- Windows 10 ou 11 x64;
- permissão para instalar o aplicativo;
- espaço local para o banco de dados e os backups.

## Desenvolvimento

Requisitos:

- Node.js 22.23.1;
- npm 10.9.8.

Instalação reproduzível:

```bash
npm ci
```

Executar em desenvolvimento:

```bash
npm run dev
```

Validação completa:

```bash
npm run quality
npm run build
npm run test:e2e
```

Gerar o instalador Windows:

```bash
npm run package:win
```

## Arquitetura

```text
apps/desktop/
├─ src/main/       # ciclo do Electron, banco, backups e handlers IPC
├─ src/preload/    # API mínima, tipada e validada exposta ao renderer
├─ src/renderer/   # interface React, rotas e módulos funcionais
└─ resources/      # identidade visual e configuração do instalador

packages/
├─ contracts/      # contratos IPC e schemas Zod
├─ database/       # SQLite, migrações, transações e consultas
└─ domain/         # regras puras e cálculos monetários
```

Princípios obrigatórios:

- funcionamento offline;
- um único processo de renderização React e um único roteador;
- isolamento entre renderer, infraestrutura e banco;
- valores monetários armazenados em centavos inteiros;
- operações críticas executadas em transações SQLite;
- auditoria imutável;
- migrações aditivas e versionadas;
- bloqueio automático de ciclos, código morto, imports indevidos e arquivos excessivamente grandes.

## Qualidade

O workflow executa:

- instalação reproduzível;
- auditoria de vulnerabilidades;
- reconstrução das dependências nativas do Electron;
- Prettier;
- TypeScript estrito;
- ESLint;
- verificação arquitetural;
- detecção de ciclos e código morto;
- testes unitários e de integração;
- build do Electron;
- jornadas E2E reais;
- geração e publicação do instalador Windows na `main`.

## Documentação técnica

- [`docs/PLANO_GERAL.md`](docs/PLANO_GERAL.md)
- [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)
- [`docs/PADRAO_DE_CODIGO.md`](docs/PADRAO_DE_CODIGO.md)
- [`docs/MODELO_DE_DADOS.md`](docs/MODELO_DE_DADOS.md)
- [`docs/REGRAS_DE_NEGOCIO.md`](docs/REGRAS_DE_NEGOCIO.md)
- [`docs/TESTES_SMOKE.md`](docs/TESTES_SMOKE.md)
- [`docs/ROADMAP.md`](docs/ROADMAP.md)
- [`docs/DECISOES.md`](docs/DECISOES.md)

## Stack

- Electron 43
- React 19
- TypeScript estrito
- Vite 7 e Electron Vite 5
- SQLite e Drizzle ORM
- Zod
- Lucide React
- Inter Variable incorporada
- Vitest
- Playwright
- ESLint
- Madge e Knip
