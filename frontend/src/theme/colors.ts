// Eclipse Brisbane Brand Colors
export const colors = {
  // Primary
  background: '#000000',
  backgroundSecondary: '#0A0A0A',
  card: '#1A1A1A',
  cardHover: '#222222',
  
  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#999999',
  textMuted: '#666666',
  
  // Accent
  accent: '#CC0000',
  accentDark: '#990000',
  accentLight: '#FF3333',
  
  // Status
  success: '#00FF00',
  successDark: '#00CC00',
  warning: '#FFD700',
  error: '#FF4444',
  
  // Tier Colors
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
  black: '#1A1A1A',
  
  // Premium
  premiumGold: '#D4AF37',
  
  // Queue Status
  queueLow: '#00FF00',
  queueMedium: '#FFD700',
  queueHigh: '#FF4444',
  
  // Borders
  border: '#333333',
  borderLight: '#444444',
  
  // Overlays
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',
};

export const tierColors: Record<string, string> = {
  bronze: colors.bronze,
  silver: colors.silver,
  gold: colors.gold,
  platinum: colors.platinum,
  black: colors.premiumGold,
};

export default colors;
