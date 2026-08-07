import type { AnalystReport } from '@/lib/analyst-engine';
import type { StockData } from '@/types/stock';

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function number(value: number | null | undefined, decimals = 1) {
  return value == null ? '-' : value.toLocaleString('sv-SE', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function volume(value: number | null | undefined) {
  if (value == null) return '-';
  if (value >= 1_000_000) return `${number(value / 1_000_000, 1)} mn`;
  if (value >= 1_000) return `${number(value / 1_000, 0)} tn`;
  return number(value, 0);
}

function marketCap(value: number | null | undefined) {
  if (value == null) return '-';
  if (value >= 1_000_000_000_000) return `${number(value / 1_000_000_000_000, 1)} bn`;
  if (value >= 1_000_000_000) return `${number(value / 1_000_000_000, 1)} md`;
  return `${number(value / 1_000_000, 0)} mn`;
}

function chartSvg(stock: StockData) {
  const data = stock.chartHistory.slice(-160);
  if (data.length < 2) return '<p class="muted">Kurshistorik saknas i rapporten.</p>';
  const values = data.map((point) => point.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.01);
  const width = 720;
  const height = 170;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const positive = values.at(-1)! >= values[0] ? '#14804a' : '#c84040';
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Kursutveckling"><line x1="0" y1="42" x2="${width}" y2="42" class="grid"/><line x1="0" y1="85" x2="${width}" y2="85" class="grid"/><line x1="0" y1="128" x2="${width}" y2="128" class="grid"/><polyline points="${points}" fill="none" stroke="${positive}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function list(items: string[]) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

export function buildPrintReportHtml(stock: StockData, report: AnalystReport | null) {
  const change = stock.regularMarketChangePercent;
  const changeClass = (change ?? 0) >= 0 ? 'positive' : 'negative';
  const stats = [
    ['Öppning', number(stock.regularMarketOpen, 2)],
    ['Dagens högsta', number(stock.regularMarketDayHigh, 2)],
    ['Dagens lägsta', number(stock.regularMarketDayLow, 2)],
    ['Volym', volume(stock.latestVolume)],
    ['Snittvolym', volume(stock.avgVolume20)],
    ['P/E', number(stock.trailingPE)],
    ['Direktavkastning', stock.dividendYield == null ? '-' : `${number(stock.dividendYield * 100)} %`],
    ['Börsvärde', marketCap(stock.marketCap)],
    ['52v hög', number(stock.fiftyTwoWeekHigh, 2)],
    ['52v låg', number(stock.fiftyTwoWeekLow, 2)],
    ['RSI (14)', number(stock.rsi)],
    ['SMA 125', number(stock.sma125, 2)],
    ['Beta', number(stock.beta, 2)],
    ['Volatilitet', stock.volatility == null ? '-' : `${number(stock.volatility)} %`],
    ['Max drawdown', stock.maxDrawdown == null ? '-' : `-${number(stock.maxDrawdown)} %`],
    ['Risk/Reward', number(stock.riskRewardScore, 0)],
  ];
  const health = stock.healthCheck;
  const generatedAt = new Date().toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });

  return `<!doctype html>
<html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(stock.ticker)} analysrapport</title>
<style>
  @page { margin: 16mm; size: A4; }
  * { box-sizing: border-box; } body { color: #172033; font: 11pt -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.45; margin: 0; }
  h1, h2, h3, p { margin-top: 0; } h1 { font-size: 27pt; letter-spacing: 0; margin-bottom: 2px; } h2 { font-size: 15pt; border-bottom: 1px solid #d9e1ea; margin: 26px 0 10px; padding-bottom: 5px; } h3 { font-size: 11pt; margin: 0 0 4px; }
  .muted { color: #65758b; } .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 3px solid #1677c8; padding-bottom: 16px; } .ticker { color: #65758b; font-size: 13pt; font-weight: 600; }
  .quote { text-align: right; white-space: nowrap; } .price { font-size: 25pt; font-weight: 750; } .positive { color: #14804a; } .negative { color: #c84040; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border: 1px solid #d9e1ea; border-radius: 6px; overflow: hidden; } .stat { border-right: 1px solid #d9e1ea; border-bottom: 1px solid #d9e1ea; min-height: 59px; padding: 9px; } .stat:nth-child(4n) { border-right: 0; } .stat:nth-last-child(-n+4) { border-bottom: 0; } .label { color: #65758b; display: block; font-size: 9pt; margin-bottom: 3px; } .value { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 700; }
  svg { display: block; height: auto; width: 100%; } .grid { stroke: #e4ebf2; stroke-width: 1; } .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; } .panel { border: 1px solid #d9e1ea; border-radius: 6px; padding: 12px; } ul { margin: 6px 0 0; padding-left: 18px; } li { margin-bottom: 4px; } .signals { display: flex; flex-wrap: wrap; gap: 6px; } .signal { background: #e8f1fb; border-radius: 12px; color: #135b95; font-size: 9pt; padding: 3px 8px; } .grade { background: #edf7ef; border-radius: 5px; color: #16703a; display: inline-block; font-weight: 700; padding: 4px 8px; } .footer { border-top: 1px solid #d9e1ea; color: #65758b; font-size: 8.5pt; margin-top: 28px; padding-top: 10px; }
  @media print { .page-break-avoid { break-inside: avoid; } }
</style></head><body>
<header class="header"><div><h1>${escapeHtml(stock.ticker.replace('.ST', ''))}</h1><p class="ticker">${escapeHtml(stock.companyName)} · Analysrapport</p><p class="muted">Skapad ${escapeHtml(generatedAt)}</p></div><div class="quote"><div class="price">${number(stock.currentPrice, 2)} kr</div><div class="${changeClass}">${change == null ? '-' : `${change >= 0 ? '+' : ''}${number(change, 2)} % idag`}</div>${health ? `<p class="grade">Betyg ${health.grade} · ${health.gradeScore}/10</p>` : ''}</div></header>
<section class="page-break-avoid"><h2>Nyckeltal</h2><div class="stats">${stats.map(([label, value]) => `<div class="stat"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value)}</span></div>`).join('')}</div></section>
<section class="page-break-avoid"><h2>Kursutveckling</h2>${chartSvg(stock)}</section>
${stock.signals?.length ? `<section class="page-break-avoid"><h2>Aktiva signaler</h2><div class="signals">${stock.signals.map((signal) => `<span class="signal">${escapeHtml(signal.label)}: ${escapeHtml(signal.detail)}</span>`).join('')}</div></section>` : ''}
${report ? `<section class="page-break-avoid"><h2>Analyst AI</h2><div class="panel"><h3>${escapeHtml(report.verdict)} · ${escapeHtml(report.confidence)} konfidens · ${report.score}/100</h3><p>${escapeHtml(report.thesis)}</p><div class="two-col"><div><h3>Styrkor</h3>${list(report.strengths)}</div><div><h3>Risker</h3>${list(report.risks)}</div></div><h3 style="margin-top:14px">Katalysatorer</h3>${list(report.catalysts)}<h3 style="margin-top:14px">När tesen försvagas</h3><p>${escapeHtml(report.invalidation)}</p></div></section>` : ''}
${health ? `<section class="page-break-avoid"><h2>Hälsokoll</h2><div class="panel"><p><strong>${escapeHtml(health.summary)}</strong></p><p class="muted">Risk: ${escapeHtml(health.riskLevel)} · Momentum: ${escapeHtml(health.momentum)}</p>${list(health.checklist.map((item) => `${item.passed ? 'Uppfyllt' : 'Ej uppfyllt'}: ${item.label} (${item.detail})`))}</div></section>` : ''}
<footer class="footer">OMX30 Screener · Uppgifterna är beslutsstöd och inte personlig investeringsrådgivning. Marknadsdata kan vara fördröjd eller ofullständig.</footer>
</body></html>`;
}

export function openPrintReport(stock: StockData, report: AnalystReport | null) {
  if (typeof window === 'undefined') return false;
  const popup = window.open('', '_blank');
  if (!popup) return false;
  popup.opener = null;
  popup.document.open();
  popup.document.write(buildPrintReportHtml(stock, report));
  popup.document.close();
  popup.focus();
  window.setTimeout(() => popup.print(), 300);
  return true;
}
