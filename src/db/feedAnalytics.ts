import { hoursBetween } from '../utils/time';

export const averageIntervalHoursFromTimestamps = (timestampsDesc: string[]) => {
  if (timestampsDesc.length < 2) return 0;

  let totalHours = 0;
  let intervals = 0;

  for (let i = 0; i < timestampsDesc.length - 1; i += 1) {
    totalHours += hoursBetween(timestampsDesc[i], timestampsDesc[i + 1]);
    intervals += 1;
  }

  return intervals ? totalHours / intervals : 0;
};

export const intervalTrendPointsFromAscending = (timestampsAsc: string[]) => {
  const points: Array<{ x: string; hours: number }> = [];

  for (let i = 1; i < timestampsAsc.length; i += 1) {
    points.push({
      x: timestampsAsc[i],
      hours: hoursBetween(timestampsAsc[i], timestampsAsc[i - 1]),
    });
  }

  return points;
};

