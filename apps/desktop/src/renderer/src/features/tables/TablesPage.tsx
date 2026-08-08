import { RefreshCw, TableProperties, TriangleAlert } from 'lucide-react';

import { formatCurrency } from '@gtrz/domain';

import { useSession } from '../../shared/session/session-context';
import { CatalogPanel } from './CatalogPanel';
import { CreateTableForm } from './CreateTableForm';
import { OrderPanel } from './OrderPanel';
import { RecentOrdersPanel } from './RecentOrdersPanel';
import { ServicePointGrid } from './ServicePointGrid';
import { useOperations } from './useOperations';
import { projectCatalogForOrder } from './virtual-stock';

export function TablesPage(): React.JSX.Element {
  const { state: sessionState } = useSession();
  const {
    state,
    selectedServicePoint,
    order,
    loading,
    busy,
    error,
    message,
    reload,
    createTable,
    setTablePinned,
    previewDeleteTable,
    deleteTable,
    openServicePoint,
    addItem,
    setItemQuantity,
    removeItem,
    bindVoucher,
    unbindVoucher,
    closeCurrentOrder,
    cancelOrder,
    clearOrder,
  } = useOperations();
  const production = sessionState?.profile === 'production';
  const servicePoints = state?.servicePoints ?? [];
  const catalog = state?.catalog ?? [];
  const recentOrders = state?.recentOrders ?? [];
  const selectedHistory =
    selectedServicePoint === null
      ? []
      : recentOrders.filter((item) => item.servicePointId === selectedServicePoint.id);
  const projectedCatalog = projectCatalogForOrder(catalog, order);
  const openPoints = servicePoints.filter((item) => item.status === 'open');
  const openTotalCents = openPoints.reduce((total, item) => total + item.activeOrderTotalCents, 0);
  const availableItems = catalog.filter((item) => item.active && item.availableQuantity > 0).length;
  const initialLoading = loading && state === null;

  return (
    <section className="feature-page">
      <header className="feature-header">
        <div>
          <span className="eyebrow">Operação completa do evento</span>
          <h1>Mesas e balcão</h1>
          <p>
            Abra uma mesa, monte o carrinho e conclua vendas sem perder o contexto ou o histórico.
          </p>
        </div>
        <button
          className="button button--secondary"
          disabled={loading || busy}
          onClick={() => {
            void reload();
          }}
          type="button"
        >
          <RefreshCw size={17} aria-hidden="true" />
          Atualizar
        </button>
      </header>

      <div className="summary-grid summary-grid--compact">
        <article className="summary-card">
          <span>Pontos de atendimento</span>
          <strong>{servicePoints.length}</strong>
        </article>
        <article className="summary-card">
          <span>Comandas abertas</span>
          <strong>{openPoints.length}</strong>
        </article>
        <article className="summary-card">
          <span>Valor em aberto</span>
          <strong>{formatCurrency(openTotalCents)}</strong>
        </article>
        <article className="summary-card summary-card--accent">
          <span>Opções à venda</span>
          <strong>{availableItems}</strong>
          <small>Produtos e combos ativos com estoque</small>
        </article>
      </div>

      {error === null ? null : <p className="form-error">{error}</p>}
      {message === null ? null : <p className="form-success">{message}</p>}
      {initialLoading ? <div className="route-state">Carregando operação…</div> : null}

      {!initialLoading && (state?.activeEventId === null || state === null) ? (
        <div className="inventory-warning">
          <TriangleAlert size={19} aria-hidden="true" />
          <span>Clique em “Operar evento” antes de registrar mesas e vendas.</span>
        </div>
      ) : null}

      {state?.activeEventId !== null && state !== null && selectedServicePoint === null ? (
        <>
          {production ? (
            <article className="panel table-creation-panel">
              <div className="panel__heading">
                <TableProperties size={20} aria-hidden="true" />
                <div>
                  <h2>Nova mesa</h2>
                  <p>O balcão permanente é criado automaticamente para cada evento.</p>
                </div>
              </div>
              <CreateTableForm busy={busy} onSubmit={createTable} />
            </article>
          ) : null}

          <ServicePointGrid
            busy={busy}
            onDelete={deleteTable}
            onOpen={openServicePoint}
            onPinChange={setTablePinned}
            onPreviewDelete={previewDeleteTable}
            production={production}
            servicePoints={servicePoints}
          />

          {production ? (
            <RecentOrdersPanel busy={busy} onCancel={cancelOrder} orders={recentOrders} />
          ) : null}
        </>
      ) : null}

      {selectedServicePoint === null ? null : (
        <div className="operation-workspace">
          <CatalogPanel items={projectedCatalog} onAdd={addItem} />
          <OrderPanel
            busy={busy}
            history={selectedHistory}
            onBack={clearOrder}
            onBindVoucher={bindVoucher}
            onCancelHistoricalOrder={cancelOrder}
            onCancelOrder={async (reason) => {
              if (order !== null) {
                await cancelOrder(order.id, reason);
              }
            }}
            onCloseOrder={closeCurrentOrder}
            onRemoveItem={removeItem}
            onSetItemQuantity={setItemQuantity}
            onUnbindVoucher={unbindVoucher}
            order={order}
            production={production}
            servicePoint={selectedServicePoint}
          />
        </div>
      )}
    </section>
  );
}
