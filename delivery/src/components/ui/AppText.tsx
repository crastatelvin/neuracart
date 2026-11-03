import type { ReactNode } from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors, fonts } from '@/constants/design';

type Variant =
  | 'display'
  | 'title'
  | 'section'
  | 'card'
  | 'body'
  | 'bodyMedium'
  | 'meta'
  | 'caption'
  | 'price'
  | 'button';

const variants: Record<Variant, TextStyle> = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: fonts.heavy, letterSpacing: -0.8 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: fonts.bold, letterSpacing: -0.4 },
  section: { fontSize: 18, lineHeight: 24, fontWeight: fonts.bold, letterSpacing: -0.2 },
  card: { fontSize: 15, lineHeight: 20, fontWeight: fonts.bold },
  body: { fontSize: 14, lineHeight: 21, fontWeight: fonts.regular },
  bodyMedium: { fontSize: 14, lineHeight: 21, fontWeight: fonts.medium },
  meta: { fontSize: 12, lineHeight: 17, fontWeight: fonts.medium },
  caption: { fontSize: 11, lineHeight: 15, fontWeight: fonts.medium },
  price: { fontSize: 18, lineHeight: 23, fontWeight: fonts.bold },
  button: { fontSize: 16, lineHeight: 21, fontWeight: fonts.semibold },
};

type Props = TextProps & {
  variant?: Variant;
  tone?: 'default' | 'muted' | 'primary' | 'danger' | 'white' | 'subtle';
  children?: ReactNode;
};

export function AppText({ variant = 'body', tone = 'default', style, ...props }: Props) {
  const toneColor = {
    default: colors.text,
    muted: colors.muted,
    primary: colors.primaryDark,
    danger: colors.danger,
    white: colors.white,
    subtle: colors.subtle,
  }[tone];

  return (
    <Text
      maxFontSizeMultiplier={1.3}
      {...props}
      style={[
        variants[variant],
        variant === 'price' && { color: colors.primaryDark },
        { color: toneColor },
        style,
      ]}
    />
  );
}
