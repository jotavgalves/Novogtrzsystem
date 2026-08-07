# Arquitetura Técnica Proposta

## 1. Objetivo arquitetural

Construir um aplicativo desktop Windows confiável, rápido e totalmente offline, com regras de negócio centralizadas, banco local transacional, interface responsiva e capacidade de recuperação por backup.

A arquitetura deverá evitar dependências de internet em tempo de execução e impedir que a camada visual altere diretamente arquivos, banco ou credenciais.

## 2. Stack base

- Electron para processo desktop e empacotamento.
- React para interface.
- TypeScript com modo estrito.
- Vite para desenvolvimento e build do renderer.
- SQLite para persistência local.
- Drizzle ORM para esquema, consultas tipadas e migrações.
- Zod para validação de entrada e contratos IPC.
- Lucide React para ícones.
- Fonte local empacotada, inicialmente Inter Variable por pacote local.
- Vitest para testes unitários e de integração.
- Playwright para testes de interface e smoke end-to-end.
- Electron Builder para instalador e distribuição Windows.

Versões exatas serão fixadas no início da implementação e registradas em lockfile.

## 3. Princípios

1. Offline por padrão.
2. Renderer sem acesso direto ao Node.js.
3. Regras de negócio fora dos componentes de interface.
4. Escritas críticas sempre transacionais.
5. Dinheiro em centavos inteiros.
6. Auditoria imutável.
7. Exclusão lógica quando houver histórico.
8. Backups verificáveis e versionados.
9. Módulos isolados, mas integrados por serviços de domínio.
10. Testabilidade de cada caso de uso sem depender da interface.

## 4. Processos Electron

### 4.1 Main process

Responsável por:

- ciclo de vida do aplicativo;
- janelas;
- banco SQLite;
- sistema de arquivos;
- backup, importação e restauração;
- impressão e exportação futura;
- logs;
- atualização de esquema;
- proteção de instância única;
- contratos IPC autorizados.

### 4.2 Preload

Expõe uma API mínima e tipada por `contextBridge`.

Exemplos conceituais:

- `events.list()`
- `sales.checkout()`
- `sales.cancel()`
- `inventory.move()`
- `vouchers.validate()`
- `backups.create()`
- `backups.import()`

O preload não expõe `fs`, `path`, `process`, banco ou execução arbitrária.

### 4.3 Renderer

Responsável apenas por:

- interface;
- estado de tela;
- formulários;
- navegação;
- apresentação de erros;
- chamadas às APIs tipadas do preload.

Configurações obrigatórias da janela:

- `contextIsolation: true`
- `nodeIntegration: false`
- CSP restritiva
- navegação externa bloqueada por padrão
- abertura de links externos somente por ação explícita e validada

## 5. Organização proposta do projeto

```text
sistema-GTRZ/
├─ apps/
│  └─ desktop/
│     ├─ src/
│     │  ├─ main/
│     │  ├─ preload/
│     │  └─ renderer/
│     └─ resources/
├─ packages/
│  ├─ domain/
│  ├─ database/
│  ├─ contracts/
│  ├─ ui/
│  └─ test-utils/
├─ docs/
├─ tests/
│  ├─ smoke/
│  ├─ integration/
│  └─ e2e/
├─ scripts/
└─ package.json
```

A implementação poderá começar como workspace único, mantendo os limites lógicos acima. A separação física em pacotes deverá ser adotada quando reduzir acoplamento sem aumentar desnecessariamente a complexidade.

## 6. Camadas

### 6.1 Domínio

Contém regras puras e entidades:

- eventos;
- produtos;
- estoque;
- combos;
- mesas;
- vendas;
- pagamentos;
- vouchers;
- despesas;
- ingressos;
- caixa;
- auditoria.

Não depende de Electron, React ou SQLite.

### 6.2 Casos de uso

Orquestram operações completas:

