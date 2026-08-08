import { buildQuantAnalystReport, isAnalystReport, type AnalystReport } from '@/lib/analyst-engine';
import { buildAnalystContext } from '@/lib/analyst-context';
import { getAuthenticatedUser, requireAuthenticatedUser } from '@/lib/app-auth';
import { claimAiRequest, getAiQuotaStatus, type AiQuotaResult } from '@/lib/ai-quota';
import { normalizeLanguage, type AppLanguage } from '@/lib/language';
import type { StockData } from '@/types/stock';

const CACHE_TTL = 10 * 60 * 1000;
type AiStatus = 'available' | 'disabled' | 'unconfigured' | 'quota-exhausted' | 'request-failed';
const cache = new Map<string, { report: AnalystReport; cachedAt: number; aiStatus: AiStatus }>();

function statusForQuota(aiEntitled: boolean, aiConfigured: boolean, quota: AiQuotaResult): AiStatus {
  if (!aiEntitled) return 'disabled';
  if (!aiConfigured) return 'unconfigured';
  if (!quota.available) return 'request-failed';
  return quota.allowed ? 'available' : 'quota-exhausted';
}

function quotaResponse(quota: AiQuotaResult) {
  return {
    aiQuotaRemaining: quota.remaining,
    aiQuotaUsed: quota.used,
    aiDailyLimit: quota.dailyLimit,
  };
}

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

function cacheKey(stock: StockData, userKey: string, language: AppLanguage) {
  return `${userKey}:${language}:${stock.ticker}:${stock.currentPrice}:${stock.regularMarketChangePercent ?? 'none'}`;
}

function reportSchema(language: AppLanguage) {
  return {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'thesis', 'strengths', 'risks', 'catalysts', 'invalidation'],
  properties: {
    verdict: { type: 'string', enum: language === 'en' ? ['Positive', 'Watch', 'Wait'] : ['Positiv analys', 'Bevaka', 'Avvakta'] },
    thesis: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' }, maxItems: 4 },
    risks: { type: 'array', items: { type: 'string' }, maxItems: 4 },
    catalysts: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    invalidation: { type: 'string' },
  },
  };
}

