import { buildQuantAnalystReport, isAnalystReport, type AnalystReport } from '@/lib/analyst-engine';
import { getAuthenticatedUser, requireAuthenticatedUser } from '@/lib/app-auth';
import { roundMarketValue } from '@/lib/market-values';
import type { StockData } from '@/types/stock';

const CACHE_TTL = 10 * 60 * 1000;
const cache = new Map<string, { report: AnalystReport; cachedAt: number }>();

interface OpenAIResponse {
  output?: { content?: { type?: string; text?: string }[] }[];
}

function responseText(response: OpenAIResponse) {
  for (const output of response.output || []) {
    for (const content of output.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  return null;
}

function validStock(value: unknown): value is StockData {
  if (!value || typeof value !== 'object') return false;
  const stock = value as Record<string, unknown>;
  return typeof stock.ticker === 'string'
    && stock.ticker.length <= 24
    && typeof stock.companyName === 'string'
    && stock.companyName.length <= 160
    && typeof stock.currentPrice === 'number'
    && Number.isFinite(stock.currentPrice);
}

function cacheKey(stock: StockData) {
  return `${stock.ticker}:${stock.currentPrice}:${stock.regularMarketChangePercent ?? 'none'}`;
}

const reportSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'confidence', 'thesis', 'strengths', 'risks', 'catalysts', 'invalidation'],
  properties: {
    verdict: { type: 'string', enum: ['Positiv analys', 'Bevaka', 'Avvakta'] },
    confidence: { type: 'string', enum: ['Låg', 'Medel', 'Hög'] },
    thesis: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    risks: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    catalysts: { type: 'array', items: { type: 'string' }, maxItems: 2 },
    invalidation: { type: 'string' },
  },
};

async function createAiNarrative(stock: StockData, quantReport: AnalystReport) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_ANALYST_MODEL || 'gpt-5-mini',
        store: false,
        instructions: [
          'Du ar en forsiktig aktieanalytiker for en privat analysapp.',
          'Skriv pa svenska och anvand bara de strukturerade fakta som skickas in.',
          'Ge generell bolagsanalys, aldrig personlig placeringsradgivning.',
          'Hitta inte pa nyheter, konsensus, riktkurser eller data som saknas.',
          'Var tydlig med osakerhet och lat risker vaga tungt nar data ar blandad.',
          'Anvand avrundade tal: pris och glidande medelvarden med tva decimaler, P/E med en decimal och procent med en decimal.',
          'Faltet dividendYieldPercent ar redan en procent, sa skriv exempelvis 2,2 % och multiplicera aldrig det igen.',
          'Anvand inte ordet kop som uppmaning. Välj endast en av de givna slutsatserna.',
        ].join(' '),
        input: JSON.stringify({
          stock: {
            ticker: stock.ticker,
            companyName: stock.companyName,
            currentPrice: roundMarketValue(stock.currentPrice),
            changePercent: roundMarketValue(stock.regularMarketChangePercent, 1),
            trailingPE: roundMarketValue(stock.trailingPE, 1),
            dividendYieldPercent: stock.dividendYield == null ? null : roundMarketValue(stock.dividendYield * 100, 1),
            beta: roundMarketValue(stock.beta, 2),
            volatility: roundMarketValue(stock.volatility, 1),
            maxDrawdown: roundMarketValue(stock.maxDrawdown, 1),
            riskRewardScore: roundMarketValue(stock.riskRewardScore, 0),
            rsi: roundMarketValue(stock.rsi, 1),
            sma50: roundMarketValue(stock.sma50),
            sma125: roundMarketValue(stock.sma125),
            sma200: roundMarketValue(stock.sma200),
            fiftyTwoWeekHigh: roundMarketValue(stock.fiftyTwoWeekHigh),
            fiftyTwoWeekLow: roundMarketValue(stock.fiftyTwoWeekLow),
            signals: stock.signals?.map((signal) => signal.label) || [],
          },
          quantReport,
        }),
        text: {
          format: {
            type: 'json_schema',
            name: 'stock_analyst_report',
            strict: true,
            schema: reportSchema,
          },
        },
      }),
    });

    if (!response.ok) {
      console.error('OpenAI analyst request failed:', response.status, await response.text());
      return null;
    }

    const rawText = responseText(await response.json() as OpenAIResponse);
    if (!rawText) return null;

    try {
      const narrative = JSON.parse(rawText);
      if (!isAnalystReport(narrative)) return null;
      return narrative;
    } catch {
      return null;
    }
  } catch (error) {
    console.error('OpenAI analyst request could not be completed:', error);
    return null;
  }
}

export async function POST(request: Request) {
  const authenticationError = await requireAuthenticatedUser(request);
  if (authenticationError) return authenticationError;

  // AI-analysen är det enda i appen som kostar pengar per anrop, och därför
  // det enda som styrs per användare. Saknas behörigheten svarar endpointen
  // ändå, fast med den regelbaserade analysen: hellre en enklare analys än ett
  // felmeddelande.
  const user = await getAuthenticatedUser(request);
  const aiAllowed = Boolean(user?.canUseAi) && Boolean(process.env.OPENAI_API_KEY);

  try {
    const body = await request.json() as { stock?: unknown };
    if (!validStock(body.stock)) return Response.json({ error: 'Invalid stock payload' }, { status: 400 });

    const stock = body.stock;
    const key = cacheKey(stock);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL && (cached.report.source === 'quant' || aiAllowed)) {
      return Response.json({ report: cached.report, cached: true, aiAvailable: aiAllowed });
    }

    const quantReport = buildQuantAnalystReport(stock);
    const narrative = aiAllowed ? await createAiNarrative(stock, quantReport) : null;
    const report: AnalystReport = narrative
      ? { ...narrative, score: quantReport.score, source: 'ai', generatedAt: new Date().toISOString() }
      : quantReport;

    cache.set(key, { report, cachedAt: Date.now() });
    return Response.json({ report, cached: false, aiAvailable: aiAllowed });
  } catch (error) {
    console.error('Analyst API Error:', error);
    return Response.json({ error: 'Failed to create analyst report' }, { status: 500 });
  }
}
