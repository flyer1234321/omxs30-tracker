import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance({ 
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
  validation: { logErrors: false }
});

const MARKETS: Record<string, string[]> = {
  omxs30: [
    "ABB.ST", "ADDT-B.ST", "ALFA.ST", "ASSA-B.ST", "AZN.ST",
    "ATCO-A.ST", "BOL.ST", "EPI-A.ST", "EQT.ST", "ERIC-B.ST",
    "ESSITY-B.ST", "EVO.ST", "HM-B.ST", "HEXA-B.ST", "INDU-C.ST",
    "INVE-B.ST", "LIFCO-B.ST", "NIBE-B.ST", "NDA-SE.ST", "SAND.ST",
    "SCA-B.ST", "SEB-A.ST", "SKA-B.ST", "SKF-B.ST", "SSAB-A.ST",
    "SSAB-B.ST", "SWED-A.ST", "TEL2-B.ST", "TELIA.ST", "VOLV-B.ST"
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

// In-memory cache keyed by request string
let cache: Record<string, { data: any, lastUpdated: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function calculateSMA(history: any[], period: number) {
  if (history.length < period) return null;
  const recent = history.slice(-period);
  const sum = recent.reduce((acc, curr) => acc + curr.close, 0);
  return sum / period;
}

function calculateRSI(history: any[], period = 14) {
  if (history.length < period + 1) return null;
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = history[i].close - history[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < history.length; i++) {
    const diff = history[i].close - history[i - 1].close;
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateBollingerBands(history: any[], period = 20, stdDev = 2) {
  if (history.length < period) return null;
  const recent = history.slice(-period);
  const middle = recent.reduce((acc, curr) => acc + curr.close, 0) / period;
  
  const variance = recent.reduce((acc, curr) => acc + Math.pow(curr.close - middle, 2), 0) / period;
  const std = Math.sqrt(variance);
  
  return {
    upper: middle + stdDev * std,
    middle: middle,
    lower: middle - stdDev * std
  };
}

function calculateMACD(history: any[]) {
  if (history.length < 26) return null;
  
  const ema = (data: number[], period: number) => {
    let result = [];
    let k = 2 / (period + 1);
    let initialSma = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    result.push(initialSma);
    for (let i = period; i < data.length; i++) {
      result.push(data[i] * k + result[result.length - 1] * (1 - k));
    }
    return result;
  };
  
  const closes = history.map(h => h.close);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  
  const macdLine = [];
  for (let i = 0; i < ema26.length; i++) {
    const idx12 = ema12.length - ema26.length + i;
    macdLine.push(ema12[idx12] - ema26[i]);
  }
  
  if (macdLine.length < 9) return null;
  const signalLine = ema(macdLine, 9);
  
  const histogram = [];
  for(let i=0; i<signalLine.length; i++) {
    const idxMacd = macdLine.length - signalLine.length + i;
    histogram.push(macdLine[idxMacd] - signalLine[i]);
  }
  
  const currentMacd = macdLine[macdLine.length - 1];
  const currentSignal = signalLine[signalLine.length - 1];
  const currentHistogram = histogram[histogram.length - 1];
  
  let trend: 'up' | 'down' | 'neutral' = 'neutral';
  if (histogram.length >= 3) {
    const h = histogram;
    const len = h.length;
    if (currentHistogram > 0 && h[len-1] > h[len-2] && h[len-2] > h[len-3]) {
      trend = 'up';
    } else if (currentHistogram < 0 && h[len-1] < h[len-2] && h[len-2] < h[len-3]) {
      trend = 'down';
    }
  }

  return { macd: currentMacd, signal: currentSignal, histogram: currentHistogram, trend };
}

function calculateVolatility(history: any[], period = 20) {
  if (history.length < period + 1) return null;
  const recent = history.slice(-(period + 1));
  const returns = [];
  for (let i = 1; i < recent.length; i++) {
    returns.push(Math.log(recent[i].close / recent[i - 1].close));
  }
  
  const mean = returns.reduce((sum, val) => sum + val, 0) / returns.length;
  const variance = returns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / returns.length;
  const std = Math.sqrt(variance);
  
  return std * Math.sqrt(252) * 100; // Annualized percentage
}

function generateHealthCheck(item: any) {
  let gradeScore = 0;
  const checklist = [];
  
  const { currentPrice, sma125, rsi, fiftyTwoWeekLow, fiftyTwoWeekHigh, trailingPE, dividendYield, regularMarketChangePercent, bollingerBands, macdData, volatility, companyName, latestVolume, avgVolume20 } = item;
  
  const pePassed = trailingPE !== null && trailingPE > 0;
  checklist.push({ label: 'Tjänar företaget pengar?', passed: pePassed, detail: pePassed ? `P/E: ${trailingPE.toFixed(1)}` : 'Negativt/Saknas' });
  if (pePassed) gradeScore += 1;
  
  const divPassed = dividendYield !== null && dividendYield > 0;
  checklist.push({ label: 'Betalar utdelning?', passed: divPassed, detail: divPassed ? `Direktavkastning: ${(dividendYield * 100).toFixed(1)}%` : 'Ingen utdelning' });
  if (divPassed) gradeScore += 1;
  
  let dropVal = 0;
  if (fiftyTwoWeekHigh) {
    dropVal = ((fiftyTwoWeekHigh - currentPrice) / fiftyTwoWeekHigh) * 100;
  } else if (sma125) {
    dropVal = ((sma125 - currentPrice) / sma125) * 100;
  }
  const dropPassed = dropVal > 8;
  checklist.push({ label: 'Har aktien fallit kraftigt?', passed: dropPassed, detail: `Faller ${dropVal.toFixed(1)}%` });
  if (dropPassed) gradeScore += 1;
  
  const nearLowPassed = fiftyTwoWeekLow ? ((currentPrice - fiftyTwoWeekLow) / fiftyTwoWeekLow) <= 0.10 : false;
  checklist.push({ label: 'Nära botten?', passed: nearLowPassed, detail: fiftyTwoWeekLow ? `${(((currentPrice - fiftyTwoWeekLow) / fiftyTwoWeekLow)*100).toFixed(1)}% från botten` : 'N/A' });
  if (nearLowPassed) gradeScore += 1;
  
  const rsiPassed = rsi !== null && rsi < 35;
  checklist.push({ label: 'Översåld (RSI)?', passed: rsiPassed, detail: rsi ? `RSI: ${rsi.toFixed(1)}` : 'N/A' });
  if (rsiPassed) gradeScore += 1;
  
  const smaPassed = sma125 !== null && currentPrice < sma125;
  const smaDiff = sma125 ? ((sma125 - currentPrice) / sma125) * 100 : 0;
  checklist.push({ label: 'Under glidande medelvärde?', passed: smaPassed, detail: smaPassed ? `${smaDiff.toFixed(1)}% under` : 'Över SMA' });
  if (smaPassed) gradeScore += 1;
  
  if (rsi !== null && rsi < 20) gradeScore += 1;
  
  const nearLowerBB = bollingerBands && currentPrice <= bollingerBands.lower * 1.01;
  if (nearLowerBB) gradeScore += 1;
  
  if (macdData && macdData.trend === 'up') gradeScore += 1;
  
  const passedItems = checklist.filter(c => c.passed).length;
  
  let grade: 'A'|'B'|'C'|'D'|'F' = 'F';
  if ((gradeScore >= 7 || (passedItems >= 5 && rsi !== null && rsi < 30)) && pePassed && divPassed) {
    grade = 'A';
  } else if (gradeScore >= 5) {
    grade = 'B';
  } else if (gradeScore >= 3) {
    grade = 'C';
  } else if (gradeScore >= 1) {
    grade = 'D';
  } else {
    grade = 'F';
  }
  
  let riskLevel: 'Låg' | 'Medel' | 'Hög' = 'Låg';
  if (volatility !== null) {
    if (volatility > 40) riskLevel = 'Hög';
    else if (volatility > 25) riskLevel = 'Medel';
  }
  
  const momentum = macdData ? (macdData.trend === 'up' ? 'Uppåt' : (macdData.trend === 'down' ? 'Nedåt' : 'Sidledes')) : 'Sidledes';
  
  const observations = [];
  if (nearLowerBB) observations.push('Kursen är vid sin statistiska botten');
  if (macdData && macdData.trend === 'up') observations.push('Momentum håller på att vända uppåt');
  if (latestVolume && avgVolume20 && latestVolume > 1.5 * avgVolume20) observations.push('Handelsvolymen är ovanligt hög');
  if (rsi !== null && rsi < 30) observations.push('Aktien är tekniskt översåld');
  if (nearLowPassed) observations.push('Kursen närmar sig årslägsta');
  
  const diffPct = sma125 ? Math.abs(((currentPrice - sma125) / sma125) * 100).toFixed(1) : '0.0';
  const priceAction = sma125 ? (currentPrice < sma125 ? `handlas ${diffPct}% under` : `handlas ${diffPct}% över`) + ' sitt 6-månaderssnitt' : 'handlas nära sitt snitt';
  const rsiText = (rsi !== null && rsi < 30) ? ` och RSI ligger på ${rsi.toFixed(0)} (översåld)` : '';
  const divText = dividendYield ? `. Direktavkastningen är ${(dividendYield * 100).toFixed(1)}%` : '';
  const lowText = (fiftyTwoWeekLow && ((currentPrice - fiftyTwoWeekLow) / fiftyTwoWeekLow) <= 0.10) ? `. ${( ((currentPrice - fiftyTwoWeekLow) / fiftyTwoWeekLow) * 100 ).toFixed(1)}% från 52v-lägsta` : '';

  let summary = `${companyName} ${priceAction}${rsiText}${divText}${lowText}. Risken bedöms som ${riskLevel.toLowerCase()}.`;
  if (grade === 'A' || grade === 'B') {
    summary += ' Övergripande visar aktien flera tecken på köpläge.';
  } else if (grade === 'C') {
    summary += ' Övergripande är aktien i ett neutralt läge.';
  } else {
    summary += ' Inga tydliga köpsignaler för tillfället.';
  }
  
  return { grade, gradeScore, summary, riskLevel, momentum, checklist };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const market = url.searchParams.get('market') || 'omxs30';
  const customTickers = url.searchParams.get('tickers');

  let tickersToFetch: string[] = [];
  if (customTickers) {
    tickersToFetch = customTickers.split(',').map(t => t.trim().toUpperCase());
  } else {
    tickersToFetch = MARKETS[market] || MARKETS['omxs30'];
  }

  const cacheKey = customTickers ? `custom_${customTickers}` : `market_${market}`;

  if (cache[cacheKey] && Date.now() - cache[cacheKey].lastUpdated < CACHE_TTL) {
    return Response.json({ data: cache[cacheKey].data, cached: true, timestamp: cache[cacheKey].lastUpdated });
  }

  try {
    const period1 = new Date();
    period1.setMonth(period1.getMonth() - 18); // 18 months back to ensure enough data for 125-day SMA on the 1Y chart

    const results = [];
    const quotes = await yahooFinance.quote(tickersToFetch, {}, { validateResult: false });
    const quotesMap = new Map();
    quotes.forEach(q => quotesMap.set(q.symbol, q));

    for (const ticker of tickersToFetch) {
      try {
        const chartData = await yahooFinance.chart(ticker, {
          period1,
          interval: '1d',
        }, { validateResult: false });

        const quote = quotesMap.get(ticker);
        const currentPrice = quote?.regularMarketPrice;
        const companyName = quote?.longName || quote?.shortName || ticker;

        const history = chartData.quotes;

        if (!history || history.length === 0 || !currentPrice) {
          continue;
        }

        const sma125 = calculateSMA(history, 125);
        const sma200 = calculateSMA(history, 200);
        const rsi = calculateRSI(history, 14);
        const bollingerBands = calculateBollingerBands(history, 20, 2);
        const macdData = calculateMACD(history);
        const volatility = calculateVolatility(history, 20);
        
        const latestVolume = history[history.length - 1].volume || 0;
        const vol20 = history.slice(-20);
        const avgVolume20 = vol20.reduce((acc, curr) => acc + (curr.volume || 0), 0) / (vol20.length || 1);

        const chartHistory = [];
        const chartHistoryLength = 252; // Return 1 year of trading data for timeframe selector
        const startIndex = Math.max(0, history.length - chartHistoryLength);
        
        for (let i = startIndex; i < history.length; i++) {
            const historyUpToI = history.slice(0, i + 1);
            const sma125AtDay = calculateSMA(historyUpToI, 125);
            chartHistory.push({
                date: history[i].date,
                close: history[i].close,
                sma125: sma125AtDay
            });
        }

        const itemData = {
          ticker,
          companyName,
          currentPrice,
          sma125,
          sma200,
          rsi,
          diffPercent125: sma125 ? ((currentPrice - sma125) / sma125) * 100 : null,
          fiftyTwoWeekLow: quote?.fiftyTwoWeekLow || null,
          fiftyTwoWeekHigh: quote?.fiftyTwoWeekHigh || null,
          trailingPE: quote?.trailingPE || null,
          dividendYield: quote?.dividendYield || null,
          marketCap: quote?.marketCap || null,
          regularMarketChangePercent: quote?.regularMarketChangePercent || null,
          latestVolume,
          avgVolume20,
          chartHistory,
          bollingerBands,
          macdData,
          volatility,
          earningsTimestamp: quote?.earningsTimestamp || null,
          priceToBook: quote?.priceToBook || null,
          bookValue: quote?.bookValue || null,
          fiftyDayAverage: quote?.fiftyDayAverage || null,
          twoHundredDayAverage: quote?.twoHundredDayAverage || null
        };
        
        const healthCheck = generateHealthCheck(itemData);

        results.push({
          ...itemData,
          healthCheck
        });
      } catch (err) {
        console.error(`Failed to fetch data for ${ticker}:`, err);
      }
    }

    cache[cacheKey] = {
      data: results,
      lastUpdated: Date.now()
    };

    return Response.json({ data: results, cached: false, timestamp: cache[cacheKey].lastUpdated });

  } catch (error) {
    console.error("API Error:", error);
    return Response.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
