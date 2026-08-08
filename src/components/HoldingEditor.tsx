import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { HintedTouchable } from '@/components/HintedTouchable';
import { useAppLanguage } from '@/components/AppLanguage';
import { currencySuffix, formatNumber, formatPrice, formatSignedPercent } from '@/lib/format';
import { formatNumericInput, parseNumericInput } from '@/lib/numeric-input';
import {
  buildPosition,
  detectHoldingMismatch,
  portfolioWeight,
  approximateSekValue,
  type Holding,
  type PortfolioSummary,
} from '@/lib/holdings';
import { colors as palette } from '@/theme';
import type { StockData } from '@/types/stock';

interface HoldingEditorProps {
  item: StockData;
  holding: Holding | undefined;
  portfolio: PortfolioSummary | null;
  onSave: (holding: Holding) => void;
  onRemove: (ticker: string) => void;
}

/**
 * Ditt innehav i bolaget.
 *
 * Två tal räcker för att göra resten av sidan personlig: antal och
 * anskaffningsvärde. Först då blir handelsplanens risk ett belopp i stället för
 * en procentsats, och först då går det att se om positionen är för stor.
 */
export function HoldingEditor({ item, holding, portfolio, onSave, onRemove }: HoldingEditorProps) {
  const { t } = useAppLanguage();
  const [shares, setShares] = useState(() => formatNumericInput(holding?.shares));
  const [averagePrice, setAveragePrice] = useState(() => formatNumericInput(holding?.averagePrice));

  useEffect(() => {
    setShares(formatNumericInput(holding?.shares));
    setAveragePrice(formatNumericInput(holding?.averagePrice));
  }, [holding?.shares, holding?.averagePrice, item.ticker]);

  const parsedShares = parseNumericInput(shares);
  const parsedPrice = parseNumericInput(averagePrice);
  const canSave = parsedShares != null && parsedShares > 0 && parsedPrice != null && parsedPrice > 0;

  const position = buildPosition(item, holding);
  const weight = position && portfolio ? portfolioWeight(position, portfolio) : null;
  const mismatch = position ? detectHoldingMismatch(position) : null;
  const price = (value: number | null | undefined, decimals = 2) => formatPrice(value, item.currency, decimals);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('Ditt innehav', 'Your holding')}</Text>
      <Text style={styles.subtitle}>
        {t(
          'Antal och genomsnittligt anskaffningsvärde. Räknas bara på det du matar in - courtage, utdelningar och skatt ingår inte.',
          'Number of shares and average purchase price. Based only on what you enter - brokerage fees, dividends and tax are not included.',
        )}
      </Text>

      <View style={styles.inputRow}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{t('Antal aktier', 'Shares')}</Text>
          <TextInput
            style={styles.input}
            value={shares}
            onChangeText={setShares}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder={t('t.ex. 300', 'e.g. 300')}
            placeholderTextColor={palette.textMuted}
            accessibilityLabel={t('Antal aktier', 'Number of shares')}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{t('Snittkurs (GAV)', 'Average price')}</Text>
          <TextInput
            style={styles.input}
            value={averagePrice}
            onChangeText={setAveragePrice}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder={t('t.ex. 48,50', 'e.g. 48.50')}
            placeholderTextColor={palette.textMuted}
            accessibilityLabel={t('Genomsnittligt anskaffningsvärde per aktie', 'Average purchase price per share')}
          />
        </View>
      </View>

      <View style={styles.actions}>
        <HintedTouchable
          style={[styles.saveButton, !canSave && styles.disabled]}
          disabled={!canSave}
          onPress={() => {
            if (canSave) onSave({ ticker: item.ticker, shares: parsedShares, averagePrice: parsedPrice });
          }}
          accessibilityLabel={t('Spara innehav', 'Save holding')}
          hint={t(
            'Sparar antal och anskaffningsvärde. Uppgifterna används för att räkna om risken till stoppnivån i kronor.',
            'Saves the number of shares and purchase price. Used to express the risk to the stop level as an amount.',
          )}
        >
          <Text style={styles.saveButtonText}>{holding ? t('Uppdatera', 'Update') : t('Spara', 'Save')}</Text>
        </HintedTouchable>

        {holding && (
          <HintedTouchable
            style={styles.removeButton}
            onPress={() => onRemove(item.ticker)}
            accessibilityLabel={t('Ta bort innehavet', 'Remove holding')}
            hint={t('Tar bort innehavet. Aktien ligger kvar i bevakningen.', 'Removes the holding. The stock remains on your watchlist.')}
          >
            <Text style={styles.removeButtonText}>{t('Ta bort', 'Remove')}</Text>
          </HintedTouchable>
        )}
      </View>

      {position && (
        <>
          <View style={styles.figures}>
            <Figure
              label={t('Värde', 'Value')}
              value={price(position.marketValue, 0)}
              note={item.currency && item.currency.toUpperCase() !== 'SEK' ? formatPrice(approximateSekValue(position.marketValue, item.currency), 'SEK', 0) : undefined}
            />
            <Figure
              label={t('Orealiserat', 'Unrealised')}
              value={`${position.unrealisedAmount >= 0 ? '+' : ''}${price(position.unrealisedAmount, 0)}`}
              tone={position.unrealisedAmount >= 0 ? 'positive' : 'negative'}
              note={`${item.currency && item.currency.toUpperCase() !== 'SEK' ? (position.unrealisedAmount >= 0 ? '+' : '') + formatPrice(approximateSekValue(position.unrealisedAmount, item.currency), 'SEK', 0) + '\n' : ''}${formatSignedPercent(position.unrealisedPercent)}`}
            />
            <Figure
              label={t('I dag', 'Today')}
              value={position.dayChangeAmount == null ? '-' : `${position.dayChangeAmount >= 0 ? '+' : ''}${price(position.dayChangeAmount, 0)}`}
              tone={(position.dayChangeAmount ?? 0) >= 0 ? 'positive' : 'negative'}
              note={item.currency && item.currency.toUpperCase() !== 'SEK' && position.dayChangeAmount != null ? `${position.dayChangeAmount >= 0 ? '+' : ''}${formatPrice(approximateSekValue(position.dayChangeAmount, item.currency), 'SEK', 0)}` : undefined}
            />
          </View>

          <View style={styles.figures}>
            {weight != null && (
              <Figure
                label={t('Andel av portföljen', 'Share of portfolio')}
                value={`${formatNumber(weight, 0)} %`}
                note={weight >= 25 ? t('Stor koncentration', 'High concentration') : undefined}
                tone={weight >= 25 ? 'warning' : undefined}
              />
            )}
            {position.riskToStopAmount != null && (
              <Figure
                label={t('Risk till stoppen', 'Risk to stop')}
                value={price(position.riskToStopAmount, 0)}
                note={t('Om stoppnivån nås', 'If the stop is reached')}
              />
            )}
          </View>

          {mismatch === 'currency' && (
            <Text style={styles.warning}>
              {t(
                `Aktien handlas i ${item.currency ?? currencySuffix(item.currency)}, men ditt anskaffningsvärde ser ut att vara angivet i kronor - avvikelsen motsvarar ungefär växelkursen. Det här är sannolikt bolagets utländska notering. Leta upp den svenska, som slutar på .ST, och lägg in innehavet där i stället.`,
                `This share trades in ${item.currency ?? 'a foreign currency'}, but your purchase price looks like it was entered in another currency - the discrepancy matches the exchange rate. This is probably the company's foreign listing. Find the local listing and record the holding there instead.`,
              )}
            </Text>
          )}

          {mismatch === 'split' && (
            <Text style={styles.warning}>
              {t(
                'Kursen ligger långt från ditt registrerade anskaffningsvärde. Har aktien delats eller slagits samman behöver antal och GAV uppdateras - kurshistoriken är redan justerad, så felet syns annars inte.',
                'The price is far from your recorded purchase price. If the share has split or been consolidated, update the number of shares and the average price - price history is already adjusted, so the error is otherwise invisible.',
              )}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

function Figure({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'positive' | 'negative' | 'warning' }) {
  const color = tone === 'positive' ? palette.positive : tone === 'negative' ? palette.negative : tone === 'warning' ? palette.warning : palette.textPrimary;
  return (
    <View style={styles.figure}>
      <Text style={styles.figureLabel}>{label}</Text>
      <Text style={[styles.figureValue, { color }]}>{value}</Text>
      {note && <Text style={styles.figureNote}>{note}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    marginBottom: 24,
  },
  title: { color: palette.textStrong, fontSize: 16, fontWeight: '700' },
  subtitle: { color: palette.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 14 },
  inputRow: { flexDirection: 'row', gap: 12 },
  inputGroup: { flex: 1 },
  inputLabel: { color: palette.textSecondary, fontSize: 11, marginBottom: 4 },
  input: {
    backgroundColor: palette.bg, borderWidth: 1, borderColor: palette.borderStrong, borderRadius: 6,
    color: palette.textPrimary, fontSize: 15, paddingHorizontal: 12, paddingVertical: 10,
    fontVariant: ['tabular-nums'],
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  saveButton: {
    flex: 1, minHeight: 40, borderRadius: 6, backgroundColor: palette.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  saveButtonText: { color: palette.textStrong, fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  removeButton: { minHeight: 40, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  removeButtonText: { color: '#fca5a5', fontSize: 13, fontWeight: '600' },
  figures: { flexDirection: 'row', gap: 12, marginTop: 16 },
  figure: { flex: 1 },
  figureLabel: { color: palette.textMuted, fontSize: 11, marginBottom: 3 },
  figureValue: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  figureNote: { color: palette.textMuted, fontSize: 11, marginTop: 2 },
  warning: { color: palette.warning, fontSize: 11, lineHeight: 16, marginTop: 14 },
});
