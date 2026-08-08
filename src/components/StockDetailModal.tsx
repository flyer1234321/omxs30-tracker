import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  ScrollView,
  SafeAreaView,
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
import type { GlossaryKey } from '@/lib/glossary';

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

/** Hur mycket man är beredd att förlora om stoppen träffas. */
const DEFAULT_RISK_AMOUNT = 1000;

export const StockDetailModal: React.FC<StockDetailModalProps> = ({ item, onClose, isWatchlisted, onToggleWatchlist }) => {
  const { width: viewportWidth } = useWindowDimensions();
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const [analystReport, setAnalystReport] = useState<AnalystReport | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);

  useEffect(() => {
    setAnalystReport(null);
    setPrintError(null);
  }, [item?.ticker]);

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
        return `P/E-talet visar hur mycket du betalar för 1 kr av bolagets vinst. Ett "normalt" värde ligger runt 15. ${stock.companyName} har just nu ett P/E på ${stock.trailingPE?.toFixed(1) || 'okänt'}, vilket innebär att det är ${stock.trailingPE ? (stock.trailingPE < 15 ? 'relativt lågt värderat i förhållande till vinsten' : 'ganska högt värderat') : 'okänt'}.`;
      case 'Betalar utdelning?':
        return `Direktavkastningen visar hur stor del av aktiekursen du får tillbaka varje år i utdelning. ${stock.companyName} delar ut ${(stock.dividendYield ? (stock.dividendYield * 100).toFixed(1) : '0')}% varje år. Stabil utdelning över tid tyder på ett hälsosamt bolag.`;
      case 'Har aktien fallit kraftigt?':
        return `När en aktie faller snabbt kan det vara tillfällig panik (bra köpläge) eller ett genuint problem (varning). ${stock.companyName} handlas just nu på ${price(stock.currentPrice)}.`;
      case 'Nära botten?':
        return `Lägsta priset för ${stock.ticker.replace('.ST','')} de senaste 52 veckorna var ${price(stock.fiftyTwoWeekLow)} (Nuvarande pris: ${price(stock.currentPrice)}). Om kursen vänder upp från botten kan det vara ett starkt stödområde.`;
      case 'Översåld (RSI)?':
        return `RSI mäter om en aktie har sålts för aggressivt. Under 30 är "översålt" och över 70 "överköpt". ${stock.companyName} har ett RSI på ${stock.rsi?.toFixed(1) || 'okänt'}. ${stock.rsi && stock.rsi < 35 ? 'Den är utsträckt på nedsidan, som ett gummiband som kan snärta tillbaka.' : 'Den befinner sig i en normal/stark zon.'}`;
      case 'Under glidande medelvärde?':
        return `Genomsnittskursen de senaste 6 månaderna (SMA 125) ligger på ${price(stock.sma125)}. ${stock.companyName} ligger just nu ${stock.sma125 && stock.currentPrice && stock.currentPrice < stock.sma125 ? 'under detta snitt (svag kortsiktig trend)' : 'över detta snitt (stark trend)'}.`;
      default:
        return '';
    }
  };

  const earningsDays = daysUntilEarnings(item.earningsTimestamp);
  const interpretation = interpretHealth(item);

  const renderTradePlan = () => {
    const plan = item.tradePlan;
    if (!plan) return null;
    const shares = positionSizeForRisk(plan, DEFAULT_RISK_AMOUNT);
    // Under 1R betyder att man riskerar mer än man rimligen kan vinna till
    // närmaste motstånd. Det är inte ett säljråd, men värt att se innan köp.
    const rColor = plan.rMultiple >= 2 ? colors.green : plan.rMultiple >= 1 ? colors.yellow : colors.red;

    return (
      <View style={s.planCard}>
        <View style={s.planHeader}>
          <Text style={s.planTitle}>Handelsplan</Text>
          <Text style={s.planSubtitle}>Nivåer ur ATR och närliggande stöd/motstånd</Text>
        </View>

        <View style={s.planRow}>
          <View style={s.planCell}>
            <InfoTip term="stopLoss"><Text style={s.planLabel}>Stop loss</Text></InfoTip>
            <Text style={[s.planValue, { color: colors.red }]}>{price(plan.stopLoss)}</Text>
            <Text style={[s.planDelta, { color: colors.red }]}>-{formatPercent(plan.riskPercent)}</Text>
            <Text style={s.planBasis}>{plan.stopBasis}</Text>
          </View>
          <View style={s.planCell}>
            <InfoTip term="target"><Text style={s.planLabel}>Riktkurs</Text></InfoTip>
            <Text style={[s.planValue, { color: colors.green }]}>{price(plan.target)}</Text>
            <Text style={[s.planDelta, { color: colors.green }]}>+{formatPercent(plan.rewardPercent)}</Text>
            <Text style={s.planBasis}>{plan.targetBasis}</Text>
          </View>
          <View style={s.planCell}>
            <InfoTip term="rMultiple"><Text style={s.planLabel}>Risk/vinst</Text></InfoTip>
            <Text style={[s.planValue, { color: rColor }]}>{formatNumber(plan.rMultiple, 1)}R</Text>
            <Text style={s.planDelta}>{plan.rMultiple >= 1 ? 'Vinstpotential > risk' : 'Risk > vinstpotential'}</Text>
            <Text style={s.planBasis}>Avstånd till riktkurs delat med avstånd till stop</Text>
          </View>
        </View>

        {shares != null && shares > 0 && (
          <Text style={s.planSizing}>
            Vill du riskera {formatNumber(DEFAULT_RISK_AMOUNT, 0)} kr till stoppen motsvarar det {formatNumber(shares, 0)} aktier
            {' '}({price(shares * item.currentPrice, 0)} investerat).
          </Text>
        )}
        <Text style={s.planDisclaimer}>
          Nivåerna är mekaniska och bygger enbart på kurshistorik. De tar inte hänsyn till rapporter, nyheter eller likviditet.
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
            <Text style={s.planTitle}>Bolagets ekonomi</Text>
            <Text style={s.planSubtitle}>Skild från betyget: betyget mäter kursen, det här mäter bolaget</Text>
          </View>
          <View style={[s.qualityBadge, { borderColor: color }]}>
            <Text style={[s.qualityScore, { color }]}>{quality.score.toFixed(0)}</Text>
            <Text style={[s.qualityLabel, { color }]}>{quality.label}</Text>
          </View>
        </View>

        {quality.components.map((component) => (
          <View key={component.id} style={s.qualityRow}>
            <Text style={s.qualityRowLabel}>{component.label}</Text>
            <Text style={s.qualityRowDetail}>{component.detail}</Text>
            <Text style={[
              s.qualityRowPoints,
              component.points == null ? { color: colors.textMuted } : component.points === 2 ? { color: colors.green } : component.points === 1 ? { color: colors.yellow } : { color: colors.red },
            ]}>
              {component.points == null ? '–' : `${component.points}/2`}
            </Text>
          </View>
        ))}

        <Text style={s.planDisclaimer}>
          Siffrorna kommer från senaste kvartalsrapporten och är alltså upp till tre månader gamla.
          {quality.debtNotComparable ? ' Skuldsättningen utgår här, eftersom hög belåning hör till affärsmodellen i den här sektorn.' : ''}
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
            <Text style={s.healthSummary}>{hc.summary}</Text>
          </View>
        </View>

        <View style={s.pillRow}>
          <View style={[s.pill, { borderColor: riskCol }]}>
            <Text style={[s.pillLabel, { color: riskCol }]}>Risk: {hc.riskLevel}</Text>
          </View>
          <View style={[s.pill, { borderColor: '#8E8E93' }]}>
            <Text style={s.pillLabel}>{momIcon} Momentum: {hc.momentum}</Text>
          </View>
        </View>

        <View style={s.checklist}>
          <Text style={s.checklistTitle}>Rekylkriterier — tryck på en rad för förklaring</Text>
          {hc.checklist.map((ci, i) => {
            const checkKey = `${item.ticker}-${i}`;
            const isOpen = expandedCheck === checkKey;
            const explanation = getExplanation(ci.label, item);
            return (
              <HintedTouchable key={i} activeOpacity={0.7} onPress={() => setExpandedCheck(isOpen ? null : checkKey)} accessibilityLabel={`${isOpen ? 'Dölj' : 'Visa'} förklaring: ${ci.label}`} hint={explanation || `${isOpen ? 'Döljer' : 'Visar'} hur kontrollpunkten ${ci.label.toLowerCase()} påverkar analysen.`}>
                <View style={[s.checkRow, isOpen && { backgroundColor: '#1a2332', borderRadius: 8, padding: 8, marginHorizontal: -8 }]}>
                  <Text style={s.checkIcon}>{ci.passed ? '✅' : '❌'}</Text>
                  <Text style={[s.checkLabel, !ci.passed && { color: '#666' }]}>{ci.label}</Text>
                  <Text style={[s.checkDetail, ci.passed ? { color: '#34C759' } : { color: '#666' }]}>{ci.detail}</Text>
                </View>
                {isOpen && explanation ? (
                  <View style={s.checkExplain}>
                    <Text style={s.checkExplainText}>{explanation}</Text>
                  </View>
                ) : null}
              </HintedTouchable>
            );
          })}
          <Text style={[s.checklistTitle, { marginTop: 18 }]}>Tekniska bonuspoäng</Text>
          {hc.bonuses.map((bonus, index) => (
            <View key={`bonus-${index}`} style={s.checkRow}>
              <Text style={s.checkIcon}>{bonus.passed ? '✅' : '❌'}</Text>
              <Text style={[s.checkLabel, !bonus.passed && { color: '#666' }]}>{bonus.label}</Text>
              <Text style={[s.checkDetail, bonus.passed ? { color: colors.green } : { color: '#666' }]}>{bonus.detail}</Text>
            </View>
          ))}

          <View style={s.checkResult}>
            <Text style={s.checkResultText}>
              {hc.gradeScore}/{MAX_GRADE_SCORE} poäng → Rekylläge {hc.grade}
            </Text>
          </View>

          {interpretation && (
            <View style={s.interpretation}>
              <Text style={s.interpretationScore}>{interpretation.scoreExplanation}</Text>

              {interpretation.qualityVerdict && (
                <Text style={[s.interpretationScore, { marginTop: 10 }]}>{interpretation.qualityVerdict}</Text>
              )}

              <View style={s.interpretationBlock}>
                <Text style={s.interpretationLabel}>Om du äger aktien</Text>
                <Text style={s.interpretationText}>{interpretation.ifYouOwn}</Text>
              </View>

              <View style={s.interpretationBlock}>
                <Text style={s.interpretationLabel}>Om du överväger att köpa</Text>
                <Text style={s.interpretationText}>{interpretation.ifYouConsiderBuying}</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderTrendAnalysis = () => {
    const trend = getTrendInsight(item);
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
  const bullPoints = getBullPoints(item);
  const bearPoints = getBearPoints(item);
  const printReport = () => {
    setPrintError(openPrintReport(item, analystReport) ? null : 'Kunde inte öppna utskriftsdialogen. Tillåt popup-fönster för den här sidan och försök igen.');
  };

  return (
    <Modal visible={!!item} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.safeArea}>
        <View style={s.header}>
          <HintedTouchable style={s.headerBtn} onPress={onClose} accessibilityLabel="Tillbaka till screenern" hint="Stänger detaljvyn och återgår till aktietabellen.">
            <Text style={s.headerBtnText}>←</Text>
          </HintedTouchable>
          <View style={s.headerTitleWrap}>
            <Text style={s.headerTicker}>{item.ticker.replace('.ST', '')}</Text>
            <Text style={s.headerName} numberOfLines={1}>{item.companyName}</Text>
          </View>
          <View style={s.headerActions}>
            <HintedTouchable style={s.printButton} onPress={printReport} accessibilityLabel="Skriv ut eller spara som PDF" hint="Öppnar en utskriftsvänlig aktierapport. Välj Spara som PDF i webbläsarens utskriftsdialog.">
              <Text style={s.printButtonText}>PDF</Text>
            </HintedTouchable>
            <HintedTouchable style={s.headerBtn} onPress={onToggleWatchlist} accessibilityLabel={isWatchlisted ? `Ta bort ${item.ticker.replace('.ST', '')} från favoriter` : `Lägg till ${item.ticker.replace('.ST', '')} i favoriter`} hint={isWatchlisted ? 'Tar bort aktien från din personliga favoritlista.' : 'Lägger till aktien i din personliga favoritlista.'}>
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

          {/* Market data mirrors the compact quote block in Apple Stocks. */}
          <View style={s.statsGrid}>
            <DetailStat width={statWidth} label="Öppning" term="open" value={price(item.regularMarketOpen)} />
            <DetailStat width={statWidth} label="Högsta" term="dayHigh" value={price(item.regularMarketDayHigh)} />
            <DetailStat width={statWidth} label="Lägsta" term="dayLow" value={price(item.regularMarketDayLow)} />
            <DetailStat width={statWidth} label="Volym" term="volume" value={formatVol(item.latestVolume)} />
            <DetailStat width={statWidth} label="P/E" term="pe" value={item.trailingPE?.toFixed(1) || '-'} />
            <DetailStat width={statWidth} label="Börsvärde" term="marketCap" value={formatMCap(item.marketCap)} />
            <DetailStat width={statWidth} label="52v Hög" term="fiftyTwoWeekHigh" value={price(item.fiftyTwoWeekHigh)} />
            <DetailStat width={statWidth} label="52v Låg" term="fiftyTwoWeekLow" value={price(item.fiftyTwoWeekLow)} />
            <DetailStat width={statWidth} label="Snittvolym" term="avgVolume" value={formatVol(item.avgVolume20)} />
            <DetailStat width={statWidth} label="Direktavk." term="dividendYield" value={item.dividendYield != null ? `${(item.dividendYield * 100).toFixed(1)}%` : '-'} />
            <DetailStat width={statWidth} label="Beta" term="beta" value={item.beta?.toFixed(2) || '-'} />
            <DetailStat width={statWidth} label="VPA" term="eps" value={price(item.epsTrailingTwelveMonths)} />
            <DetailStat width={statWidth} label="Volatilitet" term="volatility" value={item.volatility != null ? `${item.volatility.toFixed(1)}%` : '-'} />
            <DetailStat width={statWidth} label="Max drawdown" term="drawdown" value={item.maxDrawdown != null ? `-${item.maxDrawdown.toFixed(1)}%` : '-'} valueColor={colors.red} />
            <DetailStat
              width={statWidth}
              label="Mot index 3m"
              term="relativeStrength"
              value={formatSignedPercent(item.relativeStrength63)}
              valueColor={item.relativeStrength63 == null ? undefined : item.relativeStrength63 >= 0 ? colors.green : colors.red}
            />
            <DetailStat
              width={statWidth}
              label="ATR (14)" term="atr"
              value={item.atr != null ? `${formatNumber(item.atr, 2)} (${formatNumber((item.atr / item.currentPrice) * 100, 1)}%)` : '-'}
            />
            <DetailStat width={statWidth} label="P/B" term="priceToBook" value={item.priceToBook != null ? formatNumber(item.priceToBook, 2) : '-'} />
            <DetailStat
              width={statWidth}
              label="Rapport"
              term="earnings"
              value={earningsDays == null ? '-' : earningsDays === 0 ? 'I dag' : earningsDays < 0 ? 'Nyligen' : `Om ${earningsDays} d`}
              valueColor={earningsDays != null && earningsDays >= 0 && earningsDays <= 7 ? colors.yellow : undefined}
            />
          </View>

          {renderTradePlan()}

          {/* Chart */}
          <AnalystBrief item={item} onReportGenerated={setAnalystReport} />

          <MarketChart item={item} />

          {/* Bull vs Bear */}
          <View style={s.bullBearContainer}>
            <View style={[s.bullBearColumn, s.bullColumn]}>
              <Text style={s.bullTitle}>Styrkor 📈</Text>
              {bullPoints.length > 0 ? bullPoints.map((p, i) => (
                <Text key={i} style={s.bullBearItem}>• {p}</Text>
              )) : <Text style={s.bullBearEmpty}>Inga tydliga styrkor just nu</Text>}
            </View>
            <View style={[s.bullBearColumn, s.bearColumn]}>
              <Text style={s.bearTitle}>Svagheter 📉</Text>
              {bearPoints.length > 0 ? bearPoints.map((p, i) => (
                <Text key={i} style={s.bullBearItem}>• {p}</Text>
              )) : <Text style={s.bullBearEmpty}>Inga tydliga svagheter just nu</Text>}
            </View>
          </View>

          {renderQualityCard()}

          <EarningsHistory item={item} />

          {/* Trend Analysis */}
          {renderTrendAnalysis()}

          {/* Health Check */}
          {renderHealthCard()}

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
  printButtonText: { color: '#93c5fd', fontSize: 10, fontWeight: '800' },
  headerBtnText: {
    color: '#007AFF',
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
  planSizing: { color: '#EBEBF5', fontSize: 13, lineHeight: 19, marginTop: 16 },
  planDisclaimer: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 10 },
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
    color: '#EBEBF5',
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
    color: '#fff',
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
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EBEBF5',
  },
  checklist: {
    marginTop: 8,
  },
  checklistTitle: {
    color: '#8E8E93',
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
    color: '#EBEBF5',
    fontSize: 14,
    fontWeight: '500',
  },
  checkDetail: {
    fontSize: 14,
    fontWeight: '600',
  },
  checkExplain: {
    backgroundColor: 'rgba(0,122,255,0.1)',
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 12,
    marginLeft: 30,
    borderLeftWidth: 2,
    borderLeftColor: '#007AFF',
  },
  checkExplainText: {
    color: '#EBEBF5',
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
  qualityRowLabel: { color: '#EBEBF5', fontSize: 13, flex: 1.1 },
  qualityRowDetail: { color: colors.textMuted, fontSize: 11, flex: 1.3, textAlign: 'right' },
  qualityRowPoints: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'], width: 34, textAlign: 'right' },
  interpretation: { marginTop: 18, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 },
  interpretationScore: { color: '#EBEBF5', fontSize: 13, lineHeight: 19 },
  interpretationBlock: { marginTop: 14, borderLeftWidth: 2, borderLeftColor: '#3b82f6', paddingLeft: 12 },
  interpretationLabel: { color: '#93c5fd', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  interpretationText: { color: '#EBEBF5', fontSize: 13, lineHeight: 19 },
  checkResultText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
  },
});
