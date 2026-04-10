// Luna Group UI Kit v3.0 - Premium Dark Edition Design Tokens
// Complete rewrite with proper depth, glassmorphism, and premium feel

export const colors = {
  // Primary Backgrounds - Layered depth system
  bg: '#101018',
  background: '#101018',
  surface: '#181824',
  surfaceElevated: '#202030',
  surfaceFloat: '#282840',
  surfaceHover: '#303048',
  surfaceActive: '#383850',
  
  // Legacy mappings - MUCH BRIGHTER for card visibility
  backgroundElevated: '#1C1C2C',
  backgroundCard: '#202034',
  backgroundCardHover: '#282844',
  
  // Card Gradient Colors - Subtle accent tints
  cardGradientStart: '#1E1E2E',
  cardGradientEnd: '#14141E',
  cardGradientBlue: 'rgba(37, 99, 235, 0.08)',
  cardGradientGold: 'rgba(212, 168, 50, 0.06)',
  cardGradientPurple: 'rgba(139, 92, 246, 0.06)',
  cardAccentBorder: 'rgba(37, 99, 235, 0.25)',
  
  // True Glassmorphism System - WITH ACCENT TINTS
  glass: '#1E1E30',
  glassMid: '#252540',
  glassHigh: '#2C2C4A',
  glassAccent: 'rgba(37, 99, 235, 0.18)',
  glassGold: 'rgba(212, 168, 50, 0.14)',
  glassLight: 'rgba(255, 255, 255, 0.12)',
  glassBorder: 'rgba(255, 255, 255, 0.28)',
  glassBorderStrong: 'rgba(255, 255, 255, 0.38)',
  glassBorderSubtle: 'rgba(255, 255, 255, 0.18)',
  glassHighlight: 'rgba(255, 255, 255, 0.38)',
  glassShine: 'rgba(255, 255, 255, 0.45)',
  
  // Text - High contrast hierarchy
  text: '#F5F5FA',
  textPrimary: '#F5F5FA',
  textSecondary: 'rgba(245, 245, 250, 0.65)',
  textTertiary: 'rgba(245, 245, 250, 0.40)',
  textMuted: 'rgba(245, 245, 250, 0.50)',
  textDisabled: 'rgba(245, 245, 250, 0.25)',
  textInverse: '#050507',
  
  // Border System - Hierarchical - HIGH VISIBILITY
  border: 'rgba(255, 255, 255, 0.22)',
  borderHover: 'rgba(255, 255, 255, 0.30)',
  borderStrong: 'rgba(255, 255, 255, 0.38)',
  borderLight: 'rgba(255, 255, 255, 0.15)',
  borderAccent: 'rgba(37, 99, 235, 0.65)',
  borderGold: 'rgba(212, 168, 50, 0.65)',
  borderCard: 'rgba(255, 255, 255, 0.28)',
  
  // Brand Accent - Electric Blue
  accent: '#2563EB',
  accentDim: 'rgba(37, 99, 235, 0.16)',
  accentBright: '#3B82F6',
  accentVibrant: '#60A5FA',
  accentDark: '#1D4ED8',
  accentLight: '#93C5FD',
  accentGlow: 'rgba(37, 99, 235, 0.35)',
  accentSoft: 'rgba(37, 99, 235, 0.12)',
  
  // Premium Gold - Rich & Vibrant
  gold: '#D4A832',
  goldDim: 'rgba(212, 168, 50, 0.15)',
  goldBright: '#F0C850',
  goldDark: '#B8922A',
  goldLight: '#F5D878',
  goldGlow: 'rgba(212, 168, 50, 0.30)',
  goldSoft: 'rgba(212, 168, 50, 0.12)',
  goldShine: '#FFE082',
  
  // Status Colors - Vivid
  success: '#10B981',
  green: '#10B981',
  greenDim: 'rgba(16, 185, 129, 0.14)',
  greenBright: '#34D399',
  successGlow: 'rgba(16, 185, 129, 0.30)',
  
  error: '#EF4444',
  red: '#EF4444',
  redDim: 'rgba(239, 68, 68, 0.14)',
  redBright: '#F87171',
  errorGlow: 'rgba(239, 68, 68, 0.30)',
  
  warning: '#F97316',
  orange: '#F97316',
  orangeDim: 'rgba(249, 115, 22, 0.14)',
  orangeBright: '#FB923C',
  warningGlow: 'rgba(249, 115, 22, 0.30)',
  
  info: '#3B82F6',
  infoDim: 'rgba(59, 130, 246, 0.14)',
  infoGlow: 'rgba(59, 130, 246, 0.30)',
  
  // Hot/Trending
  hot: '#FF6B6B',
  hotDim: 'rgba(255, 107, 107, 0.14)',
  hotGlow: 'rgba(255, 107, 107, 0.35)',
  
  // Tier Colors - Premium Metallic
  bronze: '#CD7F32',
  bronzeDim: 'rgba(205, 127, 50, 0.15)',
  bronzeGlow: 'rgba(205, 127, 50, 0.30)',
  
  silver: '#C0C0C0',
  silverDim: 'rgba(192, 192, 192, 0.15)',
  silverGlow: 'rgba(192, 192, 192, 0.25)',
  
  goldTier: '#D4A832',
  
  platinum: '#E8E8E8',
  platinumDim: 'rgba(232, 232, 232, 0.15)',
  platinumGlow: 'rgba(232, 232, 232, 0.20)',
  
  black: '#1A1A1A',
  
  // Queue Status
  queueLow: '#10B981',
  queueMedium: '#F97316',
  queueHigh: '#EF4444',
  
  // Overlays
  overlay: 'rgba(5, 5, 7, 0.88)',
  overlayLight: 'rgba(5, 5, 7, 0.65)',
  overlayDark: 'rgba(0, 0, 0, 0.92)',
  
  // Gradients (as arrays for LinearGradient)
  gradientAccent: ['#3B82F6', '#2563EB', '#1D4ED8'],
  gradientGold: ['#F5D878', '#D4A832', '#B8922A'],
  gradientDark: ['#1A1A22', '#0C0C10', '#050507'],
  gradientCard: ['#1A1A22', '#131318', '#0C0C10'],
  gradientGlass: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.03)'],
  gradientHot: ['#FF6B6B', '#FF8E53', '#FFD93D'],
  gradientPremium: ['#D4A832', '#F0C850', '#D4A832'],
  gradientPurple: ['#A855F7', '#7C3AED', '#6D28D9'],
};

