import { runAlertJob } from '@/lib/alert-job';
import { isWeekend, localMinutes } from '@/lib/market-hours';

const STOCKHOLM = 'Europe/Stockholm';
const CLOSE_MINUTES = 17 * 60 + 30;

/**
 * Kravet var tidigare exakt klockan 17:35 i svensk tid, på minuten. Vercels
 * gratisnivå kan bara köra en cron per dag och garanterar inte minuten, så i
 * praktiken skickades sammanfattningen aldrig.
 *
 * Nu accepteras vilken körning som helst efter börsens stängning. Att köra
 * flera gånger samma kväll är ofarligt: claim_alert_log släpper bara igenom en
 * signal per bolag och riktning per sjudagarsperiod, så dubbletter filtreras
 * bort i databasen.
 */
function isAfterStockholmClose() {
  if (isWeekend(STOCKHOLM)) return false;
  return localMinutes(STOCKHOLM) >= CLOSE_MINUTES;
}

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get('force') !== '1' && !isAfterStockholmClose()) {
    return Response.json({ ok: true, skipped: 'Before the Stockholm close.' });
  }
  return runAlertJob(request, 'daily');
}
