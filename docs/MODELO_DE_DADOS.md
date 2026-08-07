# Modelo de Dados Inicial

Este documento apresenta o modelo lógico inicial. Os nomes finais de tabelas e colunas poderão ser refinados durante as migrações, sem alterar as regras descritas.

## 1. Convenções

- Chaves primárias: identificadores textuais imutáveis, preferencialmente UUID ou ULID.
- Valores monetários: inteiros em centavos, sufixo `_cents`.
- Datas: timestamp padronizado.
- Exclusão lógica: `archived_at` ou `deleted_at`.
- Toda tabela operacional relevante terá `created_at` e `updated_at`.
- Entidades de histórico não utilizarão atualização destrutiva.
- Chaves estrangeiras serão obrigatórias quando a relação for estrutural.

## 2. Segurança e sessão

### `operators`

Representa os dois perfis alternáveis.

Campos principais:

- `id`
- `role`: `PRODUCAO` ou `CAIXA`
- `display_name`
- `password_hash`, aplicável à Produção
- `active`
- `created_at`
- `updated_at`

Regra: existirão inicialmente apenas os registros Produção e Caixa. A interface não será um cadastro geral de funcionários na primeira versão.

### `operator_sessions`

- `id`
- `operator_id`
- `started_at`
- `ended_at`
- `authorization_scope`
- `authorized_by_operator_id`

Usada para alternância de perfil e autorizações pontuais do Caixa.

## 3. Eventos

### `events`

- `id`
- `name`
- `description`
- `starts_at`
- `ends_at`
- `status`: planejamento, ativo, encerrado ou arquivado
- `timezone`
- `closed_at`
- `closed_by_operator_id`
- `reopened_at`
- `created_at`
- `updated_at`

Todas as entidades operacionais usarão `event_id`.

## 4. Produtos e estoque

### `product_categories`

- `id`
- `event_id`
- `name`
- `kind`: comida, bebida ou personalizada
- `sort_order`
- `active`
- `archived_at`

### `products`

- `id`
- `event_id`
- `category_id`
- `name`
- `description`
- `unit`
- `allows_fraction`
- `current_quantity`
- `low_stock_limit`
- `cost_price_cents`
- `sale_price_cents`
- `active`
- `archived_at`
- `created_at`
- `updated_at`

Lucro e margem serão calculados, não armazenados como fonte de verdade.

### `inventory_movements`

Livro imutável de estoque.

- `id`
- `event_id`
- `product_id`
- `type`
- `quantity_delta`
- `quantity_before`
- `quantity_after`
- `unit_cost_cents`
- `reason`
- `source_type`
- `source_id`
- `transfer_group_id`
- `operator_id`
- `created_at`

Tipos:

- compra
- entrada manual
- venda
- ajuste de venda
- cancelamento de venda
- correção positiva
- correção negativa
- perda
- quebra
- consumo interno
- cortesia
- devolução
- transferência de saída
- transferência de entrada

## 5. Combos

### `combos`

- `id`
- `event_id`
- `name`
- `description`
- `sale_price_cents`
- `active`
- `archived_at`
- `created_at`
- `updated_at`

### `combo_items`

- `id`
- `combo_id`
- `product_id`
- `quantity`

Restrição única: um produto aparece apenas uma vez por combo; alterações somam quantidade no mesmo registro.

## 6. Mesas

### `service_tables`

- `id`
- `event_id`
- `name`
- `is_counter`
- `status`: ativa, encerrada ou arquivada
- `sort_order`
- `closed_at`
- `closed_by_operator_id`
- `archived_at`
- `created_at`
- `updated_at`

Restrições:

- cada evento terá exatamente um Balcão com `is_counter = true`;
- Balcão não poderá ser excluído ou arquivado.

## 7. Vendas de produtos

### `sales`

Registro original da venda.

- `id`
- `event_id`
- `table_id`
- `sale_number`
- `status`: concluída, parcialmente ajustada ou cancelada
- `subtotal_cents`
- `discount_cents`
- `total_cents`
- `change_cents`
- `operator_id`
- `completed_at`
- `created_at`

