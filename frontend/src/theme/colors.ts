// Eclipse Brisbane Premium Brand Colors & Design Tokens
export const colors = {
  // Primary Backgrounds - Deep blacks with subtle warmth
  background: '#000000',
  backgroundElevated: '#0A0A0A',
  backgroundCard: '#111111',
  backgroundCardHover: '#161616',
  
  // Text - High contrast with hierarchy
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textMuted: '#606060',
  textDisabled: '#404040',
  
  // Brand Accent - Rich Eclipse Red
  accent: '#E31837',
  accentDark: '#B8132C',
  accentLight: '#FF2D4D',
  accentGlow: 'rgba(227, 24, 55, 0.3)',
  
  // Premium Gold - VIP Status
  gold: '#D4AF37',
  goldLight: '#F4CF57',
  goldDark: '#B4952F',
  goldGlow: 'rgba(212, 175, 55, 0.25)',
  
  // Status Colors
  success: '#00D26A',
  successGlow: 'rgba(0, 210, 106, 0.2)',
  warning: '#FFB800',
  warningGlow: 'rgba(255, 184, 0, 0.2)',
  error: '#FF3B5C',
  errorGlow: 'rgba(255, 59, 92, 0.2)',
  info: '#00A3FF',
  
  // Tier Colors - Premium Metallic Feel
  bronze: '#CD7F32',
  bronzeGlow: 'rgba(205, 127, 50, 0.2)',
  silver: '#C0C0C0',
  silverGlow: 'rgba(192, 192, 192, 0.2)',
  goldTier: '#FFD700',
  platinum: '#E5E4E2',
  platinumGlow: 'rgba(229, 228, 226, 0.15)',
  black: '#1A1A1A',
  
  // Queue Status
  queueLow: '#00D26A',
  queueMedium: '#FFB800',
  queueHigh: '#FF3B5C',
  
  // Borders & Dividers
  border: '#1F1F1F',
  borderLight: '#2A2A2A',
  borderAccent: '#333333',
  
  // Overlays
  overlay: 'rgba(0, 0, 0, 0.85)',
  overlayLight: 'rgba(0, 0, 0, 0.6)',
  
  // Gradients (as arrays for LinearGradient)
  gradientAccent: ['#E31837', '#B8132C'],
  gradientGold: ['#F4CF57', '#D4AF37', '#B4952F'],
  gradientDark: ['#1A1A1A', '#0A0A0A', '#000000'],
  gradientCard: ['#161616', '#111111'],
};

export const tierColors: Record<string, string> = {
  bronze: colors.bronze,
  silver: colors.silver,
  gold: colors.goldTier,
  platinum: colors.platinum,
  black: colors.gold,
};

export const tierGlows: Record<string, string> = {
  bronze: colors.bronzeGlow,
  silver: colors.silverGlow,
  gold: colors.goldGlow,
  platinum: colors.platinumGlow,
  black: colors.goldGlow,
};

// Typography Scale
export const typography = {
  hero: {
    fontSize: 56,
    fontWeight: '800' as const,
    letterSpacing: 8,
  },
  h1: {
    fontSize: 32,
    fontWeight: '700' as const,
    letterSpacing: 1,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 1.5,
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

// Border Radius
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

// Shadows (for elevated elements)
export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  }),
};

export default colors;