async function createAiNarrative(stock: StockData, quantReport: AnalystReport, language: AppLanguage) {
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
          language === 'en'
            ? 'You are a cautious equity analyst for a private analysis app. Write in clear English and use only the structured facts provided.'
            : 'Du ar en forsiktig aktieanalytiker for en privat analysapp. Skriv pa svenska och anvand bara de strukturerade fakta som skickas in.',
          'Ge generell bolagsanalys, aldrig personlig placeringsradgivning.',
          'Hitta inte pa nyheter, konsensus, riktkurser eller data som saknas.',
          'Var tydlig med osakerhet och lat risker vaga tungt nar data ar blandad.',
          'Ga igenom hela analysisContext innan du skriver och vag teknisk trend, relativ styrka, volym, fundamental kvalitet, vardering, risk, kommande rapport och handelsplan mot varandra.',
          'Skilj historiska observationer fran framtida mojligheter. RSI, MACD, glidande medelvarden och prisformationer ar bakatblickande och bevisar inte nasta kursrorelse.',
          'Anvand kvalitetens delkomponenter, inte bara den sammanvagda kvalitetspoangen. Namn konkret skuld, marginal, kassaflode eller tillvaxt nar underlaget finns.',
          'Anvand inte en signaletikett utan att kontrollera dess detail och observedAt.',
          'Anvand avrundade tal: pris och glidande medelvarden med tva decimaler, P/E med en decimal och procent med en decimal.',
          'Faltet valuation.dividendYieldPercent ar redan en procent, sa skriv exempelvis 2,2 % och multiplicera aldrig det igen.',
          'Kalla aldrig en aktie billig eller dyr utifran ett absolut P/E. Anvand bara jamforelsen med egen historik eller sektor som skickas in.',
          'Faltet valuation.trailingPEPriceProxyMedian ar inte historiska rapporterade P/E-tal. Det ar medianpriset for tolv manader delat med dagens VPA och ska alltid kallas prisproxy.',
          'Om datakallor saknas eller motsager varandra ska det namnas som en osakerhet, inte fyllas ut med antaganden.',
          'Anvand inte ordet kop som uppmaning. Välj endast en av de givna slutsatserna.',
        ].join(' '),
        input: JSON.stringify({
          analysisContext: buildAnalystContext(stock),
          quantReport,
        }),
        text: {
          format: {
            type: 'json_schema',
            name: 'stock_analyst_report',
            strict: true,
            schema: reportSchema(language),
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

export async function GET(request: Request) {
  const authenticationError = await requireAuthenticatedUser(request);
  if (authenticationError) return authenticationError;

  const user = await getAuthenticatedUser(request);
  const aiEntitled = Boolean(user?.canUseAi);
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const quota = aiEntitled && aiConfigured
    ? await getAiQuotaStatus(user?.email ?? null, user?.aiDailyLimit ?? 0)
    : { allowed: false, remaining: null, used: 0, dailyLimit: user?.aiDailyLimit ?? 0, available: true };

  return Response.json({
    aiStatus: statusForQuota(aiEntitled, aiConfigured, quota),
    ...quotaResponse(quota),
  });
}

export async function POST(request: Request) {
  const authenticationError = await requireAuthenticatedUser(request);
  if (authenticationError) return authenticationError;

  // AI-analysen är det enda i appen som kostar pengar per anrop, och därför
  // det enda som styrs per användare. Saknas behörigheten svarar endpointen
  // ändå, fast med den regelbaserade analysen: hellre en enklare analys än ett
  // felmeddelande.
  const user = await getAuthenticatedUser(request);
  const aiEntitled = Boolean(user?.canUseAi);
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY);

  try {
    const body = await request.json() as { stock?: unknown; language?: unknown };
    if (!validStock(body.stock)) return Response.json({ error: 'Invalid stock payload' }, { status: 400 });

    const stock = body.stock;
    const language = normalizeLanguage(body.language);
    const key = cacheKey(stock, user?.email ?? user?.id ?? 'anonymous', language);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      const quota = aiEntitled && aiConfigured
        ? await getAiQuotaStatus(user?.email ?? null, user?.aiDailyLimit ?? 0)
        : { allowed: false, remaining: null, used: 0, dailyLimit: user?.aiDailyLimit ?? 0, available: true };
      const quotaStatus = statusForQuota(aiEntitled, aiConfigured, quota);
      return Response.json({
        report: cached.report,
        cached: true,
        aiAvailable: cached.report.source === 'ai',
        aiStatus: quotaStatus === 'available' ? cached.aiStatus : quotaStatus,
        ...quotaResponse(quota),
      });
    }

    const quantReport = buildQuantAnalystReport(stock, language);
    const quota = aiEntitled && aiConfigured
      ? await claimAiRequest(user?.email ?? null, user?.aiDailyLimit ?? 0)
      : { allowed: false, remaining: null, used: 0, dailyLimit: user?.aiDailyLimit ?? 0, available: true };
    const aiAllowed = aiEntitled && aiConfigured && quota.allowed;
    const narrative = aiAllowed ? await createAiNarrative(stock, quantReport, language) : null;
    const report: AnalystReport = narrative
      ? { ...narrative, score: quantReport.score, dataCoverage: quantReport.dataCoverage, source: 'ai', generatedAt: new Date().toISOString() }
      : quantReport;

    const aiStatus: AiStatus = !aiEntitled
      ? 'disabled'
      : !aiConfigured
        ? 'unconfigured'
        : !quota.available
          ? 'request-failed'
          : !quota.allowed
          ? 'quota-exhausted'
          : narrative
            ? 'available'
            : 'request-failed';
    cache.set(key, { report, cachedAt: Date.now(), aiStatus });
    return Response.json({
      report,
      cached: false,
      aiAvailable: Boolean(narrative),
      aiStatus,
      ...quotaResponse(quota),
    });
  } catch (error) {
    console.error('Analyst API Error:', error);
    return Response.json({ error: 'Failed to create analyst report' }, { status: 500 });
  }
}