### `sale_items`

Snapshot do item vendido.

- `id`
- `sale_id`
- `source_type`: produto ou combo
- `source_id`
- `name_snapshot`
- `category_snapshot`
- `quantity`
- `unit_sale_price_cents`
- `unit_cost_cents`
- `line_total_cents`
- `line_cost_cents`
- `eligible_quantity_after_adjustments`

### `sale_item_components`

Snapshot dos componentes de combo para estoque e histórico.

- `id`
- `sale_item_id`
- `product_id`
- `product_name_snapshot`
- `quantity_per_combo`
- `total_quantity`
- `unit_cost_cents`

### `sale_adjustments`

- `id`
- `sale_id`
- `type`: edição, cancelamento parcial ou cancelamento integral
- `reason`
- `operator_id`
- `authorized_by_operator_id`
- `total_delta_cents`
- `created_at`

### `sale_adjustment_items`

- `id`
- `adjustment_id`
- `sale_item_id`
- `quantity_before`
- `quantity_after`
- `quantity_delta`
- `unit_price_before_cents`
- `unit_price_after_cents`
- `value_delta_cents`

## 8. Pagamentos e financeiro

### `sale_payments`

- `id`
- `sale_id`
- `method`: cartão, Pix, dinheiro ou voucher
- `amount_cents`
- `voucher_id`
- `cash_received_cents`
- `change_cents`
- `created_at`

No pagamento misto existirão exatamente dois registros válidos.

### `payment_reversals`

- `id`
- `sale_payment_id`
- `sale_adjustment_id`
- `amount_cents`
- `created_at`

Permite estorno proporcional preservando o pagamento original.

### `financial_entries`

Livro financeiro unificado.

- `id`
- `event_id`
- `cash_session_id`
- `direction`: entrada ou saída
- `category`
- `method`
- `amount_cents`
- `source_type`
- `source_id`
- `reversal_of_entry_id`
- `description`
- `operator_id`
- `occurred_at`
- `created_at`

Categorias exemplificativas:

- venda de produto
- venda de ingresso
- venda de voucher
- estorno
- despesa
- sangria
- suprimento
- ajuste

## 9. Vouchers

### `vouchers`

- `id`
- `event_id`
- `name`
- `code`
- `origin`: pré-vendido, vendido no local ou cortesia
- `initial_value_cents`
- `current_balance_cents`
- `status`
- `linked_table_id`
- `valid_from`
- `valid_until`
- `notes`
- `archived_at`
- `created_at`
- `updated_at`

Restrição: `code` único em todo o banco.

### `voucher_rules`

- `id`
- `voucher_id`
- `allow_food`
- `allow_drink`
- `allow_combo`
- `max_food_quantity`
- `max_drink_quantity`
- `max_combo_quantity`

Campos de quantidade nulos significam ausência daquele limite.

### `voucher_rule_products`

- `id`
- `voucher_id`
- `product_id`
- `max_quantity`

Utilizada quando o voucher restringe ou inclui produtos específicos.

### `voucher_movements`

Livro imutável de saldo.

- `id`
- `voucher_id`
- `type`: emissão, carga, uso, devolução, ajuste, cancelamento ou reativação
- `amount_delta_cents`
- `balance_before_cents`
- `balance_after_cents`
- `sale_id`
- `sale_adjustment_id`
- `operator_id`
- `created_at`

### `voucher_sales`

Registra a venda ou carga paga do voucher.

- `id`
- `voucher_id`
- `event_id`
- `amount_cents`
- `payment_method`
- `financial_entry_id`
- `operator_id`
- `sold_at`

Não será criado para cortesia.

## 10. Caixa

### `cash_sessions`

- `id`
- `event_id`
- `status`: aberto ou fechado
- `opening_cash_cents`
- `expected_cash_cents`
- `counted_cash_cents`
- `difference_cents`
- `opened_by_operator_id`
- `closed_by_operator_id`
- `opened_at`
- `closed_at`

### `cash_operations`

