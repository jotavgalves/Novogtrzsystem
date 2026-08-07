import { Armchair, ShoppingBasket } from 'lucide-react';

import type { ServicePoint } from '@gtrz/contracts';

interface ServicePointGridProps {
  readonly servicePoints: readonly ServicePoint[];
  readonly busy: boolean;
  readonly onOpen: (servicePoint: ServicePoint) => Promise<void>;
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function ServicePointGrid({
  servicePoints,
  busy,
  onOpen,
}: ServicePointGridProps): React.JSX.Element {
  return (
    <div className="service-point-grid" aria-live="polite">
      {servicePoints.map((servicePoint) => {
        const Icon = servicePoint.type === 'counter' ? ShoppingBasket : Armchair;
        const open = servicePoint.status === 'open';

        return (
          <button
            className={open ? 'service-point-card service-point-card--open' : 'service-point-card'}
            disabled={busy}
            key={servicePoint.id}
            onClick={() => {
              void onOpen(servicePoint);
            }}
            type="button"
          >
            <span className="service-point-card__icon">
              <Icon size={22} aria-hidden="true" />
            </span>
            <span className="service-point-card__body">
              <strong>{servicePoint.label}</strong>
              <small>
                {servicePoint.type === 'counter' ? 'Venda imediata' : 'Atendimento por mesa'}
              </small>
            </span>
            <span className={open ? 'status-badge status-badge--open' : 'status-badge'}>
              {open ? formatMoney(servicePoint.activeOrderTotalCents) : 'Livre'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
