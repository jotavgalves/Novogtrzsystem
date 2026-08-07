import { ArrowRight, RefreshCw, Send, Shuffle } from 'lucide-react';
import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';

import type { InventoryProduct, TransferStockInput } from '@gtrz/contracts';

import { useStockTransfers } from './useStockTransfers';

interface StockTransferSectionProps {
  readonly activeEventId: string | null;
  readonly products: readonly InventoryProduct[];
  readonly onTransferred: () => Promise<void>;
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(timestamp);
}

export function StockTransferSection({
  activeEventId,
  products,
  onTransferred,
}: StockTransferSectionProps): React.JSX.Element {
  const { events, transfers, loading, busy, error, message, reload, transfer } =
    useStockTransfers(onTransferred);
  const sourceEvents = useMemo(
    () => events.filter((event) => event.status !== 'archived'),
    [events],
  );
  const [sourceEventId, setSourceEventId] = useState(activeEventId ?? '');
  const [destinationEventId, setDestinationEventId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const destinationEvents = useMemo(
    () => events.filter((event) => event.status === 'open' && event.id !== sourceEventId),
    [events, sourceEventId],
  );

  useEffect(() => {
    if (sourceEventId.length === 0 && activeEventId !== null) {
      setSourceEventId(activeEventId);
    }
  }, [activeEventId, sourceEventId]);

  useEffect(() => {
    if (!destinationEvents.some((event) => event.id === destinationEventId)) {
      setDestinationEventId(destinationEvents[0]?.id ?? '');
    }
  }, [destinationEventId, destinationEvents]);

  useEffect(() => {
    if (!products.some((product) => product.id === productId)) {
      setProductId(products[0]?.id ?? '');
    }
  }, [productId, products]);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    const parsedQuantity = Number(quantity);

    try {
      if (sourceEventId.length === 0 || destinationEventId.length === 0 || productId.length === 0) {
        throw new Error('Selecione origem, destino e produto.');
      }

      if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
        throw new Error('A quantidade deve ser um número inteiro positivo.');
      }

      const input: TransferStockInput = {
        sourceEventId,
        destinationEventId,
        productId,
        quantity: parsedQuantity,
        ...(note.trim().length === 0 ? {} : { note }),
      };
      await transfer(input);
      setQuantity('1');
      setNote('');
    } catch (submitError: unknown) {
      setFormError(
        submitError instanceof Error ? submitError.message : 'Não foi possível transferir.',
      );
    }
  }

  return (
    <section className="transfer-section" aria-labelledby="transfer-section-title">
      <header className="combo-section__header">
        <div>
          <span className="eyebrow">Movimento entre eventos</span>
          <h2 id="transfer-section-title">Transferências</h2>
          <p>
            Débito e crédito acontecem na mesma transação, sem saldo intermediário inconsistente.
          </p>
        </div>
        <button
          className="button button--secondary button--compact"
          disabled={loading}
          onClick={() => {
            void reload();
          }}
          type="button"
        >
          <RefreshCw size={15} aria-hidden="true" />
          Atualizar histórico
        </button>
      </header>

      {error === null ? null : <p className="form-error">{error}</p>}
      {message === null ? null : <p className="form-success">{message}</p>}

      <article className="panel transfer-panel">
        <div className="panel__heading">
          <Shuffle size={20} aria-hidden="true" />
          <div>
            <h2>Nova transferência</h2>
            <p>A origem pode estar aberta ou encerrada; o destino precisa estar aberto.</p>
          </div>
        </div>

        <form className="transfer-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="transfer-form__grid">
            <label className="form-field">
              <span>Evento de origem</span>
              <select
                aria-label="Evento de origem"
                onChange={(event) => {
                  setSourceEventId(event.target.value);
                }}
                required
                value={sourceEventId}
              >
                <option value="">Selecione</option>
                {sourceEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} · {event.status === 'open' ? 'aberto' : 'encerrado'}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Evento de destino</span>
              <select
                aria-label="Evento de destino"
                onChange={(event) => {
                  setDestinationEventId(event.target.value);
                }}
                required
                value={destinationEventId}
              >
                <option value="">Selecione</option>
                {destinationEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Produto</span>
              <select
                aria-label="Produto a transferir"
                onChange={(event) => {
                  setProductId(event.target.value);
                }}
                required
                value={productId}
              >
                <option value="">Selecione</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Quantidade</span>
              <input
                aria-label="Quantidade a transferir"
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
            <span>Observação opcional</span>
            <input
              maxLength={240}
              onChange={(event) => {
                setNote(event.target.value);
              }}
              placeholder="Ex.: saldo remanescente do evento anterior"
              value={note}
            />
          </label>

          {formError === null ? null : <p className="form-error">{formError}</p>}

          <div className="product-form__actions">
            <button
              className="button button--primary"
              disabled={
                busy ||
                sourceEventId.length === 0 ||
                destinationEventId.length === 0 ||
                productId.length === 0
              }
              type="submit"
            >
              <Send size={17} aria-hidden="true" />
              Transferir estoque
            </button>
          </div>
        </form>
      </article>

      <div className="transfer-history" aria-live="polite">
        {loading ? <div className="route-state">Carregando transferências…</div> : null}
        {!loading && transfers.length === 0 ? (
          <div className="empty-state">
            <Shuffle size={32} aria-hidden="true" />
            <h2>Nenhuma transferência registrada</h2>
            <p>As operações concluídas aparecerão aqui com os saldos anteriores e posteriores.</p>
          </div>
        ) : null}
        {transfers.map((item) => (
          <article className="transfer-card" key={item.id}>
            <div className="transfer-card__heading">
              <div>
                <span>{formatDate(item.createdAt)}</span>
                <h3>{item.productName}</h3>
              </div>
              <strong>{item.quantity} un.</strong>
            </div>
            <div className="transfer-route">
              <div>
                <span>Origem</span>
                <strong>{item.sourceEventName}</strong>
                <small>
                  {item.sourceQuantityBefore} → {item.sourceQuantityAfter}
                </small>
              </div>
              <ArrowRight size={18} aria-hidden="true" />
              <div>
                <span>Destino</span>
                <strong>{item.destinationEventName}</strong>
                <small>
                  {item.destinationQuantityBefore} → {item.destinationQuantityAfter}
                </small>
              </div>
            </div>
            {item.note === null ? null : <p>{item.note}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
