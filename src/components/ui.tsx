/**
 * Shared UI primitives — light premium theme.
 * Every interactive element carries an accessibility label.
 */

import React, {Component, type ReactNode} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {colors, radius, spacing, typography} from '../theme/tokens';

/* --- Screen ---------------------------------------------------------- */

export function Screen({
  children,
  scroll = true,
  testID,
}: {
  children: ReactNode;
  scroll?: boolean;
  testID?: string;
}) {
  const content = (
    <View style={styles.screenInner} testID={testID}>
      {children}
    </View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

/* --- Card ------------------------------------------------------------ */

export function Card({
  children,
  testID,
}: {
  children: ReactNode;
  testID?: string;
}) {
  return (
    <View style={styles.card} testID={testID}>
      {children}
    </View>
  );
}

/* --- Text ------------------------------------------------------------ */

export function Title({children}: {children: ReactNode}) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Heading({children}: {children: ReactNode}) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function Subheading({children}: {children: ReactNode}) {
  return <Text style={styles.subheading}>{children}</Text>;
}

export function Body({children}: {children: ReactNode}) {
  return <Text style={styles.body}>{children}</Text>;
}

export function Caption({children}: {children: ReactNode}) {
  return <Text style={styles.caption}>{children}</Text>;
}

export function SectionHeader({children}: {children: ReactNode}) {
  return <Text style={styles.sectionHeader}>{children}</Text>;
}

/* --- Button ---------------------------------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  accessibilityLabel,
  testID,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{disabled}}
      testID={testID}
      style={({pressed}) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}>
      <Text
        style={[
          styles.buttonText,
          variant === 'primary' && styles.buttonTextPrimary,
          variant === 'secondary' && styles.buttonTextSecondary,
          variant === 'ghost' && styles.buttonTextGhost,
          variant === 'danger' && styles.buttonTextDanger,
        ]}>
        {title}
      </Text>
    </Pressable>
  );
}

/* --- Text input ------------------------------------------------------ */

export function AppTextInput({
  label,
  ...props
}: TextInputProps & {label: string}) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        {...props}
        style={[styles.input, props.multiline && styles.inputMultiline]}
        placeholderTextColor={colors.inkFaint}
        accessibilityLabel={label}
      />
    </View>
  );
}

/* --- Band chip ------------------------------------------------------- */

export function BandChip({
  band,
  label = 'practice estimate, not an official score',
  testID,
}: {
  band: number | null;
  label?: string;
  testID?: string;
}) {
  if (band === null) {
    return null;
  }
  return (
    <View style={styles.bandChip} testID={testID}>
      <Text style={styles.bandNumber} accessibilityLabel={`Band ${band}`}>
        Band {band.toFixed(1)}
      </Text>
      <Text style={styles.bandLabel}>{label}</Text>
    </View>
  );
}

/* --- Countdown ------------------------------------------------------- */

export function Countdown({
  seconds,
  testID,
}: {
  seconds: number;
  testID?: string;
}) {
  const mm = String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0');
  const ss = String(Math.max(0, seconds) % 60).padStart(2, '0');
  const urgent = seconds < 300;
  return (
    <Text
      style={[styles.countdown, urgent && styles.countdownUrgent]}
      testID={testID}
      accessibilityLabel={`${mm} minutes ${ss} seconds remaining`}>
      {mm}:{ss}
    </Text>
  );
}

/* --- Option row (MCQ / TFNG) ----------------------------------------- */

export function OptionButton({
  label,
  selected,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{selected}}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.option, selected && styles.optionSelected]}>
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

/* --- Misc ------------------------------------------------------------ */

export function Loading({label = 'Loading…'}: {label?: string}) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  );
}

export function EmptyState({message}: {message: string}) {
  return (
    <View style={styles.centered}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

export function ErrorText({message}: {message: string}) {
  if (!message) {
    return null;
  }
  return <Text style={styles.errorText}>{message}</Text>;
}

/* --- Error boundary -------------------------------------------------- */

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {error: null};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {error};
  }

  retry = () => {
    this.setState({error: null});
  };

  render() {
    if (this.state.error) {
      return (
        <SafeAreaView style={styles.screen}>
          <View style={styles.centered}>
            <Text style={styles.heading}>Something went wrong</Text>
            <Text style={styles.body}>
              {this.state.error.message || 'An unexpected error occurred.'}
            </Text>
            <AppButton title="Try again" onPress={this.retry} />
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

/* --- Styles ---------------------------------------------------------- */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenInner: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  scrollContent: {
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.ink,
  },
  heading: {
    ...typography.heading,
    color: colors.ink,
  },
  subheading: {
    ...typography.subheading,
    color: colors.ink,
  },
  body: {
    ...typography.body,
    color: colors.ink,
  },
  caption: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  sectionHeader: {
    ...typography.subheading,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonDanger: {
    backgroundColor: colors.danger,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...typography.button,
  },
  buttonTextPrimary: {
    color: colors.white,
  },
  buttonTextSecondary: {
    color: colors.primary,
  },
  buttonTextGhost: {
    color: colors.primary,
  },
  buttonTextDanger: {
    color: colors.white,
  },
  inputWrap: {
    gap: spacing.xs,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.ink,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.ink,
  },
  inputMultiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  bandChip: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  bandNumber: {
    ...typography.heading,
    color: colors.ink,
  },
  bandLabel: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  countdown: {
    ...typography.heading,
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },
  countdownUrgent: {
    color: colors.danger,
  },
  option: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  optionText: {
    ...typography.body,
    color: colors.ink,
  },
  optionTextSelected: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  loadingLabel: {
    ...typography.bodySmall,
    color: colors.inkMuted,
  },
  emptyText: {
    ...typography.body,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.danger,
  },
});
