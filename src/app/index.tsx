import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  RefreshControl, 
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface ChartDataPoint { date: string; close: number; sma125?: number; }

interface ChecklistItem { label: string; passed: boolean; detail: string; }

interface HealthCheck {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  gradeScore: number;
  summary: string;
  riskLevel: 'Låg' | 'Medel' | 'Hög';
  momentum: 'Uppåt' | 'Nedåt' | 'Sidledes';
  checklist: ChecklistItem[];
}

interface StockData {
  ticker: string;
  companyName: string;
  currentPrice: number;
  sma125: number | null;
  sma200: number | null;
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
}

interface SearchResult { symbol: string; shortname: string; exchange: string; }

export default function HomeScreen() {
  const [data, setData] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [market, setMarket] = useState<'omxs30' | 'dji' | 'tech' | 'swe_fastigheter' | 'watchlist'>('omxs30');
  const [filter, setFilter] = useState<'ALL' | 'A' | 'B' | 'UNDER_SMA' | 'RSI'>('ALL');
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const [chartPeriod, setChartPeriod] = useState<'1D'|'1W'|'1M'|'3M'|'6M'|'1Y'>('6M');
  const [intradayData, setIntradayData] = useState<Record<string, ChartDataPoint[]>>({});
  const searchTimeout = useRef<any>(null);

  const getExplanation = (label: string, item: StockData) => {
    switch (label) {
      case 'Tjänar företaget pengar?':
        return `P/E-talet visar hur mycket du betalar för 1 kr av bolagets vinst. Ett "normalt" värde ligger runt 15. ${item.companyName} har just nu ett P/E på ${item.trailingPE?.toFixed(1) || 'okänt'}, vilket innebär att det är ${item.trailingPE ? (item.trailingPE < 15 ? 'relativt lågt värderat i förhållande till vinsten' : 'ganska högt värderat') : 'okänt'}.`;
      case 'Betalar utdelning?':
        return `Direktavkastningen visar hur stor del av aktiekursen du får tillbaka varje år i utdelning. ${item.companyName} delar ut ${(item.dividendYield ? (item.dividendYield * 100).toFixed(1) : '0')}% varje år. Stabil utdelning över tid tyder på ett hälsosamt bolag.`;
      case 'Har aktien fallit kraftigt?':
        return `När en aktie faller snabbt kan det vara tillfällig panik (bra köpläge) eller ett genuint problem (varning). ${item.companyName} handlas just nu på ${item.currentPrice?.toFixed(2)} kr.`;
      case 'Nära botten?':
        return `Lägsta priset för ${item.ticker.replace('.ST','')} de senaste 52 veckorna var ${item.fiftyTwoWeekLow?.toFixed(2) || 'okänt'} kr (Nuvarande pris: ${item.currentPrice?.toFixed(2)} kr). Om kursen vänder upp från botten kan det vara ett starkt stödområde.`;
      case 'Översåld (RSI)?':
        return `RSI mäter om en aktie har sålts för aggressivt. Under 30 är "översålt" och över 70 "överköpt". ${item.companyName} har ett RSI på ${item.rsi?.toFixed(1) || 'okänt'}. ${item.rsi && item.rsi < 35 ? 'Den är utsträckt på nedsidan, som ett gummiband som kan snärta tillbaka.' : 'Den befinner sig i en normal/stark zon.'}`;
      case 'Under glidande medelvärde?':
        return `Genomsnittskursen de senaste 6 månaderna (SMA 125) ligger på ${item.sma125?.toFixed(2) || 'okänt'} kr. ${item.companyName} ligger just nu ${item.sma125 && item.currentPrice && item.currentPrice < item.sma125 ? 'under detta snitt (svag kortsiktig trend)' : 'över detta snitt (stark trend)'}.`;
      default:
        return '';
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('@watchlist');
        if (stored) setWatchlist(JSON.parse(stored));
      } catch (e) {}
    })();
  }, []);

  useEffect(() => {
    if (chartPeriod !== '1D' && chartPeriod !== '1W') return;
    if (!expandedTicker) return;
    
    const range = chartPeriod === '1D' ? '1d' : '5d';
    const cacheKey = `${expandedTicker}-${range}`;
    if (intradayData[cacheKey]) return; // already fetched
    
    (async () => {
      try {
        const res = await fetch(`/api/intraday?ticker=${expandedTicker}&range=${range}`);
        const json = await res.json();
        if (json.data) {
          setIntradayData(prev => ({ ...prev, [cacheKey]: json.data }));
        } else {
          setIntradayData(prev => ({ ...prev, [cacheKey]: [] }));
        }
      } catch (err) {
        console.error('Intraday error', err);
        setIntradayData(prev => ({ ...prev, [cacheKey]: [] }));
      }
    })();
  }, [chartPeriod, expandedTicker]);

  const saveWatchlist = async (list: string[]) => {
    try { await AsyncStorage.setItem('@watchlist', JSON.stringify(list)); setWatchlist(list); } catch (e) {}
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!text.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(text)}`);
        const json = await res.json();
        setSearchResults(json.data || []);
      } catch (e) { setSearchResults([]); }
      finally { setIsSearching(false); }
    }, 300);
  };

  const addFromSearch = (symbol: string) => {
    if (!watchlist.includes(symbol)) saveWatchlist([...watchlist, symbol]);
    setSearchQuery(''); setSearchResults([]);
  };

  const fetchData = async (m = market, wl = watchlist) => {
    setLoading(true);
    try {
      let url = `/api/analyze`;
      if (m === 'watchlist') {
        if (wl.length === 0) { setData([]); setLoading(false); return; }
        url += `?tickers=${wl.join(',')}`;
      } else { url += `?market=${m}`; }
      const response = await fetch(url);
      if (!response.ok) throw new Error('Nätverksfel');
      const json = await response.json();
      if (json.error) throw new Error(json.error);
      setData(json.data || []); setLastUpdated(json.timestamp); setError(null);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const onMarketChange = (tab: any) => {
    if (tab !== market) {
      setData([]); // Clear old data so we don't show Volvo under Tech
      setMarket(tab);
    }
  };

  useEffect(() => {
    fetchData(market, watchlist);
    const interval = setInterval(() => fetchData(market, watchlist), 60000);
    return () => clearInterval(interval);
  }, [market, watchlist]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(market, watchlist); }, [market, watchlist]);

  const getFilteredData = () => {
    let f = data;
    if (filter === 'A') f = data.filter(d => d.healthCheck?.grade === 'A');
    else if (filter === 'B') f = data.filter(d => d.healthCheck && ['A','B'].includes(d.healthCheck.grade));
    else if (filter === 'UNDER_SMA') f = data.filter(d => d.sma125 && d.currentPrice < d.sma125);
    else if (filter === 'RSI') f = data.filter(d => d.rsi != null && d.rsi < 30);
    return [...f].sort((a, b) => {
      const ga = gradeToNum(a.healthCheck?.grade); const gb = gradeToNum(b.healthCheck?.grade);
      if (ga !== gb) return gb - ga;
      return (a.diffPercent125 || 0) - (b.diffPercent125 || 0);
    });
  };

  const gradeToNum = (g?: string) => ({ A: 5, B: 4, C: 3, D: 2, F: 1 }[g || 'F'] || 0);
  const formatMCap = (c: number | null) => { if (!c) return '-'; if (c>=1e12) return `${(c/1e12).toFixed(1)}T`; if (c>=1e9) return `${(c/1e9).toFixed(1)}B`; if (c>=1e6) return `${(c/1e6).toFixed(0)}M`; return '-'; };
  const formatVol = (v: number | null) => { if (!v) return '-'; if (v>=1e6) return `${(v/1e6).toFixed(1)}M`; if (v>=1e3) return `${(v/1e3).toFixed(0)}K`; return v.toString(); };

  const gradeColors: Record<string, { bg: string; text: string; border: string }> = {
    A: { bg: '#0A3D1A', text: '#34C759', border: '#34C759' },
    B: { bg: '#1A3D0A', text: '#A8D86B', border: '#A8D86B' },
    C: { bg: '#3D3A0A', text: '#FFD60A', border: '#FFD60A' },
    D: { bg: '#3D1A0A', text: '#FF9500', border: '#FF9500' },
    F: { bg: '#3D0A0A', text: '#FF3B30', border: '#FF3B30' },
  };

  const riskColors: Record<string, string> = { 'Låg': '#34C759', 'Medel': '#FF9500', 'Hög': '#FF3B30' };
  const momentumIcons: Record<string, string> = { 'Uppåt': '↗️', 'Nedåt': '↘️', 'Sidledes': '→' };

  // ─── RENDER FUNCTIONS ─────────────────────────────────

  const renderTabs = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsScroll} contentContainerStyle={s.tabsContainer}>
      {(['omxs30', 'dji', 'tech', 'swe_fastigheter', 'watchlist'] as const).map(tab => {
        let label = '';
        if (tab === 'omxs30') label = '🇸🇪 Sverige';
        else if (tab === 'dji') label = '🇺🇸 USA';
        else if (tab === 'tech') label = '💻 Tech';
        else if (tab === 'swe_fastigheter') label = '🏢 Fastigheter';
        else label = '⭐ Min Lista';

        return (
          <TouchableOpacity key={tab} style={[s.tab, market === tab && s.activeTab]} onPress={() => onMarketChange(tab)}>
            <Text style={[s.tabText, market === tab && s.activeTabText]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderFilters = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtersScroll} contentContainerStyle={s.filtersRow}>
      {([
        { key: 'ALL', label: 'Alla' },
        { key: 'A', label: '🏆 Betyg A' },
        { key: 'B', label: '✅ A + B' },
        { key: 'UNDER_SMA', label: '📉 Under SMA' },
        { key: 'RSI', label: '🔻 RSI < 30' },
      ] as const).map(f => (
        <TouchableOpacity key={f.key} style={[s.chip, filter === f.key && s.chipActive]} onPress={() => setFilter(f.key as any)}>
          <Text style={[s.chipText, filter === f.key && s.chipTextActive]}>{f.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderSearch = () => {
    if (market !== 'watchlist') return null;
    return (
      <View style={s.searchWrap}>
        <View style={s.searchBar}>
          <Text style={{ fontSize: 16, marginRight: 10 }}>🔍</Text>
          <TextInput style={s.searchInput} placeholder="Sök aktie (Volvo, Tesla...)" placeholderTextColor="#555" value={searchQuery} onChangeText={handleSearchChange} />
          {isSearching && <ActivityIndicator size="small" color="#007AFF" />}
        </View>
        {searchResults.length > 0 && (
          <View style={s.dropdown}>
            {searchResults.map((r, i) => (
              <TouchableOpacity key={`${r.symbol}-${i}`} style={s.dropdownItem} onPress={() => addFromSearch(r.symbol)}>
                <View><Text style={s.dropSymbol}>{r.symbol}</Text><Text style={s.dropName}>{r.shortname}</Text></View>
                <View style={s.dropExch}><Text style={s.dropExchText}>{r.exchange}</Text></View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {watchlist.length > 0 && (
          <View style={s.chipRow}>
            {watchlist.map(t => (
              <TouchableOpacity key={t} style={s.wlChip} onPress={() => saveWatchlist(watchlist.filter(x => x !== t))}>
                <Text style={s.wlChipText}>{t} ✕</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderGradeBadge = (hc: HealthCheck) => {
    const gc = gradeColors[hc.grade] || gradeColors.F;
    return (
      <View style={[s.gradeBadge, { backgroundColor: gc.bg, borderColor: gc.border }]}>  
        <Text style={[s.gradeText, { color: gc.text }]}>{hc.grade}</Text>
      </View>
    );
  };

  const renderHealthCard = (item: StockData) => {
    const hc = item.healthCheck;
    if (!hc) return null;
    const gc = gradeColors[hc.grade] || gradeColors.F;
    const riskCol = riskColors[hc.riskLevel] || '#FF9500';
    const momIcon = momentumIcons[hc.momentum] || '→';

    return (
      <View style={s.healthCard}>
        {/* Header: Grade + Summary */}
        <View style={s.healthHeader}>
          <View style={[s.gradeBigBadge, { backgroundColor: gc.bg, borderColor: gc.border }]}>
            <Text style={[s.gradeBigText, { color: gc.text }]}>{hc.grade}</Text>
            <Text style={[s.gradeSubText, { color: gc.text }]}>{hc.gradeScore}/10</Text>
          </View>
          <View style={s.healthSummaryWrap}>
            <Text style={s.healthSummary}>{hc.summary}</Text>
          </View>
        </View>

        {/* Risk & Momentum pills */}
        <View style={s.pillRow}>
          <View style={[s.pill, { borderColor: riskCol }]}>
            <Text style={[s.pillLabel, { color: riskCol }]}>Risk: {hc.riskLevel}</Text>
          </View>
          <View style={[s.pill, { borderColor: '#8E8E93' }]}>
            <Text style={s.pillLabel}>{momIcon} Momentum: {hc.momentum}</Text>
          </View>
        </View>

        {/* Checklist */}
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

  const renderChart = (item: StockData) => {
    if (!item.chartHistory || item.chartHistory.length === 0) return null;
    
    let filteredHistory = [];
    let isIntraday = false;
    let loadingIntraday = false;
    
    if (chartPeriod === '1D' || chartPeriod === '1W') {
      const range = chartPeriod === '1D' ? '1d' : '5d';
      const cacheKey = `${item.ticker}-${range}`;
      if (intradayData[cacheKey]) {
        filteredHistory = intradayData[cacheKey];
        isIntraday = true;
      } else {
        loadingIntraday = true;
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
        <View style={[s.chartSection, { height: 230, justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      );
    }
    
    if (filteredHistory.length === 0) return null;

    const labelInterval = Math.max(1, Math.floor(filteredHistory.length / 5));
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
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
          label = `${dateObj.getDate()} ${months[dateObj.getMonth()]}`;
        }
      }
      return { value: d.close, label };
    });
    
    // smaData must have same length as priceData for the chart to align properly.
    // If a value is missing (should not happen now with 18 months fetch), fallback to 0.
    const smaData = isIntraday ? [] : filteredHistory.map(d => ({ value: d.sma125 || d.close }));
    const chartWidth = SCREEN_WIDTH - 100;

    // Calculate Y-axis range for better detail
    const allValues = filteredHistory.map(d => d.close).filter(v => v != null);
    const smaValues = filteredHistory.map(d => d.sma125).filter(v => v != null) as number[];
    const allPrices = [...allValues, ...smaValues];
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const padding = (maxPrice - minPrice) * 0.1 || 1;
    const yMin = Math.floor(minPrice - padding);
    const yMax = Math.ceil(maxPrice + padding);
    const noOfSections = 4;
    const stepValue = (yMax - yMin) / noOfSections;

    return (
      <View style={s.chartSection}>
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
        <View style={s.chartLegend}>
          <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: '#007AFF' }]} /><Text style={s.legendText}>Kurs</Text></View>
          {smaData.length > 0 && <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: '#FF9500' }]} /><Text style={s.legendText}>SMA 125</Text></View>}
        </View>
        <LineChart
          key={`${item.ticker}-${chartPeriod}`} // Force remount to fix buggy animation morphing between periods
          data={priceData}
          data2={smaData.length > 0 ? smaData : undefined}
          width={chartWidth}
          height={180}
          color="#007AFF"
          color2="#FF9500"
          thickness={2}
          thickness2={1.5}
          hideDataPoints
          hideDataPoints2
          noOfSections={noOfSections}
          stepValue={stepValue}
          yAxisOffset={yMin}
          yAxisTextStyle={{ color: '#8E8E93', fontSize: 10 }}
          xAxisLabelTextStyle={{ color: '#8E8E93', fontSize: 10, width: 45, marginLeft: -15 }}
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
    );
  };

  const renderFundamentals = (item: StockData) => (
    <View style={s.fundGrid}>
      <View style={s.fundRow}>
        <View style={s.fundItem}><Text style={s.fundLabel}>52v Hög</Text><Text style={s.fundVal}>{item.fiftyTwoWeekHigh?.toFixed(2) || '-'}</Text></View>
        <View style={s.fundItem}><Text style={s.fundLabel}>52v Låg</Text><Text style={s.fundVal}>{item.fiftyTwoWeekLow?.toFixed(2) || '-'}</Text></View>
        <View style={s.fundItem}><Text style={s.fundLabel}>P/E</Text><Text style={s.fundVal}>{item.trailingPE?.toFixed(1) || '-'}</Text></View>
      </View>
      <View style={s.fundRow}>
        <View style={s.fundItem}><Text style={s.fundLabel}>Utdelning</Text><Text style={s.fundVal}>{item.dividendYield ? `${(item.dividendYield*100).toFixed(1)}%` : '-'}</Text></View>
        <View style={s.fundItem}><Text style={s.fundLabel}>Volym</Text><Text style={s.fundVal}>{formatVol(item.latestVolume)}</Text></View>
        <View style={s.fundItem}><Text style={s.fundLabel}>Börsvärde</Text><Text style={s.fundVal}>{formatMCap(item.marketCap)}</Text></View>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: StockData }) => {
    const isExpanded = expandedTicker === item.ticker;
    const hc = item.healthCheck;
    const gc = hc ? gradeColors[hc.grade] : gradeColors.F;
    const dayChange = item.regularMarketChangePercent;
    const dayColor = dayChange != null && dayChange >= 0 ? '#34C759' : '#FF3B30';

    return (
      <TouchableOpacity style={[s.card, { borderLeftWidth: 3, borderLeftColor: gc?.border || '#333' }]} activeOpacity={0.85} onPress={() => setExpandedTicker(isExpanded ? null : item.ticker)}>
        {/* Top row: ticker + grade + price */}
        <View style={s.cardTop}>
          <View style={{ flex: 1 }}>
            <View style={s.tickerRow}>
              <Text style={s.ticker}>{item.ticker.replace('.ST', '')}</Text>
              {hc && renderGradeBadge(hc)}
            </View>
            <Text style={s.companyName} numberOfLines={1}>{item.companyName}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.price}>{item.currentPrice?.toFixed(2)}</Text>
            {dayChange != null && (
              <Text style={[s.dayChange, { color: dayColor }]}>{dayChange >= 0 ? '▲' : '▼'} {Math.abs(dayChange).toFixed(2)}%</Text>
            )}
          </View>
        </View>

        {/* Quick stats row */}
        <View style={s.quickStats}>
          <View style={s.qStat}>
            <Text style={s.qLabel}>SMA</Text>
            <Text style={[s.qVal, item.sma125 && item.currentPrice < item.sma125 ? { color: '#FF3B30' } : { color: '#34C759' }]}>{item.diffPercent125?.toFixed(1) || '-'}%</Text>
          </View>
          <View style={s.qDiv} />
          <View style={s.qStat}>
            <Text style={s.qLabel}>RSI</Text>
            <Text style={[s.qVal, item.rsi != null && item.rsi < 30 ? { color: '#FF3B30' } : item.rsi != null && item.rsi > 70 ? { color: '#34C759' } : {}]}>{item.rsi?.toFixed(0) || '-'}</Text>
          </View>
          <View style={s.qDiv} />
          <View style={s.qStat}>
            <Text style={s.qLabel}>Risk</Text>
            <Text style={[s.qVal, { color: riskColors[hc?.riskLevel || 'Medel'] || '#FF9500' }]}>{hc?.riskLevel || '-'}</Text>
          </View>
          <View style={s.qDiv} />
          <View style={s.qStat}>
            <Text style={s.qLabel}>Mom.</Text>
            <Text style={s.qVal}>{hc ? momentumIcons[hc.momentum] || '→' : '-'}</Text>
          </View>
        </View>

        {/* Summary text preview */}
        {hc && !isExpanded && (
          <Text style={s.summaryPreview} numberOfLines={2}>{hc.summary}</Text>
        )}

        {/* Expanded: full health check + chart + fundamentals */}
        {isExpanded && (
          <View style={s.expanded}>
            {renderHealthCard(item)}
            {renderChart(item)}
            {renderFundamentals(item)}
            {market === 'watchlist' && (
              <TouchableOpacity style={s.removeBtn} onPress={() => saveWatchlist(watchlist.filter(t => t !== item.ticker))}>
                <Text style={s.removeBtnText}>Ta bort från listan</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={s.expandHint}>
          <Text style={s.expandHintText}>{isExpanded ? '▲ Stäng' : '▼ Visa hälsokoll & graf'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const filteredData = getFilteredData();
  const gradeACount = data.filter(d => d.healthCheck?.grade === 'A').length;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.topSticky}>
        <View style={s.header}>
          <View style={s.headerRow}>
            <Text style={s.headerTitle}>📊 Screener</Text>
            <View style={s.headerBadge}><Text style={s.headerBadgeText}>{filteredData.length} av {data.length}</Text></View>
          </View>
          <Text style={s.headerSub}>
            {lastUpdated ? `Uppdaterad ${new Date(lastUpdated).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}` : 'Hämtar...'}
            {gradeACount > 0 ? ` · 🏆 ${gradeACount} med betyg A` : ''}
          </Text>
        </View>
        {renderTabs()}
        {renderSearch()}
        {renderFilters()}
      </View>
      
      {loading && !refreshing && data.length === 0 ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={s.loadingText}>Analyserar marknaden...</Text>
        </View>
      ) : (
        <FlatList 
          data={filteredData} 
          keyExtractor={i => i.ticker} 
          renderItem={renderItem}
          ListEmptyComponent={() => (
            <View style={s.emptyWrap}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>{market === 'watchlist' && watchlist.length === 0 ? '👀' : '🚀'}</Text>
              <Text style={s.emptyText}>{market === 'watchlist' && watchlist.length === 0 ? 'Sök efter aktier ovan!' : 'Inga aktier matchar filtret!'}</Text>
            </View>
          )}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" colors={['#007AFF']} />}
        />
      )}
    </SafeAreaView>
  );
}

// ─── STYLES ─────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topSticky: { backgroundColor: '#000', zIndex: 10, paddingBottom: 5 },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#FFF' },
  headerBadge: { backgroundColor: '#1C1C1E', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  headerBadgeText: { color: '#8E8E93', fontSize: 13, fontWeight: '600' },
  headerSub: { fontSize: 13, color: '#8E8E93', marginTop: 4 },

  tabsScroll: { flexGrow: 0, marginBottom: 12 },
  tabsContainer: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 4 },
  tab: { paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#222' },
  activeTab: { borderBottomColor: '#007AFF' },
  tabText: { color: '#8E8E93', fontWeight: '600', fontSize: 14 },
  activeTabText: { color: '#007AFF' },

  searchWrap: { paddingHorizontal: 16, marginBottom: 10, zIndex: 100 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, color: '#FFF', fontSize: 15 },
  dropdown: { backgroundColor: '#2C2C2E', borderRadius: 12, marginTop: 6, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#3A3A3C' },
  dropSymbol: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  dropName: { color: '#8E8E93', fontSize: 12, marginTop: 2 },
  dropExch: { backgroundColor: '#3A3A3C', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  dropExchText: { color: '#8E8E93', fontSize: 11 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  wlChip: { backgroundColor: '#2C2C2E', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  wlChipText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  filtersScroll: { marginBottom: 15, paddingBottom: 5 },
  filtersRow: { paddingHorizontal: 16, gap: 8 },
  chip: { backgroundColor: '#1C1C1E', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  chipActive: { backgroundColor: 'rgba(0,122,255,0.15)', borderColor: '#007AFF' },
  chipText: { color: '#8E8E93', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#007AFF' },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8E8E93', marginTop: 12, fontSize: 16 },
  list: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#8E8E93', fontSize: 17, textAlign: 'center' },

  // Card
  card: { backgroundColor: '#1C1C1E', borderRadius: 16, padding: 16, marginBottom: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  tickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ticker: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  companyName: { color: '#8E8E93', fontSize: 13, marginTop: 2, maxWidth: 200 },
  price: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  dayChange: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  gradeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  gradeText: { fontSize: 13, fontWeight: '900' },

  quickStats: { flexDirection: 'row', backgroundColor: '#2C2C2E', borderRadius: 12, padding: 10, marginBottom: 8 },
  qStat: { flex: 1, alignItems: 'center' },
  qLabel: { color: '#8E8E93', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 },
  qVal: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  qDiv: { width: 1, backgroundColor: '#3A3A3C' },

  summaryPreview: { color: '#AEAEB2', fontSize: 13, lineHeight: 18, marginTop: 4 },

  expanded: { marginTop: 12 },

  // Health Card
  healthCard: { backgroundColor: '#111827', borderRadius: 14, padding: 16, marginBottom: 16 },
  healthHeader: { flexDirection: 'row', marginBottom: 14 },
  gradeBigBadge: { width: 60, height: 60, borderRadius: 12, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  gradeBigText: { fontSize: 28, fontWeight: '900' },
  gradeSubText: { fontSize: 11, fontWeight: '600', marginTop: -2 },
  healthSummaryWrap: { flex: 1, justifyContent: 'center' },
  healthSummary: { color: '#D1D5DB', fontSize: 14, lineHeight: 20 },

  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  pill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, borderWidth: 1 },
  pillLabel: { color: '#8E8E93', fontSize: 12, fontWeight: '600' },

  checklist: { backgroundColor: '#1F2937', borderRadius: 10, padding: 12 },
  checklistTitle: { color: '#9CA3AF', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  checkIcon: { fontSize: 14, width: 24 },
  checkLabel: { flex: 1, color: '#D1D5DB', fontSize: 13 },
  checkDetail: { fontSize: 13, fontWeight: '700', minWidth: 60, textAlign: 'right' },
  checkResult: { borderTopWidth: 1, borderTopColor: '#374151', paddingTop: 10, marginTop: 6, alignItems: 'center' },
  checkResultText: { color: '#9CA3AF', fontSize: 13, fontWeight: '700' },
  checkExplain: { backgroundColor: '#111827', borderRadius: 8, padding: 12, marginTop: 4, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#007AFF' },
  checkExplainText: { color: '#9CA3AF', fontSize: 13, lineHeight: 19 },

  // Chart
  chartSection: { marginBottom: 16 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  chartTitle: { color: '#8E8E93', fontSize: 13, fontWeight: '600' },
  periodTabs: { flexDirection: 'row', backgroundColor: '#1C1C1E', borderRadius: 6, padding: 2 },
  periodBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  periodBtnActive: { backgroundColor: '#3A3A3C' },
  periodBtnText: { color: '#8E8E93', fontSize: 11, fontWeight: '600' },
  periodBtnTextActive: { color: '#FFF' },
  
  chartLegend: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: '#8E8E93', fontSize: 12 },

  // Fundamentals
  fundGrid: { backgroundColor: '#2C2C2E', borderRadius: 12, padding: 12, marginBottom: 16 },
  fundRow: { flexDirection: 'row', marginBottom: 8 },
  fundItem: { flex: 1 },
  fundLabel: { color: '#8E8E93', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 },
  fundVal: { color: '#FFF', fontSize: 14, fontWeight: '600' },

  removeBtn: { alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255,59,48,0.1)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)' },
  removeBtnText: { color: '#FF3B30', fontWeight: '600', fontSize: 14 },

  expandHint: { alignItems: 'center', paddingTop: 8 },
  expandHintText: { color: '#555', fontSize: 12, fontWeight: '500' },
});
