/**
 * Icon — Drop-in replacement for Ionicons that uses LunaIcons when available.
 * 
 * Usage: Replace `<Ionicons name="star" size={20} color="#fff" />`
 *   with `<Icon name="star" size={20} color="#fff" />`
 * 
 * If the icon name has a LunaIcon equivalent it renders the custom SVG.
 * Otherwise it falls back to Ionicons.
 */
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LunaIcon } from './LunaIcons';
import type { IconName } from './LunaIcons';

// Map Ionicons names → LunaIcon names
const LUNA_MAP: Record<string, IconName> = {
  'flash': 'auction',
  'flash-outline': 'auction',
  'flame': 'streak',
  'flame-outline': 'streak',
  'location': 'explore',
  'location-outline': 'explore',
  'map': 'explore',
  'map-outline': 'explore',
  // Navigation
  'home': 'home',
  'home-outline': 'home',
  'compass': 'explore',
  'compass-outline': 'explore',
  'wallet': 'wallet',
  'wallet-outline': 'wallet',
  'person': 'profile',
  'person-outline': 'profile',
  'person-circle': 'profile',
  'person-circle-outline': 'profile',
  'podium': 'leaderboard',
  'podium-outline': 'leaderboard',
  'trophy': 'leaderboard',
  'trophy-outline': 'leaderboard',
  'images': 'photos',
  'images-outline': 'photos',
  'camera': 'photos',
  'camera-outline': 'photos',
  // Features
  'hammer': 'auction',
  'hammer-outline': 'auction',
  'flag': 'mission',
  'flag-outline': 'mission',
  'gift': 'reward',
  'gift-outline': 'reward',
  'ticket': 'ticket',
  'ticket-outline': 'ticket',
  'calendar': 'booking',
  'calendar-outline': 'booking',
  // Actions
  'scan': 'scan',
  'scan-outline': 'scan',
  'qr-code': 'scan',
  'qr-code-outline': 'scan',
  'star': 'star',
  'star-outline': 'star',
  'sparkles': 'crown',
  'sparkles-outline': 'crown',
  // Social
  'people': 'friends',
  'people-outline': 'friends',
  'share-outline': 'share',
  'share-social': 'share',
  'share-social-outline': 'share',
  'pulse': 'activity',
  'pulse-outline': 'activity',
  'shield': 'safety',
  'shield-outline': 'safety',
  'shield-checkmark': 'safety',
  'shield-checkmark-outline': 'safety',
  'notifications': 'notify',
  'notifications-outline': 'notify',
  'alert-circle': 'notify',
  'alert-circle-outline': 'notify',
  // UI
  'chevron-forward': 'chevronRight',
  'chevron-back': 'chevronLeft',
  'chevron-down': 'chevronDown',
  'chevron-up': 'chevronUp',
  'close': 'close',
  'close-outline': 'close',
  'close-circle': 'close',
  'close-circle-outline': 'close',
  'menu': 'menu',
  'menu-outline': 'menu',
  'search': 'search',
  'search-outline': 'search',
  'filter': 'filter',
  'filter-outline': 'filter',
  'settings': 'settings',
  'settings-outline': 'settings',
  'create': 'edit',
  'create-outline': 'edit',
  'pencil': 'edit',
  'pencil-outline': 'edit',
  'add': 'add',
  'add-outline': 'add',
  'add-circle': 'add',
  'add-circle-outline': 'add',
  'checkmark': 'check',
  'checkmark-outline': 'check',
  'checkmark-circle': 'check',
  'checkmark-circle-outline': 'check',
  'information-circle': 'info',
  'information-circle-outline': 'info',
  'lock-closed': 'lock',
  'lock-closed-outline': 'lock',
  'log-out': 'logout',
  'log-out-outline': 'logout',
  'arrow-forward': 'arrow',
  'arrow-forward-outline': 'arrow',
};

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: any;
}

export const Icon: React.FC<IconProps> = ({ name, size = 24, color = '#F0F0F5', style }) => {
  const lunaName = LUNA_MAP[name];
  if (lunaName) {
    return (
      <LunaIcon name={lunaName} size={size} color={color} />
    );
  }
  // Fallback to Ionicons for icons we don't have
  return <Ionicons name={name as any} size={size} color={color} style={style} />;
};

export default Icon;
