import { Trash2, X } from 'lucide-react';
import { useState } from 'react';

import type { Voucher, VoucherDeletePreview } from '@gtrz/contracts';
import { formatCurrency } from '@gtrz/domain';

interface VoucherDeleteSectionProps {
  readonly voucher: Voucher;
  readonly busy: boolean;
  readonly onPreviewDelete: (voucherId: string) => Promise<VoucherDeletePreview>;
  readonly onDelete: (voucherId: string, reason: string) => Promise<void>;
}

export function VoucherDeleteSection({
  voucher,
  busy,
  onPreviewDelete,
  onDelete,
}: VoucherDeleteSectionProps): React.JSX.Element {
  const [preview, setPreview] = useState<VoucherDeletePreview | null>(null);
  const [reason, setReason] = useState('');

  if (preview === null) {
    return (
      <button
        className="button button--danger button--compact"
        disabled={busy}
        onClick={() => {
          void onPreviewDelete(voucher.id).then(setPreview);
        }}
        type="button"
      >
        <Trash2 size={15} aria-hidden="true" />
        Excluir voucher
      </button>
    );
  }

  return (
    <form
      className="voucher-card__delete"
      onSubmit={(event) => {
        event.preventDefault();
        const normalizedReason = reason.trim();

        if (normalizedReason.length < 3) {
          return;
        }

        void onDelete(voucher.id, normalizedReason).then(() => {
          setPreview(null);
          setReason('');
        });
      }}
    >
      <div className="voucher-delete-mode">
        <strong>
          {preview.deletionMode === 'permanent'
            ? 'Este voucher será apagado definitivamente'
            : 'Este voucher possui histórico e será excluído da operação'}
        </strong>
        <small>
          {preview.deletionMode === 'permanent'
            ? 'Ele nunca foi utilizado em venda e seus registros de emissão serão removidos junto com o cadastro.'
            : 'As vendas afetadas serão estornadas, estoque e saldo serão recompostos e o voucher ficará somente no histórico de excluídos.'}
        </small>
      </div>

      <div className="voucher-card__impact">
        <span>
          Saldo restante <strong>{formatCurrency(preview.remainingBalanceCents)}</strong>
        </span>
        <span>
          Comandas pagas afetadas <strong>{preview.paidOrders}</strong>
        </span>
        <span>
          Alocações históricas <strong>{preview.allAllocations}</strong>
        </span>
        <span>
          Movimentos históricos <strong>{preview.historicalTransactions}</strong>
        </span>
        <span>
          Receita das vendas afetadas{' '}
          <strong>{formatCurrency(preview.financialImpact.affectedRevenueCents)}</strong>
        </span>
        <span>
          Pagamentos sem voucher{' '}
          <strong>{formatCurrency(preview.financialImpact.nonVoucherPaymentCents)}</strong>
        </span>
        <span>
          Saldo de voucher a restituir{' '}
          <strong>{formatCurrency(preview.financialImpact.voucherRefundCents)}</strong>
        </span>
        <span>
          Registros de pagamento afetados{' '}
          <strong>{preview.financialImpact.paymentRecordCount}</strong>
        </span>
      </div>

      {preview.affectedPayments.length > 0 ? (
        <div className="voucher-delete-details">
          <strong>Pagamentos afetados</strong>
          {preview.affectedPayments.map((payment) => (
            <span key={payment.id}>
              {payment.method} · {formatCurrency(payment.amountCents)}
            </span>
          ))}
        </div>
      ) : null}

      {preview.stockReturns.length > 0 ? (
        <div className="voucher-delete-details">
          <strong>Estoque que será devolvido</strong>
          {preview.stockReturns.map((stock) => (
            <span key={stock.productId}>
              {stock.productName} · {stock.quantity} un.
            </span>
          ))}
        </div>
      ) : null}

      <label className="form-field">
        <span>Motivo da exclusão</span>
        <input
          disabled={busy}
          maxLength={240}
          onChange={(event) => {
            setReason(event.target.value);
          }}
          placeholder="Ex.: voucher emitido incorretamente"
          value={reason}
        />
      </label>
      <div className="voucher-card__actions">
        <button
          className="button button--danger button--compact"
          disabled={busy || reason.trim().length < 3}
          type="submit"
        >
          <Trash2 size={15} aria-hidden="true" />
          {preview.deletionMode === 'permanent' ? 'Excluir definitivamente' : 'Excluir e estornar'}
        </button>
        <button
          className="button button--secondary button--compact"
          disabled={busy}
          onClick={() => {
            setPreview(null);
            setReason('');
          }}
          type="button"
        >
          <X size={15} aria-hidden="true" />
          Manter voucher
        </button>
      </div>
    </form>
  );
}