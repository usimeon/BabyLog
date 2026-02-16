import React from 'react';
import { View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

type Point = { x: string; y: number };

type Props = {
  data: Point[];
  width?: number;
  height?: number;
  color?: string;
};

export const BarChart = ({ data, width = 340, height = 220, color = '#30a46c' }: Props) => {
  if (!data.length) return <View style={{ height }} />;

  const padding = 24;
  const maxY = Math.max(...data.map((d) => d.y), 1);
  const barAreaWidth = width - padding * 2;
  const slot = barAreaWidth / data.length;
  const barWidth = Math.max(6, slot * 0.6);

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

      {data.map((point, index) => {
        const h = (point.y / maxY) * (height - padding * 2);
        const x = padding + slot * index + (slot - barWidth) / 2;
        const y = height - padding - h;
        const label = point.x.slice(5);

        return (
          <React.Fragment key={`${point.x}-${index}`}>
            <Rect x={x} y={y} width={barWidth} height={h} fill={color} rx={3} />
            {data.length <= 10 && (
              <SvgText x={x} y={height - 8} fontSize={8} fill="#666">
                {label}
              </SvgText>
            )}
          </React.Fragment>
        );
      })}

      <SvgText x={6} y={padding} fontSize={10} fill="#666">
        {maxY.toFixed(0)}
      </SvgText>
    </Svg>
  );
};
