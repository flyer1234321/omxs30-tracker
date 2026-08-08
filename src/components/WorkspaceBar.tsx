import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { HintedTouchable } from '@/components/HintedTouchable';
import { InfoTip } from '@/components/Tooltip';
import { glossaryEntry, WORKSPACE_GLOSSARY_KEYS } from '@/lib/glossary';
import { DEFAULT_WORKSPACES, TABLE_COLUMNS, tableColumnLabel, workspaceDisplayName } from '@/lib/workspaces';
import { useAppLanguage } from '@/components/AppLanguage';
import type { TableColumnId, Workspace } from '@/types/stock';
import { colors as palette } from '@/theme';

interface WorkspaceBarProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSelect: (id: string) => void;
  onUpdateColumns: (id: string, columns: TableColumnId[]) => void;
  onCreate: (name: string, columns: TableColumnId[]) => void;
  onDelete: (id: string) => void;
  onReset: (id: string) => void;
}

export function WorkspaceBar({ workspaces, activeWorkspaceId, onSelect, onUpdateColumns, onCreate, onDelete, onReset }: WorkspaceBarProps) {
  const { language, t } = useAppLanguage();
  const { height: viewportHeight } = useWindowDimensions();
  // Utfallbara paneler får aldrig äta hela höjden: tabellen ligger under dem
  // och sidan i sig scrollar inte.
  const panelMaxHeight = Math.max(200, viewportHeight * 0.4);
  const [editing, setEditing] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [draftColumns, setDraftColumns] = useState<TableColumnId[]>([]);
  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0],
    [activeWorkspaceId, workspaces],
  );

  useEffect(() => {
    setDraftColumns(activeWorkspace?.columns ?? []);
  }, [activeWorkspace?.id, activeWorkspace?.columns]);

  if (!activeWorkspace) return null;
  const activeColumns = activeWorkspace.columns;
  const selectedColumns = editing ? draftColumns : activeColumns;
  const explainedColumns = TABLE_COLUMNS.filter((column) => activeColumns.includes(column.id));
  const activeGlossaryKey = WORKSPACE_GLOSSARY_KEYS[activeWorkspace.id];
  const activeSummary = activeGlossaryKey
    ? glossaryEntry(activeGlossaryKey, language).short
    : t('Din sparade vy med de kolumner du själv har valt.', 'Your saved view with the columns you selected.');
  const activeName = workspaceDisplayName(activeWorkspace, language);

  const toggleColumn = (column: TableColumnId) => {
    if (column === 'ticker') return;
    const next = selectedColumns.includes(column)
      ? selectedColumns.filter((id) => id !== column)
      : [...selectedColumns, column];
    if (next.length >= 2) setDraftColumns(next);
  };

  const createWorkspace = () => {
    const name = newWorkspaceName.trim();
    if (!name) return;
    onCreate(name, selectedColumns);
    setNewWorkspaceName('');
    setEditing(false);
  };

  const toggleEditing = () => {
    if (!editing) setDraftColumns(activeWorkspace.columns);
    setEditing((value) => !value);
  };

  const applyColumns = () => {
    onUpdateColumns(activeWorkspace.id, draftColumns);
    setEditing(false);
  };

  const resetDefault = () => {
    const original = DEFAULT_WORKSPACES.find((workspace) => workspace.id === activeWorkspace.id);
    if (!original) return;
    setDraftColumns(original.columns);
    onReset(activeWorkspace.id);
  };

  const deleteCurrent = () => {
    onDelete(activeWorkspace.id);
    setEditing(false);
    setNewWorkspaceName('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <ScrollView horizontal style={styles.tabsScroll} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {workspaces.map((workspace) => (
            <View key={workspace.id} style={[styles.tab, workspace.id === activeWorkspace.id && styles.tabActive]}>
              {WORKSPACE_GLOSSARY_KEYS[workspace.id] ? (
                <InfoTip
                  term={WORKSPACE_GLOSSARY_KEYS[workspace.id]}
                  style={styles.tabSelect}
                  onPress={() => onSelect(workspace.id)}
                  accessibilityLabel={`${t('Välj vyn', 'Select view')} ${workspaceDisplayName(workspace, language)}`}
                >
                  <Text style={[styles.tabText, workspace.id === activeWorkspace.id && styles.tabTextActive]}>{workspaceDisplayName(workspace, language)}</Text>
                </InfoTip>
              ) : (
                <HintedTouchable
                  style={styles.tabSelect}
                  onPress={() => onSelect(workspace.id)}
                  accessibilityLabel={`${t('Välj vyn', 'Select view')} ${workspace.name}`}
                  hint={t(`En egen vy med de kolumner du har valt för ${workspace.name}.`, `A custom view with the columns selected for ${workspace.name}.`)}
                >
                  <Text style={[styles.tabText, workspace.id === activeWorkspace.id && styles.tabTextActive]}>{workspace.name}</Text>
                </HintedTouchable>
              )}
            </View>
          ))}
        </ScrollView>
        <View style={styles.actionButtons}>
          <HintedTouchable style={[styles.helpButton, showHelp && styles.helpButtonActive]} onPress={() => setShowHelp((value) => !value)} accessibilityLabel={showHelp ? t('Stäng förklaringar', 'Close explanations') : t('Visa förklaringar', 'Show explanations')} hint={t('Visar en kort förklaring av vyn och tabellens synliga rubriker.', 'Shows a short explanation of the view and its visible table columns.')}>
            <Text style={[styles.helpButtonText, showHelp && styles.helpButtonTextActive]}>{showHelp ? t('Stäng hjälp', 'Close help') : t('Förklaringar', 'Explanations')}</Text>
          </HintedTouchable>
          <HintedTouchable
            style={styles.editButton}
            onPress={toggleEditing}
            accessibilityLabel={editing ? t('Stäng kolumninställningar', 'Close column settings') : t('Ändra kolumner', 'Edit columns')}
            hint={editing ? t('Stänger utan att spara osparade kolumnval.', 'Closes without saving unsaved column choices.') : t('Välj vilka nyckeltal som ska synas i den aktuella tabellvyn.', 'Choose which metrics appear in the current table view.')}
          >
            <Text style={styles.editButtonText}>{editing ? t('Stäng', 'Close') : t('Kolumner', 'Columns')}</Text>
          </HintedTouchable>
        </View>
      </View>
      <Text style={styles.activeSummary}>{activeName}: {activeSummary}</Text>

      {showHelp && (
        <ScrollView style={[styles.helpPanel, { maxHeight: panelMaxHeight }]} contentContainerStyle={styles.helpPanelContent} nestedScrollEnabled>
          <Text style={styles.helpEyebrow}>{activeName}</Text>
          <Text style={styles.helpTitle}>{t('Så läser du den här vyn', 'How to read this view')}</Text>
          <Text style={styles.helpIntro}>
            {WORKSPACE_GLOSSARY_KEYS[activeWorkspace.id]
              ? glossaryEntry(WORKSPACE_GLOSSARY_KEYS[activeWorkspace.id], language).detail
              : t(`En egen vy med de kolumner du har valt för ${activeWorkspace.name}.`, `A custom view with the columns selected for ${activeWorkspace.name}.`)}
          </Text>
          <View style={styles.helpGrid}>
            {explainedColumns.map((column) => (
              <View key={column.id} style={styles.helpItem}>
                <Text style={styles.helpItemTitle}>{tableColumnLabel(column, language)}</Text>
                <Text style={styles.helpItemText}>{glossaryEntry(column.id, language).detail}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {editing && (
        <ScrollView style={[styles.panel, { maxHeight: panelMaxHeight }]} contentContainerStyle={styles.panelContent} nestedScrollEnabled>
          <Text style={styles.panelTitle}>{t('Visade kolumner', 'Visible columns')}</Text>
          <View style={styles.columnList}>
            {TABLE_COLUMNS.map((column) => {
              const selected = selectedColumns.includes(column.id);
              return (
                <InfoTip
                  key={column.id}
                  term={column.id}
                  style={[styles.columnToggle, selected && styles.columnToggleSelected]}
                  onPress={() => toggleColumn(column.id)}
                  accessibilityLabel={`${selected ? t('Dölj', 'Hide') : t('Visa', 'Show')} ${t('kolumnen', 'column')} ${tableColumnLabel(column, language)}`}
                >
                  <Text style={[styles.columnToggleText, selected && styles.columnToggleTextSelected]}>
                    {selected ? '✓ ' : ''}{tableColumnLabel(column, language)}
                  </Text>
                </InfoTip>
              );
            })}
          </View>
          <View style={styles.actionRow}>
            <TextInput
              value={newWorkspaceName}
              onChangeText={setNewWorkspaceName}
              placeholder={t('Namn på ny vy', 'Name of new view')}
              placeholderTextColor={palette.textSecondary}
              style={styles.nameInput}
              maxLength={32}
              accessibilityLabel={t('Namn på ny tabellvy', 'Name of new table view')}
              accessibilityHint={t('Skriv ett namn för en sparad vy med de kolumner du valt.', 'Enter a name for a saved view containing your selected columns.')}
            />
            <HintedTouchable style={styles.saveButton} onPress={createWorkspace} accessibilityLabel={t('Spara som ny vy', 'Save as new view')} hint={t('Skapar en ny sparad tabellvy med det angivna namnet och de valda kolumnerna.', 'Creates a saved table view with the entered name and selected columns.')}>
              <Text style={styles.saveButtonText}>{t('Spara som ny', 'Save as new')}</Text>
            </HintedTouchable>
            <HintedTouchable style={styles.applyButton} onPress={applyColumns} accessibilityLabel={`${t('Spara kolumner i', 'Save columns in')} ${activeName}`} hint={t('Ersätter kolumnerna i den aktuella vyn med utkastet.', 'Replaces the columns in the current view with the draft selection.')}>
              <Text style={styles.applyButtonText}>{t('Använd i denna vy', 'Apply to this view')}</Text>
            </HintedTouchable>
            {activeWorkspace.isDefault && (
              <HintedTouchable style={styles.resetButton} onPress={resetDefault} accessibilityLabel={`${t('Återställ standardvyn', 'Reset default view')} ${activeName}`} hint={t('Återställer den här standardvyn till appens ursprungliga kolumner.', 'Restores this default view to the app’s original columns.')}>
                <Text style={styles.resetButtonText}>{t('Återställ standard', 'Reset default')}</Text>
              </HintedTouchable>
            )}
            {!activeWorkspace.isDefault && (
              <HintedTouchable style={styles.deleteButton} onPress={deleteCurrent} accessibilityLabel={`Ta bort vyn ${activeWorkspace.name}`} hint="Tar bort den aktuella egna vyn. Standardvyer kan inte tas bort.">
                <Text style={styles.deleteButtonText}>{t('Ta bort egen vy', 'Delete custom view')}</Text>
              </HintedTouchable>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.border },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12 },
  activeSummary: { color: palette.textSecondary, fontSize: 11, lineHeight: 16, paddingHorizontal: 14, paddingBottom: 8 },
  tabsScroll: { flex: 1 },
  tabs: { gap: 6, paddingVertical: 8, paddingRight: 8 },
  tab: { borderRadius: 5, backgroundColor: palette.surfaceAlt },
  tabSelect: { paddingHorizontal: 9, paddingVertical: 6 },
  tabActive: { backgroundColor: palette.accentBg },
  tabText: { color: palette.textSecondary, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: palette.accent },
  actionButtons: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: 6 },
  helpButton: { paddingVertical: 6, paddingHorizontal: 7, borderRadius: 5 },
  helpButtonActive: { backgroundColor: palette.accentBg },
  helpButtonText: { color: palette.textSecondary, fontSize: 12, fontWeight: '600' },
  helpButtonTextActive: { color: palette.accent },
  editButton: { paddingVertical: 6, paddingHorizontal: 8 },
  editButtonText: { color: palette.accent, fontSize: 12, fontWeight: '600' },
  helpPanelContent: { paddingHorizontal: 14, paddingVertical: 13 },
  helpPanel: { borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.surfaceAlt },
  helpEyebrow: { color: palette.accent, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
  helpTitle: { color: palette.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 3 },
  helpIntro: { color: palette.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4, maxWidth: 760 },
  helpGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  helpItem: { width: '31.8%', minWidth: 210, flexGrow: 1, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: palette.borderStrong, borderRadius: 6, backgroundColor: palette.surface },
  helpItemTitle: { color: palette.textPrimary, fontSize: 12, fontWeight: '800', marginBottom: 3 },
  helpItemText: { color: palette.textSecondary, fontSize: 11, lineHeight: 16 },
  panelContent: { padding: 12 },
  panel: { borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.surfaceAlt },
  panelTitle: { color: palette.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  columnList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  columnToggle: { borderWidth: 1, borderColor: palette.borderStrong, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 5 },
  columnToggleSelected: { borderColor: palette.accent, backgroundColor: palette.accentBg },
  columnToggleText: { color: palette.textSecondary, fontSize: 11 },
  columnToggleTextSelected: { color: palette.accent },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  nameInput: { color: palette.textPrimary, borderWidth: 1, borderColor: palette.borderStrong, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 7, fontSize: 12, minWidth: 140 },
  saveButton: { backgroundColor: '#2563eb', borderRadius: 5, paddingHorizontal: 9, paddingVertical: 8 },
  saveButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  applyButton: { borderWidth: 1, borderColor: palette.accent, borderRadius: 5, paddingHorizontal: 9, paddingVertical: 8 },
  applyButtonText: { color: palette.accent, fontSize: 12, fontWeight: '700' },
  resetButton: { paddingHorizontal: 8, paddingVertical: 8 },
  resetButtonText: { color: palette.textSecondary, fontSize: 12, fontWeight: '600' },
  deleteButton: { paddingHorizontal: 8, paddingVertical: 8 },
  deleteButtonText: { color: palette.negative, fontSize: 12, fontWeight: '600' },
});
