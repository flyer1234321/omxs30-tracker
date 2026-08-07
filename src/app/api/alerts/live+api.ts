import { runAlertJob } from '@/lib/alert-job';

function isStockholmMarketWindow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Stockholm', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const weekday = parts.find((part) => part.type === 'weekday')?.value;
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  const minutes = hour * 60 + minute;
  return weekday !== 'Sat' && weekday !== 'Sun' && minutes >= 9 * 60 + 5 && minutes <= 17 * 60 + 35;
}

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get('force') !== '1' && !isStockholmMarketWindow()) {
    return Response.json({ ok: true, skipped: 'Outside Stockholm market hours.' });
  }
  return runAlertJob(request, 'live');
}
