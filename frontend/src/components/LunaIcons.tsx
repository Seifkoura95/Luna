import React from 'react';
import Svg, { Path, Rect, Circle, G } from 'react-native-svg';
import { colors } from '../theme/colors';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

// Home Icon
export const HomeIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path
      d="M2 9.5L11 3l9 6.5V20a1 1 0 01-1 1H3a1 1 0 01-1-1V9.5zM8 21V14h6v7"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Events/Calendar Icon
export const EventsIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Rect x="2" y="4" width="18" height="16" rx="2.5" stroke={color} strokeWidth={strokeWidth} />
    <Path d="M7 2v4M15 2v4M2 9h18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

// Ticket Icon
export const TicketIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path
      d="M2 8a2 2 0 000 4v2a2 2 0 002 2h12a2 2 0 002-2v-2a2 2 0 000-4V6a2 2 0 00-2-2H4a2 2 0 00-2 2v2zM14 4v14"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Clock Icon
export const ClockIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Circle cx="11" cy="11" r="9" stroke={color} strokeWidth={strokeWidth} />
    <Path d="M11 6v5l3.5 2.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// Guest/User Icon
export const GuestIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Circle cx="11" cy="7" r="4" stroke={color} strokeWidth={strokeWidth} />
    <Path d="M3 19c0-4 3.5-7 8-7s8 3 8 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

// Music Icon
export const MusicIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Circle cx="6" cy="18" r="3" stroke={color} strokeWidth={strokeWidth} />
    <Circle cx="17" cy="15" r="3" stroke={color} strokeWidth={strokeWidth} />
    <Path d="M9 18V6l11-3v12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// Location Icon
export const LocationIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Circle cx="11" cy="9" r="2.5" stroke={color} strokeWidth={strokeWidth} />
    <Path
      d="M11 2a7 7 0 017 7c0 5-7 12-7 12S4 14 4 9a7 7 0 017-7z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Bell/Notification Icon
export const BellIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path d="M9 19a2 2 0 004 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Path
      d="M11 2a7 7 0 00-7 7v4l-1.5 2.5h17L18 13V9a7 7 0 00-7-7z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Search Icon
export const SearchIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Circle cx="10" cy="10" r="7" stroke={color} strokeWidth={strokeWidth} />
    <Path d="M15 15L20 20" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

// Settings Icon
export const SettingsIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Circle cx="11" cy="11" r="3" stroke={color} strokeWidth={strokeWidth} />
    <Path
      d="M11 2v2M11 18v2M2 11h2M18 11h2M4.9 4.9l1.4 1.4M15.7 15.7l1.4 1.4M4.9 17.1l1.4-1.4M15.7 6.3l1.4-1.4"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </Svg>
);

// Filter Icon
export const FilterIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path d="M2 5h18M6 11h10M10 17h2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

// Chart Icon
export const ChartIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path
      d="M2 18L7 11l4 4 4-6 5 3M2 2v16h18"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Scan/QR Scan Icon
export const ScanIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path
      d="M2 7V3h4M16 3h4v4M2 15v4h4M16 19h4v-4M2 11h18"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Card/Wallet Icon
export const CardIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Rect x="2" y="5" width="18" height="13" rx="2.5" stroke={color} strokeWidth={strokeWidth} />
    <Path d="M6 14h4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Path d="M2 9h18" stroke={color} strokeWidth={strokeWidth} />
  </Svg>
);

// Share Icon
export const ShareIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path
      d="M14 3l6 6-6 6M20 9H9a7 7 0 00-7 7v1"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Heart Icon
