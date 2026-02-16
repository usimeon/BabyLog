import React, { PropsWithChildren, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { registerChartRef, unregisterChartRef } from '../services/chartCaptureRegistry';

type Props = PropsWithChildren<{ chartId: string }>;

export const CaptureChart = ({ chartId, children }: Props) => {
  const ref = useRef<View>(null);

  useEffect(() => {
    registerChartRef(chartId, ref);
    return () => unregisterChartRef(chartId);
  }, [chartId]);

  return <View ref={ref}>{children}</View>;
};
