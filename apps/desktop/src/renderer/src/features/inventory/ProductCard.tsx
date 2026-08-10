import {
  ArrowLeftRight,
  CircleDollarSign,
  MinusCircle,
  Pencil,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useState } from 'react';

import type {
  InventoryProduct,
  ProductDeletePreview,
  ProductCategory,
  RecordStockMovementInput,
  StockMovementType,
  UpdateProductInput,
} from '@gtrz/contracts';

import { ProductForm } from './ProductForm';
import { StockMovementForm } from './StockMovementForm';

interface ProductCardProps {
  readonly product: InventoryProduct;
  readonly categories: readonly ProductCategory[];
  readonly production: boolean;
  readonly hasActiveEvent: boolean;
  readonly busy: boolean;
  readonly onUpdate: (input: UpdateProductInput) => Promise<void>;
  readonly onMovement: (input: RecordStockMovementInput) => Promise<void>;
  readonly onPreviewDelete: (productId: string) => Promise<ProductDeletePreview>;
  readonly onDelete: (productId: string, reason: string) => Promise<void>;
}

type ProductCardMode = 'view' | 'edit' | 'movement';

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function ProductCard({
  product,
  categories,
  production,
  hasActiveEvent,
  busy,
  onUpdate,
  onMovement,
  onPreviewDelete,
  onDelete,
}: ProductCardProps): React.JSX.Element {
  const [mode, setMode] = useState<ProductCardMode>('view');
  const [movementType, setMovementType] = useState<StockMovementType>('purchase');
  const [deletePreview, setDeletePreview] = useState<ProductDeletePreview | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  if (mode === 'edit') {
    return (
      <article className="inventory-card inventory-card--expanded">
        <ProductForm
          busy={busy}
          categories={categories}
          onCancel={() => {
            setMode('view');
          }}
          onSubmit={async (input) => {
            await onUpdate(input);
            setMode('view');
          }}
          product={product}
        />
      </article>
    );
  }

  if (mode === 'movement') {
    return (
      <article className="inventory-card inventory-card--expanded">
        <StockMovementForm
          busy={busy}
          initialType={movementType}
          onCancel={() => {
            setMode('view');
          }}
          onSubmit={onMovement}
          product={product}
        />
      </article>
    );
  }

  return (
    <article
      className={product.active ? 'inventory-card' : 'inventory-card inventory-card--inactive'}
    >
      <div className="inventory-card__header">
        <div>
          <span>{product.categoryName}</span>
          <h2>{product.name}</h2>
        </div>
        <span className={product.lowStock ? 'stock-badge stock-badge--low' : 'stock-badge'}>
          {product.lowStock ? <TriangleAlert size={14} aria-hidden="true" /> : null}
          {product.quantity} un.
        </span>
      </div>

      <div className="inventory-card__prices">
        <div>
          <span>Venda</span>
          <strong>{formatMoney(product.salePriceCents)}</strong>
        </div>
        {product.financials === null ? null : (
          <>
            <div>
              <span>Custo</span>
              <strong>{formatMoney(product.financials.costCents)}</strong>
            </div>
            <div>
              <span>Lucro bruto</span>
              <strong>{formatMoney(product.financials.grossProfitCents)}</strong>
            </div>
            <div>
              <span>Margem</span>
              <strong>{product.financials.marginPercent.toFixed(2)}%</strong>
            </div>
          </>
        )}
      </div>

      <div className="inventory-card__footer">
        <span className="product-kind">
          <CircleDollarSign size={15} aria-hidden="true" />
          {product.kind === 'drink' ? 'Bebida' : 'Comida'}
        </span>
        {!product.active ? (
          <span className="status-badge status-badge--archived">Excluído / arquivado</span>
        ) : null}
        {production && product.active ? (
          <div className="inventory-card__actions">
            <button
              className="button button--ghost button--compact"
              disabled={busy}
              onClick={() => {
                setMode('edit');
              }}
              type="button"
            >
              <Pencil size={15} aria-hidden="true" />
              Editar
            </button>
            <button
              className="button button--secondary button--compact"
              disabled={busy || !hasActiveEvent}
              onClick={() => {
                setMovementType('purchase');
                setMode('movement');
              }}
              title={hasActiveEvent ? undefined : 'Selecione um evento aberto.'}
              type="button"
            >
              <ArrowLeftRight size={15} aria-hidden="true" />
              Entrada / ajuste
            </button>
            <button
              className="button button--danger button--compact"
              disabled={busy || !hasActiveEvent || product.quantity <= 0}
              onClick={() => {
                setMovementType('loss');
                setMode('movement');
              }}
              title={
                !hasActiveEvent
                  ? 'Selecione um evento aberto.'
                  : product.quantity <= 0
                    ? 'Este produto não possui saldo para baixar.'
                    : 'Reduz estoque sem criar venda.'
              }
              type="button"
            >
              <MinusCircle size={15} aria-hidden="true" />
              Perda / quebra / baixa
            </button>
            <button
              className="button button--ghost button--compact"
              disabled={busy}
              onClick={() => {
                void onPreviewDelete(product.id).then(setDeletePreview);
              }}
              type="button"
            >
              <Trash2 size={15} aria-hidden="true" />
              Excluir produto
            </button>
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

            void onDelete(product.id, reason).then(() => {
              setDeletePreview(null);
              setDeleteReason('');
            });
          }}
        >
          <div className="inventory-delete__mode">
            <strong>
              {deletePreview.deletionMode === 'permanent'
                ? 'O produto será excluído definitivamente'
                : 'O produto será removido do catálogo operacional'}
            </strong>
            <small>
              {deletePreview.deletionMode === 'permanent'
                ? 'O item nunca teve estoque, vendas, transferências ou dependências e poderá ser removido por completo.'
                : 'Como existe histórico, o cadastro será arquivado para preservar auditoria, vendas e estoque anteriores. Ele desaparecerá da lista de produtos ativos.'}
            </small>
          </div>
          <div className="inventory-delete__impact">
            <span>
              Estoque neste evento <strong>{deletePreview.activeEventStockQuantity}</strong>
            </span>
            <span>
              Estoque em todos os eventos <strong>{deletePreview.totalStockQuantity}</strong>
            </span>
            <span>
              Combos dependentes <strong>{deletePreview.dependentCombos.length}</strong>
            </span>
            <span>
              Vendas históricas <strong>{deletePreview.historicalSales}</strong>
            </span>
            <span>
              Movimentações <strong>{deletePreview.stockMovements}</strong>
            </span>
            <span>
              Transferências <strong>{deletePreview.stockTransfers}</strong>
            </span>
          </div>
          <label className="form-field">
            <span>Motivo</span>
            <input
              disabled={busy}
              maxLength={240}
              onChange={(event) => {
                setDeleteReason(event.target.value);
              }}
              placeholder="Ex.: item cadastrado por engano"
              value={deleteReason}
            />
          </label>
          <div className="inventory-card__actions">
            <button
              className="button button--danger button--compact"
              disabled={busy || deleteReason.trim().length < 3}
              type="submit"
            >
              <Trash2 size={15} aria-hidden="true" />
              {deletePreview.deletionMode === 'permanent'
                ? 'Excluir definitivamente'
                : 'Remover dos ativos'}
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
              Manter produto
            </button>
          </div>
        </form>
      )}
    </article>
  );
}