import {
  formatLedgerDate,
  formatQty,
  formatRupees,
  monthYearUpper,
} from './format';
import type { LedgerRow } from './types';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function buildLedgerHtml(params: {
  start: string;
  end: string;
  farmerName: string;
  farmerAddress: string;
  rows: LedgerRow[];
}): string {
  const sameMonth = params.start.slice(0, 7) === params.end.slice(0, 7);
  const title = sameMonth
    ? `MILK SALE ${monthYearUpper(params.start)}`
    : `MILK SALE ${formatLedgerDate(params.start)} – ${formatLedgerDate(params.end)}`;

  const farmerLine = [params.farmerName, params.farmerAddress]
    .filter((part) => part.trim().length > 0)
    .join(', ');

  const morningTotal = params.rows.reduce((sum, row) => sum + (row.morning_litres ?? 0), 0);
  const afternoonTotal = params.rows.reduce((sum, row) => sum + (row.afternoon_litres ?? 0), 0);
  const litresTotal = params.rows.reduce((sum, row) => sum + row.total, 0);
  const amountTotal = params.rows.reduce((sum, row) => sum + row.amount, 0);
  const rate = params.rows[0]?.rate ?? 0;

  const body = params.rows
    .map(
      (row) => `<tr>
        <td>${formatLedgerDate(row.date)}</td>
        <td class="num">${formatQty(row.morning_litres)}</td>
        <td class="num">${formatQty(row.afternoon_litres)}</td>
        <td class="num">${formatQty(row.total)}</td>
        <td class="num">${formatQty(row.rate)}</td>
        <td class="num">${formatQty(row.amount)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { margin: 18px; }
    body { font-family: Helvetica, Arial, sans-serif; color: #1c1917; padding: 12px; }
    h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: 0.4px; }
    .sub { font-size: 13px; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #333; padding: 6px 8px; }
    th { background: #f3efe4; text-align: left; }
    td.num, th.num { text-align: right; }
    tr.total { background: #fff4c2; font-weight: 700; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="sub">${escapeHtml(farmerLine || 'Farmer name and address not set')}</p>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th class="num">Morning Milk(L)</th>
        <th class="num">Afternoon Milk(L)</th>
        <th class="num">Total(L)</th>
        <th class="num">Rate(₹)</th>
        <th class="num">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${body}
      <tr class="total">
        <td><strong>TOTAL</strong></td>
        <td class="num"><strong>${formatQty(morningTotal)}</strong></td>
        <td class="num"><strong>${formatQty(afternoonTotal)}</strong></td>
        <td class="num"><strong>${formatQty(litresTotal)}</strong></td>
        <td class="num"><strong>${formatQty(rate)}</strong></td>
        <td class="num"><strong>${formatRupees(amountTotal)}</strong></td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;
}
