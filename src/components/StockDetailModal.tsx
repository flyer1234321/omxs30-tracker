import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface ChartDataPoint { date: string; close: number; sma125?: number; sma50?: number; sma200?: number; }
interface ChecklistItem { label: string; passed: boolean; detail: string; }
interface HealthCheck {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  gradeScore: number;
  summary: string;
  riskLevel: 'Låg' | 'Medel' | 'Hög';
  momentum: 'Uppåt' | 'Nedåt' | 'Sidledes';
  checklist: ChecklistItem[];
}
export interface StockData {
  ticker: string;
  companyName: string;
  currentPrice: number;
  sma125: number | null;
  sma200: number | null;
  sma50?: number | null;
  rsi: number | null;
  diffPercent125: number | null;
  chartHistory: ChartDataPoint[];
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  trailingPE: number | null;
  dividendYield: number | null;
  marketCap: number | null;
  regularMarketChangePercent: number | null;
  latestVolume: number | null;
  avgVolume20: number | null;
  healthCheck: HealthCheck | null;
  volatility?: number | null; // Added for bull/bear
  macdData?: { trend: 'up' | 'down' | 'neutral' }; // Added for bull/bear
}

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
  const [chartPeriod, setChartPeriod] = useState<'1D'|'1W'|'1M'|'3M'|'6M'|'1Y'>('6M');
  const [intradayData, setIntradayData] = useState<Record<string, ChartDataPoint[]>>({});
  const [loadingIntraday, setLoadingIntraday] = useState(false);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);

  const [showSma50, setShowSma50] = useState(false);
  const [showSma125, setShowSma125] = useState(true);
  const [showSma200, setShowSma200] = useState(false);

  useEffect(() => {
    if (!item) return;
    if (chartPeriod === '1D' || chartPeriod === '1W') {
      const range = chartPeriod === '1D' ? '1d' : '5d';
      const cacheKey = `${item.ticker}-${range}`;
      if (intradayData[cacheKey]) return;

      setLoadingIntraday(true);
      fetch(`/api/intraday?ticker=${item.ticker}&range=${range}`)
        .then(res => res.json())
        .then(data => {
          if (data && Array.isArray(data)) {
            setIntradayData(prev => ({ ...prev, [cacheKey]: data }));
          }
        })
        .catch(err => console.error('Failed to fetch intraday', err))
        .finally(() => setLoadingIntraday(false));
    }
  }, [item, chartPeriod]);

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
              <TouchableOpacity key={i} activeOpacity={0.7} onPress={() => setExpandedCheck(isOpen ? null : checkKey)}>
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
              </TouchableOpacity>
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

  const renderChart = () => {
    if (!item.chartHistory || item.chartHistory.length === 0) return null;
    
    let filteredHistory: ChartDataPoint[] = [];
    let isIntraday = false;
    
    if (chartPeriod === '1D' || chartPeriod === '1W') {
      const range = chartPeriod === '1D' ? '1d' : '5d';
      const cacheKey = `${item.ticker}-${range}`;
      if (intradayData[cacheKey]) {
        filteredHistory = intradayData[cacheKey];
        isIntraday = true;
      }
    } else {
      let days = 125;
      if (chartPeriod === '1M') days = 21;
      if (chartPeriod === '3M') days = 63;
      if (chartPeriod === '1Y') days = 252;
      const startIndex = Math.max(0, item.chartHistory.length - days);
      filteredHistory = item.chartHistory.slice(startIndex);
    }
    
    if (loadingIntraday) {
      return (
        <View style={[s.chartSection, { height: 260, justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      );
    }
    
    if (filteredHistory.length === 0) return null;

    const labelInterval = Math.max(1, Math.floor(filteredHistory.length / 5));
    const weekdays = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];

    const priceData = filteredHistory.map((d, i) => {
      let label = '';
      if (i % labelInterval === 0 || i === filteredHistory.length - 1) {
        const dateObj = new Date(d.date);
        if (chartPeriod === '1D') {
          label = `${dateObj.getHours()}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
        } else if (chartPeriod === '1W') {
          label = `${weekdays[dateObj.getDay()]}`;
        } else {
          label = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
        }
      }
      return { value: d.close, label };
    });
    
    const sma125Data = (!isIntraday && showSma125) ? filteredHistory.map(d => ({ value: d.sma125 || d.close })) : [];
    const sma50Data = (!isIntraday && showSma50) ? filteredHistory.map(d => ({ value: d.sma50 || d.close })) : [];
    const sma200Data = (!isIntraday && showSma200) ? filteredHistory.map(d => ({ value: d.sma200 || d.close })) : [];
    
    const chartWidth = SCREEN_WIDTH - 40; // Full screen modal with 20px padding on each side

    const allValues = filteredHistory.map(d => d.close).filter(v => v != null);
    if (!isIntraday && showSma125) allValues.push(...filteredHistory.map(d => d.sma125).filter((v): v is number => v != null));
    if (!isIntraday && showSma50) allValues.push(...filteredHistory.map(d => d.sma50).filter((v): v is number => v != null));
    if (!isIntraday && showSma200) allValues.push(...filteredHistory.map(d => d.sma200).filter((v): v is number => v != null));
    
    const minPrice = Math.min(...allValues);
    const maxPrice = Math.max(...allValues);
    const padding = (maxPrice - minPrice) * 0.1 || 1;
    const yMin = Math.floor(minPrice - padding);
    const yMax = Math.ceil(maxPrice + padding);
    const noOfSections = 4;
    const stepValue = (yMax - yMin) / noOfSections;

    return (
      <View style={[s.chartSection, { height: 320 }]}>
        <View style={s.chartHeader}>
          <Text style={s.chartTitle}>Kursutveckling</Text>
          <View style={s.periodTabs}>
            {(['1D', '1W', '1M', '3M', '6M', '1Y'] as const).map(p => (
              <TouchableOpacity key={p} style={[s.periodBtn, chartPeriod === p && s.periodBtnActive]} onPress={() => setChartPeriod(p)}>
                <Text style={[s.periodBtnText, chartPeriod === p && s.periodBtnTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {/* SMA Toggles */}
        <View style={s.smaToggles}>
          <TouchableOpacity style={[s.smaBtn, showSma50 && s.smaBtnActive, { borderColor: '#8A2BE2' }]} onPress={() => setShowSma50(!showSma50)}>
            <Text style={[s.smaBtnText, showSma50 && s.smaBtnTextActive, { color: showSma50 ? '#fff' : '#8A2BE2' }]}>SMA 50</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.smaBtn, showSma125 && s.smaBtnActive, { borderColor: '#FF9500' }]} onPress={() => setShowSma125(!showSma125)}>
            <Text style={[s.smaBtnText, showSma125 && s.smaBtnTextActive, { color: showSma125 ? '#fff' : '#FF9500' }]}>SMA 125</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.smaBtn, showSma200 && s.smaBtnActive, { borderColor: '#FF2D55' }]} onPress={() => setShowSma200(!showSma200)}>
            <Text style={[s.smaBtnText, showSma200 && s.smaBtnTextActive, { color: showSma200 ? '#fff' : '#FF2D55' }]}>SMA 200</Text>
          </TouchableOpacity>
        </View>

        {/* Wrap in pointerEvents none to prevent web panresponder crash on touch */}
        <View pointerEvents="none">
          <LineChart
            data={priceData}
            data2={sma125Data.length > 0 ? sma125Data : undefined}
            data3={sma50Data.length > 0 ? sma50Data : undefined}
            data4={sma200Data.length > 0 ? sma200Data : undefined}
            width={chartWidth}
            height={180}
            color="#007AFF"
            color2="#FF9500"
            color3="#8A2BE2"
            color4="#FF2D55"
            thickness={2}
            thickness2={1.5}
            thickness3={1.5}
            thickness4={1.5}
            hideDataPoints
            hideDataPoints2
            hideDataPoints3
            hideDataPoints4
            noOfSections={noOfSections}
            stepValue={stepValue}
            yAxisOffset={yMin}
            yAxisTextStyle={{ color: '#8E8E93', fontSize: 10 }}
            xAxisLabelTextStyle={{ color: '#8E8E93', fontSize: 10 }}
            spacing={(chartWidth - 20) / Math.max(filteredHistory.length, 1)}
            initialSpacing={10}
            yAxisColor="#333"
            xAxisColor="#333"
            rulesColor="#222"
            curved
            areaChart
            startFillColor="rgba(0,122,255,0.2)"
            endFillColor="rgba(0,122,255,0.02)"
            startOpacity={0.4}
            endOpacity={0}
          />
        </View>
      </View>
    );
  };

  const dayChange = item.regularMarketChangePercent;
  const dayColor = dayChange != null && dayChange >= 0 ? colors.green : colors.red;
  const bullPoints = getBullPoints(item);
  const bearPoints = getBearPoints(item);

  return (
    <Modal visible={!!item} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.safeArea}>
        <View style={s.header}>
          <TouchableOpacity style={s.headerBtn} onPress={onClose}>
            <Text style={s.headerBtnText}>←</Text>
          </TouchableOpacity>
          <View style={s.headerTitleWrap}>
            <Text style={s.headerTicker}>{item.ticker.replace('.ST', '')}</Text>
            <Text style={s.headerName} numberOfLines={1}>{item.companyName}</Text>
          </View>
          <TouchableOpacity style={s.headerBtn} onPress={onToggleWatchlist}>
            <Text style={[s.starIcon, isWatchlisted && s.starIconActive]}>
              {isWatchlisted ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
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

          {/* Quick Stats Grid */}
          <View style={s.statsGrid}>
            <View style={s.statBox}><Text style={s.statLabel}>52v Hög</Text><Text style={s.statVal}>{item.fiftyTwoWeekHigh?.toFixed(2) || '-'}</Text></View>
            <View style={s.statBox}><Text style={s.statLabel}>52v Låg</Text><Text style={s.statVal}>{item.fiftyTwoWeekLow?.toFixed(2) || '-'}</Text></View>
            <View style={s.statBox}><Text style={s.statLabel}>P/E</Text><Text style={s.statVal}>{item.trailingPE?.toFixed(1) || '-'}</Text></View>
            <View style={s.statBox}><Text style={s.statLabel}>Utdelning</Text><Text style={s.statVal}>{item.dividendYield ? `${(item.dividendYield*100).toFixed(1)}%` : '-'}</Text></View>
            <View style={s.statBox}><Text style={s.statLabel}>Volym</Text><Text style={s.statVal}>{formatVol(item.latestVolume)}</Text></View>
            <View style={s.statBox}><Text style={s.statLabel}>Börsvärde</Text><Text style={s.statVal}>{formatMCap(item.marketCap)}</Text></View>
          </View>

          {/* Chart */}
          {renderChart()}

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
  chartSection: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 2,
  },
  periodBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  periodBtnActive: {
    backgroundColor: '#333',
  },
  periodBtnText: {
    color: '#8E8E93',
    fontSize: 12,
  },
  periodBtnTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  smaToggles: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  smaBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  smaBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  smaBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
  smaBtnTextActive: {
    fontWeight: 'bold',
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