- concluir venda;
- ajustar venda;
- cancelar venda;
- usar voucher;
- devolver saldo de voucher;
- registrar pagamento parcial;
- transferir estoque;
- encerrar evento;
- importar backup.

Cada caso de uso recebe dependências por interfaces, facilitando testes.

### 6.3 Infraestrutura

Implementa:

- repositórios SQLite;
- transações;
- hashing;
- relógio;
- geração de códigos;
- arquivos e backups;
- logs;
- adaptadores Electron IPC.

### 6.4 Apresentação

React, rotas, layouts, formulários, tabelas, cards e diálogos.

## 7. Banco de dados

### 7.1 SQLite

Configurações planejadas:

- foreign keys ativadas;
- journal mode WAL quando compatível com a estratégia de backup;
- busy timeout configurado;
- transações explícitas;
- integridade verificada periodicamente;
- migrações numeradas e irreversíveis somente com estratégia de restauração.

O arquivo principal ficará no diretório de dados da aplicação do usuário, nunca dentro da pasta de instalação.

### 7.2 Transações críticas

As seguintes operações serão atômicas:

- concluir venda;
- ajustar ou cancelar venda;
- usar ou devolver voucher;
- registrar ou cancelar pagamento de despesa;
- lançar ou cancelar ingresso;
- transferir estoque entre eventos;
- fechar caixa;
- restaurar backup.

Exemplo de conclusão de venda:

1. validar evento e perfil;
2. validar carrinho;
3. validar estoque atual;
4. validar voucher e elegibilidade;
5. criar venda e itens com snapshots;
6. criar pagamentos;
7. baixar estoque e componentes dos combos;
8. reduzir saldo do voucher;
9. criar lançamentos financeiros;
10. criar auditoria;
11. confirmar transação.

Qualquer falha executa rollback completo.

## 8. Modelo financeiro

Todos os valores serão inteiros em centavos.

Serão separados:

- venda comercial;
- forma de quitação;
- entrada ou saída financeira;
- custo histórico;
- estorno;
- troco;
- saldo de voucher.

Isso permite mostrar faturamento sem duplicar a venda de voucher e seu consumo posterior.

## 9. Snapshots históricos

Itens de venda armazenarão cópias dos dados relevantes no momento da operação:

- nome do produto ou combo;
- categoria;
- preço unitário;
- custo unitário;
- quantidade;
- composição do combo;
- margem calculada.

Alterar um cadastro não modifica relatórios de vendas antigas.

## 10. Autenticação local e autorização

Não haverá autenticação remota.

- perfil atual persistido apenas conforme política definida;
- troca para Produção exige senha;
- ações protegidas do Caixa exigem autorização pontual;
- senha protegida por algoritmo de hash apropriado e salt;
- tentativa e falha de autorização registradas sem armazenar a senha;
- sessão de autorização pontual terá validade curta e escopo específico, evitando reutilização indevida.

## 11. UI e design system

### 11.1 Tokens

Serão centralizados:

- cores;
- tipografia;
- espaçamentos;
- raios;
- sombras;
- estados;
- tamanhos de ícone;
- densidade de tabelas e cards.

### 11.2 Tema

- fundo quase preto;
- superfícies cinza-escuras;
- vermelho vivo como destaque principal;
- branco para conteúdo primário;
- cinza-claro para conteúdo secundário;
- verde para pago ou sucesso;
- amarelo para parcial ou atenção;
- vermelho semântico acompanhado de texto e ícone para erro, em aberto ou cancelamento.

### 11.3 Ícones offline

`lucide-react` será dependência do projeto. Os SVGs usados serão incluídos no bundle durante o build. Não haverá importação por URL, CDN ou download em tempo de execução.

Somente ícones realmente usados serão importados, permitindo tree-shaking.

### 11.4 Fonte offline

A fonte será instalada como dependência local e incorporada ao build. Não haverá Google Fonts, CDN ou chamada externa.

