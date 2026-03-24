// Luna Group UI Kit v2.0 - Dark Edition Design Tokens
export const colors = {
  // Primary Backgrounds - Deep blacks
  bg: '#08080A',
  background: '#08080A',
  surface: '#0F0F12',
  surfaceElevated: '#161619',
  surfaceFloat: '#1E1E24',
  surfaceHover: '#242430',
  
  // Legacy mappings for compatibility
  backgroundElevated: '#0F0F12',
  backgroundCard: '#0F0F12',
  backgroundCardHover: '#161619',
  
  // Glassmorphism backgrounds
  glass: 'rgba(15, 15, 18, 0.85)',
  glassLight: 'rgba(255, 255, 255, 0.04)',
  glassBorder: 'rgba(255, 255, 255, 0.06)',
  glassHighlight: 'rgba(255, 255, 255, 0.12)',
  
  // Text - High contrast with hierarchy
  text: '#F0F0F5',
  textPrimary: '#F0F0F5',
  textSecondary: 'rgba(240, 240, 245, 0.5)',
  textTertiary: 'rgba(240, 240, 245, 0.25)',
  textMuted: 'rgba(240, 240, 245, 0.4)',
  textDisabled: 'rgba(240, 240, 245, 0.2)',
  
  // Borders
  border: 'rgba(255, 255, 255, 0.06)',
  borderHover: 'rgba(255, 255, 255, 0.12)',
  borderStrong: 'rgba(255, 255, 255, 0.18)',
  borderLight: 'rgba(255, 255, 255, 0.08)',
  borderAccent: 'rgba(37, 99, 235, 0.3)',
  
  // Brand Accent - Blue (Primary actions)
  accent: '#2563EB',
  accentDim: 'rgba(37, 99, 235, 0.14)',
  accentBright: '#3B82F6',
  accentVibrant: '#60A5FA',
  accentDark: '#1D4ED8',
  accentLight: '#60A5FA',
  accentGlow: 'rgba(37, 99, 235, 0.25)',
  
  // Premium Gold - VIP Status
  gold: '#C9A84C',
  goldDim: 'rgba(201, 168, 76, 0.13)',
  goldBright: '#E2C06E',
  goldDark: '#A68B3D',
  goldLight: '#E2C06E',
  goldGlow: 'rgba(201, 168, 76, 0.2)',
  
  // Status Colors
  success: '#22C55E',
  green: '#22C55E',
  greenDim: 'rgba(34, 197, 94, 0.12)',
  successGlow: 'rgba(34, 197, 94, 0.2)',
  
  error: '#EF4444',
  red: '#EF4444',
  redDim: 'rgba(239, 68, 68, 0.12)',
  errorGlow: 'rgba(239, 68, 68, 0.2)',
  
  warning: '#F97316',
  orange: '#F97316',
  orangeDim: 'rgba(249, 115, 22, 0.12)',
  warningGlow: 'rgba(249, 115, 22, 0.2)',
  
  info: '#3B82F6',
  infoGlow: 'rgba(59, 130, 246, 0.2)',
  
  // Tier Colors - Premium Metallic Feel
  bronze: '#CD7F32',
  bronzeGlow: 'rgba(205, 127, 50, 0.2)',
  silver: '#C0C0C0',
  silverGlow: 'rgba(192, 192, 192, 0.2)',
  goldTier: '#C9A84C',
  platinum: '#E5E4E2',
  platinumGlow: 'rgba(229, 228, 226, 0.15)',
  black: '#1A1A1A',
  
  // Queue Status
  queueLow: '#22C55E',
  queueMedium: '#F97316',
  queueHigh: '#EF4444',
  
  // Overlays
  overlay: 'rgba(8, 8, 10, 0.85)',
  overlayLight: 'rgba(8, 8, 10, 0.6)',
  
  // Gradients (as arrays for LinearGradient)
  gradientAccent: ['#3B82F6', '#2563EB'],
  gradientGold: ['#E2C06E', '#C9A84C', '#A68B3D'],
  gradientDark: ['#161619', '#0F0F12', '#08080A'],
  gradientCard: ['#161619', '#0F0F12'],
  gradientGlass: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)'],
};

export const tierColors: Record<string, string> = {
  bronze: colors.bronze,
  silver: colors.silver,
  gold: colors.goldTier,
  platinum: colors.platinum,
  black: colors.gold,
  // New tiers matching app
  lunar: colors.silver,
  nova: colors.gold,
  supernova: colors.goldBright,
  aurora: colors.accentVibrant,
};

export const tierGlows: Record<string, string> = {
  bronze: colors.bronzeGlow,
  silver: colors.silverGlow,
  gold: colors.goldGlow,
  platinum: colors.platinumGlow,
  black: colors.goldGlow,
};

// Typography Scale - Luna UI Kit
export const typography = {
  // Display - Bebas Neue style (bold, condensed)
  display: {
    fontSize: 80,
    fontWeight: '700' as const,
    letterSpacing: 2,
    lineHeight: 0.95,
  },
  hero: {
    fontSize: 52,
    fontWeight: '700' as const,
    letterSpacing: 2,
  },
  h1: {
    fontSize: 36,
    fontWeight: '700' as const,
    letterSpacing: 1.5,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700' as const,
    letterSpacing: 1,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
  // Body - Outfit style
  subtitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500' as const,
    letterSpacing: 0.3,
  },
  // Labels - Uppercase with tracking
  label: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
  },
  labelSmall: {
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },
  overline: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 2.5,
    textTransform: 'uppercase' as const,
  },
};

// Spacing Scale (8pt grid)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

// Border Radius - Luna UI Kit
export const radius = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 18,
  pill: 100,
  full: 9999,
};

// Shadows (for elevated elements)
export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 5,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  }),
};

// Button styles matching UI Kit
export const buttonStyles = {
  primary: {
    backgroundColor: colors.accent,
    color: '#FFFFFF',
    borderRadius: radius.md,
  },
  secondary: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 0.5,
    color: colors.text,
    borderRadius: radius.md,
  },
  ghost: {
    backgroundColor: 'transparent',
    color: colors.textSecondary,
    borderRadius: radius.md,
  },
  gold: {
    backgroundColor: colors.gold,
    color: '#08080A',
    borderRadius: radius.md,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: colors.accent,
    borderWidth: 0.5,
    color: colors.accentVibrant,
    borderRadius: radius.md,
  },
  danger: {
    backgroundColor: colors.redDim,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 0.5,
    color: colors.red,
    borderRadius: radius.md,
  },
};

export default colors;
