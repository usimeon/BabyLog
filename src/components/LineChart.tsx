import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

type Point = { x: string; y: number };

type Props = {
  data: Point[];
  width?: number;
  height?: number;
  color?: string;
  yMin?: number;
  yMax?: number;
  yUnitLabel?: string;
  xAxisLabel?: string;
};

export const LineChart = ({
  data,
  width = 340,
  height = 220,
  color = '#2b7cff',
  yMin,
  yMax,
  yUnitLabel,
  xAxisLabel,
}: Props) => {
  if (!data.length) return <View style={{ height }} />;

  const padding = 24;
  const yValues = data.map((d) => d.y);
  const minY = yMin ?? Math.min(...yValues);
  const maxY = yMax ?? Math.max(...yValues);
  const rangeY = maxY - minY || 1;

  const toX = (index: number) =>
    padding + (index / Math.max(data.length - 1, 1)) * (width - padding * 2);
  const toY = (value: number) =>
    height - padding - ((value - minY) / rangeY) * (height - padding * 2);

  const path = data
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${toX(index)} ${toY(point.y)}`)
    .join(' ');

  return (
    <Svg width={width} height={height}>
      <Line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#bbb" strokeWidth={1} />
      <Line
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
        stroke="#bbb"
        strokeWidth={1}
      />

      <Path d={path} fill="none" stroke={color} strokeWidth={2.5} />

      {data.map((point, index) => (
        <Circle key={point.x} cx={toX(index)} cy={toY(point.y)} r={3} fill={color} />
      ))}

      <SvgText x={6} y={padding} fontSize={10} fill="#666">
        {`${maxY.toFixed(1)}${yUnitLabel ? ` ${yUnitLabel}` : ''}`}
      </SvgText>
      <SvgText x={6} y={height - padding} fontSize={10} fill="#666">
        {`${minY.toFixed(1)}${yUnitLabel ? ` ${yUnitLabel}` : ''}`}
      </SvgText>
      {xAxisLabel ? (
        <SvgText x={width / 2 - 24} y={height - 4} fontSize={10} fill="#666">
          {xAxisLabel}
        </SvgText>
      ) : null}
    </Svg>
  );
};
