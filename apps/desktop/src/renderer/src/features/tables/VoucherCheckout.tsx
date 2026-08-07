import { Link2, TicketCheck, Unlink } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { Voucher, VoucherAllocation } from '@gtrz/contracts';
import { formatCurrency } from '@gtrz/domain';

interface VoucherCheckoutProps {
  readonly orderId: string;
  readonly servicePointId: string;
  readonly allocation: VoucherAllocation | null;
  readonly busy: boolean;
  readonly value: string;
  readonly valueCents: number;
  readonly invalid: boolean;
  readonly onValueChange: (value: string) => void;
  readonly onBind: (code: string) => Promise<void>;
  readonly onUnbind: () => Promise<void>;
}

export function VoucherCheckout({
  orderId,
  servicePointId,
  allocation,
  busy,
  value,
  valueCents,
  invalid,
  onValueChange,
  onBind,
  onUnbind,
}: VoucherCheckoutProps): React.JSX.Element {
  const [availableVouchers, setAvailableVouchers] = useState<readonly Voucher[]>([]);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    let active = true;

    void window.gtrz.vouchers.getState().then((voucherState) => {
      if (active) {
        setAvailableVouchers(
          voucherState.vouchers.filter(
            (voucher) =>
              voucher.status === 'active' &&
              voucher.remainingBalanceCents > 0 &&
              voucher.linkedServicePointId === servicePointId,
          ),
        );
      }
    });

    return () => {
      active = false;
    };
  }, [orderId, allocation?.voucherId, servicePointId]);

  return (
    <section className="voucher-checkout" aria-label="Voucher da comanda">
      <div className="voucher-checkout__heading">
        <TicketCheck size={18} aria-hidden="true" />
        <div>
          <strong>Voucher vinculado à mesa</strong>
          <small>Selecione o voucher e o sistema associa automaticamente à comanda.</small>
        </div>
      </div>

      <div className="voucher-checkout__selector">
        <select
          aria-label="Voucher vinculado à comanda"
          disabled={busy}
          onChange={(event) => {
            const code = event.target.value;

            if (code.length === 0) {
              void onUnbind();
            } else {
              void onBind(code);
            }
          }}
          value={allocation?.code ?? ''}
        >
          <option value="">Nenhum voucher</option>
          {availableVouchers.map((voucher) => (
            <option key={voucher.id} value={voucher.code}>
              {voucher.code} · {voucher.label} · {formatCurrency(voucher.remainingBalanceCents)}
            </option>
          ))}
        </select>
        {allocation === null ? <Link2 size={18} aria-hidden="true" /> : null}
        {allocation !== null ? (
          <button
            aria-label="Remover voucher da comanda"
            className="icon-button"
            disabled={busy}
            onClick={() => {
              void onUnbind();
            }}
            title="Remover voucher"
            type="button"
          >
            <Unlink size={17} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="voucher-checkout__selector">
        <input
          aria-label="Aplicar voucher por código"
          disabled={busy}
          onChange={(event) => {
            setManualCode(event.target.value.toLocaleUpperCase('pt-BR'));
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && manualCode.trim().length >= 4) {
              event.preventDefault();
              void onBind(manualCode.trim());
            }
          }}
          placeholder="Aplicar código manual"
          value={manualCode}
        />
        <button
          className="button button--secondary button--compact"
          disabled={busy || manualCode.trim().length < 4}
          onClick={() => {
            void onBind(manualCode.trim()).then(() => {
              setManualCode('');
            });
          }}
          type="button"
        >
          <Link2 size={15} aria-hidden="true" />
          Aplicar código
        </button>
      </div>

      {allocation === null ? (
        <p className="voucher-checkout__empty">Nenhum voucher vinculado.</p>
      ) : (
        <div className="voucher-checkout__card">
          <span>
            <strong>{allocation.label}</strong>
            <small>{allocation.code}</small>
          </span>
          <span>
            <small>Saldo disponível</small>
            <strong>{formatCurrency(allocation.remainingBalanceCents)}</strong>
          </span>
          <label className="form-field">
            <span>Valor a utilizar</span>
            <input
              aria-invalid={invalid}
              disabled={busy}
              inputMode="decimal"
              onChange={(event) => {
                onValueChange(event.target.value);
              }}
              placeholder="0,00"
              value={value}
            />
          </label>
        </div>
      )}

      {allocation !== null && valueCents > allocation.remainingBalanceCents ? (
        <p className="form-error">
          O voucher possui somente {formatCurrency(allocation.remainingBalanceCents)} disponíveis.
        </p>
      ) : null}
    </section>
  );
}
