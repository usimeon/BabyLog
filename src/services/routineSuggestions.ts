import { listDiaperLogs } from '../db/diaperRepo';
import { listFeeds } from '../db/feedRepo';
import { listMedicationLogs } from '../db/medicationRepo';
import { listTemperatureLogs } from '../db/temperatureRepo';

export type RoutineSuggestion = {
  id: string;
  title: string;
  detail: string;
};

export const getRoutineSuggestions = async (babyId: string): Promise<RoutineSuggestion[]> => {
  const [feeds, diapers, temps, meds] = await Promise.all([
    listFeeds(babyId),
    listDiaperLogs(babyId),
    listTemperatureLogs(babyId),
    listMedicationLogs(babyId),
  ]);

  const suggestions: RoutineSuggestion[] = [];

  const recentFeeds = feeds.filter((x) => Date.now() - new Date(x.timestamp).getTime() <= 7 * 24 * 60 * 60 * 1000);
  if (recentFeeds.length >= 5) {
    const hours = recentFeeds
      .slice(0, 20)
      .map((x) => new Date(x.timestamp).getHours())
      .sort((a, b) => a - b);
    const medianHour = hours[Math.floor(hours.length / 2)] ?? 9;
    suggestions.push({
      id: 'feed-window',
      title: 'Likely next feed window',
      detail: `Most feeds cluster around ${String(medianHour).padStart(2, '0')}:00. Consider preparing 30 minutes earlier.`,
    });
  }

  const recentDiapers = diapers.filter((x) => Date.now() - new Date(x.timestamp).getTime() <= 72 * 60 * 60 * 1000);
  if (recentDiapers.length) {
    const avgPerDay = recentDiapers.length / 3;
    suggestions.push({
      id: 'diaper-rate',
      title: 'Diaper rhythm',
      detail: `Average ${avgPerDay.toFixed(1)} diaper logs/day over last 3 days.`,
    });
  }

  const highTemps = temps.filter((x) => Number(x.temperature_c) >= 38).slice(0, 5);
  if (highTemps.length >= 2) {
    suggestions.push({
      id: 'temp-trend',
      title: 'Temperature trend watch',
      detail: `${highTemps.length} high-temperature entries were logged recently. Keep monitoring and seek medical guidance if needed.`,
    });
  }

  const medWithIntervals = meds.filter((x) => x.min_interval_hours && x.min_interval_hours > 0);
  if (medWithIntervals.length) {
    const latest = medWithIntervals[0];
    const dueAt = new Date(new Date(latest.timestamp).getTime() + (latest.min_interval_hours ?? 0) * 36e5);
    suggestions.push({
      id: 'med-next-window',
      title: 'Medication spacing reminder',
      detail: `${latest.medication_name} next safe window starts around ${dueAt.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })}.`,
    });
  }

  if (!suggestions.length) {
    suggestions.push({
      id: 'start-data',
      title: 'Build your baseline',
      detail: 'Log feeds, temperatures, and diapers for 2-3 days to unlock personalized suggestions.',
    });
  }

  return suggestions.slice(0, 4);
};
