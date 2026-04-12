/**
 * Luna Group VIP — Custom Icon Pack
 * 
 * All icons are pure SVG paths, no external dependencies.
 * Designed for React Native with react-native-svg.
 * 
 * Usage:
 *   import { LunaIcon } from './LunaIcons';
 *   <LunaIcon name="auction" size={24} color={colors.accent} />
 * 
 * Available icons:
 *   Navigation:   home, explore, wallet, profile, leaderboard, photos
 *   Features:     auction, mission, reward, ticket, booking, event
 *   Actions:      bid, checkin, scan, gift, star, crown
 *   Social:       friends, share, activity, safety, lostfound, notify
 *   Venue:        eclipse, afterdark, sucasa, juju, vip, booth
 *   Status:       bronze, silver, gold, platinum, points, streak
 *   UI:           chevronRight, chevronLeft, chevronDown, close, menu, search, filter, settings, edit, add, check, info, lock, logout
 */

import React from 'react';
import Svg, { Path, Circle, Rect, G, Line, Polyline, Polygon } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  filled?: boolean;
}

type IconName =
  // Navigation
  | 'home' | 'explore' | 'wallet' | 'profile' | 'leaderboard' | 'photos'
  // Features
  | 'auction' | 'mission' | 'reward' | 'ticket' | 'booking' | 'event'
  // Actions
  | 'bid' | 'checkin' | 'scan' | 'gift' | 'star' | 'crown'
  // Social
  | 'friends' | 'share' | 'activity' | 'safety' | 'lostfound' | 'notify'
  // Venue
  | 'eclipse' | 'afterdark' | 'sucasa' | 'juju' | 'vip' | 'booth'
  // Status
  | 'bronze' | 'silver' | 'gold' | 'platinum' | 'points' | 'streak'
  // UI
  | 'chevronRight' | 'chevronLeft' | 'chevronDown' | 'chevronUp'
  | 'close' | 'menu' | 'search' | 'filter' | 'settings' | 'edit'
  | 'add' | 'check' | 'info' | 'lock' | 'logout' | 'arrow';

