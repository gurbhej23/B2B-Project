import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

export type IconName =
  | 'home'
  | 'catalogue'
  | 'cart'
  | 'orders'
  | 'account'
  | 'search'
  | 'filter'
  | 'offers'
  | 'ledger'
  | 'check'
  | 'close'
  | 'plus'
  | 'minus'
  | 'chevron-right'
  | 'chevron-left'
  | 'chevron-down'
  | 'chevron-up'
  | 'arrow-right'
  | 'trash'
  | 'box'
  | 'lock'
  | 'info'
  | 'star'
  | 'edit'
  | 'map-pin'
  | 'phone'
  | 'mail'
  | 'bell'
  | 'shield'
  | 'file-text'
  | 'log-out'
  | 'refresh';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: ViewStyle;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  color = '#252525',
  strokeWidth = 2,
  style,
}) => {
  const containerStyle: ViewStyle = {
    width: size,
    height: size,
    alignItems: 'center',
    justifyContent: 'center',
    ...style,
  };

  switch (name) {
    case 'home': {
      const roofWidth = size * 0.8;
      const roofHeight = size * 0.42;
      const baseWidth = size * 0.64;
      const baseHeight = size * 0.42;
      return (
        <View style={containerStyle}>
          {/* Triangular Roof */}
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: roofWidth / 2,
              borderRightWidth: roofWidth / 2,
              borderBottomWidth: roofHeight,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: color,
              borderStyle: 'solid',
            }}
          />
          {/* House Base */}
          <View
            style={{
              width: baseWidth,
              height: baseHeight,
              backgroundColor: color,
              borderBottomLeftRadius: 2,
              borderBottomRightRadius: 2,
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}
          >
            {/* Door Cutout */}
            <View
              style={{
                width: size * 0.22,
                height: size * 0.26,
                backgroundColor: '#FFFFFF',
                borderTopLeftRadius: 2,
                borderTopRightRadius: 2,
              }}
            />
          </View>
        </View>
      );
    }

    case 'catalogue':
    case 'box': {
      const boxSize = size * 0.36;
      const gap = size * 0.08;
      return (
        <View style={containerStyle}>
          <View style={{ flexDirection: 'row', marginBottom: gap }}>
            <View
              style={{
                width: boxSize,
                height: boxSize,
                backgroundColor: color,
                borderRadius: 2.5,
                marginRight: gap,
              }}
            />
            <View
              style={{
                width: boxSize,
                height: boxSize,
                backgroundColor: color,
                borderRadius: 2.5,
              }}
            />
          </View>
          <View style={{ flexDirection: 'row' }}>
            <View
              style={{
                width: boxSize,
                height: boxSize,
                backgroundColor: color,
                borderRadius: 2.5,
                marginRight: gap,
              }}
            />
            <View
              style={{
                width: boxSize,
                height: boxSize,
                backgroundColor: color,
                borderRadius: 2.5,
              }}
            />
          </View>
        </View>
      );
    }

    case 'cart': {
      const cartWidth = size * 0.72;
      const basketHeight = size * 0.44;
      const wheelSize = size * 0.16;
      return (
        <View style={containerStyle}>
          <View style={{ width: size * 0.85, height: size * 0.8, justifyContent: 'center' }}>
            {/* Basket & Handle */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              {/* Push Handle */}
              <View
                style={{
                  width: strokeWidth * 1.5,
                  height: size * 0.28,
                  backgroundColor: color,
                  transform: [{ rotate: '-25deg' }],
                  marginTop: -size * 0.04,
                  marginRight: size * 0.04,
                  borderRadius: 1,
                }}
              />
              {/* Basket Frame */}
              <View
                style={{
                  width: cartWidth,
                  height: basketHeight,
                  borderWidth: strokeWidth,
                  borderColor: color,
                  borderBottomLeftRadius: 4,
                  borderBottomRightRadius: 4,
                  borderTopRightRadius: 2,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                {/* Horizontal Basket Line */}
                <View
                  style={{
                    width: '80%',
                    height: strokeWidth * 0.8,
                    backgroundColor: color,
                  }}
                />
              </View>
            </View>
            {/* Wheels */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingLeft: size * 0.18,
                paddingRight: size * 0.08,
                marginTop: size * 0.06,
              }}
            >
              <View
                style={{
                  width: wheelSize,
                  height: wheelSize,
                  borderRadius: wheelSize / 2,
                  backgroundColor: color,
                }}
              />
              <View
                style={{
                  width: wheelSize,
                  height: wheelSize,
                  borderRadius: wheelSize / 2,
                  backgroundColor: color,
                }}
              />
            </View>
          </View>
        </View>
      );
    }

    case 'orders': {
      const docWidth = size * 0.65;
      const docHeight = size * 0.8;
      const clipWidth = size * 0.36;
      const clipHeight = size * 0.12;
      return (
        <View style={containerStyle}>
          {/* Main Board */}
          <View
            style={{
              width: docWidth,
              height: docHeight,
              borderWidth: strokeWidth,
              borderColor: color,
              borderRadius: 3,
              alignItems: 'center',
              paddingTop: size * 0.18,
              position: 'relative',
            }}
          >
            {/* Top Clip Tab */}
            <View
              style={{
                position: 'absolute',
                top: -clipHeight / 2 - 1,
                width: clipWidth,
                height: clipHeight,
                backgroundColor: color,
                borderRadius: 2,
              }}
            />
            {/* Document Lines */}
            <View
              style={{
                width: '70%',
                height: strokeWidth,
                backgroundColor: color,
                borderRadius: 1,
                marginBottom: size * 0.08,
              }}
            />
            <View
              style={{
                width: '70%',
                height: strokeWidth,
                backgroundColor: color,
                borderRadius: 1,
                marginBottom: size * 0.08,
              }}
            />
            <View
              style={{
                width: '45%',
                height: strokeWidth,
                backgroundColor: color,
                borderRadius: 1,
                alignSelf: 'flex-start',
                marginLeft: '15%',
              }}
            />
          </View>
        </View>
      );
    }

    case 'account': {
      const headSize = size * 0.36;
      const bodyWidth = size * 0.72;
      const bodyHeight = size * 0.34;
      return (
        <View style={containerStyle}>
          {/* Head */}
          <View
            style={{
              width: headSize,
              height: headSize,
              borderRadius: headSize / 2,
              backgroundColor: color,
              marginBottom: size * 0.06,
            }}
          />
          {/* Shoulders / Torso */}
          <View
            style={{
              width: bodyWidth,
              height: bodyHeight,
              borderTopLeftRadius: bodyWidth / 2,
              borderTopRightRadius: bodyWidth / 2,
              backgroundColor: color,
            }}
          />
        </View>
      );
    }

    case 'search': {
      const circleSize = size * 0.58;
      const handleLength = size * 0.34;
      return (
        <View style={containerStyle}>
          <View style={{ width: size, height: size, position: 'relative' }}>
            {/* Lens */}
            <View
              style={{
                position: 'absolute',
                top: size * 0.05,
                left: size * 0.05,
                width: circleSize,
                height: circleSize,
                borderRadius: circleSize / 2,
                borderWidth: strokeWidth,
                borderColor: color,
              }}
            />
            {/* Handle */}
            <View
              style={{
                position: 'absolute',
                bottom: size * 0.1,
                right: size * 0.1,
                width: strokeWidth * 1.2,
                height: handleLength,
                backgroundColor: color,
                borderRadius: 1,
                transform: [{ rotate: '-45deg' }],
              }}
            />
          </View>
        </View>
      );
    }

    case 'filter': {
      const barHeight = strokeWidth;
      const barWidth = size * 0.78;
      const knobSize = size * 0.22;
      return (
        <View style={containerStyle}>
          {/* Line 1 - Knob on left */}
          <View
            style={{
              width: barWidth,
              height: knobSize,
              justifyContent: 'center',
              marginBottom: size * 0.06,
              position: 'relative',
            }}
          >
            <View style={{ width: '100%', height: barHeight, backgroundColor: color, borderRadius: 1 }} />
            <View
              style={{
                position: 'absolute',
                left: size * 0.1,
                width: knobSize,
                height: knobSize,
                borderRadius: knobSize / 2,
                backgroundColor: color,
              }}
            />
          </View>
          {/* Line 2 - Knob on right */}
          <View
            style={{
              width: barWidth,
              height: knobSize,
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <View style={{ width: '100%', height: barHeight, backgroundColor: color, borderRadius: 1 }} />
            <View
              style={{
                position: 'absolute',
                right: size * 0.12,
                width: knobSize,
                height: knobSize,
                borderRadius: knobSize / 2,
                backgroundColor: color,
              }}
            />
          </View>
        </View>
      );
    }

    case 'offers': {
      const tagWidth = size * 0.65;
      const tagHeight = size * 0.75;
      return (
        <View style={containerStyle}>
          {/* Angled Tag */}
          <View
            style={{
              width: tagWidth,
              height: tagHeight,
              borderWidth: strokeWidth,
              borderColor: color,
              borderRadius: 4,
              borderTopRightRadius: tagWidth * 0.45,
              alignItems: 'center',
              justifyContent: 'space-around',
              paddingVertical: size * 0.1,
            }}
          >
            {/* Tag Hole */}
            <View
              style={{
                width: size * 0.14,
                height: size * 0.14,
                borderRadius: size * 0.07,
                backgroundColor: color,
                alignSelf: 'flex-end',
                marginRight: size * 0.08,
              }}
            />
            {/* % Line */}
            <View
              style={{
                width: size * 0.35,
                height: strokeWidth,
                backgroundColor: color,
                transform: [{ rotate: '-35deg' }],
              }}
            />
          </View>
        </View>
      );
    }

    case 'ledger': {
      const cardWidth = size * 0.8;
      const cardHeight = size * 0.58;
      return (
        <View style={containerStyle}>
          {/* Passbook / Card */}
          <View
            style={{
              width: cardWidth,
              height: cardHeight,
              borderWidth: strokeWidth,
              borderColor: color,
              borderRadius: 3,
              justifyContent: 'space-between',
              paddingVertical: size * 0.06,
            }}
          >
            {/* Magnetic / Header Stripe */}
            <View
              style={{
                width: '100%',
                height: size * 0.14,
                backgroundColor: color,
              }}
            />
            {/* Chip/Number indicator */}
            <View style={{ flexDirection: 'row', paddingHorizontal: size * 0.08 }}>
              <View
                style={{
                  width: size * 0.16,
                  height: size * 0.1,
                  backgroundColor: color,
                  borderRadius: 1.5,
                }}
              />
            </View>
          </View>
        </View>
      );
    }

    case 'check': {
      const checkW = size * 0.65;
      const checkH = size * 0.45;
      return (
        <View style={containerStyle}>
          <View
            style={{
              width: checkW,
              height: checkH,
              borderBottomWidth: strokeWidth * 1.2,
              borderLeftWidth: strokeWidth * 1.2,
              borderColor: color,
              transform: [{ rotate: '-45deg' }],
              marginTop: -size * 0.1,
            }}
          />
        </View>
      );
    }

    case 'close': {
      const lineLen = size * 0.65;
      return (
        <View style={containerStyle}>
          <View
            style={{
              position: 'absolute',
              width: lineLen,
              height: strokeWidth,
              backgroundColor: color,
              borderRadius: strokeWidth / 2,
              transform: [{ rotate: '45deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              width: lineLen,
              height: strokeWidth,
              backgroundColor: color,
              borderRadius: strokeWidth / 2,
              transform: [{ rotate: '-45deg' }],
            }}
          />
        </View>
      );
    }

    case 'plus': {
      const lineLen = size * 0.65;
      return (
        <View style={containerStyle}>
          <View
            style={{
              position: 'absolute',
              width: lineLen,
              height: strokeWidth,
              backgroundColor: color,
              borderRadius: strokeWidth / 2,
            }}
          />
          <View
            style={{
              position: 'absolute',
              width: strokeWidth,
              height: lineLen,
              backgroundColor: color,
              borderRadius: strokeWidth / 2,
            }}
          />
        </View>
      );
    }

    case 'minus': {
      const lineLen = size * 0.65;
      return (
        <View style={containerStyle}>
          <View
            style={{
              width: lineLen,
              height: strokeWidth,
              backgroundColor: color,
              borderRadius: strokeWidth / 2,
            }}
          />
        </View>
      );
    }

    case 'chevron-right': {
      const arrowSize = size * 0.34;
      return (
        <View style={containerStyle}>
          <View
            style={{
              width: arrowSize,
              height: arrowSize,
              borderTopWidth: strokeWidth,
              borderRightWidth: strokeWidth,
              borderColor: color,
              transform: [{ rotate: '45deg' }],
              marginLeft: -size * 0.08,
            }}
          />
        </View>
      );
    }

    case 'chevron-left': {
      const arrowSize = size * 0.34;
      return (
        <View style={containerStyle}>
          <View
            style={{
              width: arrowSize,
              height: arrowSize,
              borderBottomWidth: strokeWidth,
              borderLeftWidth: strokeWidth,
              borderColor: color,
              transform: [{ rotate: '45deg' }],
              marginLeft: size * 0.08,
            }}
          />
        </View>
      );
    }

    case 'chevron-down': {
      const arrowSize = size * 0.34;
      return (
        <View style={containerStyle}>
          <View
            style={{
              width: arrowSize,
              height: arrowSize,
              borderBottomWidth: strokeWidth,
              borderRightWidth: strokeWidth,
              borderColor: color,
              transform: [{ rotate: '45deg' }],
              marginTop: -size * 0.08,
            }}
          />
        </View>
      );
    }

    case 'chevron-up': {
      const arrowSize = size * 0.34;
      return (
        <View style={containerStyle}>
          <View
            style={{
              width: arrowSize,
              height: arrowSize,
              borderTopWidth: strokeWidth,
              borderLeftWidth: strokeWidth,
              borderColor: color,
              transform: [{ rotate: '45deg' }],
              marginTop: size * 0.08,
            }}
          />
        </View>
      );
    }

    case 'arrow-right': {
      const headSize = size * 0.28;
      return (
        <View style={containerStyle}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: size * 0.45,
                height: strokeWidth,
                backgroundColor: color,
                borderRadius: strokeWidth / 2,
              }}
            />
            <View
              style={{
                width: headSize,
                height: headSize,
                borderTopWidth: strokeWidth,
                borderRightWidth: strokeWidth,
                borderColor: color,
                transform: [{ rotate: '45deg' }],
                marginLeft: -strokeWidth,
              }}
            />
          </View>
        </View>
      );
    }

    case 'trash': {
      const canWidth = size * 0.55;
      const canHeight = size * 0.55;
      return (
        <View style={containerStyle}>
          {/* Lid */}
          <View
            style={{
              width: size * 0.7,
              height: strokeWidth,
              backgroundColor: color,
              borderRadius: 1,
              marginBottom: 1,
            }}
          />
          {/* Can */}
          <View
            style={{
              width: canWidth,
              height: canHeight,
              borderWidth: strokeWidth,
              borderColor: color,
              borderTopWidth: 0,
              borderBottomLeftRadius: 3,
              borderBottomRightRadius: 3,
              alignItems: 'center',
              justifyContent: 'space-evenly',
              flexDirection: 'row',
            }}
          >
            <View style={{ width: strokeWidth * 0.7, height: '60%', backgroundColor: color }} />
            <View style={{ width: strokeWidth * 0.7, height: '60%', backgroundColor: color }} />
          </View>
        </View>
      );
    }

    case 'lock': {
      const bodyWidth = size * 0.6;
      const bodyHeight = size * 0.45;
      const shackleSize = size * 0.36;
      return (
        <View style={containerStyle}>
          {/* Shackle */}
          <View
            style={{
              width: shackleSize,
              height: shackleSize,
              borderWidth: strokeWidth,
              borderColor: color,
              borderBottomWidth: 0,
              borderTopLeftRadius: shackleSize / 2,
              borderTopRightRadius: shackleSize / 2,
              marginBottom: -1,
            }}
          />
          {/* Body */}
          <View
            style={{
              width: bodyWidth,
              height: bodyHeight,
              backgroundColor: color,
              borderRadius: 3,
            }}
          />
        </View>
      );
    }

    case 'star': {
      return (
        <View style={containerStyle}>
          <View
            style={{
              width: size * 0.55,
              height: size * 0.55,
              backgroundColor: color,
              transform: [{ rotate: '45deg' }],
              borderRadius: 2,
            }}
          />
        </View>
      );
    }

    case 'edit': {
      return (
        <View style={containerStyle}>
          <View
            style={{
              width: size * 0.52,
              height: strokeWidth * 2.2,
              backgroundColor: color,
              borderRadius: 2,
              transform: [{ rotate: '-45deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: size * 0.16,
              left: size * 0.16,
              width: strokeWidth * 1.8,
              height: strokeWidth * 1.8,
              backgroundColor: color,
              borderRadius: 1,
            }}
          />
        </View>
      );
    }

    case 'map-pin': {
      const pinSize = size * 0.52;
      return (
        <View style={containerStyle}>
          <View
            style={{
              width: pinSize,
              height: pinSize,
              borderRadius: pinSize / 2,
              borderWidth: strokeWidth,
              borderColor: color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: strokeWidth * 1.4,
                height: strokeWidth * 1.4,
                borderRadius: strokeWidth,
                backgroundColor: color,
              }}
            />
          </View>
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: pinSize * 0.32,
              borderRightWidth: pinSize * 0.32,
              borderTopWidth: pinSize * 0.42,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: color,
              marginTop: -2,
            }}
          />
        </View>
      );
    }

    case 'phone': {
      const phoneWidth = size * 0.52;
      const phoneHeight = size * 0.74;
      return (
        <View style={containerStyle}>
          <View
            style={{
              width: phoneWidth,
              height: phoneHeight,
              borderWidth: strokeWidth,
              borderColor: color,
              borderRadius: 5,
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 3,
            }}
          >
            <View style={{ width: phoneWidth * 0.32, height: strokeWidth * 0.8, backgroundColor: color, borderRadius: 1 }} />
            <View style={{ width: strokeWidth * 1.5, height: strokeWidth * 1.5, borderRadius: strokeWidth, backgroundColor: color }} />
          </View>
        </View>
      );
    }

    case 'mail': {
      const envWidth = size * 0.72;
      const envHeight = size * 0.52;
      return (
        <View style={containerStyle}>
          <View
            style={{
              width: envWidth,
              height: envHeight,
              borderWidth: strokeWidth,
              borderColor: color,
              borderRadius: 3,
              overflow: 'hidden',
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: envWidth * 0.68,
                height: envWidth * 0.68,
                borderBottomWidth: strokeWidth,
                borderRightWidth: strokeWidth,
                borderColor: color,
                transform: [{ rotate: '45deg' }],
                marginTop: -envWidth * 0.46,
              }}
            />
          </View>
        </View>
      );
    }

    case 'bell': {
      const bellWidth = size * 0.54;
      const bellHeight = size * 0.48;
      return (
        <View style={containerStyle}>
          <View style={{ width: strokeWidth * 1.4, height: strokeWidth * 1.4, borderRadius: strokeWidth, backgroundColor: color, marginBottom: 1 }} />
          <View
            style={{
              width: bellWidth,
              height: bellHeight,
              borderTopLeftRadius: bellWidth / 2,
              borderTopRightRadius: bellWidth / 2,
              borderWidth: strokeWidth,
              borderColor: color,
              borderBottomWidth: 0,
            }}
          />
          <View
            style={{
              width: bellWidth * 1.25,
              height: strokeWidth,
              backgroundColor: color,
              borderRadius: 1,
            }}
          />
          <View
            style={{
              width: strokeWidth * 1.6,
              height: strokeWidth * 1.2,
              borderBottomLeftRadius: strokeWidth,
              borderBottomRightRadius: strokeWidth,
              backgroundColor: color,
              marginTop: 1,
            }}
          />
        </View>
      );
    }

    case 'shield': {
      const shieldWidth = size * 0.64;
      const shieldHeight = size * 0.72;
      return (
        <View style={containerStyle}>
          <View
            style={{
              width: shieldWidth,
              height: shieldHeight,
              borderWidth: strokeWidth,
              borderColor: color,
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4,
              borderBottomLeftRadius: shieldWidth / 2,
              borderBottomRightRadius: shieldWidth / 2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: strokeWidth * 1.5,
                height: shieldHeight * 0.45,
                backgroundColor: color,
                borderRadius: 1,
              }}
            />
          </View>
        </View>
      );
    }

    case 'file-text': {
      const docW = size * 0.6;
      const docH = size * 0.74;
      return (
        <View style={containerStyle}>
          <View
            style={{
              width: docW,
              height: docH,
              borderWidth: strokeWidth,
              borderColor: color,
              borderRadius: 3,
              paddingHorizontal: 3,
              paddingVertical: 4,
              justifyContent: 'space-evenly',
            }}
          >
            <View style={{ width: '80%', height: strokeWidth, backgroundColor: color, borderRadius: 1 }} />
            <View style={{ width: '80%', height: strokeWidth, backgroundColor: color, borderRadius: 1 }} />
            <View style={{ width: '50%', height: strokeWidth, backgroundColor: color, borderRadius: 1 }} />
          </View>
        </View>
      );
    }

    case 'log-out': {
      return (
        <View style={containerStyle}>
          <View
            style={{
              position: 'absolute',
              left: size * 0.16,
              width: size * 0.38,
              height: size * 0.68,
              borderLeftWidth: strokeWidth,
              borderTopWidth: strokeWidth,
              borderBottomWidth: strokeWidth,
              borderColor: color,
              borderTopLeftRadius: 3,
              borderBottomLeftRadius: 3,
            }}
          />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              position: 'absolute',
              right: size * 0.14,
            }}
          >
            <View style={{ width: size * 0.36, height: strokeWidth, backgroundColor: color, borderRadius: 1 }} />
            <View
              style={{
                width: size * 0.22,
                height: size * 0.22,
                borderTopWidth: strokeWidth,
                borderRightWidth: strokeWidth,
                borderColor: color,
                transform: [{ rotate: '45deg' }],
                marginLeft: -strokeWidth,
              }}
            />
          </View>
        </View>
      );
    }

    case 'refresh': {
      const outerR = size * 0.62;
      return (
        <View style={containerStyle}>
          <View
            style={{
              width: outerR,
              height: outerR,
              borderRadius: outerR / 2,
              borderWidth: strokeWidth,
              borderTopColor: 'transparent',
              borderRightColor: color,
              borderBottomColor: color,
              borderLeftColor: color,
              alignItems: 'flex-start',
              justifyContent: 'flex-start',
            }}
          >
            <View
              style={{
                width: 0,
                height: 0,
                borderLeftWidth: strokeWidth * 1.5,
                borderRightWidth: strokeWidth * 1.5,
                borderBottomWidth: strokeWidth * 2.2,
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent',
                borderBottomColor: color,
                transform: [{ rotate: '-40deg' }],
                marginTop: -2,
                marginLeft: 1,
              }}
            />
          </View>
        </View>
      );
    }

    case 'info':
    default: {
      const outerSize = size * 0.75;
      return (
        <View style={containerStyle}>
          <View
            style={{
              width: outerSize,
              height: outerSize,
              borderRadius: outerSize / 2,
              borderWidth: strokeWidth,
              borderColor: color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: strokeWidth * 1.1,
                height: size * 0.08,
                backgroundColor: color,
                marginBottom: 2,
                borderRadius: 1,
              }}
            />
            <View
              style={{
                width: strokeWidth * 1.1,
                height: size * 0.22,
                backgroundColor: color,
                borderRadius: 1,
              }}
            />
          </View>
        </View>
      );
    }
  }
};

