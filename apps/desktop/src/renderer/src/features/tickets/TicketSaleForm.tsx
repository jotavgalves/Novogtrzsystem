import { BadgeDollarSign } from 'lucide-react';
import { useMemo, useState } from 'react';

import type {
  CreateTicketSaleInput,
  PaymentMethod,
  TicketLot,
  TicketSaleSource,
} from '@gtrz/contracts';

interface TicketSaleFormProps {
  readonly lots: readonly TicketLot[];
  readonly busy: boolean;
  readonly onSubmit: (input: CreateTicketSaleInput) => Promise<void>;
}

const SOURCE_LABELS: Readonly<Record<TicketSaleSource, string>> = {
  sympla: 'Sympla',
  whatsapp: 'WhatsApp',
  door: 'Porta',
  courtesy: 'Cortesia',
};

const PAYMENT_LABELS: Readonly<Record<PaymentMethod, string>> = {
  cash: 'Dinheiro',
  pix: 'PIX',
  'credit-card': 'Crédito',
  'debit-card': 'Débito',
};

function splitCodes(value: string): readonly string[] {
  return value
    .split(/[\n,;]+/u)
    .map((code) => code.trim())
    .filter((code) => code.length > 0);
}

export function TicketSaleForm({ lots, busy, onSubmit }: TicketSaleFormProps): React.JSX.Element {
  const availableLots = useMemo(
    () => lots.filter((lot) => lot.active && lot.availableQuantity > 0),
    [lots],
  );
  const [lotId, setLotId] = useState('');
  const [attendeeName, setAttendeeName] = useState('');
  const [source, setSource] = useState<TicketSaleSource>('door');
  const [quantity, setQuantity] = useState('1');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [manualCodes, setManualCodes] = useState('');
  const selectedLot = availableLots.find((lot) => lot.id === lotId) ?? null;
  const quantityNumber = Number(quantity);
  const parsedCodes = splitCodes(manualCodes);

  return (
    <form
      className="ticket-form ticket-sale-form"
      onSubmit={(event) => {
        event.preventDefault();
        const input = {
          lotId,
          attendeeName: attendeeName.trim(),
          source,
          quantity: quantityNumber,
          ...(source === 'courtesy' ? {} : { paymentMethod }),
          ...(parsedCodes.length === 0 ? {} : { manualCodes: [...parsedCodes] }),
        };
        void onSubmit(input).then(() => {
          setAttendeeName('');
          setQuantity('1');
          setManualCodes('');
        });
      }}
    >
      <div className="panel__heading">
        <BadgeDollarSign size={20} aria-hidden="true" />
        <div>
          <h2>Registrar ingressos</h2>
          <p>Vendas e cortesias consomem a capacidade do lote.</p>
        </div>
      </div>

      <label className="form-field">
        <span>Lote</span>
        <select
          disabled={busy}
          onChange={(event) => {
            setLotId(event.target.value);
          }}
          required
          value={lotId}
        >
          <option value="">Selecione</option>
          {availableLots.map((lot) => (
            <option key={lot.id} value={lot.id}>
              {lot.name} · {lot.availableQuantity} disponíveis
            </option>
          ))}
        </select>
      </label>

      <label className="form-field">
        <span>Responsável ou participante</span>
        <input
          disabled={busy}
          maxLength={120}
          onChange={(event) => {
            setAttendeeName(event.target.value);
          }}
          placeholder="Nome completo"
          required
          value={attendeeName}
        />
      </label>

      <div className="ticket-form__row ticket-form__row--three">
        <label className="form-field">
          <span>Origem</span>
          <select
            disabled={busy}
            onChange={(event) => {
              setSource(event.target.value as TicketSaleSource);
            }}
            value={source}
          >
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Quantidade</span>
          <input
            disabled={busy}
            max={selectedLot?.availableQuantity}
            min={1}
            onChange={(event) => {
              setQuantity(event.target.value);
            }}
            required
            type="number"
            value={quantity}
          />
        </label>
        <label className="form-field">
          <span>Pagamento</span>
          <select
            disabled={busy || source === 'courtesy'}
            onChange={(event) => {
              setPaymentMethod(event.target.value as PaymentMethod);
            }}
            value={paymentMethod}
          >
            {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="form-field">
        <span>Códigos manuais opcionais</span>
        <textarea
          disabled={busy}
          onChange={(event) => {
            setManualCodes(event.target.value);
          }}
          placeholder="Um código por linha. Vazio gera automaticamente."
          rows={3}
          value={manualCodes}
        />
        {parsedCodes.length > 0 ? (
          <small>
            {parsedCodes.length} código(s) para {quantityNumber || 0} ingresso(s).
          </small>
        ) : null}
      </label>

      <button
        className="button"
        disabled={
          busy ||
          lotId.length === 0 ||
          attendeeName.trim().length < 2 ||
          !Number.isInteger(quantityNumber) ||
          quantityNumber <= 0 ||
          (selectedLot !== null && quantityNumber > selectedLot.availableQuantity) ||
          (parsedCodes.length > 0 && parsedCodes.length !== quantityNumber)
        }
        type="submit"
      >
        {source === 'courtesy' ? 'Registrar cortesia' : 'Registrar venda'}
      </button>
    </form>
  );
}
