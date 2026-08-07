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
import { getBearPoints, getBullPoints, getTrendInsight } from '@/lib/stock-insights';

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

interface DetailStatProps { label: string; value: string; hint: string; valueColor?: string; }

function DetailStat({ label, value, hint, valueColor }: DetailStatProps) {
  return (
    <HintedTouchable style={s.statBox} accessibilityLabel={`Förklaring: ${label}`} hint={hint}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statVal, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </HintedTouchable>
  );
}

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
            <DetailStat label="Öppning" value={item.regularMarketOpen?.toFixed(2) ?? '-'} hint="Första betalkursen för dagens handel. Jämför den med gårdagens stängning för att se om aktien öppnade med ett gap." />
            <DetailStat label="Högsta" value={item.regularMarketDayHigh?.toFixed(2) ?? '-'} hint="Högsta kurs som handlats i dag. Visar var dagens motstånd hittills har funnits." />
            <DetailStat label="Lägsta" value={item.regularMarketDayLow?.toFixed(2) ?? '-'} hint="Lägsta kurs som handlats i dag. Visar var dagens stöd hittills har funnits." />
            <DetailStat label="Volym" value={formatVol(item.latestVolume)} hint="Antal omsatta aktier i den senaste handelsdagen. Högre volym gör ofta en kursrörelse mer trovärdig." />
            <DetailStat label="P/E" value={item.trailingPE?.toFixed(1) || '-'} hint="Pris/vinst-tal: hur mycket marknaden betalar för en krona av bolagets vinst. Jämför helst med bolagets historik och sektorn." />
            <DetailStat label="Börsvärde" value={formatMCap(item.marketCap)} hint="Bolagets totala marknadsvärde: aktiekurs multiplicerat med antal aktier. Det säger inget ensamt om värderingen." />
            <DetailStat label="52v Hög" value={item.fiftyTwoWeekHigh?.toFixed(2) || '-'} hint="Högsta priset under de senaste 52 veckorna. Ett återtest kan fungera som motstånd." />
            <DetailStat label="52v Låg" value={item.fiftyTwoWeekLow?.toFixed(2) || '-'} hint="Lägsta priset under de senaste 52 veckorna. Ett återtest kan fungera som stöd, men också signalera fortsatt svaghet." />
            <DetailStat label="Snittvolym" value={formatVol(item.avgVolume20)} hint="Genomsnittlig dagsvolym över 20 handelsdagar. Jämför med dagens volym för att bedöma om rörelsen är bekräftad." />
            <DetailStat label="Direktavk." value={item.dividendYield != null ? `${(item.dividendYield * 100).toFixed(1)}%` : '-'} hint="Årlig utdelning som andel av aktuell aktiekurs. En mycket hög siffra kan bero på ett kraftigt kursfall eller osäker utdelning." />
            <DetailStat label="Beta" value={item.beta?.toFixed(2) || '-'} hint="Känslighet mot jämförelseindex. Beta 1 innebär ungefär samma rörelse; över 1 innebär normalt större svängningar." />
            <DetailStat label="VPA" value={item.epsTrailingTwelveMonths?.toFixed(2) ?? '-'} hint="Vinst per aktie de senaste tolv månaderna. Tillsammans med priset ligger den till grund för P/E-talet." />
            <DetailStat label="Volatilitet" value={item.volatility != null ? `${item.volatility.toFixed(1)}%` : '-'} hint="Historisk 30-dagars volatilitet. Högre värde betyder större typiska kurssvängningar och normalt högre risk." />
            <DetailStat label="Max drawdown" value={item.maxDrawdown != null ? `-${item.maxDrawdown.toFixed(1)}%` : '-'} hint="Största historiska fall från en tidigare topp i den studerade perioden. Visar hur djup en nedgång har varit." valueColor={colors.red} />
            <DetailStat label="Risk/Reward" value={item.riskRewardScore?.toFixed(0) || '-'} hint="Intern sammanvägd skala 0-100 som väger trend, volatilitet, drawdown och kvalitet. Den är beslutsstöd, inte ett prisprognos." valueColor={item.riskRewardScore != null && item.riskRewardScore >= 70 ? colors.green : undefined} />
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
