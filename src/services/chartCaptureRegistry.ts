import { RefObject } from 'react';
import { View } from 'react-native';

const chartRefMap = new Map<string, RefObject<View | null>>();

export const registerChartRef = (chartId: string, ref: RefObject<View | null>) => {
  chartRefMap.set(chartId, ref);
};

export const unregisterChartRef = (chartId: string) => {
  chartRefMap.delete(chartId);
};

export const getChartRef = (chartId: string) => chartRefMap.get(chartId);
