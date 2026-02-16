import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDateTime } from '../utils/time';

type Props = {
  syncState: 'idle' | 'syncing' | 'success' | 'error';
  lastSyncAt: string | null;
  syncError: string | null;
  enabled: boolean;
};

export const SyncBanner = ({ syncState, lastSyncAt, syncError, enabled }: Props) => {
  if (!enabled) {
    return (
      <View style={[styles.wrap, styles.neutral]}>
        <Text style={styles.text}>Cloud sync disabled (missing Supabase env).</Text>
      </View>
    );
  }

  if (syncState === 'syncing') {
    return (
      <View style={[styles.wrap, styles.syncing]}>
        <Text style={styles.text}>Sync in progress...</Text>
      </View>
    );
  }

  if (syncState === 'error') {
    return (
      <View style={[styles.wrap, styles.error]}>
        <Text style={styles.text}>Sync error: {syncError ?? 'Unknown issue'}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, styles.success]}>
      <Text style={styles.text}>Last sync: {lastSyncAt ? formatDateTime(lastSyncAt) : 'Never'}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  text: {
    fontSize: 12,
    color: '#1f2937',
  },
  neutral: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },
  syncing: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  success: {
    backgroundColor: '#ecfdf3',
    borderColor: '#bbf7d0',
  },
  error: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
});

