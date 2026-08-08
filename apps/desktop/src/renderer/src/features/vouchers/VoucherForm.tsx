import { TicketPlus } from 'lucide-react';
import { useState } from 'react';

import type { CreateVoucherInput, ServicePoint } from '@gtrz/contracts';
import { parseCurrencyInput } from '@gtrz/domain';

interface VoucherFormProps {
  readonly busy: boolean;
  readonly servicePoints: readonly ServicePoint[];
  readonly onSubmit: (input: CreateVoucherInput) => Promise<void>;
}

export function VoucherForm({
  busy,
  servicePoints,
  onSubmit,
}: VoucherFormProps): React.JSX.Element {
  const [label, setLabel] = useState('');
  const [code, setCode] = useState('');
  const [balance, setBalance] = useState('');
  const [linkedServicePointId, setLinkedServicePointId] = useState('');

  return (
    <form
      className="voucher-form"
      onSubmit={(event) => {
        event.preventDefault();
        const normalizedCode = code.trim();
        const initialBalanceCents = parseCurrencyInput(balance);

        if (linkedServicePointId.length === 0) {
          return;
        }

        const input: CreateVoucherInput =
          normalizedCode.length === 0
            ? {
                label: label.trim(),
                linkedServicePointId,
                initialBalanceCents,
              }
            : {
                code: normalizedCode,
                label: label.trim(),
                linkedServicePointId,
                initialBalanceCents,
              };

        void onSubmit(input).then(() => {
          setLabel('');
          setCode('');
          setBalance('');
          setLinkedServicePointId('');
        });
      }}
    >
      <div className="panel__heading">
        <TicketPlus size={20} aria-hidden="true" />
        <div>
          <h2>Emitir voucher</h2>
          <p>Cada voucher nasce vinculado a uma única mesa.</p>
        </div>
      </div>
      <label className="form-field">
        <span>Identificação</span>
        <input
          disabled={busy}
          maxLength={100}
          onChange={(event) => {
            setLabel(event.target.value);
          }}
          placeholder="Ex.: Crédito patrocinador"
          required
          value={label}
        />
      </label>
      <label className="form-field">
        <span>Código opcional</span>
        <input
          disabled={busy}
          maxLength={32}
          onChange={(event) => {
            setCode(event.target.value.toLocaleUpperCase('pt-BR'));
          }}
          placeholder="Gerado automaticamente"
          value={code}
        />
      </label>
      <label className="form-field">
        <span>Mesa vinculada</span>
        <select
          disabled={busy}
          onChange={(event) => {
            setLinkedServicePointId(event.target.value);
          }}
          required
          value={linkedServicePointId}
        >
          <option value="">Selecione uma mesa</option>
          {servicePoints.map((servicePoint) => (
            <option key={servicePoint.id} value={servicePoint.id}>
              {servicePoint.label}
            </option>
          ))}
        </select>
        <small>
          O voucher só poderá ser usado nesta mesa. O vínculo só é liberado se a mesa for excluída.
        </small>
      </label>
      <label className="form-field">
        <span>Saldo inicial</span>
        <input
          disabled={busy}
          inputMode="decimal"
          onChange={(event) => {
            setBalance(event.target.value);
          }}
          placeholder="100,00"
          required
          value={balance}
        />
      </label>
      <button
        className="button button--primary"
        disabled={
          busy ||
          label.trim().length < 2 ||
          linkedServicePointId.length === 0 ||
          parseCurrencyInput(balance) <= 0
        }
        type="submit"
      >
        Emitir voucher
      </button>
    </form>
  );
}
