import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { glossaryEntry, glossaryText, type GlossaryKey } from '@/lib/glossary';
import { colors as palette } from '@/theme';

/**
 * Förklaringar vid muspekaren.
 *
 * Rutan renderas i ett lager högst upp i trädet, inte bredvid det den hör till.
 * Det är nödvändigt: tabellrubrikerna ligger i en horisontell ScrollView, och
 * ett absolut placerat syskon där hade klippts av vid kanten.
 *
 * Två fällor är värda att känna till, eftersom båda gav blinkande rutor:
 *
 * 1. Ett heltäckande stängningslager ovanpå skärmen stjäl muspekaren från det
 *    fält man hovrar över. Pekaren lämnar fältet, rutan stängs, lagret
 *    försvinner, pekaren är tillbaka på fältet, rutan öppnas igen - flera
 *    gånger i sekunden. Lagret finns därför bara på pekskärmar, där rutan
 *    öppnas med ett tryck och behöver något att stängas med.
 *
 * 2. Webbläsarens egen `title`-text visas ovanpå den här rutan och kommer och
 *    går av sig själv. Två förklaringar samtidigt blir oläsligt, så attributet
 *    är borta. Skärmläsare får texten via accessibilityHint i stället.
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

/** Höjd att räkna med innan rutan mätts, bara för första bildrutan. */
const ASSUMED_HEIGHT = 170;

/**
 * Kort fördröjning innan rutan stängs. Den överbryggar de enstaka bildrutor då
 * pekaren passerar mellan två intilliggande rubriker, så att rutan byter
 * innehåll i stället för att slockna och tändas.
 */
const HIDE_DELAY_MS = 120;

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TooltipState | null>(null);
  const [cardHeight, setCardHeight] = useState<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  const api = useMemo<TooltipApi>(() => ({
    show: (content, anchor) => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      setState((current) => {
        // Samma fält igen: rör inte tillståndet, annars mäts rutan om och
        // hoppar till.
        if (current && current.content.title === content.title && current.anchor.x === anchor.x) return current;
        setCardHeight(null);
        return { content, anchor };
      });
    },
    hide: () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        setState(null);
        setCardHeight(null);
        hideTimer.current = null;
      }, HIDE_DELAY_MS);
    },
  }), []);

  const position = useMemo(() => {
    if (!state) return null;
    const { anchor } = state;
    const height = cardHeight ?? ASSUMED_HEIGHT;

    // Vågrätt: centrera under ankaret, men håll rutan innanför skärmen.
    const preferredLeft = anchor.x + anchor.width / 2 - TOOLTIP_WIDTH / 2;
    const left = Math.max(EDGE_MARGIN, Math.min(preferredLeft, viewportWidth - TOOLTIP_WIDTH - EDGE_MARGIN));

    // Lodrätt: under ankaret om det får plats, annars ovanför.
    const below = anchor.y + anchor.height + GAP;
    const showAbove = below + height > viewportHeight - EDGE_MARGIN && anchor.y - height - GAP > EDGE_MARGIN;
    const top = showAbove ? anchor.y - height - GAP : Math.min(below, viewportHeight - height - EDGE_MARGIN);

    return { left, top: Math.max(EDGE_MARGIN, top) };
  }, [state, cardHeight, viewportWidth, viewportHeight]);

  return (
    <TooltipContext.Provider value={api}>
      {children}
      {state && position && (
        <View style={styles.overlay} pointerEvents="box-none">
          {/* Endast pekskärm: där öppnas rutan med ett tryck och behöver kunna
              stängas. På webben stängs den när pekaren lämnar fältet, och ett
              lager här hade stulit hovern och fått rutan att blinka. */}
          {Platform.OS !== 'web' && (
            <Pressable
              style={styles.dismissLayer}
              onPress={api.hide}
              accessibilityLabel="Stäng förklaringen"
            />
          )}
          <View
            style={[styles.card, { left: position.left, top: position.top }, cardHeight == null && styles.measuring]}
            pointerEvents="none"
            onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
          >
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
      >
        {children}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 },
  dismissLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
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
  /** Osynlig tills höjden är känd, så att rutan inte syns hoppa på plats. */
  measuring: { opacity: 0 },
  title: { color: palette.textStrong, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  short: { color: palette.accent, fontSize: 12, lineHeight: 17, marginBottom: 6 },
  detail: { color: palette.textBody, fontSize: 12, lineHeight: 18 },
  cautionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  cautionBar: { width: 2, borderRadius: 1, backgroundColor: palette.warning },
  caution: { color: palette.textSecondary, fontSize: 11, lineHeight: 16, flex: 1 },
});
