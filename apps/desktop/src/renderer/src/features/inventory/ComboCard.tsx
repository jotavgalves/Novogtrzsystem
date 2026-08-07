import { Boxes, Pencil, Tags, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import type {
  ComboDeletePreview,
  InventoryCombo,
  InventoryProduct,
  UpdateComboInput,
} from '@gtrz/contracts';

import { ComboForm } from './ComboForm';

interface ComboCardProps {
  readonly combo: InventoryCombo;
  readonly products: readonly InventoryProduct[];
  readonly production: boolean;
  readonly busy: boolean;
  readonly onUpdate: (input: UpdateComboInput) => Promise<void>;
  readonly onPreviewDelete: (comboId: string) => Promise<ComboDeletePreview>;
  readonly onDelete: (comboId: string, reason: string) => Promise<void>;
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function ComboCard({
  combo,
  products,
  production,
  busy,
  onUpdate,
  onPreviewDelete,
  onDelete,
}: ComboCardProps): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [deletePreview, setDeletePreview] = useState<ComboDeletePreview | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  if (editing) {
    return (
      <article className="combo-card combo-card--expanded">
        <ComboForm
          busy={busy}
          combo={combo}
          onCancel={() => {
            setEditing(false);
          }}
          onSubmit={async (input) => {
            await onUpdate(input);
            setEditing(false);
          }}
          products={products}
        />
      </article>
    );
  }

  return (
    <article className={combo.active ? 'combo-card' : 'combo-card combo-card--inactive'}>
      <div className="combo-card__header">
        <div>
          <span>Combo</span>
          <h3>{combo.name}</h3>
        </div>
        <span className="stock-badge">
          <Boxes size={14} aria-hidden="true" />
          {combo.availableUnits} disponíveis
        </span>
      </div>

      <div className="combo-card__prices">
        <div>
          <span>Preço do combo</span>
          <strong>{formatMoney(combo.salePriceCents)}</strong>
        </div>
        <div>
          <span>Venda individual</span>
          <strong>{formatMoney(combo.individualSaleTotalCents)}</strong>
        </div>
        <div>
          <span>{combo.savingsCents >= 0 ? 'Economia' : 'Acréscimo'}</span>
          <strong>{formatMoney(Math.abs(combo.savingsCents))}</strong>
        </div>
        {combo.financials === null ? null : (
          <>
            <div>
              <span>Custo consolidado</span>
              <strong>{formatMoney(combo.financials.costCents)}</strong>
            </div>
            <div>
              <span>Lucro bruto</span>
              <strong>{formatMoney(combo.financials.grossProfitCents)}</strong>
            </div>
            <div>
              <span>Margem</span>
              <strong>{combo.financials.marginPercent.toFixed(2)}%</strong>
            </div>
          </>
        )}
      </div>

      <div className="combo-card__components">
        {combo.components.map((component) => (
          <div key={component.productId}>
            <span>{component.productName}</span>
            <strong>{component.quantity} un.</strong>
          </div>
        ))}
      </div>

      <div className="combo-card__footer">
        <span className="product-kind">
          <Tags size={15} aria-hidden="true" />
          {combo.components.length} componente{combo.components.length === 1 ? '' : 's'}
        </span>
        {!combo.active ? (
          <span className="status-badge status-badge--archived">Inativo</span>
        ) : null}
        {production ? (
          <div className="inventory-card__actions">
            <button
              className="button button--ghost button--compact"
              disabled={busy}
              onClick={() => {
                setEditing(true);
              }}
              type="button"
            >
              <Pencil size={15} aria-hidden="true" />
              Editar combo
            </button>
            {combo.active ? (
              <button
                className="button button--ghost button--compact"
                disabled={busy}
                onClick={() => {
                  void onPreviewDelete(combo.id).then(setDeletePreview);
                }}
                type="button"
              >
                <Trash2 size={15} aria-hidden="true" />
                Excluir
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {deletePreview === null ? null : (
        <form
          className="inventory-delete"
          onSubmit={(event) => {
            event.preventDefault();
            const reason = deleteReason.trim();

            if (reason.length < 3) {
              return;
            }

            void onDelete(combo.id, reason).then(() => {
              setDeletePreview(null);
              setDeleteReason('');
            });
          }}
        >
          <div className="inventory-delete__impact">
            <span>
              Componentes <strong>{deletePreview.components.length}</strong>
            </span>
            <span>
              Vendas históricas <strong>{deletePreview.historicalSales}</strong>
            </span>
          </div>
          <label className="form-field">
            <span>Motivo da exclusão</span>
            <input
              disabled={busy}
              maxLength={240}
              onChange={(event) => {
                setDeleteReason(event.target.value);
              }}
              placeholder="Ex.: combo fora de catálogo"
              value={deleteReason}
            />
          </label>
          <div className="inventory-card__actions">
            <button
              className="button button--ghost button--compact"
              disabled={busy || deleteReason.trim().length < 3}
              type="submit"
            >
              <Trash2 size={15} aria-hidden="true" />
              Confirmar exclusão
            </button>
            <button
              className="button button--secondary button--compact"
              disabled={busy}
              onClick={() => {
                setDeletePreview(null);
                setDeleteReason('');
              }}
              type="button"
            >
              <X size={15} aria-hidden="true" />
              Manter combo
            </button>
          </div>
        </form>
      )}
    </article>
  );
}
