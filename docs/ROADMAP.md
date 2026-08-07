# Roadmap de Implementação

O desenvolvimento será incremental. Cada fase deverá terminar executável, testada e documentada antes da próxima. Não será permitido implementar telas sem que os respectivos casos de uso, regras e testes estejam definidos.

## Fase 0 — Planejamento e aprovação

### Entregas

- escopo funcional consolidado;
- regras de negócio;
- arquitetura;
- modelo de dados;
- catálogo de smoke tests;
- decisões confirmadas e pendentes;
- definição do MVP.

### Critério de conclusão

- documentação aprovada;
- nenhuma contradição crítica entre módulos;
- pendências vinculadas às fases correspondentes.

### Estado

Em elaboração. Nenhum código funcional deverá ser iniciado antes da aprovação desta fase.

## Fase 1 — Fundação do aplicativo

### Entregas

- workspace TypeScript;
- Electron, React e Vite;
- estrutura main, preload e renderer;
- banco SQLite e Drizzle;
- sistema de migrações;
- contratos IPC com Zod;
- logs locais;
- tema escuro base;
- Lucide incorporado ao bundle;
- fonte local incorporada ao bundle;
- Vitest e Playwright configurados;
- banco temporário para testes;
- instalador Windows inicial.

### Critérios de conclusão

- aplicativo inicia offline;
- renderer não acessa Node diretamente;
- ícones e fonte carregam sem internet;
- migração inicial cria banco válido;
- smoke tests de infraestrutura passam.

## Fase 2 — Eventos, perfis e configurações básicas

### Entregas

- criação, edição, encerramento, reabertura e arquivamento de evento;
- alternância Caixa e Produção;
- senha inicial da Produção;
- alteração segura da senha;
- matriz de permissões;
- autorização pontual de ação protegida;
- configuração global e por evento;
- Balcão automático por evento.

### Critérios de conclusão

- dados de eventos não se misturam;
- Caixa não recebe dados administrativos pelo IPC;
- ações protegidas exigem senha;
- auditoria mínima de segurança funciona.

## Fase 3 — Produtos, estoque e combos

### Entregas

- categorias;
- produtos;
- custo, preço, lucro bruto e margem;
- estoque atual;
- limite e alertas;
- movimentações manuais;
- transferência entre eventos;
- combos;
- comparação entre combo e venda individual;
- disponibilidade por componente limitante.

### Critérios de conclusão

- estoque nunca fica negativo;
- toda movimentação possui histórico;
- Caixa não vê custo ou margem;
- combos baixam componentes corretamente;
- testes `SMK-EST-*` e `SMK-CMB-*` passam.

## Fase 4 — Mesas, carrinho, vendas e pagamentos

### Entregas

- cadastro e ciclo de mesas;
- Balcão permanente;
- catálogo por categoria;
- carrinho sem reserva de estoque;
- checkout transacional;
- cartão, Pix, dinheiro e voucher como contrato inicial;
- pagamento misto com dois blocos;
- troco;
- histórico por mesa;
- ajustes e cancelamentos;
- estorno proporcional;
- devolução de estoque.

### Critérios de conclusão

- validação de estoque ocorre no checkout;
- falha causa rollback integral;
- cada pagamento cria venda independente;
- mesa permanece aberta até encerramento manual;
- venda original não é sobrescrita;
- testes `SMK-MSA-*`, `SMK-PGT-*` e `SMK-VND-*` passam.

## Fase 5 — Vouchers

### Entregas

- criação automática e manual;
- venda prévia, venda local e cortesia;
- saldo e estados;
- regras visuais de elegibilidade;
- limites por categoria e produto;
- vínculo com mesa;
- aplicação por código;
- uso parcial;
- pagamento misto;
- bloqueio de dois vouchers;
- cancelamento e reativação;
- histórico completo;
- comportamento temporário no Balcão;
- devolução proporcional em ajustes.

### Critérios de conclusão

- não existe duplicidade financeira entre venda e consumo do voucher;
- regras são validadas no domínio e no checkout;
- saldo nunca fica negativo;
- cancelamento recompõe saldo e estoque atomicamente;
- testes `SMK-VCH-*` passam.

## Fase 6 — Caixa e despesas

### Entregas

