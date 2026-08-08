import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  ScrollView,
  SafeAreaView,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import type { DimensionValue } from 'react-native';
import type { StockData } from '@/types/stock';
import { colors as palette, gradeColorMap } from '@/theme';
import { AnalystBrief } from '@/components/AnalystBrief';
import { MarketChart } from '@/components/MarketChart';
import { HintedTouchable } from '@/components/HintedTouchable';
import type { AnalystReport } from '@/lib/analyst-engine';
import { openPrintReport } from '@/lib/print-report';
import { getBearPoints, getBullPoints, getTrendInsight } from '@/lib/stock-insights';
import { formatNumber, formatPercent, formatPrice, formatSignedPercent } from '@/lib/format';
import { MAX_GRADE_SCORE } from '@/lib/stock-health';
import { interpretHealth } from '@/lib/health-interpretation';
import { positionSizeForRisk } from '@/lib/trade-plan';
import { daysUntilEarnings } from '@/lib/stock-signals';
import { EarningsHistory } from '@/components/EarningsHistory';
import { InfoTip } from '@/components/Tooltip';
import { NoviceOverview } from '@/components/NoviceOverview';
import type { GlossaryKey } from '@/lib/glossary';
import { parseNumericInput } from '@/lib/numeric-input';
import { assessValuation } from '@/lib/valuation';
import { useAppLanguage } from '@/components/AppLanguage';
import { healthDetail, healthLabel, healthSummary } from '@/lib/health-language';

export type { StockData } from '@/types/stock';

interface StockDetailModalProps {
  item: StockData | null;
  onClose: () => void;
  isWatchlisted: boolean;
  onToggleWatchlist: () => void;
}

const colors = {
  bg: palette.bg,
  surface: palette.surface,
  text: palette.textStrong,
  textMuted: palette.textSecondary,
  green: palette.positive,
  red: palette.negative,
  yellow: palette.warning,
  border: palette.borderStrong,
};

const gradeColors = gradeColorMap;

const riskColors: Record<string, string> = { 'Låg': palette.positive, 'Medel': palette.warning, 'Hög': palette.negative };
const momentumIcons: Record<string, string> = { 'Uppåt': '↗️', 'Nedåt': '↘️', 'Sidledes': '→' };

interface DetailStatProps { label: string; value: string; term: GlossaryKey; valueColor?: string; width: DimensionValue; }

function DetailStat({ label, value, term, valueColor, width }: DetailStatProps) {
  return (
    <InfoTip term={term} style={[s.statBox, { width }]} accessibilityLabel={`Förklaring: ${label}`}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statVal, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </InfoTip>
  );
}

