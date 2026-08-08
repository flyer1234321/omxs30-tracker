import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { glossaryEntry, glossaryText, type GlossaryKey } from '@/lib/glossary';
import { colors as palette } from '@/theme';

/**
 * Förklaringar vid muspekaren.
 *
 * Tidigare låg de i webbläsarens egen `title`-text, som dröjer en sekund, inte
 * går att formatera och bryter illa på flera rader. Alternativet var att öppna
 * en hjälpsida, vilket bryter arbetsflödet mitt i en jämförelse.
 *
 * Rutan renderas i ett lager högst upp i trädet, inte bredvid det den hör till.
 * Det är nödvändigt: tabellrubrikerna ligger i en horisontell ScrollView, och
 * ett absolut placerat syskon där hade klippts av vid kanten.
 */

interface TooltipContent {
  title: string;
  short: string;
  detail: string;
  caution?: string;
}

interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TooltipState {
  content: TooltipContent;
  anchor: AnchorRect;
}

interface TooltipApi {
  show: (content: TooltipContent, anchor: AnchorRect) => void;
  hide: () => void;
}

const TooltipContext = createContext<TooltipApi>({ show: () => {}, hide: () => {} });

const TOOLTIP_WIDTH = 290;
const EDGE_MARGIN = 12;
const GAP = 8;

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TooltipState | null>(null);
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();

  const api = useMemo<TooltipApi>(() => ({
    show: (content, anchor) => setState({ content, anchor }),
    hide: () => setState(null),
  }), []);

  const position = useMemo(() => {
    if (!state) return null;
    const { anchor } = state;

    // Vågrätt: centrera under ankaret, men håll rutan innanför skärmen.
    const preferredLeft = anchor.x + anchor.width / 2 - TOOLTIP_WIDTH / 2;
    const left = Math.max(EDGE_MARGIN, Math.min(preferredLeft, viewportWidth - TOOLTIP_WIDTH - EDGE_MARGIN));

    // Lodrätt: under ankaret om det får plats, annars ovanför.
    const below = anchor.y + anchor.height + GAP;
    const estimatedHeight = 150;
    const showAbove = below + estimatedHeight > viewportHeight && anchor.y > estimatedHeight;
    const top = showAbove ? Math.max(EDGE_MARGIN, anchor.y - estimatedHeight - GAP) : below;

    return { left, top };
  }, [state, viewportWidth, viewportHeight]);

  return (
    <TooltipContext.Provider value={api}>
      {children}
      {state && position && (
        <View style={styles.overlay} pointerEvents="box-none">
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={api.hide}
            accessibilityLabel="Stäng förklaringen"
          />
          <View style={[styles.card, { left: position.left, top: position.top }]} pointerEvents="none">
            <Text style={styles.title}>{state.content.title}</Text>
            <Text style={styles.short}>{state.content.short}</Text>
            <Text style={styles.detail}>{state.content.detail}</Text>
            {state.content.caution && (
              <View style={styles.cautionRow}>
                <View style={styles.cautionBar} />
                <Text style={styles.caution}>{state.content.caution}</Text>
              </View>
            )}
          </View>
        </View>
      )}
    </TooltipContext.Provider>
  );
}

interface InfoTipProps {
  term: GlossaryKey;
  children: React.ReactNode;
  style?: React.ComponentProps<typeof View>['style'];
  /** Anropas vid klick, så att en rubrik kan både förklara och sortera. */
  onPress?: () => void;
  accessibilityLabel?: string;
}

/**
 * På webben visas rutan vid muspekaren. På telefon finns ingen pekare, så där
 * öppnas den vid tryck - och när elementet redan har en egen funktion, som att
 * sortera en kolumn, får ett långt tryck sköta förklaringen.
 */
export function InfoTip({ term, children, style, onPress, accessibilityLabel }: InfoTipProps) {
  const { show, hide } = useContext(TooltipContext);
  const anchorRef = useRef<View>(null);
  const entry = glossaryEntry(term);

  const reveal = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      show({ title: entry.term, short: entry.short, detail: entry.detail, caution: entry.caution }, { x, y, width, height });
    });
  }, [entry, show]);

  return (
    <View
      ref={anchorRef}
      style={style}
      onPointerEnter={Platform.OS === 'web' ? reveal : undefined}
      onPointerLeave={Platform.OS === 'web' ? hide : undefined}
    >
      <Pressable
        onPress={onPress ?? reveal}
        onLongPress={onPress ? reveal : undefined}
        delayLongPress={350}
        accessibilityRole={onPress ? 'button' : 'text'}
        accessibilityLabel={accessibilityLabel ?? entry.term}
        accessibilityHint={glossaryText(term)}
        // Webbläsarens egen hovertext behålls som reserv för den som navigerar
        // med tangentbord eller skärmläsare.
        {...(Platform.OS === 'web' ? ({ title: glossaryText(term) } as Record<string, string>) : {})}
      >
        {children}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 },
  card: {
    position: 'absolute',
    width: TOOLTIP_WIDTH,
    backgroundColor: palette.surfaceHover,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...Platform.select({
      web: { boxShadow: '0 8px 24px rgba(0,0,0,0.45)' } as object,
      default: { elevation: 8, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
    }),
  },
  title: { color: palette.textStrong, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  short: { color: palette.accent, fontSize: 12, lineHeight: 17, marginBottom: 6 },
  detail: { color: palette.textBody, fontSize: 12, lineHeight: 18 },
  cautionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  cautionBar: { width: 2, borderRadius: 1, backgroundColor: palette.warning },
  caution: { color: palette.textSecondary, fontSize: 11, lineHeight: 16, flex: 1 },
});
