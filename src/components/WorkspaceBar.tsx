import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { HintedTouchable } from '@/components/HintedTouchable';
import { TABLE_COLUMNS } from '@/lib/workspaces';
import type { TableColumnId, Workspace } from '@/types/stock';

interface WorkspaceBarProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSelect: (id: string) => void;
  onUpdateColumns: (id: string, columns: TableColumnId[]) => void;
  onCreate: (name: string, columns: TableColumnId[]) => void;
  onDelete: (id: string) => void;
}

export function WorkspaceBar({ workspaces, activeWorkspaceId, onSelect, onUpdateColumns, onCreate, onDelete }: WorkspaceBarProps) {
  const [editing, setEditing] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0],
    [activeWorkspaceId, workspaces],
  );

  if (!activeWorkspace) return null;
  const selectedColumns = activeWorkspace.columns;

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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {workspaces.map((workspace) => (
            <HintedTouchable
              key={workspace.id}
              style={[styles.tab, workspace.id === activeWorkspace.id && styles.tabActive]}
              onPress={() => onSelect(workspace.id)}
              accessibilityLabel={`Välj vyn ${workspace.name}`}
              hint={`Väljer vyn ${workspace.name}. En vy ändrar bara vilka kolumner som visas i tabellen.`}
            >
              <Text style={[styles.tabText, workspace.id === activeWorkspace.id && styles.tabTextActive]}>{workspace.name}</Text>
            </HintedTouchable>
          ))}
        </ScrollView>
        <HintedTouchable style={styles.editButton} onPress={() => setEditing((value) => !value)} accessibilityLabel={editing ? 'Stäng kolumninställningar' : 'Ändra kolumner'} hint={editing ? 'Stänger inställningarna för tabellkolumner.' : 'Välj vilka nyckeltal som ska synas i den aktuella tabellvyn.'}>
          <Text style={styles.editButtonText}>{editing ? 'Klar' : 'Kolumner'}</Text>
        </HintedTouchable>
      </View>

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
              placeholderTextColor="#6b6b82"
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
  container: { backgroundColor: '#111118', borderBottomWidth: 1, borderBottomColor: '#1e1e2e' },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12 },
  tabs: { gap: 6, paddingVertical: 8, paddingRight: 8 },
  tab: { borderRadius: 5, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#161620' },
  tabActive: { backgroundColor: 'rgba(59,130,246,0.16)' },
  tabText: { color: '#a0a0b2', fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#93c5fd' },
  editButton: { marginLeft: 'auto', marginRight: 12, paddingVertical: 6, paddingHorizontal: 8 },
  editButtonText: { color: '#93c5fd', fontSize: 12, fontWeight: '600' },
  panel: { borderTopWidth: 1, borderTopColor: '#1e1e2e', padding: 12, backgroundColor: '#161620' },
  panelTitle: { color: '#a0a0b2', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  columnList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  columnToggle: { borderWidth: 1, borderColor: '#2a2a38', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 5 },
  columnToggleSelected: { borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.12)' },
  columnToggleText: { color: '#8e8e9e', fontSize: 11 },
  columnToggleTextSelected: { color: '#bfdbfe' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  nameInput: { color: '#e2e2ea', borderWidth: 1, borderColor: '#2a2a38', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 7, fontSize: 12, minWidth: 140 },
  saveButton: { backgroundColor: '#2563eb', borderRadius: 5, paddingHorizontal: 9, paddingVertical: 8 },
  saveButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  deleteButton: { paddingHorizontal: 8, paddingVertical: 8 },
  deleteButtonText: { color: '#fca5a5', fontSize: 12, fontWeight: '600' },
});
