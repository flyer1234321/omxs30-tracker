import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import type { StockData } from '@/types/stock';
import { AnalystBrief } from '@/components/AnalystBrief';
import { MarketChart } from '@/components/MarketChart';
import { HintedTouchable } from '@/components/HintedTouchable';
import type { AnalystReport } from '@/lib/analyst-engine';
import { openPrintReport } from '@/lib/print-report';

export type { StockData } from '@/types/stock';

interface StockDetailModalProps {
  item: StockData | null;
  onClose: () => void;
  isWatchlisted: boolean;
  onToggleWatchlist: () => void;
}

const colors = {
  bg: '#08080f',
  surface: '#111118',
  text: '#ffffff',
  textMuted: '#8E8E93',
  green: '#34C759',
  red: '#FF3B30',
  yellow: '#FFCC00',
  border: '#2a2a35'
};

const gradeColors: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: '#0A3D1A', text: '#34C759', border: '#34C759' },
  B: { bg: '#1A3D0A', text: '#A8D86B', border: '#A8D86B' },
  C: { bg: '#3D3A0A', text: '#FFD60A', border: '#FFD60A' },
  D: { bg: '#3D1A0A', text: '#FF9500', border: '#FF9500' },
  F: { bg: '#3D0A0A', text: '#FF3B30', border: '#FF3B30' },
};

const riskColors: Record<string, string> = { 'Låg': '#34C759', 'Medel': '#FF9500', 'Hög': '#FF3B30' };
const momentumIcons: Record<string, string> = { 'Uppåt': '↗️', 'Nedåt': '↘️', 'Sidledes': '→' };

