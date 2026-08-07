# Registro de Decisões

## 1. Decisões confirmadas

### DEC-001 — Aplicativo offline

O GTRZ System será um aplicativo desktop para um único computador, funcional sem internet após a instalação.

### DEC-002 — Separação por evento

Estoque, mesas, vendas, vouchers, ingressos, despesas, caixa, auditoria e relatórios serão separados por evento.

### DEC-003 — Perfis

Existirão somente dois perfis:

- Produção, com direitos administrativos completos;
- Caixa, com acesso operacional a mesas e estoque.

Não haverá um terceiro perfil chamado Administrador. Produção exerce os direitos administrativos.

### DEC-004 — Restrições do Caixa

Caixa não visualiza ingressos, custos, margem, lucro, despesas, caixa administrativo, auditoria ou configurações. Edição e cancelamento protegidos exigem senha da Produção.

### DEC-005 — Senha inicial

A senha inicial para acesso à Produção será `121225`. Ela deverá ser alterável e armazenada somente como hash.

### DEC-006 — Estoque sem reserva

Adicionar item ao carrinho não reserva estoque. A quantidade é validada e baixada apenas na conclusão da venda.

### DEC-007 — Pagamento imediato

Todas as compras realizadas em mesas são pagas imediatamente. A mesa não acumula conta pendente e permanece ativa até encerramento manual.

### DEC-008 — Histórico da mesa

Cada pagamento concluído gera uma venda independente no histórico da mesa.

### DEC-009 — Balcão

O Balcão é uma mesa fixa, permanente e não arquivável. Vouchers aplicados no Balcão são temporários para a compra atual.

### DEC-010 — Formas de pagamento de produtos

Cartão, Pix, dinheiro, voucher e misto.

### DEC-011 — Pagamento misto

O pagamento misto terá dois blocos. Cada bloco possui seletor de forma e campo de valor. Troco é calculado automaticamente quando houver valor excedente em dinheiro.

### DEC-012 — Estorno misto

Cancelamentos e reduções devolvem valores proporcionalmente às formas originais, inclusive voucher.

### DEC-013 — Margem

O sistema exibirá lucro bruto e margem percentual sobre o preço de venda.

### DEC-014 — Combo

Combo utiliza produtos cadastrados e baixa o estoque de seus componentes. O sistema compara custo, lucro e venda individual.

### DEC-015 — Origens de voucher

Voucher poderá ser:

- vendido previamente;
- vendido no local;
- cortesia.

### DEC-016 — Um voucher por venda

Não será permitido combinar dois vouchers na mesma venda. Voucher poderá ser usado em pagamento misto com outra forma.

### DEC-017 — Limites do voucher

O limite monetário do voucher é seu saldo. As regras determinam as categorias, produtos e quantidades elegíveis.

### DEC-018 — Estados do voucher

Ativo, parcialmente utilizado, esgotado, cancelado, expirado e arquivado. Cancelados ficarão em seção separada e poderão ser reativados.

### DEC-019 — Financeiro do voucher

Venda ou carga paga gera entrada financeira. Cortesia não gera entrada. O consumo do voucher quita uma venda, mas não duplica entrada financeira.

### DEC-020 — Alterações de venda

Venda original não será sobrescrita. Edição e cancelamento serão ajustes ou estornos vinculados, com atualização atômica de estoque, financeiro, voucher e auditoria.

### DEC-021 — Despesas

Despesas terão estados pago, parcial e em aberto. Pagamentos parciais registrarão valor, data, forma e observação e refletirão no caixa.

### DEC-022 — Ingressos

Ingressos são operados somente pela Produção. Lotes não são pagos automaticamente na criação.

### DEC-023 — Formas registradas de ingresso

Sympla, WhatsApp ou dinheiro.

### DEC-024 — Códigos de ingresso

Cada ingresso terá código único automático ou manual. Não haverá QR Code.

### DEC-025 — Cortesia de ingresso

Ingressos poderão ser cortesia com valor financeiro zero e relatório separado.

### DEC-026 — Exclusões com histórico

Ingressos, vouchers, produtos, mesas e demais entidades com histórico serão excluídos logicamente. A interface poderá usar o termo “Excluir”, mas a auditoria preservará o registro.

### DEC-027 — Movimentações de estoque

Compra, entrada manual, correções, perda, quebra, consumo interno, cortesia, devolução e transferência entre eventos.

### DEC-028 — Backup

Backup automático, ao encerrar evento, manual, importação, restauração, destino configurável, unidade externa e verificação de integridade.

### DEC-029 — Ícones

A interface utilizará Lucide Icons por dependência local empacotada. Não haverá CDN ou download em tempo de execução.

### DEC-030 — Fonte

A fonte será incorporada localmente ao aplicativo. A proposta inicial é Inter Variable, sem dependência de internet.

### DEC-031 — Tema

Tema escuro, vermelho vivo e branco. Estados de despesa usarão verde, amarelo e vermelho com texto e ícone.

### DEC-032 — Testes

Cada função criada deverá possuir smoke test individual identificado e apto a automação posterior.

## 2. Padrões técnicos adotados no planejamento

Estes padrões poderão ser alterados por nova decisão documentada antes da implementação afetada:

- Electron, React, TypeScript e Vite;
- SQLite e Drizzle ORM;
- Zod para contratos;
- Vitest e Playwright;
- dinheiro armazenado em centavos inteiros;
- snapshots históricos de preço e custo;
- transações atômicas;
- auditoria somente de acréscimo;
- instalador Windows x64 inicial.

## 3. Definições a fechar antes dos módulos correspondentes

Estas pendências não impedem o planejamento geral, mas deverão ser resolvidas antes da implementação indicada.

### PEN-001 — Sympla, WhatsApp e dinheiro

Confirmar se representam canais de origem do ingresso, formas de recebimento ou ambos. Até a confirmação, serão armazenados como “forma registrada do ingresso”, conforme informado.

### PEN-002 — Pagamento da venda local de voucher

Definir quais formas poderão receber a venda de um voucher no local. Proposta padrão: cartão, Pix e dinheiro.

### PEN-003 — Quantidades fracionárias

Definir se algum produto poderá ser vendido em unidade fracionária. Proposta padrão: quantidades inteiras, com opção por produto somente quando necessário.

### PEN-004 — Transferência de estoque e custo

Definir se a transferência preservará o custo do evento de origem. Proposta padrão: preservar o custo unitário transferido.

### PEN-005 — Escopo da importação de backup

Definir se a importação sempre substituirá todo o banco ou se também haverá importação de um evento isolado. Proposta para a primeira versão: restauração integral do banco, por ser mais segura e previsível.

### PEN-006 — Taxas de cartão e Sympla

Definir se taxas administrativas serão cadastradas automaticamente por forma ou registradas como despesas. Proposta inicial: registrar como despesa ou ajuste explícito, sem presumir taxas.

## 4. Processo para novas decisões

Toda mudança relevante deverá:

1. receber um identificador `DEC-XXX`;
2. descrever a decisão;
3. indicar módulos afetados;
4. atualizar regras e modelo de dados quando necessário;
5. adicionar ou alterar testes smoke;
6. ser registrada antes da implementação ou junto da mudança em pull request.