export const HeartIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5, filled = false }: IconProps & { filled?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path
      d="M11 19S2 13 2 7a5 5 0 0110 0 5 5 0 0110 0c0 6-9 12-9 12z"
      stroke={color}
      strokeWidth={strokeWidth}
      fill={filled ? color : 'none'}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Bolt/Lightning Icon
export const BoltIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path
      d="M13 2L4 13h7l-2 8 9-11h-7l2-8z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Camera Icon
export const CameraIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Rect x="2" y="7" width="18" height="13" rx="2" stroke={color} strokeWidth={strokeWidth} />
    <Circle cx="11" cy="13.5" r="3.5" stroke={color} strokeWidth={strokeWidth} />
    <Path d="M7 7l2-3h4l2 3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// Door/Entry Icon
export const DoorIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Rect x="5" y="2" width="12" height="19" rx="1.5" stroke={color} strokeWidth={strokeWidth} />
    <Circle cx="14.5" cy="11.5" r="1" fill={color} />
    <Path d="M2 21h18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

// Drinks Icon
export const DrinksIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path
      d="M6 2h10l-4 9v8h2v1H8v-1h2v-8L6 2zM5 6h12"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Star Icon
export const StarIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5, filled = false }: IconProps & { filled?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path
      d="M11 2l2.5 6H20l-5.5 4 2 6.5L11 15l-5.5 3.5 2-6.5L2 8h6.5L11 2z"
      stroke={color}
      strokeWidth={strokeWidth}
      fill={filled ? color : 'none'}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// QR Code Icon
export const QRIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Rect x="2" y="2" width="7" height="7" rx="1" stroke={color} strokeWidth={strokeWidth} />
    <Rect x="13" y="2" width="7" height="7" rx="1" stroke={color} strokeWidth={strokeWidth} />
    <Rect x="2" y="13" width="7" height="7" rx="1" stroke={color} strokeWidth={strokeWidth} />
    <Rect x="4" y="4" width="3" height="3" fill={color} />
    <Rect x="15" y="4" width="3" height="3" fill={color} />
    <Rect x="4" y="15" width="3" height="3" fill={color} />
    <Path d="M13 13h3v3M16 16h3v3M13 16v3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

// Wristband Icon
export const WristbandIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Rect x="2" y="8" width="18" height="6" rx="3" stroke={color} strokeWidth={strokeWidth} />
    <Path
      d="M7 8V7a4 4 0 018 0v1M7 14v1a4 4 0 008 0v-1M10 11h2"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </Svg>
);

// Table Icon
export const TableIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Rect x="3" y="7" width="16" height="8" rx="2" stroke={color} strokeWidth={strokeWidth} />
    <Path d="M5 15v4M17 15v4M2 7h18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

// Trophy/Leaderboard Icon
export const TrophyIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path
      d="M6 4h10v5a5 5 0 01-10 0V4zM11 14v3M8 20h6"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M6 4H3v3a3 3 0 003 3M16 4h3v3a3 3 0 01-3 3"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Gift Icon
export const GiftIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Rect x="3" y="8" width="16" height="12" rx="1" stroke={color} strokeWidth={strokeWidth} />
    <Path d="M11 8v12M3 12h16" stroke={color} strokeWidth={strokeWidth} />
    <Path
      d="M11 8c-1.5-2-3.5-4-5-3s0 3 5 3M11 8c1.5-2 3.5-4 5-3s0 3-5 3"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </Svg>
);

// Chevron Right
export const ChevronRightIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path d="M8 4l7 7-7 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// Chevron Left
export const ChevronLeftIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path d="M14 4l-7 7 7 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// Chevron Down
export const ChevronDownIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path d="M4 8l7 7 7-7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// Close/X Icon
export const CloseIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path d="M5 5l12 12M17 5L5 17" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

// Check Icon
export const CheckIcon = ({ size = 22, color = colors.text, strokeWidth = 2 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path d="M4 11l5 5L18 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// Plus Icon
export const PlusIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path d="M11 4v14M4 11h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

// Minus Icon
export const MinusIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path d="M4 11h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

// Crown Icon (for VIP/Premium)
export const CrownIcon = ({ size = 22, color = colors.gold, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path
      d="M3 17h16l-2-10-4 4-3-6-3 6-4-4-2 10zM5 17v2h12v-2"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Logout Icon
export const LogoutIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path
      d="M14 3h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M10 17l5-5-5-5M15 12H3"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Auction/Gavel Icon
export const AuctionIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path
      d="M14.5 4.5l3 3M3 21l4-4M10.5 7.5l4 4M7 11l-4 4 3 3 4-4M11 7l4-4 4 4-4 4"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// Luna AI Chat Icon - Custom chat bubble with sparkle
export const LunaAIIcon = ({ size = 22, color = colors.text, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path
      d="M11 2C5.5 2 2 6 2 10c0 2 1 3.5 2 4.5V18l3-2c1.3.6 2.6 1 4 1 5.5 0 9-4 9-7s-3.5-8-9-8z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M11 6v1M11 10v1M15 8l-1 1M7 8l1 1"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </Svg>
);

export default {
  HomeIcon,
  EventsIcon,
  TicketIcon,
  ClockIcon,
  GuestIcon,
  MusicIcon,
  LocationIcon,
  BellIcon,
  SearchIcon,
  SettingsIcon,
  FilterIcon,
  ChartIcon,
  ScanIcon,
  CardIcon,
  ShareIcon,
  HeartIcon,
  BoltIcon,
  CameraIcon,
  DoorIcon,
  DrinksIcon,
  StarIcon,
  QRIcon,
  WristbandIcon,
  TableIcon,
  TrophyIcon,
  GiftIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  CloseIcon,
  CheckIcon,
  PlusIcon,
  MinusIcon,
  CrownIcon,
  LogoutIcon,
  AuctionIcon,
  LunaAIIcon,
};
