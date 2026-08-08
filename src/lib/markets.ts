/**
 * Aktieurvalen och deras jämförelseindex. Ligger separat eftersom både
 * screenern och händelsestudien behöver samma listor.
 *
 * Observera att listorna innehåller dagens bolag. Vid historiska studier ger
 * det en överlevnadsbias: bolag som lämnat indexet finns inte med, och de har
 * i regel lämnat för att det gått dåligt.
 */
export const MARKETS: Record<string, string[]> = {
  omxs30: [
    "ABB.ST", "ADDT-B.ST", "ALFA.ST", "ASSA-B.ST", "AZN.ST",
    "ATCO-A.ST", "BOL.ST", "EPI-A.ST", "EQT.ST", "ERIC-B.ST",
    "ESSITY-B.ST", "EVO.ST", "HM-B.ST", "HEXA-B.ST", "INDU-C.ST",
    "INVE-B.ST", "LIFCO-B.ST", "NIBE-B.ST", "NDA-SE.ST", "SAND.ST",
    "SCA-B.ST", "SEB-A.ST", "SKA-B.ST", "SKF-B.ST", "SSAB-A.ST",
    "SSAB-B.ST", "SWED-A.ST", "TEL2-B.ST", "TELIA.ST", "VOLV-B.ST"
  ],
  swe_broad: [
    "ABB.ST", "ADDT-B.ST", "ALFA.ST", "ARPL.ST", "ASSA-B.ST", "ATCO-A.ST", "ATCO-B.ST", "ATRLJ-B.ST",
    "AXFO.ST", "AZN.ST", "BALD-B.ST", "BOL.ST", "CASTE.ST", "CIBUS.ST", "DIOS.ST", "ELUX-B.ST",
    "EPI-A.ST", "EQT.ST", "ERIC-B.ST", "ESSITY-B.ST", "EVO.ST", "FABG.ST", "GETI-B.ST", "HEXA-B.ST",
    "HM-B.ST", "HUFV-A.ST", "INDU-C.ST", "INVE-A.ST", "INVE-B.ST", "KINV-B.ST", "LIFCO-B.ST", "LUND-B.ST",
    "NDA-SE.ST", "NIBE-B.ST", "NP3.ST", "OEM-B.ST", "PEAB-B.ST", "SAAB-B.ST", "SAND.ST", "SBB-B.ST",
    "SCA-B.ST", "SEB-A.ST", "SECU-B.ST", "SKA-B.ST", "SKF-B.ST", "SSAB-A.ST", "SSAB-B.ST", "SWED-A.ST",
    "TEL2-B.ST", "TELIA.ST", "TREL-B.ST", "TRUE-B.ST", "VOLV-A.ST", "VOLV-B.ST", "WIHL.ST", "XANO-B.ST"
  ],
  dji: [
    "AAPL", "MSFT", "UNH", "JNJ", "V", "PG", "HD", "CVX", "JPM", "MRK",
    "MCD", "CRM", "CSCO", "KO", "DIS", "WMT", "VZ", "INTC", "NKE", "BA",
    "IBM", "AMGN", "CAT", "HON", "AXP", "GS", "MMM", "TRV", "DOW", "WBA"
  ],
  tech: [
    "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "TSLA", "AVGO",
    "NFLX", "AMD", "QCOM", "ADBE", "CRM", "INTC", "CSCO"
  ],
  swe_fastigheter: [
    "SBB-B.ST", "BALD-B.ST", "CASTE.ST", "NYF.ST", "FABG.ST",
    "WALL-B.ST", "NP3.ST", "HUFV-A.ST", "CORE-B.ST", "DIOS.ST",
    "CIBUS.ST", "HEBA-B.ST", "KFAST-B.ST", "CATENA.ST", "ATRLJ-B.ST"
  ]
};

export const BENCHMARKS: Record<string, string> = {
  omxs30: '^OMX',
  swe_broad: '^OMX',
  swe_fastigheter: '^OMX',
  dji: '^DJI',
  tech: '^IXIC',
  watchlist: '^OMX',
};

export function benchmarkForTicker(ticker: string, market: string, isCustomRequest: boolean) {
  if (isCustomRequest) return ticker.endsWith('.ST') ? '^OMX' : '^GSPC';
  return BENCHMARKS[market] || BENCHMARKS.omxs30;
}
