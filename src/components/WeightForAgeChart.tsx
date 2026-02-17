import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

type ChartPoint = { x: number; y: number };

type Props = {
  observations: ChartPoint[];
  p10: ChartPoint[];
  p50: ChartPoint[];
  p90: ChartPoint[];
  width?: number;
  height?: number;
  xMax?: number;
  yUnitLabel: string;
};

const buildPath = (points: ChartPoint[], toX: (value: number) => number, toY: (value: number) => number) =>
  points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${toX(point.x)} ${toY(point.y)}`)
    .join(' ');

export const WeightForAgeChart = ({
  observations,
  p10,
  p50,
  p90,
  width = 340,
  height = 260,
  xMax = 24,
  yUnitLabel,
}: Props) => {
  if (!observations.length) return <View style={{ height }} />;

  const paddingLeft = 38;
  const paddingRight = 12;
  const paddingTop = 16;
  const paddingBottom = 30;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const allY = [...p10, ...p50, ...p90, ...observations].map((p) => p.y);
  const minYRaw = Math.min(...allY);
  const maxYRaw = Math.max(...allY);
  const yPadding = Math.max(0.3, (maxYRaw - minYRaw) * 0.12);
  const yMin = Math.max(0, minYRaw - yPadding);
  const yMax = maxYRaw + yPadding;
  const yRange = yMax - yMin || 1;

  const toX = (value: number) => paddingLeft + (Math.max(0, Math.min(xMax, value)) / Math.max(1, xMax)) * chartWidth;
  const toY = (value: number) => paddingTop + (1 - (value - yMin) / yRange) * chartHeight;

  const p10Path = buildPath(p10, toX, toY);
  const p50Path = buildPath(p50, toX, toY);
  const p90Path = buildPath(p90, toX, toY);
  const babyPath = buildPath(observations, toX, toY);

  const bandPath = `${p10Path} ${[...p90]
    .reverse()
    .map((point) => `L ${toX(point.x)} ${toY(point.y)}`)
    .join(' ')} Z`;

  const xTicks = Array.from({ length: Math.floor(xMax / 2) + 1 }, (_, i) => i * 2);
  const yTicks = Array.from({ length: 7 }, (_, i) => yMin + (i / 6) * yRange);

  return (
    <Svg width={width} height={height}>
      <Rect x={paddingLeft} y={paddingTop} width={chartWidth} height={chartHeight} fill="#fff" />

      {yTicks.map((tick) => (
        <React.Fragment key={`y-${tick}`}>
          <Line
            x1={paddingLeft}
            y1={toY(tick)}
            x2={paddingLeft + chartWidth}
            y2={toY(tick)}
            stroke="#cbd5e1"
            strokeDasharray="3 4"
            strokeWidth={1}
          />
          <SvgText x={4} y={toY(tick) + 4} fontSize={10} fill="#64748b">
            {tick.toFixed(1)}
          </SvgText>
        </React.Fragment>
      ))}

      {xTicks.map((tick) => (
        <React.Fragment key={`x-${tick}`}>
          <Line
            x1={toX(tick)}
            y1={paddingTop}
            x2={toX(tick)}
            y2={paddingTop + chartHeight}
            stroke="#cbd5e1"
            strokeDasharray="3 4"
            strokeWidth={1}
          />
          <SvgText x={tick === 0 ? toX(tick) - 10 : toX(tick) - 6} y={height - 10} fontSize={10} fill="#64748b">
            {tick === 0 ? 'B' : `${tick}`}
          </SvgText>
        </React.Fragment>
      ))}

      <Path d={bandPath} fill="#99f6e4" fillOpacity={0.35} />
      <Path d={p10Path} fill="none" stroke="#9333ea" strokeWidth={2} />
      <Path d={p90Path} fill="none" stroke="#facc15" strokeWidth={2} />
      <Path d={p50Path} fill="none" stroke="#14b8a6" strokeWidth={3} />
      <Path d={babyPath} fill="none" stroke="#0f172a" strokeWidth={2.5} />

      {observations.map((point, index) => (
        <Circle key={`${point.x}-${point.y}-${index}`} cx={toX(point.x)} cy={toY(point.y)} r={3} fill="#0f172a" />
      ))}

      <SvgText x={paddingLeft + chartWidth / 2 - 38} y={height - 2} fontSize={11} fill="#475569">
        Age (months)
      </SvgText>
      <SvgText x={6} y={12} fontSize={11} fill="#475569">
        Weight ({yUnitLabel})
      </SvgText>
    </Svg>
  );
};