const ICONS: Record<IconName, (props: IconProps) => React.ReactNode> = {

  // ── NAVIGATION ──────────────────────────────────────────────────────────────

  home: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H14v-5h-4v5H4a1 1 0 01-1-1V9.5z"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),

  explore: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M16.5 7.5l-3.5 5-5 3.5 3.5-5 5-3.5z"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="12" r="1" fill={color} />
    </Svg>
  ),

  wallet: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="2" y="6" width="20" height="14" rx="2" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M2 10h20" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Rect x="15" y="13" width="4" height="3" rx="1" fill={color} />
    </Svg>
  ),

  profile: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  ),

  leaderboard: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="12" width="4" height="9" rx="1" stroke={color} strokeWidth={strokeWidth} />
      <Rect x="10" y="7" width="4" height="14" rx="1" stroke={color} strokeWidth={strokeWidth} />
      <Rect x="17" y="3" width="4" height="18" rx="1" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  ),

  photos: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="2" y="5" width="20" height="15" rx="2" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="8.5" cy="10.5" r="1.5" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M2 16l5-5 4 4 3-3 5 5"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),

  // ── FEATURES ─────────────────────────────────────────────────────────────────

  auction: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14.5 3.5l6 6-10 10-3-1-1-3 8-12z"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12.5 5.5l6 6M3 21l4.5-4.5"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M3 21h4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  ),

  mission: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="12" cy="12" r="5" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="12" cy="12" r="1.5" fill={color} />
    </Svg>
  ),

  reward: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 12v9H4v-9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 7H2v5h20V7z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 21V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),

  ticket: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 9a1 1 0 011-1h18a1 1 0 011 1v2a2 2 0 000 4v2a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a2 2 0 000-4V9z"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 8v8M15 8v2M15 13v3"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray="2 1.5" />
    </Svg>
  ),

  booking: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M3 9h18M8 4V2M16 4V2"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M7 13h3v3H7z" fill={color} />
      <Path d="M14 13h3v3h-3z" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  ),

  event: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 00-1.3-3.2 4.2 4.2 0 00-.1-3.2s-1-.3-3.3 1.3a11.5 11.5 0 00-6 0C7.1 2.8 6.1 3.1 6.1 3.1a4.2 4.2 0 00-.1 3.2A4.6 4.6 0 004.7 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),

  // ── ACTIONS ──────────────────────────────────────────────────────────────────

  bid: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),

  checkin: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 13a4 4 0 100-8 4 4 0 000 8z"
        stroke={color} strokeWidth={strokeWidth} />
      <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),

  scan: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M3 12h18" stroke={color} strokeWidth={strokeWidth * 1.5} strokeLinecap="round" />
      <Rect x="7" y="7" width="4" height="4" rx="0.5" stroke={color} strokeWidth={strokeWidth} />
      <Rect x="13" y="7" width="4" height="4" rx="0.5" stroke={color} strokeWidth={strokeWidth} />
      <Rect x="7" y="13" width="4" height="4" rx="0.5" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M13 15h2M15 13v2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  ),

  gift: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 12v10H4V12M22 7H2v5h20V7zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),

  star: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5, filled = false }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
        fill={filled ? color : 'none'} />
    </Svg>
  ),

  crown: ({ size = 24, color = '#C9A84C', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 18l3-10 4.5 5L12 4l2.5 9 4.5-5 3 10H2z"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M2 18h20" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  ),

  // ── SOCIAL ───────────────────────────────────────────────────────────────────

  friends: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="7" r="3.5" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M2 20c0-3.5 3.1-6 7-6s7 2.5 7 6"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M19 8v6M16 11h6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  ),

  share: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="18" cy="5" r="3" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="6" cy="12" r="3" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="18" cy="19" r="3" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M8.7 10.7l6.6-3.4M8.7 13.3l6.6 3.4"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  ),

  activity: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="22 12 18 12 15 21 9 3 6 12 2 12"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  ),

  safety: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3L4 7v5c0 4.4 3.4 8.5 8 9.5 4.6-1 8-5.1 8-9.5V7l-8-4z"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 12l2 2 4-4"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),

  lostfound: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),

  notify: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),

  // ── VENUE ────────────────────────────────────────────────────────────────────

  eclipse: ({ size = 24, color = '#E31837', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M12 3v4M12 17v4M3 12h4M17 12h4"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  ),

  afterdark: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),

  sucasa: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 21v-6h3v6M13 21v-6h3v6"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),

  juju: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 20c0-6 4-10 10-10s10 4 10 10"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M12 10V3M8 5l4-2 4 2"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="3" r="1" fill={color} />
    </Svg>
  ),

  vip: ({ size = 24, color = '#C9A84C', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 7l4 10 6-8 6 8 4-10"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M2 7h20" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  ),

  booth: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="8" width="18" height="13" rx="2" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M3 12h18M8 21V12M16 21V12"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M7 8V5a2 2 0 012-2h6a2 2 0 012 2v3"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  ),

  // ── STATUS ───────────────────────────────────────────────────────────────────

  bronze: ({ size = 24, color = '#CD7F32', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6l2-6z"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),

  silver: ({ size = 24, color = '#C0C0C0', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="8" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M12 4l1.8 5.5H19l-4.6 3.3 1.7 5.2L12 15l-4.1 3 1.7-5.2L5 9.5h5.2L12 4z"
        fill={color} />
    </Svg>
  ),

  gold: ({ size = 24, color = '#C9A84C', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
        fill={color} />
    </Svg>
  ),

  platinum: ({ size = 24, color = '#E5E4E2', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="12" r="3" fill={color} />
    </Svg>
  ),

  points: ({ size = 24, color = '#2563EB', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M9 12h6M12 9v6"
        stroke={color} strokeWidth={strokeWidth * 1.5} strokeLinecap="round" />
    </Svg>
  ),

  streak: ({ size = 24, color = '#F97316', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M13 2L4.5 13.5H11L9 22l10.5-12H13L13 2z"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),

  // ── UI ───────────────────────────────────────────────────────────────────────

  chevronRight: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18l6-6-6-6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),

  chevronLeft: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),

  chevronDown: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),

  chevronUp: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 15l-6-6-6 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),

  close: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  ),

  menu: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 12h18M3 6h18M3 18h12"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  ),

  search: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="10.5" cy="10.5" r="6.5" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M15.5 15.5L21 21" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  ),

  filter: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),

  settings: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),

  edit: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),

  add: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M12 8v8M8 12h8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  ),

  check: ({ size = 24, color = '#22C55E', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),

  info: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M12 8v.5M12 11v5" stroke={color} strokeWidth={strokeWidth * 1.5} strokeLinecap="round" />
    </Svg>
  ),

  lock: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="5" y="11" width="14" height="11" rx="2" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M8 11V7a4 4 0 018 0v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx="12" cy="16" r="1.5" fill={color} />
    </Svg>
  ),

  logout: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),

  arrow: ({ size = 24, color = '#F0F0F5', strokeWidth = 1.5 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14M12 5l7 7-7 7"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
};

// ── Main component ────────────────────────────────────────────────────────────

interface LunaIconProps extends IconProps {
  name: IconName;
}

export const LunaIcon: React.FC<LunaIconProps> = ({
  name,
  size = 24,
  color = '#F0F0F5',
  strokeWidth = 1.5,
  filled = false,
}) => {
  const IconComponent = ICONS[name];
  if (!IconComponent) return null;
  return <>{IconComponent({ size, color, strokeWidth, filled })}</>;
};

// ── Tab bar preset (20px, slightly thicker stroke) ───────────────────────────

export const TabIcon: React.FC<{ name: IconName; active?: boolean; color?: string }> = ({
  name,
  active = false,
  color,
}) => (
  <LunaIcon
    name={name}
    size={22}
    color={color ?? (active ? '#2563EB' : 'rgba(240,240,245,0.4)')}
    strokeWidth={active ? 2 : 1.5}
  />
);

// ── Feature icon preset (32px, accent color) ─────────────────────────────────

export const FeatureIcon: React.FC<{ name: IconName; color?: string }> = ({ name, color = '#2563EB' }) => (
  <LunaIcon name={name} size={32} color={color} strokeWidth={1.5} />
);

// ── Named exports for direct use ─────────────────────────────────────────────

export default LunaIcon;
export type { IconName, LunaIconProps };