export const StockDetailModal: React.FC<StockDetailModalProps> = ({ item, onClose, isWatchlisted, onToggleWatchlist }) => {
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const [analystReport, setAnalystReport] = useState<AnalystReport | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);

  useEffect(() => {
    setAnalystReport(null);
    setPrintError(null);
  }, [item?.ticker]);

  if (!item) return null;

  const formatMCap = (c: number | null) => { if (!c) return '-'; if (c>=1e12) return `${(c/1e12).toFixed(1)}T`; if (c>=1e9) return `${(c/1e9).toFixed(1)}B`; if (c>=1e6) return `${(c/1e6).toFixed(0)}M`; return '-'; };
  const formatVol = (v: number | null) => { if (!v) return '-'; if (v>=1e6) return `${(v/1e6).toFixed(1)}M`; if (v>=1e3) return `${(v/1e3).toFixed(0)}K`; return v.toString(); };

  const getExplanation = (label: string, stock: StockData) => {
    switch (label) {
      case 'Tjänar företaget pengar?':
        return `P/E-talet visar hur mycket du betalar för 1 kr av bolagets vinst. Ett "normalt" värde ligger runt 15. ${stock.companyName} har just nu ett P/E på ${stock.trailingPE?.toFixed(1) || 'okänt'}, vilket innebär att det är ${stock.trailingPE ? (stock.trailingPE < 15 ? 'relativt lågt värderat i förhållande till vinsten' : 'ganska högt värderat') : 'okänt'}.`;
      case 'Betalar utdelning?':
        return `Direktavkastningen visar hur stor del av aktiekursen du får tillbaka varje år i utdelning. ${stock.companyName} delar ut ${(stock.dividendYield ? (stock.dividendYield * 100).toFixed(1) : '0')}% varje år. Stabil utdelning över tid tyder på ett hälsosamt bolag.`;
      case 'Har aktien fallit kraftigt?':
        return `När en aktie faller snabbt kan det vara tillfällig panik (bra köpläge) eller ett genuint problem (varning). ${stock.companyName} handlas just nu på ${stock.currentPrice?.toFixed(2)} kr.`;
      case 'Nära botten?':
        return `Lägsta priset för ${stock.ticker.replace('.ST','')} de senaste 52 veckorna var ${stock.fiftyTwoWeekLow?.toFixed(2) || 'okänt'} kr (Nuvarande pris: ${stock.currentPrice?.toFixed(2)} kr). Om kursen vänder upp från botten kan det vara ett starkt stödområde.`;
      case 'Översåld (RSI)?':
        return `RSI mäter om en aktie har sålts för aggressivt. Under 30 är "översålt" och över 70 "överköpt". ${stock.companyName} har ett RSI på ${stock.rsi?.toFixed(1) || 'okänt'}. ${stock.rsi && stock.rsi < 35 ? 'Den är utsträckt på nedsidan, som ett gummiband som kan snärta tillbaka.' : 'Den befinner sig i en normal/stark zon.'}`;
      case 'Under glidande medelvärde?':
        return `Genomsnittskursen de senaste 6 månaderna (SMA 125) ligger på ${stock.sma125?.toFixed(2) || 'okänt'} kr. ${stock.companyName} ligger just nu ${stock.sma125 && stock.currentPrice && stock.currentPrice < stock.sma125 ? 'under detta snitt (svag kortsiktig trend)' : 'över detta snitt (stark trend)'}.`;
      default:
        return '';
    }
  };

  const getBullPoints = (stock: StockData): string[] => {
    const points: string[] = [];
    if (stock.sma125 && stock.currentPrice > stock.sma125) points.push('Handlas över 6-månadersnittet');
    if (stock.sma200 && stock.currentPrice > stock.sma200) points.push('Handlas över årsgenomsnittet');
    if (stock.rsi && stock.rsi < 40 && stock.rsi > 20) points.push('RSI indikerar potentiell vändning');
    if (stock.dividendYield && stock.dividendYield > 0.03) points.push(`Stark direktavkastning (${(stock.dividendYield * 100).toFixed(1)}%)`);
    if (stock.trailingPE && stock.trailingPE < 15 && stock.trailingPE > 0) points.push(`Låg värdering (P/E ${stock.trailingPE.toFixed(1)})`);
    if (stock.macdData?.trend === 'up') points.push('Positiv momentumvändning (MACD)');
    if (stock.latestVolume && stock.avgVolume20 && stock.latestVolume > stock.avgVolume20 * 1.3) points.push('Ökande handelsvolym');
    return points;
  };

  const getBearPoints = (stock: StockData): string[] => {
    const points: string[] = [];
    if (stock.sma125 && stock.currentPrice < stock.sma125) points.push('Handlas under 6-månadersnittet');
    if (stock.sma200 && stock.currentPrice < stock.sma200) points.push('Handlas under årsgenomsnittet');
    if (stock.rsi && stock.rsi > 70) points.push(`Överköpt (RSI ${stock.rsi.toFixed(1)})`);
    if (stock.rsi && stock.rsi < 20) points.push('Extremt översåld - risk för ytterligare fall');
    if (stock.trailingPE && stock.trailingPE > 30) points.push(`Hög värdering (P/E ${stock.trailingPE.toFixed(1)})`);
    if (stock.volatility && stock.volatility > 40) points.push(`Hög volatilitet (${stock.volatility.toFixed(1)}%)`);
    if (stock.macdData?.trend === 'down') points.push('Negativt momentum (MACD)');
    if (stock.currentPrice && stock.fiftyTwoWeekLow && stock.currentPrice < stock.fiftyTwoWeekLow * 1.05) points.push('Nära 52-veckors lägsta');
    return points;
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
            <Text style={[s.gradeSubText, { color: gc.text }]}>{hc.gradeScore}/10</Text>
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
          <Text style={s.checklistTitle}>Hälsokoll — tryck på en rad för förklaring</Text>
          {hc.checklist.map((ci, i) => {
            const checkKey = `${item.ticker}-${i}`;
            const isOpen = expandedCheck === checkKey;
            const explanation = getExplanation(ci.label, item);
            return (
              <HintedTouchable key={i} activeOpacity={0.7} onPress={() => setExpandedCheck(isOpen ? null : checkKey)} accessibilityLabel={`${isOpen ? 'Dölj' : 'Visa'} förklaring: ${ci.label}`} hint={`${isOpen ? 'Döljer' : 'Visar'} hur kontrollpunkten ${ci.label.toLowerCase()} påverkar analysen.`}>
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
          <View style={s.checkResult}>
            <Text style={s.checkResultText}>
              {hc.checklist.filter(c => c.passed).length}/{hc.checklist.length} uppfyllda → Betyg {hc.grade}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderTrendAnalysis = () => {
    if (!item.sma125 || !item.currentPrice) return null;
    
    const diffPercent = ((item.currentPrice - item.sma125) / item.sma125) * 100;
    const isTesting = Math.abs(diffPercent) <= 2.0;
    
    let title = '';
    let text = '';
    let color = '';
    let icon = '';

    if (isTesting) {
      title = 'Testar Brytpunkt (SMA 125)';
      text = `Aktien handlas just nu på ${item.currentPrice.toFixed(2)} kr, vilket är mycket nära halvårstrenden på ${item.sma125.toFixed(2)} kr. Ett utbrott uppåt under hög volym kan vara en köpsignal, medan ett brott nedåt kan ses som en varningssignal.`;
      color = '#FFCC00';
      icon = '⚠️';
    } else if (item.currentPrice > item.sma125) {
      title = 'Positiv Trend (Bullish)';
      text = `Aktien befinner sig i en positiv trend eftersom kursen (${item.currentPrice.toFixed(2)} kr) handlas över sitt 125-dagars snitt (${item.sma125.toFixed(2)} kr). SMA 125 fungerar just nu som ett dynamiskt "golv" (stöd) vid eventuella nedgångar.`;
      color = '#34C759';
      icon = '📈';
    } else {
      title = 'Negativ Trend (Bearish)';
      text = `Aktien befinner sig i en negativ trend eftersom kursen (${item.currentPrice.toFixed(2)} kr) handlas under sitt 125-dagars snitt (${item.sma125.toFixed(2)} kr). SMA 125 fungerar just nu som ett dynamiskt "tak" (motstånd) som är svårt att bryta igenom.`;
      color = '#FF3B30';
      icon = '📉';
    }

    return (
      <View style={[s.trendBox, { borderLeftColor: color }]}>
        <View style={s.trendHeader}>
          <Text style={s.trendIcon}>{icon}</Text>
          <Text style={[s.trendTitle, { color }]}>{title}</Text>
        </View>
        <Text style={s.trendText}>{text}</Text>
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
              <Text style={s.priceText}>{item.currentPrice.toFixed(2)} kr</Text>
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
            <View style={s.statBox}><Text style={s.statLabel}>Öppning</Text><Text style={s.statVal}>{item.regularMarketOpen?.toFixed(2) ?? '-'}</Text></View>
            <View style={s.statBox}><Text style={s.statLabel}>Högsta</Text><Text style={s.statVal}>{item.regularMarketDayHigh?.toFixed(2) ?? '-'}</Text></View>
            <View style={s.statBox}><Text style={s.statLabel}>Lägsta</Text><Text style={s.statVal}>{item.regularMarketDayLow?.toFixed(2) ?? '-'}</Text></View>
            <View style={s.statBox}><Text style={s.statLabel}>Volym</Text><Text style={s.statVal}>{formatVol(item.latestVolume)}</Text></View>
            <View style={s.statBox}><Text style={s.statLabel}>P/E</Text><Text style={s.statVal}>{item.trailingPE?.toFixed(1) || '-'}</Text></View>
            <View style={s.statBox}><Text style={s.statLabel}>Börsvärde</Text><Text style={s.statVal}>{formatMCap(item.marketCap)}</Text></View>
            <View style={s.statBox}><Text style={s.statLabel}>52v Hög</Text><Text style={s.statVal}>{item.fiftyTwoWeekHigh?.toFixed(2) || '-'}</Text></View>
            <View style={s.statBox}><Text style={s.statLabel}>52v Låg</Text><Text style={s.statVal}>{item.fiftyTwoWeekLow?.toFixed(2) || '-'}</Text></View>
            <View style={s.statBox}><Text style={s.statLabel}>Snittvolym</Text><Text style={s.statVal}>{formatVol(item.avgVolume20)}</Text></View>
            <View style={s.statBox}><Text style={s.statLabel}>Direktavk.</Text><Text style={s.statVal}>{item.dividendYield != null ? `${(item.dividendYield * 100).toFixed(1)}%` : '-'}</Text></View>
            <View style={s.statBox}><Text style={s.statLabel}>Beta</Text><Text style={s.statVal}>{item.beta?.toFixed(2) || '-'}</Text></View>
            <View style={s.statBox}><Text style={s.statLabel}>VPA</Text><Text style={s.statVal}>{item.epsTrailingTwelveMonths?.toFixed(2) ?? '-'}</Text></View>
            <View style={s.statBox}><Text style={s.statLabel}>Volatilitet</Text><Text style={s.statVal}>{item.volatility != null ? `${item.volatility.toFixed(1)}%` : '-'}</Text></View>
            <View style={s.statBox}><Text style={s.statLabel}>Max drawdown</Text><Text style={[s.statVal, { color: colors.red }]}>{item.maxDrawdown != null ? `-${item.maxDrawdown.toFixed(1)}%` : '-'}</Text></View>
            <View style={s.statBox}><Text style={s.statLabel}>Risk/Reward</Text><Text style={[s.statVal, item.riskRewardScore != null && item.riskRewardScore >= 70 && { color: colors.green }]}>{item.riskRewardScore?.toFixed(0) || '-'}</Text></View>
          </View>

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
  checkResultText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
  },
});