Proposta inicial:

- família: Inter Variable;
- uso: interface e números;
- carregamento via arquivos internos gerados pela dependência de fonte.

## 12. Estado da interface

- estado remoto local, vindo do banco, gerenciado por camada de queries e invalidação;
- formulários isolados;
- carrinho mantido na memória da tela até o pagamento;
- nenhuma baixa de estoque antes do checkout;
- revalidação no momento da venda;
- dados críticos sempre recarregados após mutação.

Uma biblioteca de gerenciamento de servidor local poderá ser usada, desde que não crie dependência de rede.

## 13. Tratamento de erros

Erros terão códigos estáveis, por exemplo:

- `STOCK_INSUFFICIENT`
- `VOUCHER_NOT_FOUND`
- `VOUCHER_INELIGIBLE_ITEMS`
- `PAYMENT_TOTAL_INVALID`
- `AUTHORIZATION_REQUIRED`
- `BACKUP_CORRUPTED`
- `EVENT_CLOSED`

A interface traduzirá códigos em mensagens claras. Detalhes técnicos serão enviados ao log local, sem expor stack trace ao operador.

## 14. Backup

### 14.1 Formato

Pacote de backup planejado:

```text
backup-gtrz-AAAA-MM-DD-HH-mm.zip
├─ database.sqlite
├─ manifest.json
└─ checksums.sha256
```

O manifesto conterá:

- versão do aplicativo;
- versão do esquema;
- data e hora;
- identificador da instalação;
- tamanho do banco;
- checksum;
- eventos incluídos.

### 14.2 Criação

- checkpoint seguro do banco;
- cópia consistente;
- verificação de integridade SQLite;
- geração de checksum;
- compactação;
- validação final do arquivo.

### 14.3 Importação e restauração

1. selecionar arquivo;
2. validar extensão e estrutura;
3. validar checksum;
4. validar versão do esquema;
5. extrair para pasta temporária;
6. executar verificação de integridade;
7. criar backup automático do banco atual;
8. fechar conexões;
9. substituir atomicamente;
10. reabrir banco e validar;
11. registrar auditoria.

Se qualquer etapa falhar, o banco atual permanece ativo.

## 15. Logs locais

- logs rotativos;
- níveis de erro, aviso e informação;
- sem senhas ou dados sensíveis;
- identificação de operação e evento;
- opção de exportar pacote de diagnóstico pela Produção.

## 16. Testes

### 16.1 Unitários

Regras puras, cálculos, voucher, margem, troco, rateio de estorno e disponibilidade de combo.

### 16.2 Integração

Banco SQLite temporário real, migrações, transações e rollback.

### 16.3 End-to-end

Aplicativo empacotável ou ambiente Electron controlado, cobrindo navegação e fluxos críticos.

### 16.4 Smoke

Cada função terá identificador `SMK-<MODULO>-<NUMERO>`. O catálogo inicial está em `TESTES_SMOKE.md`.

## 17. Build e distribuição

- alvo inicial: Windows x64;
- instalador com atalho e desinstalação;
- dados do usuário preservados em atualização ou desinstalação conforme confirmação;
- versão exibida nas configurações;
- pacote de produção sem dependências remotas;
- verificação automática de que o build não contém URLs obrigatórias para recursos visuais.

A atualização inicial será manual por instalador, preservando banco e executando migrações. Atualização online automática está fora do escopo inicial.

## 18. Critérios arquiteturais de aceite

A arquitetura somente será considerada pronta para implementação quando:

- contratos entre renderer e main estiverem definidos;
- esquema inicial estiver revisado;
- regras financeiras estiverem cobertas por testes;
- venda e cancelamento tiverem desenho transacional validado;
- estratégia de migração e backup estiver definida;
- matriz de permissões estiver consolidada;
- nenhum recurso visual obrigatório depender de internet;
- estrutura de smoke tests estiver pronta para execução automatizada.