export const StockDetailModal: React.FC<StockDetailModalProps> = ({ item, onClose, isWatchlisted, onToggleWatchlist }) => {
  const { language, t } = useAppLanguage();
  const { width: viewportWidth } = useWindowDimensions();
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const [analystReport, setAnalystReport] = useState<AnalystReport | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<'simple' | 'analysis'>('simple');
  const [riskAmountText, setRiskAmountText] = useState('1000');

  useEffect(() => {
    setAnalystReport(null);
    setPrintError(null);
    setDetailMode('simple');
  }, [item?.ticker, language]);

  if (!item) return null;

  // Tre kolumner var hårdkodat, vilket gav enormt breda rutor på en dator.
  const statColumns = viewportWidth >= 1100 ? 6 : viewportWidth >= 820 ? 5 : viewportWidth >= 560 ? 4 : 3;
  const statWidth: DimensionValue = `${100 / statColumns}%`;
  const price = (value: number | null | undefined, decimals = 2) => formatPrice(value, item.currency, decimals);

  const formatMCap = (c: number | null) => { if (!c) return '-'; if (c>=1e12) return `${(c/1e12).toFixed(1)}T`; if (c>=1e9) return `${(c/1e9).toFixed(1)}B`; if (c>=1e6) return `${(c/1e6).toFixed(0)}M`; return '-'; };
  const formatVol = (v: number | null) => { if (!v) return '-'; if (v>=1e6) return `${(v/1e6).toFixed(1)}M`; if (v>=1e3) return `${(v/1e3).toFixed(0)}K`; return v.toString(); };

  const getExplanation = (label: string, stock: StockData) => {
    switch (label) {
      case 'Tjänar företaget pengar?':
        return stock.trailingPE != null && stock.trailingPE > 0
          ? t(`${stock.companyName} har positiv vinst de senaste tolv månaderna. P/E är ${stock.trailingPE.toFixed(1)}, men nivån måste jämföras med bolagets historik och sektor för att säga något om relativ värdering.`, `${stock.companyName} has reported positive earnings over the last twelve months. P/E is ${stock.trailingPE.toFixed(1)}, but it must be compared with company history and sector peers to assess relative valuation.`)
          : t('Positiv vinst eller ett användbart P/E-tal saknas. Det säger inte ensamt att bolaget går med förlust just nu; kontrollera senaste rapporten.', 'Positive earnings or a usable P/E figure is unavailable. This alone does not prove that the company is currently loss-making; check the latest report.');
      case 'Betalar utdelning?':
        return t(`Uppgiven direktavkastning är ${stock.dividendYield != null ? `${(stock.dividendYield * 100).toFixed(1)} %` : 'okänd'}. Den bygger på nuvarande kurs och senast kända utdelning; framtida utdelning kan höjas, sänkas eller ställas in.`, `The stated dividend yield is ${stock.dividendYield != null ? `${(stock.dividendYield * 100).toFixed(1)}%` : 'unknown'}. It is based on the current price and latest known dividend; future dividends may be raised, cut or cancelled.`);
      case 'Har aktien fallit kraftigt?':
        return t(`Ett kraftigt fall beskriver bara prisrörelsen. Orsaken kan vara tillfällig oro eller försämrade framtidsutsikter och behöver kontrolleras i rapporter och nyheter. ${stock.companyName} handlas nu på ${price(stock.currentPrice)}.`, `A sharp decline describes only the price move. It may reflect temporary concern or deteriorating prospects and should be checked against reports and news. ${stock.companyName} currently trades at ${price(stock.currentPrice)}.`);
      case 'Nära botten?':
        return t(`52-veckorslägsta var ${price(stock.fiftyTwoWeekLow)} och nuvarande pris är ${price(stock.currentPrice)}. En tidigare botten kan fungera som stöd, men ett nytt lägsta visar i stället fortsatt svaghet.`, `The 52-week low was ${price(stock.fiftyTwoWeekLow)} and the current price is ${price(stock.currentPrice)}. A previous low may act as support, while a new low instead signals continued weakness.`);
      case 'Översåld (RSI)?':
        return t(`RSI sammanfattar de senaste fjorton dagarnas momentum. Under 30 kallas ofta översålt, men en fallande aktie kan förbli där länge. ${stock.companyName} har RSI ${stock.rsi?.toFixed(1) || 'okänt'}.`, `RSI summarizes momentum over the last fourteen sessions. Below 30 is commonly called oversold, but a falling share can remain there for a long time. ${stock.companyName} has RSI ${stock.rsi?.toFixed(1) || 'unknown'}.`);
      case 'Under glidande medelvärde?':
        return t(`Genomsnittskursen de senaste 6 månaderna (SMA 125) ligger på ${price(stock.sma125)}. ${stock.companyName} ligger just nu ${stock.sma125 && stock.currentPrice && stock.currentPrice < stock.sma125 ? 'under detta snitt (svag kortsiktig trend)' : 'över detta snitt (stark trend)'}.`, `The six-month average price (SMA 125) is ${price(stock.sma125)}. ${stock.companyName} currently trades ${stock.sma125 && stock.currentPrice && stock.currentPrice < stock.sma125 ? 'below this average (weak trend)' : 'above this average (strong trend)'}.`);
      default:
        return '';
    }
  };

  const earningsDays = daysUntilEarnings(item.earningsTimestamp);
  const interpretation = interpretHealth(item, undefined, language);
  const valuationAssessment = assessValuation(item, language);

  const renderTradePlan = () => {
    const plan = item.tradePlan;
    if (!plan) return null;
    const riskAmount = parseNumericInput(riskAmountText);
    const shares = riskAmount != null && riskAmount > 0 ? positionSizeForRisk(plan, riskAmount) : null;
    // Under 1R betyder att man riskerar mer än man rimligen kan vinna till
    // närmaste motstånd. Det är inte ett säljråd, men värt att se innan köp.
    const rColor = plan.rMultiple >= 2 ? colors.green : plan.rMultiple >= 1 ? colors.yellow : colors.red;

    return (
      <View style={s.planCard}>
        <View style={s.planHeader}>
          <Text style={s.planTitle}>{t('Handelsplan', 'Trade plan')}</Text>
          <Text style={s.planSubtitle}>{t('Nivåer ur ATR och närliggande stöd/motstånd', 'Levels based on ATR and nearby support/resistance')}</Text>
        </View>

        <View style={s.planRow}>
          <View style={s.planCell}>
            <InfoTip term="stopLoss"><Text style={s.planLabel}>Stop loss</Text></InfoTip>
            <Text style={[s.planValue, { color: colors.red }]}>{price(plan.stopLoss)}</Text>
            <Text style={[s.planDelta, { color: colors.red }]}>-{formatPercent(plan.riskPercent)}</Text>
            <Text style={s.planBasis}>{plan.stopBasis}</Text>
          </View>
          <View style={s.planCell}>
            <InfoTip term="target"><Text style={s.planLabel}>{t('Riktkurs', 'Target')}</Text></InfoTip>
            <Text style={[s.planValue, { color: colors.green }]}>{price(plan.target)}</Text>
            <Text style={[s.planDelta, { color: colors.green }]}>+{formatPercent(plan.rewardPercent)}</Text>
            <Text style={s.planBasis}>{plan.targetBasis}</Text>
          </View>
          <View style={s.planCell}>
            <InfoTip term="rMultiple"><Text style={s.planLabel}>{t('Risk/vinst', 'Risk/reward')}</Text></InfoTip>
            <Text style={[s.planValue, { color: rColor }]}>{formatNumber(plan.rMultiple, 1)}R</Text>
            <Text style={s.planDelta}>{plan.rMultiple >= 1 ? t('Vinstpotential > risk', 'Reward potential > risk') : t('Risk > vinstpotential', 'Risk > reward potential')}</Text>
            <Text style={s.planBasis}>{t('Avstånd till riktkurs delat med avstånd till stop', 'Distance to target divided by distance to stop')}</Text>
          </View>
        </View>

        <View style={s.riskExample}>
          <Text style={s.riskExampleLabel}>{t('Räkneexempel: maximal förlust om stoppen träffas', 'Example: maximum loss if the stop is hit')}</Text>
          <View style={s.riskInputRow}>
            <TextInput
              style={s.riskInput}
              value={riskAmountText}
              onChangeText={setRiskAmountText}
              keyboardType="decimal-pad"
              inputMode="decimal"
              placeholder={t('t.ex. 1000', 'e.g. 1000')}
              placeholderTextColor={palette.textMuted}
              accessibilityLabel={t('Maximal förlust i räkneexemplet', 'Maximum loss in the example')}
            />
            <Text style={s.riskCurrency}>kr</Text>
          </View>
        </View>
        {shares != null && shares > 0 && riskAmount != null && (
          <Text style={s.planSizing}>
            {t('En maximal förlust på', 'A maximum loss of')} {formatNumber(riskAmount, 0)} kr {t('till stoppen motsvarar', 'at the stop corresponds to')} {formatNumber(shares, 0)} {t('aktier', 'shares')}
            {' '}({price(shares * item.currentPrice, 0)} {t('investerat', 'invested')}).
          </Text>
        )}
        <Text style={s.planDisclaimer}>
          {t('Nivåerna är mekaniska och bygger enbart på kurshistorik. De tar inte hänsyn till rapporter, nyheter eller likviditet.', 'The levels are mechanical and based only on price history. They do not account for reports, news or liquidity.')}
        </Text>
      </View>
    );
  };

  const renderQualityCard = () => {
    const quality = item.quality;
    if (!quality) return null;
    const color = quality.score >= 7 ? colors.green : quality.score >= 4 ? colors.yellow : colors.red;

    return (
      <View style={s.planCard}>
        <View style={s.qualityHeader}>
          <View style={s.planHeader}>
            <Text style={s.planTitle}>{t('Bolagets ekonomi', 'Company fundamentals')}</Text>
            <Text style={s.planSubtitle}>{t('Skild från betyget: betyget mäter kursen, det här mäter bolaget', 'Separate from the grade: the grade measures the share price, while this measures the business')}</Text>
          </View>
          <View style={[s.qualityBadge, { borderColor: color }]}>
            <Text style={[s.qualityScore, { color }]}>{quality.score.toFixed(0)}</Text>
            <Text style={[s.qualityLabel, { color }]}>{language === 'en' ? ({ Stark: 'Strong', Godtagbar: 'Acceptable', Svag: 'Weak', 'Otillräckligt underlag': 'Insufficient data' }[quality.label] ?? quality.label) : quality.label}</Text>
          </View>
        </View>

        {quality.components.map((component) => (
          <View key={component.id} style={s.qualityRow}>
            <Text style={s.qualityRowLabel}>{language === 'en' ? ({ debt: 'Leverage', profitability: 'Return on equity', margin: 'Operating margin', cashflow: 'Free cash flow', growth: 'Revenue growth' }[component.id] ?? component.label) : component.label}</Text>
            <Text style={s.qualityRowDetail}>{language === 'en' ? component.detail.replace('Underlag saknas', 'Data unavailable').replace('ansträngt', 'stretched').replace('lågt', 'low').replace('förlust', 'loss').replace('Negativt: bolaget förbrukar kassa', 'Negative: the company is consuming cash').replace(' av börsvärdet', ' of market cap').replace('Positivt', 'Positive').replace(' mot samma kvartal i fjol', ' versus the same quarter last year').replace('krympande', 'contracting').replace('Utgår: hög skuldsättning hör till affärsmodellen i den här sektorn', 'Excluded: high leverage is part of the business model in this sector') : component.detail}</Text>
            <Text style={[
              s.qualityRowPoints,
              component.points == null ? { color: colors.textMuted } : component.points === 2 ? { color: colors.green } : component.points === 1 ? { color: colors.yellow } : { color: colors.red },
            ]}>
              {component.points == null ? '–' : `${component.points}/2`}
            </Text>
          </View>
        ))}

        <Text style={s.planDisclaimer}>
          {t('Siffrorna kommer från senaste kvartalsrapporten och är alltså upp till tre månader gamla.', 'Figures come from the latest quarterly report and may therefore be up to three months old.')}
          {quality.debtNotComparable ? t(' Skuldsättningen utgår här, eftersom hög belåning hör till affärsmodellen i den här sektorn.', ' Debt is excluded here because high leverage is part of the business model in this sector.') : ''}
        </Text>
      </View>
    );
  };

  const renderHealthCard = () => {
    const hc = item.healthCheck;
    if (!hc) return null;
    const gc = gradeColors[hc.grade] || gradeColors.F;
    const riskCol = riskColors[hc.riskLevel] || '#FF9500';
    const momIcon = momentumIcons[hc.momentum] || '→';

    return (
      <View style={s.healthCard}>
        <View style={s.healthHeader}>
          <View style={[s.gradeBigBadge, { backgroundColor: gc.bg, borderColor: gc.border }]}>
            <Text style={[s.gradeBigText, { color: gc.text }]}>{hc.grade}</Text>
            <Text style={[s.gradeSubText, { color: gc.text }]}>{hc.gradeScore}/{MAX_GRADE_SCORE}</Text>
          </View>
          <View style={s.healthSummaryWrap}>
            <Text style={s.healthSummary}>{healthSummary(item, language)}</Text>
          </View>
        </View>

        <View style={s.pillRow}>
          <View style={[s.pill, { borderColor: riskCol }]}>
            <Text style={[s.pillLabel, { color: riskCol }]}>{t('Risk', 'Risk')}: {language === 'en' ? ({ Låg: 'Low', Medel: 'Medium', Hög: 'High' }[hc.riskLevel] ?? hc.riskLevel) : hc.riskLevel}</Text>
          </View>
          <View style={[s.pill, { borderColor: '#8E8E93' }]}>
            <Text style={s.pillLabel}>{momIcon} Momentum: {language === 'en' ? ({ Uppåt: 'Up', Nedåt: 'Down', Sidledes: 'Sideways' }[hc.momentum] ?? hc.momentum) : hc.momentum}</Text>
          </View>
        </View>

        <View style={s.checklist}>
          <Text style={s.checklistTitle}>{t('Rekylkriterier — tryck på en rad för förklaring', 'Pullback criteria — select a row for an explanation')}</Text>
          {hc.checklist.map((ci, i) => {
            const checkKey = `${item.ticker}-${i}`;
            const isOpen = expandedCheck === checkKey;
            const explanation = getExplanation(ci.label, item);
            return (
              <HintedTouchable key={i} activeOpacity={0.7} onPress={() => setExpandedCheck(isOpen ? null : checkKey)} accessibilityLabel={`${isOpen ? 'Dölj' : 'Visa'} förklaring: ${ci.label}`} hint={explanation || `${isOpen ? 'Döljer' : 'Visar'} hur kontrollpunkten ${ci.label.toLowerCase()} påverkar analysen.`}>
                <View style={[s.checkRow, isOpen && { backgroundColor: palette.accentBg, borderRadius: 8, padding: 8, marginHorizontal: -8 }]}>
                  <Text style={s.checkIcon}>{ci.passed ? '✅' : '❌'}</Text>
                  <Text style={[s.checkLabel, !ci.passed && { color: palette.textMuted }]}>{healthLabel(ci.label, language)}</Text>
                  <Text style={[s.checkDetail, ci.passed ? { color: colors.green } : { color: palette.textMuted }]}>{healthDetail(ci.detail, language)}</Text>
                </View>
                {isOpen && explanation ? (
                  <View style={s.checkExplain}>
                    <Text style={s.checkExplainText}>{explanation}</Text>
                  </View>
                ) : null}
              </HintedTouchable>
            );
          })}
          <Text style={[s.checklistTitle, { marginTop: 18 }]}>{t('Tekniska bonuspoäng', 'Technical bonus points')}</Text>
          {hc.bonuses.map((bonus, index) => (
            <View key={`bonus-${index}`} style={s.checkRow}>
              <Text style={s.checkIcon}>{bonus.passed ? '✅' : '❌'}</Text>
              <Text style={[s.checkLabel, !bonus.passed && { color: palette.textMuted }]}>{healthLabel(bonus.label, language)}</Text>
              <Text style={[s.checkDetail, bonus.passed ? { color: colors.green } : { color: palette.textMuted }]}>{healthDetail(bonus.detail, language)}</Text>
            </View>
          ))}

          <View style={s.checkResult}>
            <Text style={s.checkResultText}>
              {hc.gradeScore}/{MAX_GRADE_SCORE} {t('poäng → Rekylläge', 'points → Pullback grade')} {hc.grade}
            </Text>
          </View>

          {interpretation && (
            <View style={s.interpretation}>
              <Text style={s.interpretationScore}>{interpretation.scoreExplanation}</Text>

              {interpretation.qualityVerdict && (
                <Text style={[s.interpretationScore, { marginTop: 10 }]}>{interpretation.qualityVerdict}</Text>
              )}

              <View style={s.interpretationBlock}>
                <Text style={s.interpretationLabel}>{t('Om du äger aktien', 'If you own the stock')}</Text>
                <Text style={s.interpretationText}>{interpretation.ifYouOwn}</Text>
              </View>

              <View style={s.interpretationBlock}>
                <Text style={s.interpretationLabel}>{t('Om du överväger att köpa', 'If you are considering buying')}</Text>
                <Text style={s.interpretationText}>{interpretation.ifYouConsiderBuying}</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderTrendAnalysis = () => {
    const trend = getTrendInsight(item, language);
    if (!trend) return null;
    const color = trend.color === 'positive' ? colors.green : trend.color === 'negative' ? colors.red : colors.yellow;

    return (
      <View style={[s.trendBox, { borderLeftColor: color }]}>
        <View style={s.trendHeader}>
          <Text style={s.trendIcon}>{trend.icon}</Text>
          <Text style={[s.trendTitle, { color }]}>{trend.title}</Text>
        </View>
        <Text style={s.trendText}>{trend.text}</Text>
      </View>
    );
  };

  const dayChange = item.regularMarketChangePercent;
  const dayColor = dayChange != null && dayChange >= 0 ? colors.green : colors.red;
  const bullPoints = getBullPoints(item, language);
  const bearPoints = getBearPoints(item, language);
  const printReport = () => {
    setPrintError(openPrintReport(item, analystReport, language) ? null : t('Kunde inte öppna utskriftsdialogen. Tillåt popup-fönster för den här sidan och försök igen.', 'Could not open the print dialog. Allow pop-up windows for this site and try again.'));
  };

  return (
    <Modal visible={!!item} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.safeArea}>
        <View style={s.header}>
          <HintedTouchable style={s.headerBtn} onPress={onClose} accessibilityLabel={t('Tillbaka till screenern', 'Back to screener')} hint={t('Stänger detaljvyn och återgår till aktietabellen.', 'Closes the detail view and returns to the stock table.')}>
            <Text style={s.headerBtnText}>←</Text>
          </HintedTouchable>
          <View style={s.headerTitleWrap}>
            <Text style={s.headerTicker}>{item.ticker.replace('.ST', '')}</Text>
            <Text style={s.headerName} numberOfLines={1}>{item.companyName}</Text>
          </View>
          <View style={s.headerActions}>
            <HintedTouchable style={s.printButton} onPress={printReport} accessibilityLabel={t('Skriv ut eller spara som PDF', 'Print or save as PDF')} hint={t('Öppnar en utskriftsvänlig aktierapport. Välj Spara som PDF i webbläsarens utskriftsdialog.', 'Opens a print-friendly stock report. Select Save as PDF in your browser’s print dialog.')}>
              <Text style={s.printButtonText}>PDF</Text>
            </HintedTouchable>
            <HintedTouchable
              style={s.headerBtn}
              onPress={onToggleWatchlist}
              accessibilityLabel={isWatchlisted
                ? `${t('Ta bort', 'Remove')} ${item.ticker.replace('.ST', '')} ${t('från favoriter', 'from favourites')}`
                : `${t('Lägg till', 'Add')} ${item.ticker.replace('.ST', '')} ${t('i favoriter', 'to favourites')}`}
              hint={isWatchlisted
                ? t('Tar bort aktien från din personliga favoritlista.', 'Removes the share from your personal favourites.')
                : t('Lägger till aktien i din personliga favoritlista.', 'Adds the share to your personal favourites.')}
            >
              <Text style={[s.starIcon, isWatchlisted && s.starIconActive]}>
                {isWatchlisted ? '★' : '☆'}
              </Text>
            </HintedTouchable>
          </View>
        </View>

        <ScrollView style={s.scrollView} contentContainerStyle={s.scrollContent}>
          {/* Price Section */}
          <View style={s.priceSection}>
            <View>
              <Text style={s.priceText}>{price(item.currentPrice)}</Text>
              <Text style={[s.changeText, { color: dayColor }]}>
                {dayChange != null && dayChange >= 0 ? '▲' : '▼'} {dayChange != null ? Math.abs(dayChange).toFixed(2) : '-'}%
              </Text>
            </View>
            {item.healthCheck && (
              <View style={[s.gradeBadge, { backgroundColor: gradeColors[item.healthCheck.grade]?.bg || gradeColors.F.bg, borderColor: gradeColors[item.healthCheck.grade]?.border || gradeColors.F.border }]}>
                <Text style={[s.gradeText, { color: gradeColors[item.healthCheck.grade]?.text || gradeColors.F.text }]}>{item.healthCheck.grade}</Text>
              </View>
            )}
          </View>
          {printError && <Text style={s.printError}>{printError}</Text>}

          <View style={s.modeSwitch} accessibilityRole="tablist">
            <HintedTouchable
              style={[s.modeButton, detailMode === 'simple' && s.modeButtonActive]}
              onPress={() => setDetailMode('simple')}
              accessibilityRole="tab"
              accessibilityState={{ selected: detailMode === 'simple' }}
              accessibilityLabel={t('Visa enkel aktieöversikt', 'Show simple stock overview')}
              hint={t('Visar de viktigaste slutsatserna med mindre fackspråk.', 'Shows the most important conclusions using less technical language.')}
            >
              <Text style={[s.modeButtonText, detailMode === 'simple' && s.modeButtonTextActive]}>{t('Enkel vy', 'Simple view')}</Text>
            </HintedTouchable>
            <HintedTouchable
              style={[s.modeButton, detailMode === 'analysis' && s.modeButtonActive]}
              onPress={() => setDetailMode('analysis')}
              accessibilityRole="tab"
              accessibilityState={{ selected: detailMode === 'analysis' }}
              accessibilityLabel={t('Visa fullständig analysvy', 'Show full analysis view')}
              hint={t('Visar samtliga nyckeltal, handelsplan, rapportdata och rekyllogik.', 'Shows all metrics, the trade plan, report data and pullback logic.')}
            >
              <Text style={[s.modeButtonText, detailMode === 'analysis' && s.modeButtonTextActive]}>{t('Analysvy', 'Analysis view')}</Text>
            </HintedTouchable>
          </View>

          <NoviceOverview item={item} />

          {detailMode === 'simple' && <MarketChart item={item} />}

          {detailMode === 'analysis' && (
            <>
              <View style={s.sectionHeading}>
                <Text style={s.sectionTitle}>{t('Marknadsdata', 'Market data')}</Text>
                <Text style={s.sectionIntro}>{t('Nyckeltalen beskriver pris, värdering och historisk risk. Tryck eller håll över ett värde för en full förklaring.', 'The metrics describe price, valuation and historical risk. Select or hover over a value for a full explanation.')}</Text>
              </View>
              <View style={s.statsGrid}>
                <DetailStat width={statWidth} label={t('Öppning', 'Open')} term="open" value={price(item.regularMarketOpen)} />
                <DetailStat width={statWidth} label={t('Högsta', 'High')} term="dayHigh" value={price(item.regularMarketDayHigh)} />
                <DetailStat width={statWidth} label={t('Lägsta', 'Low')} term="dayLow" value={price(item.regularMarketDayLow)} />
                <DetailStat width={statWidth} label={t('Volym', 'Volume')} term="volume" value={formatVol(item.latestVolume)} />
                <DetailStat width={statWidth} label="P/E" term="pe" value={item.trailingPE?.toFixed(1) || '-'} />
                <DetailStat width={statWidth} label={t('Börsvärde', 'Market cap')} term="marketCap" value={formatMCap(item.marketCap)} />
                <DetailStat width={statWidth} label={t('52v Hög', '52w High')} term="fiftyTwoWeekHigh" value={price(item.fiftyTwoWeekHigh)} />
                <DetailStat width={statWidth} label={t('52v Låg', '52w Low')} term="fiftyTwoWeekLow" value={price(item.fiftyTwoWeekLow)} />
                <DetailStat width={statWidth} label={t('Snittvolym', 'Avg volume')} term="avgVolume" value={formatVol(item.avgVolume20)} />
                <DetailStat width={statWidth} label={t('Direktavk.', 'Dividend yield')} term="dividendYield" value={item.dividendYield != null ? `${(item.dividendYield * 100).toFixed(1)}%` : '-'} />
                <DetailStat width={statWidth} label="Beta" term="beta" value={item.beta?.toFixed(2) || '-'} />
                <DetailStat width={statWidth} label="VPA" term="eps" value={price(item.epsTrailingTwelveMonths)} />
                <DetailStat width={statWidth} label={t('Volatilitet', 'Volatility')} term="volatility" value={item.volatility != null ? `${item.volatility.toFixed(1)}%` : '-'} />
                <DetailStat width={statWidth} label="Max drawdown" term="drawdown" value={item.maxDrawdown != null ? `-${item.maxDrawdown.toFixed(1)}%` : '-'} valueColor={colors.red} />
                <DetailStat width={statWidth} label={t('Mot index 3m', 'Vs index 3m')} term="relativeStrength" value={formatSignedPercent(item.relativeStrength63)} valueColor={item.relativeStrength63 == null ? undefined : item.relativeStrength63 >= 0 ? colors.green : colors.red} />
                <DetailStat width={statWidth} label="ATR (14)" term="atr" value={item.atr != null ? `${formatNumber(item.atr, 2)} (${formatNumber((item.atr / item.currentPrice) * 100, 1)}%)` : '-'} />
                <DetailStat width={statWidth} label="P/B" term="priceToBook" value={item.priceToBook != null ? formatNumber(item.priceToBook, 2) : '-'} />
                <DetailStat width={statWidth} label={t('Rapport', 'Earnings')} term="earnings" value={earningsDays == null ? '-' : earningsDays === 0 ? t('I dag', 'Today') : earningsDays < 0 ? t('Nyligen', 'Recently') : `${t('Om', 'In')} ${earningsDays} d`} valueColor={earningsDays != null && earningsDays >= 0 && earningsDays <= 7 ? colors.yellow : undefined} />
              </View>
              <View style={s.valuationNote}>
                <Text style={s.valuationNoteTitle}>{t('Relativ värdering', 'Relative valuation')}: {valuationAssessment.label}</Text>
                <Text style={s.valuationNoteText}>{valuationAssessment.summary} {valuationAssessment.evidence.join(' · ')}</Text>
              </View>
              {renderTradePlan()}
            </>
          )}

          <AnalystBrief item={item} onReportGenerated={setAnalystReport} />

          {detailMode === 'analysis' && (
            <>
              <MarketChart item={item} />
              <View style={s.sectionHeading}>
                <Text style={s.sectionTitle}>{t('Faktorer i modellen', 'Model factors')}</Text>
                <Text style={s.sectionIntro}>{t('Listorna visar vad aktuell data talar för och emot. De är observationer, inte en prognos.', 'The lists show what current data supports and contradicts. They are observations, not a forecast.')}</Text>
              </View>
              <View style={s.bullBearContainer}>
                <View style={[s.bullBearColumn, s.bullColumn]}>
                  <Text style={s.bullTitle}>{t('Styrkor', 'Strengths')}</Text>
                  {bullPoints.length > 0 ? bullPoints.map((p, i) => <Text key={i} style={s.bullBearItem}>• {p}</Text>) : <Text style={s.bullBearEmpty}>{t('Inga tydliga styrkor just nu', 'No clear strengths at present')}</Text>}
                </View>
                <View style={[s.bullBearColumn, s.bearColumn]}>
                  <Text style={s.bearTitle}>{t('Svagheter', 'Weaknesses')}</Text>
                  {bearPoints.length > 0 ? bearPoints.map((p, i) => <Text key={i} style={s.bullBearItem}>• {p}</Text>) : <Text style={s.bullBearEmpty}>{t('Inga tydliga svagheter just nu', 'No clear weaknesses at present')}</Text>}
                </View>
              </View>
              {renderQualityCard()}
              <EarningsHistory item={item} />
              {renderTrendAnalysis()}
              {renderHealthCard()}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const s = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  headerBtn: {
    padding: 8,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  printButton: { borderWidth: 1, borderColor: '#3b82f6', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 5 },
  printButtonText: { color: palette.accent, fontSize: 10, fontWeight: '800' },
  headerBtnText: {
    color: palette.accent,
    fontSize: 24,
    fontWeight: '300',
  },
  headerTitleWrap: {
    alignItems: 'center',
    flex: 1,
  },
  headerTicker: {
    color: colors.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerName: {
    color: colors.textMuted,
    fontSize: 12,
  },
  starIcon: {
    fontSize: 24,
    color: colors.textMuted,
  },
  starIconActive: {
    color: colors.yellow,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    padding: 16,
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  modeSwitch: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    padding: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  modeButton: {
    minHeight: 34,
    minWidth: 92,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  modeButtonActive: { backgroundColor: palette.accentBg },
  modeButtonText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  modeButtonTextActive: { color: palette.accent },
  sectionHeading: { marginBottom: 10 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  sectionIntro: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4, maxWidth: 760 },
  printError: { color: colors.red, fontSize: 12, lineHeight: 18, marginTop: -14, marginBottom: 16 },
  priceText: {
    color: colors.text,
    fontSize: 32,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  changeText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  gradeBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
    marginBottom: 24,
  },
  statBox: {
    width: '33.33%',
    padding: 8,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  statVal: {
    color: colors.text,
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: '500',
  },
  planCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 24,
  },
  planHeader: { marginBottom: 14 },
  planTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  planSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  planRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  planCell: { flexGrow: 1, flexBasis: 150, minWidth: 130 },
  planLabel: { color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  planValue: { fontSize: 19, fontWeight: '700', fontFamily: 'monospace' },
  planDelta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  planBasis: { color: colors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 4 },
  riskExample: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  riskExampleLabel: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginBottom: 7 },
  riskInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 240 },
  riskInput: {
    flex: 1,
    minHeight: 40,
    color: colors.text,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 11,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  riskCurrency: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  planSizing: { color: colors.text, fontSize: 13, lineHeight: 19, marginTop: 16 },
  planDisclaimer: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 10 },
  valuationNote: {
    marginTop: -10,
    marginBottom: 24,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: palette.accent,
    backgroundColor: palette.accentBg,
  },
  valuationNoteTitle: { color: palette.accent, fontSize: 12, fontWeight: '800', marginBottom: 4 },
  valuationNoteText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  bullBearContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  bullBearColumn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
  },
  bullColumn: {
    borderLeftColor: colors.green,
  },
  bearColumn: {
    borderLeftColor: colors.red,
  },
  bullTitle: {
    color: colors.green,
    fontWeight: 'bold',
    marginBottom: 12,
    fontSize: 16,
  },
  bearTitle: {
    color: colors.red,
    fontWeight: 'bold',
    marginBottom: 12,
    fontSize: 16,
  },
  bullBearItem: {
    color: colors.text,
    fontSize: 13,
    marginBottom: 8,
    lineHeight: 18,
  },
  bullBearEmpty: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  trendBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
  },
  trendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  trendIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  trendTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  trendText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  healthCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  healthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  gradeBigBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  gradeBigText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  gradeSubText: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: -2,
  },
  healthSummaryWrap: {
    flex: 1,
  },
  healthSummary: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  pillRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 10,
    backgroundColor: palette.surfaceAlt,
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  checklist: {
    marginTop: 8,
  },
  checklistTitle: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkIcon: {
    fontSize: 14,
    marginRight: 10,
    width: 20,
    textAlign: 'center',
  },
  checkLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  checkDetail: {
    fontSize: 14,
    fontWeight: '600',
  },
  checkExplain: {
    backgroundColor: palette.accentBg,
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 12,
    marginLeft: 30,
    borderLeftWidth: 2,
    borderLeftColor: palette.accent,
  },
  checkExplainText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  checkResult: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  qualityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  qualityBadge: { minWidth: 70, alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  qualityScore: { fontSize: 20, fontWeight: '700', fontFamily: 'monospace' },
  qualityLabel: { fontSize: 10, fontWeight: '700', marginTop: 1 },
  qualityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  qualityRowLabel: { color: colors.text, fontSize: 13, flex: 1.1 },
  qualityRowDetail: { color: colors.textMuted, fontSize: 11, flex: 1.3, textAlign: 'right' },
  qualityRowPoints: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'], width: 34, textAlign: 'right' },
  interpretation: { marginTop: 18, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 },
  interpretationScore: { color: colors.text, fontSize: 13, lineHeight: 19 },
  interpretationBlock: { marginTop: 14, borderLeftWidth: 2, borderLeftColor: '#3b82f6', paddingLeft: 12 },
  interpretationLabel: { color: palette.accent, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  interpretationText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  checkResultText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
});
