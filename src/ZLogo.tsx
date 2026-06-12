import { View, ViewStyle } from 'react-native';

type ZLogoProps = {
  size?: number;
  color?: string;
  haloColor?: string;
  withHalo?: boolean;
  style?: ViewStyle;
};

export default function ZLogo({
  size = 32,
  color = '#1f1c17',
  haloColor = '#cfe0d4',
  withHalo = false,
  style,
}: ZLogoProps) {
  const w = size;
  const h = size * 0.82;
  const stroke = Math.max(2, Math.round(size * 0.16));
  const innerH = h - stroke * 2;
  const hypot = Math.sqrt(w * w + innerH * innerH);
  const angleDeg = -Math.atan2(innerH, w) * (180 / Math.PI);
  const dotSize = Math.max(3, Math.round(size * 0.16));

  return (
    <View
      style={[
        {
          width: withHalo ? size * 1.55 : size,
          height: withHalo ? size * 1.55 : h + dotSize * 1.4,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {withHalo ? (
        <View
          style={{
            position: 'absolute',
            width: size * 1.55,
            height: size * 1.55,
            borderRadius: size,
            backgroundColor: haloColor,
            opacity: 0.55,
          }}
        />
      ) : null}
      <View style={{ width: w, height: h }}>
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: stroke,
            borderRadius: stroke / 2,
            backgroundColor: color,
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: (h - stroke) / 2,
            left: (w - hypot) / 2,
            width: hypot,
            height: stroke,
            borderRadius: stroke / 2,
            backgroundColor: color,
            transform: [{ rotate: `${angleDeg}deg` }],
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: stroke,
            borderRadius: stroke / 2,
            backgroundColor: color,
          }}
        />
      </View>
      <View
        style={{
          marginTop: dotSize * 0.4,
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: haloColor === color ? color : haloColor,
        }}
      />
    </View>
  );
}
