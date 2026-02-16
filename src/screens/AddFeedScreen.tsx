import React, { useEffect, useMemo, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../app/navigation';
import { Button, Card, Input, Label, Row, SelectPill } from '../components/ui';
import { addFeed, FeedInput, getFeedById, softDeleteFeed, updateFeed } from '../db/feedRepo';
import { useAppContext } from '../context/AppContext';
import { displayToMl, mlToDisplay } from '../utils/units';
import { recalculateReminder } from '../services/reminderCoordinator';

const feedTypes: FeedInput['type'][] = ['breast', 'bottle', 'formula', 'solids'];
const sides: FeedInput['side'][] = ['left', 'right', 'both', 'none'];

export const AddFeedScreen = ({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'AddFeed'>) => {
  const { babyId, amountUnit, reminderSettings, syncNow } = useAppContext();
  const feedId = route.params?.feedId;

  const [timestamp, setTimestamp] = useState(new Date());
  const [type, setType] = useState<FeedInput['type']>('bottle');
  const [amount, setAmount] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [side, setSide] = useState<FeedInput['side']>('none');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const canHaveAmount = useMemo(() => type === 'bottle' || type === 'formula' || type === 'solids', [type]);

  useEffect(() => {
    if (!feedId) return;

    const load = async () => {
      const feed = await getFeedById(feedId);
      if (!feed) return;
      setTimestamp(new Date(feed.timestamp));
      setType(feed.type);
      setAmount(feed.amount_ml ? String(mlToDisplay(feed.amount_ml, amountUnit).toFixed(1)) : '');
      setDurationMinutes(feed.duration_minutes ? String(feed.duration_minutes) : '');
      setSide(feed.side);
      setNotes(feed.notes ?? '');
    };

    load();
  }, [feedId, amountUnit]);

  const onSave = async () => {
    try {
      setBusy(true);
      const amountMl = canHaveAmount && amount ? displayToMl(Number(amount), amountUnit) : null;
      const payload: FeedInput = {
        timestamp: timestamp.toISOString(),
        type,
        amount_ml: Number.isFinite(amountMl as number) ? amountMl : null,
        duration_minutes: durationMinutes ? Number(durationMinutes) : null,
        side,
        notes: notes || null,
      };

      if (feedId) {
        await updateFeed(feedId, payload);
      } else {
        await addFeed(babyId, payload);
      }

      await recalculateReminder(babyId, reminderSettings);
      await syncNow();
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Failed to save', error?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!feedId) return;

    Alert.alert('Delete feed', 'This will remove the feed from history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await softDeleteFeed(feedId);
            await recalculateReminder(babyId, reminderSettings);
            await syncNow();
            navigation.goBack();
          } catch (error: any) {
            Alert.alert('Failed to delete', error?.message ?? 'Unknown error');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card title="Feed Details">
          <Label>Timestamp</Label>
          <DateTimePicker value={timestamp} onChange={(_, next) => next && setTimestamp(next)} mode="datetime" />

          <Label>Type</Label>
          <Row>
            {feedTypes.map((option) => (
              <SelectPill key={option} label={option} selected={type === option} onPress={() => setType(option)} />
            ))}
          </Row>

          <Label>Amount ({amountUnit})</Label>
          <Input
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder={canHaveAmount ? `Enter ${amountUnit}` : 'Optional'}
          />

          <Label>Duration (minutes)</Label>
          <Input value={durationMinutes} onChangeText={setDurationMinutes} keyboardType="number-pad" />

          <Label>Side</Label>
          <Row>
            {sides.map((option) => (
              <SelectPill key={option} label={option} selected={side === option} onPress={() => setSide(option)} />
            ))}
          </Row>

          <Label>Notes</Label>
          <Input value={notes} onChangeText={setNotes} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
        </Card>

        <Button title={busy ? 'Saving...' : 'Save Feed'} onPress={onSave} />
        {feedId ? <Button title="Delete Feed" variant="danger" onPress={onDelete} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  content: { padding: 16, gap: 10 },
});
