import { ArrowDownToLine, X } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';

import type {
  InventoryProduct,
  RecordStockMovementInput,
  StockMovementType,
} from '@gtrz/contracts';

interface StockMovementFormProps {
  readonly product: InventoryProduct;
  readonly busy: boolean;
  readonly initialType?: StockMovementType;
  readonly onSubmit: (input: RecordStockMovementInput) => Promise<void>;
  readonly onCancel: () => void;
}

const MOVEMENT_LABELS: Readonly<Record<StockMovementType, string>> = {
  purchase: 'Compra / entrada',
  'correction-positive': 'Correção positiva',
  'correction-negative': 'Correção negativa',
  loss: 'Perda',
  breakage: 'Quebra',
  'internal-consumption': 'Consumo interno',
  courtesy: 'Cortesia',
  return: 'Devolução ao estoque',
};

const NEGATIVE_MOVEMENTS = new Set<StockMovementType>([
  'correction-negative',
  'loss',
  'breakage',
  'internal-consumption',
  'courtesy',
]);

export function StockMovementForm({
  product,
  busy,
  initialType = 'purchase',
  onSubmit,
  onCancel,
}: StockMovementFormProps): React.JSX.Element {
  const [type, setType] = useState<StockMovementType>(initialType);
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const decreasesStock = NEGATIVE_MOVEMENTS.has(type);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    try {
      const parsedQuantity = Number(quantity);

      if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
        throw new Error('A quantidade deve ser um número inteiro maior que zero.');
      }

      await onSubmit({
        productId: product.id,
        type,
        quantity: parsedQuantity,
        note: note.trim() || undefined,
      });
      onCancel();
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível movimentar o estoque.',
      );
    }
  }

  return (
    <form className="movement-form" onSubmit={(event) => void handleSubmit(event)}>
      <div className="movement-form__heading">
        <div>
          <span>{decreasesStock ? 'Baixar estoque' : 'Movimentar estoque'}</span>
          <strong>{product.name}</strong>
        </div>
        <span className="stock-number">Saldo: {product.quantity}</span>
      </div>

      {decreasesStock ? (
        <p className="inventory-warning inventory-warning--inline">
          Esta movimentação reduz o saldo sem registrar uma venda. Use para perda, quebra, consumo
          interno ou correção de cadastro.
        </p>
      ) : null}

      <div className="movement-form__grid">
        <label className="form-field">
          <span>Tipo</span>
          <select
            onChange={(event) => {
              setType(event.target.value as StockMovementType);
            }}
            value={type}
          >
            {Object.entries(MOVEMENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span>Quantidade</span>
          <input
            min="1"
            onChange={(event) => {
              setQuantity(event.target.value);
            }}
            required
            step="1"
            type="number"
            value={quantity}
          />
        </label>
      </div>

      <label className="form-field">
        <span>Observação</span>
        <input
          maxLength={240}
          onChange={(event) => {
            setNote(event.target.value);
          }}
          placeholder={decreasesStock ? 'Ex.: 2 unidades quebradas' : 'Opcional'}
          value={note}
        />
      </label>

      {error === null ? null : <p className="form-error">{error}</p>}

      <div className="product-form__actions">
        <button className="button button--ghost" disabled={busy} onClick={onCancel} type="button">
          <X size={16} aria-hidden="true" />
          Cancelar
        </button>
        <button
          className={decreasesStock ? 'button button--danger' : 'button button--primary'}
          disabled={busy}
          type="submit"
        >
          <ArrowDownToLine size={17} aria-hidden="true" />
          {decreasesStock ? 'Confirmar baixa' : 'Registrar movimento'}
        </button>
      </div>
    </form>
  );
}
