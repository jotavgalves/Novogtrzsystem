const ACTION_LABELS: Readonly<Record<string, string>> = {
  'event.created': 'Evento criado',
  'event.renamed': 'Evento renomeado',
  'event.status-changed': 'Status do evento alterado',
  'event.selected': 'Evento selecionado',
  'event.closed-with-backup': 'Evento encerrado com backup',
  'profile.switched': 'Perfil alterado',
  'settings.production-password-changed': 'Senha da Produção alterada',
  'inventory.category-created': 'Categoria criada',
  'inventory.product-created': 'Produto criado',
  'inventory.product-updated': 'Produto atualizado',
  'inventory.stock-moved': 'Estoque movimentado',
  'inventory.stock-transferred': 'Estoque transferido',
  'combo.created': 'Combo criado',
  'combo.updated': 'Combo atualizado',
  'operations.counter-created': 'Balcão criado',
  'operations.service-point-created': 'Mesa criada',
  'operations.order-opened': 'Comanda aberta',
  'operations.item-added': 'Item adicionado à comanda',
  'operations.item-removed': 'Item removido da comanda',
  'operations.order-paid': 'Venda concluída',
  'operations.order-cancelled': 'Comanda cancelada ou estornada',
  'voucher.created': 'Voucher emitido',
  'voucher.status-changed': 'Status do voucher alterado',
  'voucher.linked-to-order': 'Voucher vinculado à comanda',
  'voucher.unlinked-from-order': 'Voucher removido da comanda',
  'cash.opened': 'Caixa aberto',
  'cash.movement-recorded': 'Movimentação de caixa registrada',
  'cash.closed': 'Caixa fechado',
  'expense.created': 'Despesa registrada',
  'expense.cancelled': 'Despesa cancelada',
  'ticket.lot-created': 'Lote de ingressos criado',
  'ticket.lot-updated': 'Lote de ingressos atualizado',
  'ticket.sale-created': 'Ingressos vendidos',
  'ticket.sale-cancelled': 'Venda de ingressos cancelada',
};

const ENTITY_LABELS: Readonly<Record<string, string>> = {
  event: 'Evento',
  profile: 'Perfil',
  settings: 'Configurações',
  category: 'Categoria',
  product: 'Produto',
  stock: 'Estoque',
  'stock-transfer': 'Transferência de estoque',
  combo: 'Combo',
  'service-point': 'Mesa ou balcão',
  order: 'Comanda',
  voucher: 'Voucher',
  cash: 'Caixa',
  expense: 'Despesa',
  'ticket-lot': 'Lote de ingressos',
  'ticket-sale': 'Venda de ingressos',
};

export function describeAuditAction(action: string): string {
  return ACTION_LABELS[action] ?? action.replaceAll('.', ' · ');
}

export function describeEntityType(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType.replaceAll('-', ' ');
}

export function sortAuditActions(actions: readonly string[]): readonly string[] {
  return [...actions].sort((left, right) =>
    describeAuditAction(left).localeCompare(describeAuditAction(right), 'pt-BR'),
  );
}
