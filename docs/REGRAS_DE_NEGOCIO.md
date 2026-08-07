# Regras de Negócio e Invariantes

Este documento define condições que o GTRZ System não poderá violar. Qualquer implementação deverá possuir validação, teste automatizado e registro de auditoria compatíveis com estas regras.

## 1. Escopo por evento

1. Toda entidade operacional pertence a um evento, exceto configurações globais, perfis e catálogo reutilizável.
2. Uma venda não pode referenciar mesa, produto, voucher ou lote de outro evento.
3. Transferência de estoque entre eventos deverá gerar uma saída no evento de origem e uma entrada no evento de destino, vinculadas pelo mesmo identificador de transferência.
4. Evento encerrado não aceita novas vendas, movimentações ou lançamentos, salvo reabertura autorizada pela Produção.

## 2. Perfis e autorização

1. Existem somente os perfis `PRODUCAO` e `CAIXA`.
2. Produção possui direitos administrativos completos.
3. Caixa acessa mesas, Balcão, venda e consulta operacional de estoque.
4. Caixa não visualiza preço de custo, margem, lucro, ingressos, despesas, caixa administrativo, auditoria ou configurações.
5. Edição ou cancelamento de venda pelo Caixa exige autorização por senha da Produção.
6. A autorização deve registrar o perfil executor, a ação autorizada e o instante da autorização.
7. A senha nunca será armazenada em texto puro.
8. A senha inicial é `121225`, mas será alterável pela Produção.

## 3. Valores monetários

1. Valores monetários serão armazenados em centavos inteiros.
2. Cálculos financeiros não utilizarão ponto flutuante binário.
3. Arredondamentos serão realizados em centavos e de forma determinística.
4. Quantidades fracionárias somente serão permitidas para produtos cuja unidade de medida autorize fração.
5. Venda histórica preservará o preço, custo e nome apresentados no momento da operação.

## 4. Produtos e estoque

1. Quantidade de produto não poderá ficar negativa.
2. Adicionar item ao carrinho não reserva e não baixa estoque.
3. A baixa ocorrerá somente ao concluir a venda.
4. A conclusão deverá validar o estoque dentro da mesma transação que grava a venda.
5. Se qualquer item não possuir quantidade suficiente, nenhuma parte da venda será concluída.
6. Cancelamento integral devolve integralmente as quantidades elegíveis ao estoque.
7. Redução de quantidade devolve apenas a diferença.
8. Aumento de quantidade valida e baixa apenas a diferença adicional.
9. Toda alteração de estoque gera movimentação identificada e auditável.
10. Produto com histórico não será removido fisicamente; poderá ser arquivado.
11. Estoque baixo ocorre quando `quantidade_atual <= limite_cadastrado`.

## 5. Combos

1. Combo utiliza exclusivamente produtos ativos do mesmo evento ou do catálogo copiado para o evento.
2. A venda do combo baixa os componentes conforme suas quantidades.
3. A disponibilidade do combo é limitada pelo componente com menor capacidade de atendimento.
4. Se qualquer componente estiver insuficiente, a venda do combo não será concluída.
5. Alteração futura no custo dos produtos não modifica o custo histórico de combos já vendidos.
6. Cancelamento de combo devolve todos os componentes correspondentes.

## 6. Mesas e Balcão

1. Todos os produtos são pagos no momento da compra.
2. A mesa não acumula débito para pagamento posterior.
3. Cada pagamento concluído cria uma venda independente vinculada ao histórico da mesa.
4. Uma mesa permanece ativa até encerramento manual.
5. Encerrar mesa não apaga seu histórico.
6. O Balcão é permanente e não pode ser excluído ou arquivado.
7. Voucher aplicado no Balcão vale apenas para o carrinho atual e é removido da interface após conclusão ou cancelamento.

## 7. Vouchers

1. Código de voucher é único em todo o sistema.
2. Voucher poderá ter código automático ou manual.
3. Voucher manual duplicado será rejeitado.
4. Um voucher não poderá ser combinado com outro voucher na mesma venda.
5. Voucher poderá participar de pagamento misto com uma forma não voucher.
6. Valor utilizado não poderá superar:
   - o saldo atual;
   - o valor elegível do carrinho;
   - o valor informado pelo operador;
   - o valor restante da venda.
7. As regras definem elegibilidade de categorias, produtos e quantidades.
8. Itens não elegíveis não poderão ser quitados por voucher.
9. O uso do voucher reduz seu saldo na mesma transação da venda.
10. Cancelamento ou ajuste devolve proporcionalmente o valor ao voucher original.
11. Voucher cortesia não gera entrada financeira em sua emissão.
12. Venda ou carga paga de voucher gera entrada financeira própria.
13. Consumo do voucher não gera nova entrada de dinheiro.
14. Voucher com histórico não será apagado fisicamente.
15. Voucher cancelado poderá ser reativado preservando saldo e histórico.
16. Voucher esgotado possui saldo zero e não poderá ser utilizado até eventual estorno ou ajuste autorizado.

## 8. Pagamentos

