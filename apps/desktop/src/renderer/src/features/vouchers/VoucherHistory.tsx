import { History } from 'lucide-react';

import type { VoucherTransaction } from '@gtrz/contracts';

interface VoucherHistoryProps {
  readonly transactions: readonly VoucherTransaction[];
}

const TYPE_LABELS = {
  issue: 'Emissão',
  redemption: 'Uso',
  cancellation: 'Cancelamento',
  reactivation: 'Reativação',
  refund: 'Restituição',
} as const;

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(timestamp);
}

export function VoucherHistory({ transactions }: VoucherHistoryProps): React.JSX.Element {
  return (
    <article className="panel voucher-history">
      <div className="panel__heading">
        <History size={20} aria-hidden="true" />
        <div>
          <h2>Histórico de saldos</h2>
          <p>Cada alteração preserva o saldo anterior e o saldo resultante.</p>
        </div>
      </div>

      {transactions.length === 0 ? (
        <p className="operation-empty">Nenhuma movimentação de voucher registrada.</p>
      ) : (
        <div className="voucher-history__list">
          {transactions.map((transaction) => (
            <div className="voucher-history__row" key={transaction.id}>
              <span>
                <strong>{transaction.voucherCode}</strong>
                <small>{formatDate(transaction.createdAt)}</small>
              </span>
              <span>{TYPE_LABELS[transaction.type]}</span>
              <span>{formatMoney(transaction.amountCents)}</span>
              <strong>
                {formatMoney(transaction.balanceBeforeCents)} →{' '}
                {formatMoney(transaction.balanceAfterCents)}
              </strong>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
