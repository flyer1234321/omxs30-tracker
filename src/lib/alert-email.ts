import type { StockAlert } from '@/lib/alert-engine';

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function section(type: 'BUY' | 'SELL', alerts: StockAlert[]) {
  if (!alerts.length) return '';
  const color = type === 'BUY' ? '#16803a' : '#c53b3b';
  const label = type === 'BUY' ? 'Köpläge' : 'Sälj/risk';
  return `<h2 style="color:${color};font-size:16px;margin:24px 0 10px">${label}</h2>${alerts.map((alert) => `
    <div style="border:1px solid #d9e1ea;border-left:4px solid ${color};border-radius:6px;margin:8px 0;padding:14px">
      <strong style="font-size:16px">${escapeHtml(alert.ticker.replace('.ST', ''))}</strong>
      <span style="float:right;font-family:monospace;font-weight:700">${alert.price.toFixed(2)} kr</span>
      <p style="color:#526276;margin:7px 0 0">${escapeHtml(alert.companyName)}</p>
      <p style="margin:8px 0 0">${alert.reasons.map(escapeHtml).join(' + ')}</p>
    </div>`).join('')}`;
}

export function buildAlertEmailHtml(alerts: StockAlert[], appUrl: string, unsubscribeUrl: string) {
  const buys = alerts.filter((alert) => alert.type === 'BUY');
  const sells = alerts.filter((alert) => alert.type === 'SELL');
  return `<!doctype html><html lang="sv"><body style="background:#f3f6f9;color:#172033;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:24px">
    <main style="background:#fff;border:1px solid #d9e1ea;border-radius:8px;margin:auto;max-width:620px;overflow:hidden">
      <header style="background:#10151f;color:#fff;padding:24px"><div style="color:#86a9cb;font-size:12px;font-weight:700;letter-spacing:.8px">OMX30 SCREENER</div><h1 style="font-size:23px;margin:10px 0 0">Dagens bevakning: ${alerts.length} signal${alerts.length === 1 ? '' : 'er'} från din favoritlista</h1></header>
      <section style="padding:24px">${section('BUY', buys)}${section('SELL', sells)}
        <p style="margin:26px 0 4px"><a href="${escapeHtml(appUrl)}" style="background:#1677c8;border-radius:5px;color:#fff;display:inline-block;font-weight:700;padding:12px 16px;text-decoration:none">Öppna OMX30-appen för djupanalys</a></p>
      </section>
      <footer style="border-top:1px solid #d9e1ea;color:#68778b;font-size:12px;padding:18px 24px">Beslutsstöd, inte personlig investeringsrådgivning. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#526276">Avregistrera dig från dessa varningar</a>.</footer>
    </main></body></html>`;
}

export async function sendAlertDigest(input: { to: string; alerts: StockAlert[]; appUrl: string; unsubscribeUrl: string; idempotencyKey: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) throw new Error('Resend is not configured.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey,
      'List-Unsubscribe': `<${input.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `OMX30 Screener: ${input.alerts.length} signal${input.alerts.length === 1 ? '' : 'er'} i din bevakning`,
      html: buildAlertEmailHtml(input.alerts, input.appUrl, input.unsubscribeUrl),
    }),
  });
  if (!response.ok) throw new Error(`Resend failed: ${response.status} ${await response.text()}`);
  return await response.json() as { id: string };
}