export const tierColors: Record<string, string> = {
  bronze: colors.bronze,
  silver: colors.silver,
  gold: colors.goldTier,
  platinum: colors.platinum,
  black: colors.gold,
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

// Typography Scale - Premium Luna UI Kit
export const typography = {
  // Display - Bold Impact
  display: {
    fontSize: 80,
    fontWeight: '800' as const,
    letterSpacing: -1,
    lineHeight: 0.92,
  },
  hero: {
    fontSize: 48,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  h1: {
    fontSize: 32,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },
  // Body
  subtitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    letterSpacing: 0.2,
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
    letterSpacing: 0.2,
  },
  // Labels - Readable Size
  label: {
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  labelSmall: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  overline: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },
  // Numbers - Tight tracking for premium feel
  number: {
    fontSize: 34,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  numberSmall: {
    fontSize: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
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

// Border Radius - Bold & Modern
export const radius = {
  xs: 8,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 36,
  pill: 100,
  full: 9999,
};

// Shadows - Rich depth system
export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 6,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 10,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.50,
    shadowRadius: 20,
    elevation: 12,
  }),
  blueGlow: {
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius: 16,
    elevation: 8,
  },
  goldGlow: {
    shadowColor: '#D4A832',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius: 16,
    elevation: 8,
  },
  hotGlow: {
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius: 16,
    elevation: 8,
  },
  inner: {
    // For inset shadows (use with care on RN)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.30,
    shadowRadius: 4,
    elevation: 0,
  },
};

// Glass Card Presets
export const glassPresets = {
  card: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
    borderRadius: radius.lg,
  },
  cardSubtle: {
    backgroundColor: colors.glassMid,
    borderWidth: 0.5,
    borderColor: colors.glassBorder,
    borderRadius: radius.md,
  },
  cardBold: {
    backgroundColor: colors.glassHigh,
    borderWidth: 1.5,
    borderColor: colors.glassBorderStrong,
    borderRadius: radius.xl,
  },
};

// Button styles matching UI Kit
export const buttonStyles = {
  primary: {
    backgroundColor: colors.accent,
    color: '#FFFFFF',
    borderRadius: radius.md,
  },
  secondary: {
    backgroundColor: colors.glass,
    borderColor: colors.glassBorderStrong,
    borderWidth: 1,
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
    color: colors.textInverse,
    borderRadius: radius.md,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: colors.accent,
    borderWidth: 1.5,
    color: colors.accentVibrant,
    borderRadius: radius.md,
  },
  danger: {
    backgroundColor: colors.redDim,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    color: colors.red,
    borderRadius: radius.md,
  },
  glass: {
    backgroundColor: colors.glass,
    borderColor: colors.glassBorderStrong,
    borderWidth: 1,
    color: colors.text,
    borderRadius: radius.lg,
  },
};

export default colors;