- abertura e fechamento;
- valor inicial;
- suprimento e sangria;
- entradas por forma;
- faturamento comercial;
- saldo realizado;
- resultado projetado;
- despesas e categorias;
- estados pago, parcial e em aberto;
- parcelas com data, forma e observação;
- estorno de parcela;
- indicadores do evento.

### Critérios de conclusão

- faturamento, fluxo financeiro e lucro são demonstrados separadamente;
- despesas parciais recalculam saldo corretamente;
- caixa fechado bloqueia movimentações;
- testes `SMK-CAX-*` e `SMK-DSP-*` passam.

## Fase 7 — Ingressos

### Entregas

- lotes;
- quantidade disponível;
- lançamento individual e múltiplo;
- nomes individuais ou em grupo;
- códigos automáticos e manuais;
- Sympla, WhatsApp e dinheiro;
- cortesia;
- edição;
- cancelamento;
- exclusão lógica;
- faturamento separado;
- bloqueio integral para Caixa.

### Critérios de conclusão

- lote não gera receita na criação;
- quantidade válida não supera o lote;
- códigos são únicos;
- cancelamentos recalculam disponibilidade e financeiro;
- testes `SMK-ING-*` passam.

## Fase 8 — Auditoria completa e backups

### Entregas

- auditoria central de todos os módulos;
- filtros;
- antes e depois;
- correlação transacional;
- backup manual;
- backup automático;
- backup no encerramento;
- destino configurável;
- suporte a unidade externa;
- importação;
- restauração;
- checksum;
- verificação SQLite;
- backup pré-restauração;
- histórico de backups.

### Critérios de conclusão

- operação crítica falha se auditoria obrigatória não for persistida;
- backup corrompido não altera o banco;
- restauração é atômica;
- dados restaurados passam por verificação de integridade;
- testes `SMK-AUD-*` e `SMK-BKP-*` passam.

## Fase 9 — Relatórios, acabamento e acessibilidade

### Entregas

- vendas por produto e categoria;
- ranking;
- estoque inicial, movimentado e restante;
- consumo por mesa;
- consumo e saldo de voucher;
- ingressos por lote e forma;
- cortesias;
- despesas por categoria;
- resultado do evento;
- exportação em PDF e planilha;
- atalhos de teclado;
- estados vazios e mensagens;
- revisão de contraste e legibilidade;
- navegação otimizada para operação rápida.

### Critérios de conclusão

- relatórios conciliam com livros de estoque e financeiro;
- exportações funcionam offline;
- fluxos principais podem ser operados sem mouse quando aplicável;
- revisão visual aprovada.

## Fase 10 — Estabilização e entrega

### Entregas

- suíte completa automatizada;
- teste com base volumosa;
- teste de queda durante venda e restauração;
- teste de atualização entre versões;
- instalador Windows x64;
- procedimento de instalação;
- procedimento de backup e recuperação;
- manual operacional de Caixa;
- manual de Produção;
- versão `1.0.0`.

### Critérios de conclusão

- zero falhas críticas abertas;
- smoke tests completos aprovados;
- aplicação funciona sem internet;
- clone, instalação e build reproduzíveis;
- backup restaurado com sucesso em instalação limpa;
- operação simulada de evento aprovada.

## Estratégia de desenvolvimento

Para cada fase:

1. atualizar documentação afetada;
2. criar ou revisar migrações;
3. implementar regras de domínio;
4. criar testes unitários;
5. implementar repositórios e transações;
6. criar testes de integração;
7. implementar IPC;
8. implementar interface;
9. criar smoke tests e E2E;
10. executar build offline;
11. revisar auditoria e permissões;
12. atualizar changelog.

## Estratégia de branches

- `main`: estado estável e documentado;
- `feat/<modulo>`: implementação de módulo;
- `fix/<descricao>`: correção;
- `docs/<descricao>`: documentação;
- pull requests pequenos e revisáveis;
- nenhuma fase será mesclada com smoke tests críticos falhando.

## Ordem de dependência

```text
Fundação
  → Eventos e perfis
    → Estoque e combos
      → Mesas, vendas e pagamentos
        → Vouchers
          → Caixa e despesas
            → Ingressos
              → Auditoria e backups
                → Relatórios
                  → Estabilização
```

Auditoria básica, testes e backup técnico inicial começarão desde as primeiras fases, mesmo que sua interface completa seja concluída posteriormente.