- `id`
- `cash_session_id`
- `type`: suprimento ou sangria
- `amount_cents`
- `reason`
- `operator_id`
- `created_at`

## 11. Despesas

### `expense_categories`

- `id`
- `event_id`
- `name`
- `active`
- `archived_at`

### `expenses`

- `id`
- `event_id`
- `category_id`
- `name`
- `total_amount_cents`
- `status`: em aberto, parcial ou pago
- `due_date`
- `notes`
- `archived_at`
- `created_at`
- `updated_at`

### `expense_payments`

- `id`
- `expense_id`
- `amount_cents`
- `payment_method`
- `paid_at`
- `notes`
- `financial_entry_id`
- `operator_id`
- `cancelled_at`
- `created_at`

O estado da despesa será derivado da soma de pagamentos não cancelados.

## 12. Ingressos

### `ticket_batches`

- `id`
- `event_id`
- `name`
- `total_quantity`
- `unit_price_cents`
- `status`: ativo, cancelado ou arquivado
- `created_at`
- `updated_at`

### `ticket_sales`

Agrupa um ou vários ingressos lançados juntos.

- `id`
- `event_id`
- `batch_id`
- `registered_method`: Sympla, WhatsApp ou dinheiro
- `total_amount_cents`
- `group_name`
- `operator_id`
- `sold_at`
- `status`

### `tickets`

- `id`
- `ticket_sale_id`
- `batch_id`
- `code`
- `holder_name`
- `value_cents`
- `is_complimentary`
- `status`: válido, cancelado ou excluído
- `cancelled_at`
- `deleted_at`
- `created_at`
- `updated_at`

Restrições:

- código único;
- cortesia com valor zero;
- quantidade válida limitada pelo lote.

## 13. Auditoria

### `audit_logs`

Tabela somente de acréscimo.

- `id`
- `event_id`
- `operator_id`
- `authorized_by_operator_id`
- `module`
- `action`
- `entity_type`
- `entity_id`
- `before_json`
- `after_json`
- `reason`
- `correlation_id`
- `created_at`

`correlation_id` agrupa registros da mesma operação transacional.

## 14. Configurações

### `app_settings`

- `key`
- `value_json`
- `updated_at`
- `updated_by_operator_id`

Exemplos:

- diretório de backup;
- frequência automática;
- tema;
- comportamento de abertura;
- política de autorização;
- formato de códigos.

### `event_settings`

- `event_id`
- `key`
- `value_json`
- `updated_at`

## 15. Backups

### `backup_history`

- `id`
- `type`: automático, manual, encerramento, pré-restauração ou importado
- `file_name`
- `destination_path`
- `checksum`
- `schema_version`
- `app_version`
- `status`
- `error_message`
- `operator_id`
- `created_at`

## 16. Relacionamentos críticos

```text
event
├─ products ─ inventory_movements
├─ combos ─ combo_items ─ products
├─ service_tables ─ sales
│  ├─ sale_items ─ sale_item_components
│  ├─ sale_payments ─ payment_reversals
│  └─ sale_adjustments ─ sale_adjustment_items
├─ vouchers ─ voucher_rules
│  ├─ voucher_rule_products
│  ├─ voucher_movements
│  └─ voucher_sales
├─ cash_sessions ─ financial_entries
├─ expenses ─ expense_payments
├─ ticket_batches ─ ticket_sales ─ tickets
└─ audit_logs
```

## 17. Índices obrigatórios

- produtos por evento, categoria e status;
- estoque baixo por evento;
- código de voucher único;
- código de ingresso único;
- vendas por evento, mesa e data;
- pagamentos por forma e data;
- movimentações por produto e data;
- despesas por status e categoria;
- auditoria por evento, módulo, ação e data;
- lançamentos financeiros por evento, tipo, forma e data.

## 18. Migrações

1. Toda alteração de esquema terá migração versionada.
2. Migrações serão testadas em banco vazio e em cópia de banco anterior.
3. Antes de migração em produção será criado backup automático.
4. Falha de migração impedirá abertura operacional e oferecerá restauração segura.
