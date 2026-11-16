/**
 * PrepSathi light premium design tokens.
 * Warm ivory #FAF6ED, royal violet #5B3EA8, antique gold #B08D2E —
 * the same palette as the web app. No black backgrounds, ever.
 */

export const colors = {
  background: '#FAF6ED',
  surface: '#FFFFFF',
  surfaceAlt: '#F3EDDF',
  ink: '#241F1A',
  inkMuted: '#6B6357',
  inkFaint: '#9A917F',
  primary: '#5B3EA8',
  primaryDark: '#452C86',
  primarySoft: '#EDE7F7',
  gold: '#B08D2E',
  goldSoft: '#F6ECD2',
  success: '#2E7D4F',
  successSoft: '#E3F2E8',
  danger: '#B3261E',
  dangerSoft: '#FBE9E7',
  border: '#E3DCCB',
  white: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  title: {fontSize: 26, fontWeight: '800' as const, lineHeight: 32},
  heading: {fontSize: 20, fontWeight: '700' as const, lineHeight: 26},
  subheading: {fontSize: 17, fontWeight: '700' as const, lineHeight: 23},
  body: {fontSize: 16, fontWeight: '400' as const, lineHeight: 23},
  bodySmall: {fontSize: 14, fontWeight: '400' as const, lineHeight: 20},
  caption: {fontSize: 12, fontWeight: '600' as const, lineHeight: 16},
  button: {fontSize: 16, fontWeight: '700' as const, lineHeight: 22},
} as const;

export const BAND_LABEL = 'practice estimate, not an official score';
