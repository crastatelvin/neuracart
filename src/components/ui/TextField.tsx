import { colors, radius, layout, themedStyles } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { AppText } from './AppText';
import type { IconName } from './types';

type Props = Omit<TextInputProps, 'style'> & {
  label?: string;
  required?: boolean;
  icon?: IconName;
  error?: string | null;
  hint?: string;
  rightAccessory?: React.ReactNode;
};

export function TextField({
  label,
  required,
  icon,
  error,
  hint,
  rightAccessory,
  multiline,
  onFocus,
  onBlur,
  ...props
}: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrapper}>
      {label ? (
        <View style={styles.labelRow}>
          <AppText variant="meta" style={styles.label}>
            {label}
            {required ? <AppText style={styles.asterisk}> *</AppText> : null}
          </AppText>
        </View>
      ) : null}
      <View
        style={[
          styles.inputShell,
          multiline && styles.multilineShell,
          focused && styles.focused,
          !!error && styles.errorShell,
          props.editable === false && styles.disabledShell,
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={19}
            color={focused ? colors.primary : colors.subtle}
            style={styles.icon}
          />
        ) : null}
        <TextInput
          {...props}
          multiline={multiline}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          placeholderTextColor={colors.subtle}
          selectionColor={colors.primary}
          style={[styles.input, multiline && styles.multilineInput]}
          accessibilityLabel={label ?? props.placeholder}
        />
        {rightAccessory ? <View style={styles.accessory}>{rightAccessory}</View> : null}
      </View>
      {error ? (
        <AppText variant="meta" tone="danger" style={styles.helper}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="meta" tone="subtle" style={styles.helper}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = themedStyles((colors) => StyleSheet.create({
  wrapper: { gap: 7 },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  label: { color: colors.textSecondary, fontWeight: '600' },
  asterisk: { color: colors.danger },
  inputShell: {
    minHeight: layout.inputHeight,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.input,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  multilineShell: {
    minHeight: 106,
    alignItems: 'flex-start',
    paddingTop: 13,
  },
  focused: { borderColor: colors.primary, backgroundColor: colors.white },
  errorShell: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  disabledShell: { opacity: 0.7 },
  icon: { marginRight: 9 },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 13,
    minHeight: 48,
    outlineWidth: 0,
  },
  multilineInput: { textAlignVertical: 'top', minHeight: 80, paddingTop: 0 },
  accessory: { marginLeft: 8 },
  helper: { marginLeft: 2 },
}));
