import type { DatabaseReceiptDocument, DatabaseReceiptSettings } from '@gtrz/database';

const PAYMENT_LABELS = {
  cash: 'Dinheiro',
  pix: 'PIX',
  'credit-card': 'Crédito',
  'debit-card': 'Débito',
} as const;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(timestamp);
}

function paymentLines(document: DatabaseReceiptDocument): string {
  const payments = document.payments.map((payment) => {
    const received =
      payment.method === 'cash' && payment.receivedCents !== null
        ? `<div class="subline"><span>Recebido</span><strong>${formatCurrency(payment.receivedCents)}</strong></div>`
        : '';
    return `<div class="payment">
      <div class="line"><span>${PAYMENT_LABELS[payment.method]}</span><strong>${formatCurrency(payment.amountCents)}</strong></div>
      ${received}
    </div>`;
  });
  const vouchers = document.voucherUses.map(
    (voucher) => `<div class="payment">
      <div class="line"><span>Voucher ${escapeHtml(voucher.code)}</span><strong>${formatCurrency(voucher.amountCents)}</strong></div>
    </div>`,
  );
  return [...vouchers, ...payments].join('');
}

export function buildReceiptHtml(
  document: DatabaseReceiptDocument,
  settings: DatabaseReceiptSettings,
): string {
  const orderCode = document.orderId.slice(0, 8).toUpperCase();
  const itemRows = document.items
    .map(
      (item) => `<div class="item">
        <div class="item-main"><strong>${String(item.quantity)}x ${escapeHtml(item.name)}</strong><span>${formatCurrency(item.totalCents)}</span></div>
        <div class="item-unit">${formatCurrency(item.unitPriceCents)} cada</div>
      </div>`,
    )
    .join('');
  const change =
    document.totalChangeCents > 0
      ? `<div class="change"><span>TROCO</span><strong>${formatCurrency(document.totalChangeCents)}</strong></div>`
      : '';

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>GTRZ ${orderCode}</title>
<style>
  @page { margin: 0; size: ${String(settings.paperWidthMm)}mm auto; }
  * { box-sizing: border-box; }
  body {
    width: ${String(settings.paperWidthMm)}mm;
    margin: 0;
    padding: 4mm 3mm 6mm;
    background: #fff;
    color: #000;
    font-family: "Arial", "Helvetica", sans-serif;
    font-size: 10.5px;
    line-height: 1.3;
  }
  .center { text-align: center; }
  .brand { font-size: 17px; font-weight: 900; letter-spacing: 1.6px; }
  .event { margin-top: 2px; font-size: 13px; font-weight: 800; }
  .meta { margin-top: 5px; font-size: 9px; }
  .rule { margin: 3mm 0; border-top: 1px dashed #000; }
  .line, .item-main, .subline { display: flex; justify-content: space-between; gap: 3mm; }
  .line strong, .item-main span, .subline strong { white-space: nowrap; }
  .item { margin-bottom: 2.4mm; }
  .item-main strong { text-align: left; }
  .item-unit, .subline { margin-top: 1px; color: #333; font-size: 9px; }
  .payment { margin-bottom: 1.5mm; }
  .total {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 3mm;
    font-size: 15px;
    font-weight: 900;
  }
  .change {
    display: flex;
    justify-content: space-between;
    margin-top: 2mm;
    padding: 2mm;
    border: 1.5px solid #000;
    font-size: 12px;
    font-weight: 900;
  }
  .pickup {
    margin-top: 3mm;
    padding: 2.5mm 2mm;
    border: 2px solid #000;
    text-align: center;
    font-weight: 900;
  }
  .notice { margin-top: 2.5mm; text-align: center; font-size: 9px; }
  .code { margin-top: 3mm; text-align: center; font-family: monospace; font-size: 11px; font-weight: 800; }
</style>
</head>
<body>
  <header class="center">
    <div class="brand">GTRZ SYSTEM</div>
    <div class="event">${escapeHtml(document.eventName)}</div>
    <div class="meta">${formatDate(document.closedAt)} · ${escapeHtml(document.servicePointLabel)}</div>
  </header>

  <div class="rule"></div>
  <div>${itemRows}</div>
  <div class="rule"></div>

  <div>${paymentLines(document)}</div>
  <div class="rule"></div>
  <div class="total"><span>TOTAL</span><strong>${formatCurrency(document.totalCents)}</strong></div>
  ${change}

  <div class="pickup">APRESENTE ESTA NOTA NO BAR PARA RETIRAR OS ITENS</div>
  <div class="notice">Esta nota é válida somente durante o evento <strong>${escapeHtml(document.eventName)}</strong>.</div>
  <div class="code">VENDA ${orderCode}</div>
</body>
</html>`;
}