1. Formas de pagamento de produtos: cartão, Pix, dinheiro e voucher.
2. Pagamento simples utiliza uma forma.
3. Pagamento misto utiliza exatamente dois blocos de pagamento.
4. Os dois blocos não poderão selecionar a mesma forma.
5. Apenas um bloco poderá ser voucher.
6. A soma dos pagamentos deverá cobrir o valor total da venda.
7. Pagamento superior ao total somente será aceito quando houver dinheiro.
8. Troco será calculado apenas a partir do valor em dinheiro entregue acima da parcela necessária.
9. Troco não reduz entradas registradas em cartão, Pix ou voucher.
10. Toda forma de pagamento gera um lançamento financeiro vinculado à venda.

## 9. Venda, edição, cancelamento e estorno

1. Venda concluída é imutável como registro original.
2. Edição cria ajuste vinculado à venda original.
3. Cancelamento cria estorno vinculado à venda original.
4. A venda original nunca será substituída silenciosamente.
5. Ajuste deverá registrar dados anteriores, novos dados, justificativa e responsável.
6. Estorno de pagamento misto será proporcional aos valores originais, inclusive voucher.
7. O retorno ao estoque e os estornos financeiros ocorrerão na mesma transação.
8. Falha em qualquer parte desfaz toda a operação.
9. Venda cancelada não compõe faturamento líquido, mas permanece visível nos relatórios de cancelamento.
10. Troco já entregue não é uma forma de pagamento e não deve ser estornado como receita.

## 10. Caixa

1. Entrada financeira real será separada de faturamento comercial.
2. Venda de produtos quitada com voucher compõe faturamento de produtos.
3. Venda paga de voucher compõe entrada financeira de vouchers.
4. O consumo posterior do voucher não será contado como segunda entrada financeira.
5. Cortesia será apresentada separadamente e não compõe entrada financeira.
6. Sangria e suprimento exigem valor, data, responsável e justificativa.
7. Caixa fechado não aceita novas movimentações, salvo reabertura autorizada e auditada.
8. Resultado projetado considera despesas totais.
9. Saldo realizado considera apenas entradas e saídas efetivadas.

## 11. Despesas

1. Despesa possui valor total, valor pago e saldo em aberto.
2. `saldo_em_aberto = valor_total - soma_dos_pagamentos_validos`.
3. Estado é calculado:
   - Em aberto: valor pago igual a zero;
   - Parcial: valor pago maior que zero e menor que o total;
   - Pago: valor pago igual ao total.
4. Pagamento não poderá superar o saldo em aberto.
5. Cada pagamento parcial gera saída financeira própria.
6. Cancelar pagamento parcial reverte a saída e recalcula o estado.
7. Categoria com uso histórico será arquivada, não removida fisicamente.

## 12. Ingressos

1. Apenas Produção acessa o módulo.
2. Criar lote não registra receita nem ingresso pago.
3. A quantidade de ingressos válidos não poderá ultrapassar a quantidade do lote.
4. Cada ingresso possui código único automático ou manual.
5. Não haverá QR Code.
6. Formas registradas: Sympla, WhatsApp ou dinheiro.
7. Cortesia possui valor financeiro zero.
8. Cancelamento devolve a unidade à disponibilidade do lote quando aplicável.
9. Exclusão operacional será lógica e preservada na auditoria.
10. Cancelar lote não cancela automaticamente ingressos já lançados.

## 13. Auditoria

1. Auditoria será somente de acréscimo; registros não poderão ser editados pela interface.
2. Toda ação crítica deverá possuir registro de auditoria.
3. Registros conterão data, hora, evento, perfil, módulo, ação, entidade, identificador e alterações.
4. Operações protegidas registrarão também a autorização da Produção.
5. Falha na gravação obrigatória de auditoria impede a conclusão da operação crítica.
6. Dados sensíveis, como hash de senha, não serão copiados para a auditoria.

## 14. Exclusão lógica

1. Entidades com histórico financeiro, de estoque ou auditoria não serão apagadas fisicamente.
2. A interface poderá oferecer “Excluir”, mas a operação será registrada como exclusão lógica quando houver histórico.
3. Exclusão física somente poderá ocorrer em cadastro sem qualquer referência, ainda assim com auditoria.

## 15. Backup, importação e restauração

1. Backup deverá conter banco, versão do esquema, metadados e checksum.
2. Importação verificará integridade antes de apresentar a opção de restauração.
3. Backup incompatível ou corrompido será rejeitado sem alterar os dados atuais.
4. Antes de restaurar ou importar, o sistema criará backup de segurança do estado atual.
5. Restauração será atômica: falha não poderá deixar banco parcialmente substituído.
6. O aplicativo não dependerá de internet para criar, importar ou restaurar backups.
7. Toda operação de backup e restauração será auditada.

## 16. Datas e identificação

1. Identificadores internos serão imutáveis e independentes dos nomes editáveis.
2. Códigos visíveis poderão ser automáticos ou manuais conforme o módulo.
3. Datas serão armazenadas de forma padronizada e exibidas no horário local configurado.
4. O horário padrão inicial será o do computador, com configuração do evento disponível para relatórios.
