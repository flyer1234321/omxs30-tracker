import type { AnalystReport } from '@/lib/analyst-engine';
import { getBearPoints, getBullPoints, getTrendInsight } from '@/lib/stock-insights';
import { interpretHealth } from '@/lib/health-interpretation';
import { assessValuation } from '@/lib/valuation';
import type { StockData } from '@/types/stock';
import type { AppLanguage } from '@/lib/language';
import { healthDetail, healthLabel, healthSummary } from '@/lib/health-language';

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function number(value: number | null | undefined, decimals = 1, language: AppLanguage = 'sv') {
  return value == null ? '-' : value.toLocaleString(language === 'en' ? 'en-GB' : 'sv-SE', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
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

function chartSvg(stock: StockData, language: AppLanguage) {
  const t = (sv: string, en: string) => language === 'en' ? en : sv;
  const locale = language === 'en' ? 'en-GB' : 'sv-SE';
  const data = stock.chartHistory.slice(-126);
  if (data.length < 2) return `<p class="muted">${t('Kurshistorik saknas i rapporten.', 'Price history is unavailable in this report.')}</p>`;
  const values = data.flatMap((point) => [point.close, point.sma50, point.sma125, point.sma200].filter((value): value is number => value != null));
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = Math.max((rawMax - rawMin) * 0.06, rawMax * 0.01, 0.5);
  const min = Math.max(0, rawMin - padding);
  const max = rawMax + padding;
  const range = Math.max(max - min, 0.01);
  const width = 760;
  const plotLeft = 58;
  const plotRight = 14;
  const plotTop = 16;
  const plotHeight = 248;
  const plotBottom = plotTop + plotHeight;
  const plotWidth = width - plotLeft - plotRight;
  const volumeTop = 302;
  const volumeHeight = 46;
  const dateY = 377;
  const totalHeight = 392;
  const xForIndex = (index: number) => plotLeft + (index / (data.length - 1)) * plotWidth;
  const yForValue = (value: number) => plotBottom - ((value - min) / range) * plotHeight;
  const pointsFor = (key: 'close' | 'sma50' | 'sma125' | 'sma200') => data.flatMap((point, index) => {
    const value = point[key];
    if (value == null) return [];
    return `${xForIndex(index).toFixed(1)},${yForValue(value).toFixed(1)}`;
  }).join(' ');
  const closingPrices = data.map((point) => point.close);
  const positive = closingPrices.at(-1)! >= closingPrices[0] ? '#14804a' : '#c84040';
  const closePoints = pointsFor('close');
  const areaPoints = `${plotLeft},${plotBottom} ${closePoints} ${plotLeft + plotWidth},${plotBottom}`;
  const firstDate = new Date(data[0].date).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const lastDate = new Date(data.at(-1)!.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const returnPct = ((closingPrices.at(-1)! - closingPrices[0]) / closingPrices[0]) * 100;
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const value = max - (range * index) / 4;
    const y = plotTop + (plotHeight * index) / 4;
    return `<line x1="${plotLeft}" y1="${y.toFixed(1)}" x2="${plotLeft + plotWidth}" y2="${y.toFixed(1)}" class="grid"/><text x="${plotLeft - 9}" y="${(y + 4).toFixed(1)}" text-anchor="end" class="axis-label">${escapeHtml(number(value, value >= 100 ? 0 : 1))}</text>`;
  }).join('');
  const dateTickIndexes = Array.from(new Set([0, Math.round((data.length - 1) * 0.25), Math.round((data.length - 1) * 0.5), Math.round((data.length - 1) * 0.75), data.length - 1]));
  const dateTicks = dateTickIndexes.map((index) => {
    const label = new Date(data[index].date).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    return `<text x="${xForIndex(index).toFixed(1)}" y="${dateY}" text-anchor="middle" class="axis-label">${escapeHtml(label)}</text>`;
  }).join('');
  const volumeValues = data.map((point) => Math.max(point.volume ?? 0, 0));
  const maximumVolume = Math.max(...volumeValues, 0);
  const barWidth = Math.max(1.3, (plotWidth / data.length) * 0.72);
  const volumeBars = maximumVolume > 0 ? volumeValues.map((value, index) => {
    const height = Math.max(1, (value / maximumVolume) * volumeHeight);
    return `<rect x="${(xForIndex(index) - barWidth / 2).toFixed(1)}" y="${(volumeTop + volumeHeight - height).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${height.toFixed(1)}" rx="0.8" fill="${positive}" opacity="0.48"/>`;
  }).join('') : `<text x="${plotLeft}" y="${volumeTop + 25}" class="axis-label">${t('Volymdata saknas', 'Volume data unavailable')}</text>`;
  const periodLow = Math.min(...closingPrices);
  const periodHigh = Math.max(...closingPrices);
  const intervalPosition = periodHigh > periodLow ? ((closingPrices.at(-1)! - periodLow) / (periodHigh - periodLow)) * 100 : 50;

  return `<div class="chart-meta"><span>${t('Senaste sex månaderna', 'Last six months')}: ${escapeHtml(firstDate)} - ${escapeHtml(lastDate)}</span><strong class="${returnPct >= 0 ? 'positive' : 'negative'}">${returnPct >= 0 ? '+' : ''}${number(returnPct, 1, language)} %</strong></div><div class="chart-shell"><svg viewBox="0 0 ${width} ${totalHeight}" role="img" aria-label="${t('Kursutveckling med glidande medelvärden och handelsvolym', 'Price performance with moving averages and trading volume')}">${yTicks}<line x1="${plotLeft}" y1="${plotTop}" x2="${plotLeft}" y2="${plotBottom}" class="axis"/><line x1="${plotLeft}" y1="${plotBottom}" x2="${plotLeft + plotWidth}" y2="${plotBottom}" class="axis"/><polygon points="${areaPoints}" fill="${positive}" opacity="0.10"/><polyline points="${pointsFor('sma50')}" fill="none" stroke="#7c3aed" stroke-width="2"/><polyline points="${pointsFor('sma125')}" fill="none" stroke="#d97706" stroke-width="2"/><polyline points="${pointsFor('sma200')}" fill="none" stroke="#e11d48" stroke-width="2"/><polyline points="${closePoints}" fill="none" stroke="${positive}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><text x="${plotLeft}" y="${volumeTop - 8}" class="volume-title">${t('VOLYM', 'VOLUME')}</text>${volumeBars}${dateTicks}</svg></div><div class="chart-legend"><span><i style="background:${positive}"></i>${t('Kurs', 'Price')}</span><span><i class="sma50-line"></i>SMA 50</span><span><i class="sma125-line"></i>SMA 125</span><span><i class="sma200-line"></i>SMA 200</span></div><div class="chart-summary"><div><span>${t('Periodens lägsta', 'Period low')}</span><strong>${number(periodLow, 2, language)} kr</strong></div><div><span>${t('Periodens högsta', 'Period high')}</span><strong>${number(periodHigh, 2, language)} kr</strong></div><div><span>${t('Läge i intervallet', 'Position in range')}</span><strong>${number(intervalPosition, 0, language)} %</strong></div><div><span>${t('Senaste volym', 'Latest volume')}</span><strong>${volume(stock.latestVolume)}</strong></div></div>`;
}

function list(items: string[]) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

export function buildPrintReportHtml(stock: StockData, report: AnalystReport | null, language: AppLanguage = 'sv') {
  const t = (sv: string, en: string) => language === 'en' ? en : sv;
  const locale = language === 'en' ? 'en-GB' : 'sv-SE';
  const change = stock.regularMarketChangePercent;
  const changeClass = (change ?? 0) >= 0 ? 'positive' : 'negative';
  const stats = [
    [t('Öppning', 'Open'), number(stock.regularMarketOpen, 2, language)],
    [t('Dagens högsta', 'Day high'), number(stock.regularMarketDayHigh, 2, language)],
    [t('Dagens lägsta', 'Day low'), number(stock.regularMarketDayLow, 2, language)],
    [t('Volym', 'Volume'), volume(stock.latestVolume)],
    [t('Snittvolym', 'Average volume'), volume(stock.avgVolume20)],
    [t('VPA', 'EPS'), number(stock.epsTrailingTwelveMonths, 2, language)],
    ['P/E', number(stock.trailingPE)],
    [t('Direktavkastning', 'Dividend yield'), stock.dividendYield == null ? '-' : `${number(stock.dividendYield * 100, 1, language)} %`],
    [t('Börsvärde', 'Market cap'), marketCap(stock.marketCap)],
    [t('52v hög', '52w high'), number(stock.fiftyTwoWeekHigh, 2, language)],
    [t('52v låg', '52w low'), number(stock.fiftyTwoWeekLow, 2, language)],
    ['RSI (14)', number(stock.rsi)],
    ['SMA 50', number(stock.sma50, 2)],
    ['SMA 125', number(stock.sma125, 2)],
    ['SMA 200', number(stock.sma200, 2)],
    [t('Mot SMA 125', 'Vs SMA 125'), stock.diffPercent125 == null ? '-' : `${number(stock.diffPercent125, 1, language)} %`],
    ['Beta', number(stock.beta, 2)],
    [t('Volatilitet', 'Volatility'), stock.volatility == null ? '-' : `${number(stock.volatility, 1, language)} %`],
    ['Max drawdown', stock.maxDrawdown == null ? '-' : `-${number(stock.maxDrawdown, 1, language)} %`],
    [t('Kvalitet', 'Quality'), stock.quality ? `${number(stock.quality.score, 0, language)} / 10` : '-'],
    ['Stop loss', stock.tradePlan ? number(stock.tradePlan.stopLoss, 2) : '-'],
    [t('Riktkurs', 'Target'), stock.tradePlan ? number(stock.tradePlan.target, 2, language) : '-'],
    [t('Risk/vinst', 'Risk/reward'), stock.tradePlan ? `${number(stock.tradePlan.rMultiple, 1, language)}R` : '-'],
  ];
  const health = stock.healthCheck;
  const bullPoints = getBullPoints(stock, language);
  const bearPoints = getBearPoints(stock, language);
  const trend = getTrendInsight(stock, language);
  const interpretation = interpretHealth(stock, Date.now(), language);
  const valuation = assessValuation(stock, language);
  const generatedAt = new Date().toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

  return `<!doctype html>
<html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(stock.ticker)} ${t('analysrapport', 'analysis report')}</title>
<style>
  @page { margin: 16mm; size: A4; }
  * { box-sizing: border-box; } body { color: #172033; font: 11pt -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.45; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1, h2, h3, p { margin-top: 0; } h1 { font-size: 27pt; letter-spacing: 0; margin-bottom: 2px; } h2 { font-size: 15pt; border-bottom: 1px solid #d9e1ea; margin: 26px 0 10px; padding-bottom: 5px; } h3 { font-size: 11pt; margin: 0 0 4px; }
  .muted { color: #65758b; } .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 3px solid #1677c8; padding-bottom: 16px; } .ticker { color: #65758b; font-size: 13pt; font-weight: 600; }
  .quote { text-align: right; white-space: nowrap; } .price { font-size: 25pt; font-weight: 750; } .positive { color: #14804a; } .negative { color: #c84040; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border: 1px solid #d9e1ea; border-radius: 6px; overflow: hidden; } .stat { border-right: 1px solid #d9e1ea; border-bottom: 1px solid #d9e1ea; min-height: 59px; padding: 9px; } .stat:nth-child(4n) { border-right: 0; } .stat:nth-last-child(-n+4) { border-bottom: 0; } .label { color: #65758b; display: block; font-size: 9pt; margin-bottom: 3px; } .value { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 700; }
  svg { display: block; height: auto; width: 100%; } .grid { stroke: #e1e7ee; stroke-dasharray: 4 5; stroke-width: 1; } .axis { stroke: #aab6c3; stroke-width: 1; } .axis-label { fill: #65758b; font-size: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; } .volume-title { fill: #65758b; font-size: 9px; font-weight: 700; letter-spacing: 1px; } .chart-shell { background: #f7f9fb; border: 1px solid #d9e1ea; border-radius: 6px; overflow: hidden; padding: 8px; } .chart-meta { color: #65758b; display: flex; font-size: 9pt; justify-content: space-between; margin: 0 0 8px; } .chart-legend { display: flex; flex-wrap: wrap; gap: 14px; font-size: 8.5pt; margin-top: 8px; } .chart-legend span { align-items: center; display: inline-flex; gap: 5px; } .chart-legend i { display: inline-block; height: 3px; width: 18px; } .sma50-line { background: #7c3aed; } .sma125-line { background: #d97706; } .sma200-line { background: #e11d48; } .chart-summary { border: 1px solid #d9e1ea; border-radius: 6px; display: grid; grid-template-columns: repeat(4, 1fr); margin-top: 10px; overflow: hidden; } .chart-summary div { border-right: 1px solid #d9e1ea; padding: 8px 10px; } .chart-summary div:last-child { border-right: 0; } .chart-summary span { color: #65758b; display: block; font-size: 8pt; } .chart-summary strong { display: block; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10pt; margin-top: 2px; } .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; } .panel { border: 1px solid #d9e1ea; border-radius: 6px; padding: 12px; } .panel-positive { border-left: 4px solid #14804a; } .panel-negative { border-left: 4px solid #c84040; } .panel-attention { border-left: 4px solid #c57b00; } ul { margin: 6px 0 0; padding-left: 18px; } li { margin-bottom: 4px; } .signals { display: flex; flex-wrap: wrap; gap: 6px; } .signal { background: #e8f1fb; border-radius: 12px; color: #135b95; font-size: 9pt; padding: 3px 8px; } .grade { background: #edf7ef; border-radius: 5px; color: #16703a; display: inline-block; font-weight: 700; padding: 4px 8px; } .footer { border-top: 1px solid #d9e1ea; color: #65758b; font-size: 8.5pt; margin-top: 28px; padding-top: 10px; }
  @media print { .page-break-avoid { break-inside: avoid; } .chart-section { break-before: page; break-inside: avoid; } .long-section { break-inside: auto; } }
</style></head><body>
<header class="header"><div><h1>${escapeHtml(stock.ticker.replace('.ST', ''))}</h1><p class="ticker">${escapeHtml(stock.companyName)} · ${t('Analysrapport', 'Analysis report')}</p><p class="muted">${t('Skapad', 'Created')} ${escapeHtml(generatedAt)}</p></div><div class="quote"><div class="price">${number(stock.currentPrice, 2, language)} kr</div><div class="${changeClass}">${change == null ? '-' : `${change >= 0 ? '+' : ''}${number(change, 2, language)} % ${t('idag', 'today')}`}</div>${health ? `<p class="grade">${t('Rekylläge', 'Pullback grade')} ${health.grade} · ${health.gradeScore}/9</p>` : ''}</div></header>
<section class="page-break-avoid"><h2>${t('Nyckeltal', 'Key metrics')}</h2><div class="stats">${stats.map(([label, value]) => `<div class="stat"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value)}</span></div>`).join('')}</div></section>
<section class="page-break-avoid"><h2>${t('Relativ värdering', 'Relative valuation')}</h2><div class="panel panel-attention"><h3>${escapeHtml(valuation.label)}</h3><p>${escapeHtml(valuation.summary)}</p>${valuation.evidence.length ? list(valuation.evidence) : ''}<p class="muted">${t(`Jämförelsen bygger på ${valuation.availableComparisons} av ${valuation.totalComparisons} möjliga referenser. Ett lågt P/E är inte i sig ett bevis på att aktien är billig.`, `The comparison uses ${valuation.availableComparisons} of ${valuation.totalComparisons} possible references. A low P/E alone does not prove that a stock is cheap.`)}</p></div></section>
<section class="page-break-avoid chart-section"><h2>${t('Kursutveckling', 'Price performance')}</h2>${chartSvg(stock, language)}</section>
${stock.signals?.length ? `<section class="page-break-avoid"><h2>${t('Aktiva signaler', 'Active signals')}</h2><div class="signals">${stock.signals.map((signal) => `<span class="signal">${escapeHtml(signal.label)}: ${escapeHtml(signal.detail)}</span>`).join('')}</div></section>` : ''}
${trend ? `<section class="page-break-avoid"><h2>${t('Trendbedömning', 'Trend assessment')}</h2><div class="panel panel-${trend.color}"><h3>${escapeHtml(trend.title)}</h3><p>${escapeHtml(trend.text)}</p></div></section>` : ''}
<section class="page-break-avoid"><h2>${t('Styrkor och svagheter', 'Strengths and weaknesses')}</h2><div class="two-col"><div class="panel panel-positive"><h3>${t('Styrkor', 'Strengths')}</h3>${bullPoints.length ? list(bullPoints) : `<p class="muted">${t('Inga tydliga styrkor just nu.', 'No clear strengths at present.')}</p>`}</div><div class="panel panel-negative"><h3>${t('Svagheter', 'Weaknesses')}</h3>${bearPoints.length ? list(bearPoints) : `<p class="muted">${t('Inga tydliga svagheter just nu.', 'No clear weaknesses at present.')}</p>`}</div></div></section>
${report ? `<section class="long-section"><h2>${t('Analysmodell', 'Analysis model')}</h2><div class="panel"><h3>${escapeHtml(report.verdict)} · ${t('modellpoäng', 'model score')} ${report.score}/100</h3><p class="muted">${t('Datatäckning', 'Data coverage')}: ${report.dataCoverage.available}/${report.dataCoverage.total} (${escapeHtml(report.dataCoverage.label)}). ${t('Poängen är en summering av regler, inte sannolikheten för kursuppgång.', 'The score summarizes model rules; it is not the probability of a price increase.')}</p><p>${escapeHtml(report.thesis)}</p><div class="two-col"><div><h3>${t('Styrkor', 'Strengths')}</h3>${list(report.strengths)}</div><div><h3>${t('Risker', 'Risks')}</h3>${list(report.risks)}</div></div><h3 style="margin-top:14px">${t('Katalysatorer', 'Catalysts')}</h3>${list(report.catalysts)}<h3 style="margin-top:14px">${t('När tesen försvagas', 'What weakens the thesis')}</h3><p>${escapeHtml(report.invalidation)}</p></div></section>` : ''}
${health ? `<section class="long-section"><h2>${t('Rekylläge', 'Pullback model')}</h2><div class="panel"><p><strong>${escapeHtml(healthSummary(stock, language))}</strong></p><p class="muted">${t('Risk', 'Risk')}: ${escapeHtml(language === 'en' ? ({ Låg: 'Low', Medel: 'Medium', Hög: 'High' }[health.riskLevel] ?? health.riskLevel) : health.riskLevel)} · ${t('Momentum', 'Momentum')}: ${escapeHtml(language === 'en' ? ({ Uppåt: 'Up', Nedåt: 'Down', Sidledes: 'Sideways' }[health.momentum] ?? health.momentum) : health.momentum)}</p>${list(health.checklist.concat(health.bonuses).map((item) => `${item.passed ? t('Uppfyllt', 'Met') : t('Ej uppfyllt', 'Not met')}: ${healthLabel(item.label, language)} (${healthDetail(item.detail, language)})`))}${interpretation ? `<p>${escapeHtml(interpretation.scoreExplanation)}</p><h3 style="margin-top:12px">${t('Om du äger aktien', 'If you own the stock')}</h3><p>${escapeHtml(interpretation.ifYouOwn)}</p><h3 style="margin-top:12px">${t('Om du överväger att köpa', 'If you are considering buying')}</h3><p>${escapeHtml(interpretation.ifYouConsiderBuying)}</p>` : ''}</div></section>` : ''}
<footer class="footer">OMX30 Screener · ${t('Uppgifterna är beslutsstöd och inte personlig investeringsrådgivning. Marknadsdata kan vara fördröjd eller ofullständig.', 'The information is decision support, not personal investment advice. Market data may be delayed or incomplete.')}</footer>
</body></html>`;
}

export function openPrintReport(stock: StockData, report: AnalystReport | null, language: AppLanguage = 'sv') {
  if (typeof window === 'undefined') return false;
  const popup = window.open('', '_blank');
  if (!popup) return false;
  popup.opener = null;
  popup.document.open();
  popup.document.write(buildPrintReportHtml(stock, report, language));
  popup.document.close();
  popup.focus();
  window.setTimeout(() => popup.print(), 300);
  return true;
}
