import { runAlertJob } from '@/lib/alert-job';

function isStockholmDigestTime() {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const hour = parts.find((part) => part.type === 'hour')?.value;
  const minute = parts.find((part) => part.type === 'minute')?.value;
  return hour === '17' && minute === '35';
}

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get('force') !== '1' && !isStockholmDigestTime()) {
    return Response.json({ ok: true, skipped: 'Outside the 17:35 Europe/Stockholm schedule.' });
  }
  return runAlertJob(request, 'daily');
}
