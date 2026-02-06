import React from 'react';
import Svg, { Circle, Path, Defs, RadialGradient, Stop, G, Ellipse, Line } from 'react-native-svg';

interface LunarIconProps {
  size?: number;
  color?: string;
}

// Moon with craters
export const MoonIcon: React.FC<LunarIconProps> = ({ size = 32, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Defs>
      <RadialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
        <Stop offset="0%" stopColor={color} stopOpacity="1" />
        <Stop offset="70%" stopColor={color} stopOpacity="0.8" />
        <Stop offset="100%" stopColor={color} stopOpacity="0.3" />
      </RadialGradient>
    </Defs>
    <Circle cx="32" cy="32" r="28" fill="url(#moonGlow)" />
    <Circle cx="22" cy="24" r="5" fill={color} opacity="0.3" />
    <Circle cx="40" cy="38" r="7" fill={color} opacity="0.2" />
    <Circle cx="28" cy="42" r="4" fill={color} opacity="0.25" />
    <Circle cx="44" cy="22" r="3" fill={color} opacity="0.2" />
  </Svg>
);

// Galaxy/Spiral
export const GalaxyIcon: React.FC<LunarIconProps> = ({ size = 32, color = '#E31837' }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Defs>
      <RadialGradient id="galaxyCore" cx="50%" cy="50%" r="50%">
        <Stop offset="0%" stopColor={color} stopOpacity="1" />
        <Stop offset="50%" stopColor={color} stopOpacity="0.5" />
        <Stop offset="100%" stopColor={color} stopOpacity="0" />
      </RadialGradient>
    </Defs>
    <Circle cx="32" cy="32" r="8" fill="url(#galaxyCore)" />
    <Path
      d="M32 32 Q 45 20, 52 32 Q 45 44, 32 32"
      stroke={color}
      strokeWidth="2"
      fill="none"
      opacity="0.8"
    />
    <Path
      d="M32 32 Q 19 44, 12 32 Q 19 20, 32 32"
      stroke={color}
      strokeWidth="2"
      fill="none"
      opacity="0.8"
    />
    <Path
      d="M32 32 Q 44 45, 32 52 Q 20 45, 32 32"
      stroke={color}
      strokeWidth="1.5"
      fill="none"
      opacity="0.6"
    />
    <Path
      d="M32 32 Q 20 19, 32 12 Q 44 19, 32 32"
      stroke={color}
      strokeWidth="1.5"
      fill="none"
      opacity="0.6"
    />
    {/* Stars around */}
    <Circle cx="50" cy="14" r="1.5" fill="#FFFFFF" opacity="0.8" />
    <Circle cx="14" cy="50" r="1.5" fill="#FFFFFF" opacity="0.8" />
    <Circle cx="54" cy="48" r="1" fill="#FFFFFF" opacity="0.6" />
    <Circle cx="10" cy="16" r="1" fill="#FFFFFF" opacity="0.6" />
  </Svg>
);

// Star Constellation
export const ConstellationIcon: React.FC<LunarIconProps> = ({ size = 32, color = '#FFD700' }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    {/* Connection lines */}
    <Line x1="12" y1="20" x2="28" y2="16" stroke={color} strokeWidth="1" opacity="0.4" />
    <Line x1="28" y1="16" x2="42" y2="28" stroke={color} strokeWidth="1" opacity="0.4" />
    <Line x1="42" y1="28" x2="52" y2="18" stroke={color} strokeWidth="1" opacity="0.4" />
    <Line x1="42" y1="28" x2="38" y2="44" stroke={color} strokeWidth="1" opacity="0.4" />
    <Line x1="38" y1="44" x2="20" y2="48" stroke={color} strokeWidth="1" opacity="0.4" />
    <Line x1="20" y1="48" x2="12" y2="20" stroke={color} strokeWidth="1" opacity="0.4" />
    {/* Stars */}
    <Circle cx="12" cy="20" r="4" fill={color} />
    <Circle cx="28" cy="16" r="3" fill={color} />
    <Circle cx="42" cy="28" r="5" fill={color} />
    <Circle cx="52" cy="18" r="3" fill={color} />
    <Circle cx="38" cy="44" r="4" fill={color} />
    <Circle cx="20" cy="48" r="3" fill={color} />
  </Svg>
);

// Rocket/Spacecraft
export const RocketIcon: React.FC<LunarIconProps> = ({ size = 32, color = '#00D26A' }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Defs>
      <RadialGradient id="rocketFlame" cx="50%" cy="0%" r="100%">
        <Stop offset="0%" stopColor="#FF6B35" />
        <Stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
      </RadialGradient>
    </Defs>
    {/* Flame */}
    <Ellipse cx="32" cy="56" rx="6" ry="8" fill="url(#rocketFlame)" />
    {/* Body */}
    <Path
      d="M32 8 C 24 18, 24 38, 28 48 L 36 48 C 40 38, 40 18, 32 8"
      fill={color}
    />
    {/* Window */}
    <Circle cx="32" cy="24" r="5" fill="#0A0A0A" />
    <Circle cx="32" cy="24" r="3" fill="#1A1A1A" />
    {/* Fins */}
    <Path d="M28 44 L 20 52 L 24 48 Z" fill={color} opacity="0.8" />
    <Path d="M36 44 L 44 52 L 40 48 Z" fill={color} opacity="0.8" />
  </Svg>
);

// Orbit/Planet
export const OrbitIcon: React.FC<LunarIconProps> = ({ size = 32, color = '#8B00FF' }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    {/* Orbit rings */}
    <Ellipse
      cx="32"
      cy="32"
      rx="26"
      ry="10"
      stroke={color}
      strokeWidth="1.5"
      fill="none"
      opacity="0.4"
      transform="rotate(-20 32 32)"
    />
    <Ellipse
      cx="32"
      cy="32"
      rx="26"
      ry="10"
      stroke={color}
      strokeWidth="1"
      fill="none"
      opacity="0.2"
      transform="rotate(40 32 32)"
    />
    {/* Planet */}
    <Circle cx="32" cy="32" r="12" fill={color} />
    {/* Moon */}
    <Circle cx="52" cy="24" r="4" fill="#FFFFFF" opacity="0.8" />
  </Svg>
);

// Comet/Shooting Star
export const CometIcon: React.FC<LunarIconProps> = ({ size = 32, color = '#FFB800' }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Defs>
      <RadialGradient id="cometHead" cx="100%" cy="0%" r="100%">
        <Stop offset="0%" stopColor="#FFFFFF" />
        <Stop offset="100%" stopColor={color} />
      </RadialGradient>
    </Defs>
    {/* Tail */}
    <Path
      d="M48 16 Q 30 20, 8 52"
      stroke={color}
      strokeWidth="8"
      fill="none"
      opacity="0.3"
      strokeLinecap="round"
    />
    <Path
      d="M48 16 Q 32 22, 16 44"
      stroke={color}
      strokeWidth="4"
      fill="none"
      opacity="0.5"
      strokeLinecap="round"
    />
    <Path
      d="M48 16 Q 36 24, 28 36"
      stroke="#FFFFFF"
      strokeWidth="2"
      fill="none"
      opacity="0.7"
      strokeLinecap="round"
    />
    {/* Head */}
    <Circle cx="48" cy="16" r="8" fill="url(#cometHead)" />
    <Circle cx="48" cy="16" r="4" fill="#FFFFFF" />
  </Svg>
);

// Eclipse (Sun behind moon)
export const EclipseIcon: React.FC<LunarIconProps> = ({ size = 32, color = '#E31837' }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Defs>
      <RadialGradient id="corona" cx="50%" cy="50%" r="50%">
        <Stop offset="60%" stopColor={color} stopOpacity="0" />
        <Stop offset="80%" stopColor={color} stopOpacity="0.5" />
        <Stop offset="100%" stopColor={color} stopOpacity="0.8" />
      </RadialGradient>
    </Defs>
    {/* Corona */}
    <Circle cx="32" cy="32" r="28" fill="url(#corona)" />
    {/* Moon (dark) */}
    <Circle cx="32" cy="32" r="20" fill="#0A0A0A" />
    {/* Slight moon surface hint */}
    <Circle cx="26" cy="28" r="4" fill="#1A1A1A" />
    <Circle cx="36" cy="38" r="5" fill="#1A1A1A" />
  </Svg>
);

// Star burst
export const StarburstIcon: React.FC<LunarIconProps> = ({ size = 32, color = '#FFD700' }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Defs>
      <RadialGradient id="starCore" cx="50%" cy="50%" r="50%">
        <Stop offset="0%" stopColor="#FFFFFF" />
        <Stop offset="50%" stopColor={color} />
        <Stop offset="100%" stopColor={color} stopOpacity="0" />
      </RadialGradient>
    </Defs>
    {/* Rays */}
    {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
      <Line
        key={i}
        x1="32"
        y1="32"
        x2={32 + 24 * Math.cos((angle * Math.PI) / 180)}
        y2={32 + 24 * Math.sin((angle * Math.PI) / 180)}
        stroke={color}
        strokeWidth={i % 2 === 0 ? 3 : 1.5}
        opacity={i % 2 === 0 ? 0.8 : 0.4}
        strokeLinecap="round"
      />
    ))}
    {/* Core */}
    <Circle cx="32" cy="32" r="10" fill="url(#starCore)" />
    <Circle cx="32" cy="32" r="5" fill="#FFFFFF" />
  </Svg>
);

export const LunarIcons = {
  Moon: MoonIcon,
  Galaxy: GalaxyIcon,
  Constellation: ConstellationIcon,
  Rocket: RocketIcon,
  Orbit: OrbitIcon,
  Comet: CometIcon,
  Eclipse: EclipseIcon,
  Starburst: StarburstIcon,
};

export default LunarIcons;
