import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { HintedTouchable } from '@/components/HintedTouchable';
import { TABLE_COLUMNS } from '@/lib/workspaces';
import type { TableColumnId, Workspace } from '@/types/stock';
import { colors as palette } from '@/theme';

interface WorkspaceBarProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSelect: (id: string) => void;
  onUpdateColumns: (id: string, columns: TableColumnId[]) => void;
  onCreate: (name: string, columns: TableColumnId[]) => void;
  onDelete: (id: string) => void;
}

const WORKSPACE_HELP: Record<string, string> = {
  overview: 'Balanserad grundvy med betyg, prisrörelse, RSI, volym, värdering och trend i samma tabell.',
  momentum: 'Fokuserar på styrkan i den pågående rörelsen: dagsförändring, RSI, relativ volym, trend och volatilitet.',
  risk: 'Fokuserar på nedsiderisk och svängningar: volatilitet, beta, största nedgång och intern risk/reward-poäng.',
  value: 'Fokuserar på värdering och kvalitet: hälsobetyg, P/E, volym, SMA och intern risk/reward-poäng.',
};

export function WorkspaceBar({ workspaces, activeWorkspaceId, onSelect, onUpdateColumns, onCreate, onDelete }: WorkspaceBarProps) {
  const [editing, setEditing] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0],
    [activeWorkspaceId, workspaces],
  );

  if (!activeWorkspace) return null;
  const selectedColumns = activeWorkspace.columns;
  const explainedColumns = TABLE_COLUMNS.filter((column) => selectedColumns.includes(column.id));

  const toggleColumn = (column: TableColumnId) => {
    if (column === 'ticker') return;
    const next = selectedColumns.includes(column)
      ? selectedColumns.filter((id) => id !== column)
      : [...selectedColumns, column];
    if (next.length >= 2) onUpdateColumns(activeWorkspace.id, next);
  };

  const createWorkspace = () => {
    const name = newWorkspaceName.trim();
    if (!name) return;
    onCreate(name, selectedColumns);
    setNewWorkspaceName('');
    setEditing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <ScrollView horizontal style={styles.tabsScroll} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {workspaces.map((workspace) => (
            <View key={workspace.id} style={[styles.tab, workspace.id === activeWorkspace.id && styles.tabActive]}>
              <HintedTouchable
                style={styles.tabSelect}
                onPress={() => onSelect(workspace.id)}
                accessibilityLabel={`Välj vyn ${workspace.name}`}
                hint={WORKSPACE_HELP[workspace.id] ?? `En egen vy med de kolumner du har valt för ${workspace.name}.`}
              >
                <Text style={[styles.tabText, workspace.id === activeWorkspace.id && styles.tabTextActive]}>{workspace.name}</Text>
              </HintedTouchable>
            </View>
          ))}
        </ScrollView>
        <View style={styles.actionButtons}>
          <HintedTouchable style={[styles.helpButton, showHelp && styles.helpButtonActive]} onPress={() => setShowHelp((value) => !value)} accessibilityLabel={showHelp ? 'Stäng förklaringar' : 'Visa förklaringar'} hint="Visar en kort förklaring av vyn och tabellens synliga rubriker.">
            <Text style={[styles.helpButtonText, showHelp && styles.helpButtonTextActive]}>{showHelp ? 'Stäng hjälp' : 'Förklaringar'}</Text>
          </HintedTouchable>
          <HintedTouchable style={styles.editButton} onPress={() => setEditing((value) => !value)} accessibilityLabel={editing ? 'Stäng kolumninställningar' : 'Ändra kolumner'} hint={editing ? 'Stänger inställningarna för tabellkolumner.' : 'Välj vilka nyckeltal som ska synas i den aktuella tabellvyn.'}>
            <Text style={styles.editButtonText}>{editing ? 'Klar' : 'Kolumner'}</Text>
          </HintedTouchable>
        </View>
      </View>

      {showHelp && (
        <View style={styles.helpPanel}>
          <Text style={styles.helpEyebrow}>{activeWorkspace.name}</Text>
          <Text style={styles.helpTitle}>Så läser du den här vyn</Text>
          <Text style={styles.helpIntro}>{WORKSPACE_HELP[activeWorkspace.id] ?? `En egen vy med de kolumner du har valt för ${activeWorkspace.name}.`}</Text>
          <View style={styles.helpGrid}>
            {explainedColumns.map((column) => (
              <View key={column.id} style={styles.helpItem}>
                <Text style={styles.helpItemTitle}>{column.label}</Text>
                <Text style={styles.helpItemText}>{column.description}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {editing && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Visade kolumner</Text>
          <View style={styles.columnList}>
            {TABLE_COLUMNS.map((column) => {
              const selected = selectedColumns.includes(column.id);
              return (
                <HintedTouchable
                  key={column.id}
                  disabled={column.id === 'ticker'}
                  style={[styles.columnToggle, selected && styles.columnToggleSelected]}
                  onPress={() => toggleColumn(column.id)}
                  accessibilityLabel={`${selected ? 'Dölj' : 'Visa'} kolumnen ${column.label}`}
                  hint={column.id === 'ticker' ? 'Ticker är alltid synlig så att varje aktie går att identifiera.' : `${selected ? 'Döljer' : 'Visar'} kolumnen ${column.label} i den aktuella tabellvyn.`}
                >
                  <Text style={[styles.columnToggleText, selected && styles.columnToggleTextSelected]}>
                    {selected ? '✓ ' : ''}{column.label}
                  </Text>
                </HintedTouchable>
              );
            })}
          </View>
          <View style={styles.actionRow}>
            <TextInput
              value={newWorkspaceName}
              onChangeText={setNewWorkspaceName}
              placeholder="Namn på ny vy"
              placeholderTextColor={palette.textSecondary}
              style={styles.nameInput}
              maxLength={32}
              accessibilityLabel="Namn på ny tabellvy"
              accessibilityHint="Skriv ett namn för en sparad vy med de kolumner du valt."
            />
            <HintedTouchable style={styles.saveButton} onPress={createWorkspace} accessibilityLabel="Spara som ny vy" hint="Skapar en ny sparad tabellvy med det angivna namnet och de valda kolumnerna.">
              <Text style={styles.saveButtonText}>Spara som ny</Text>
            </HintedTouchable>
            {!activeWorkspace.isDefault && (
              <HintedTouchable style={styles.deleteButton} onPress={() => onDelete(activeWorkspace.id)} accessibilityLabel={`Ta bort vyn ${activeWorkspace.name}`} hint="Tar bort den aktuella egna vyn. Standardvyer kan inte tas bort.">
                <Text style={styles.deleteButtonText}>Ta bort</Text>
              </HintedTouchable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.border },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12 },
  tabsScroll: { flex: 1 },
  tabs: { gap: 6, paddingVertical: 8, paddingRight: 8 },
  tab: { borderRadius: 5, backgroundColor: '#161620' },
  tabSelect: { paddingHorizontal: 9, paddingVertical: 6 },
  tabActive: { backgroundColor: 'rgba(59,130,246,0.16)' },
  tabText: { color: '#a0a0b2', fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#93c5fd' },
  actionButtons: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: 6 },
  helpButton: { paddingVertical: 6, paddingHorizontal: 7, borderRadius: 5 },
  helpButtonActive: { backgroundColor: 'rgba(59,130,246,0.16)' },
  helpButtonText: { color: '#a0a0b2', fontSize: 12, fontWeight: '600' },
  helpButtonTextActive: { color: '#93c5fd' },
  editButton: { paddingVertical: 6, paddingHorizontal: 8 },
  editButtonText: { color: '#93c5fd', fontSize: 12, fontWeight: '600' },
  helpPanel: { paddingHorizontal: 14, paddingVertical: 13, borderTopWidth: 1, borderTopColor: '#252536', backgroundColor: '#14141e' },
  helpEyebrow: { color: '#60a5fa', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
  helpTitle: { color: '#e2e8f0', fontSize: 15, fontWeight: '800', marginTop: 3 },
  helpIntro: { color: '#9ca9bd', fontSize: 12, lineHeight: 18, marginTop: 4, maxWidth: 760 },
  helpGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  helpItem: { width: '31.8%', minWidth: 210, flexGrow: 1, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: '#293346', borderRadius: 6, backgroundColor: '#10111a' },
  helpItemTitle: { color: '#dbeafe', fontSize: 12, fontWeight: '800', marginBottom: 3 },
  helpItemText: { color: '#9ca9bd', fontSize: 11, lineHeight: 16 },
  panel: { borderTopWidth: 1, borderTopColor: palette.border, padding: 12, backgroundColor: '#161620' },
  panelTitle: { color: '#a0a0b2', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  columnList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  columnToggle: { borderWidth: 1, borderColor: '#2a2a38', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 5 },
  columnToggleSelected: { borderColor: palette.accent, backgroundColor: 'rgba(59,130,246,0.12)' },
  columnToggleText: { color: '#8e8e9e', fontSize: 11 },
  columnToggleTextSelected: { color: '#bfdbfe' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  nameInput: { color: palette.textPrimary, borderWidth: 1, borderColor: '#2a2a38', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 7, fontSize: 12, minWidth: 140 },
  saveButton: { backgroundColor: '#2563eb', borderRadius: 5, paddingHorizontal: 9, paddingVertical: 8 },
  saveButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  deleteButton: { paddingHorizontal: 8, paddingVertical: 8 },
  deleteButtonText: { color: '#fca5a5', fontSize: 12, fontWeight: '600' },
});
