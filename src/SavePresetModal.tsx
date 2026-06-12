import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { tapLight, tapMedium } from './haptics';

type SavePresetModalProps = {
  visible: boolean;
  bg: string;
  ink: string;
  inkSoft: string;
  line: string;
  surface: string;
  accent: string;
  existingNames: string[];
  onCancel: () => void;
  onSave: (name: string) => void;
};

export default function SavePresetModal({
  visible,
  bg,
  ink,
  inkSoft,
  line,
  surface,
  accent,
  existingNames,
  onCancel,
  onSave,
}: SavePresetModalProps) {
  const [name, setName] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setName('');
      // Tiny delay to let the modal mount before focusing.
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [visible]);

  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  const isDuplicate = existingNames.some((n) => n.toLowerCase() === lower);
  const isValid = trimmed.length > 0 && trimmed.length <= 24 && !isDuplicate;

  const submit = () => {
    if (!isValid) return;
    tapMedium();
    onSave(trimmed);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.scrim, { backgroundColor: 'rgba(31,28,23,0.45)' }]}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: bg,
              borderColor: line,
            },
          ]}
        >
          <Text style={[styles.eyebrow, { color: inkSoft }]}>New preset</Text>
          <Text style={[styles.title, { color: ink }]}>Name it</Text>
          <Text style={[styles.helper, { color: inkSoft }]}>
            Give this EQ shape a name so you can call it back later.
          </Text>

          <TextInput
            ref={inputRef}
            value={name}
            onChangeText={setName}
            placeholder="Late night, Jazz, Movie…"
            placeholderTextColor={inkSoft}
            maxLength={24}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={submit}
            style={[
              styles.input,
              {
                color: ink,
                backgroundColor: surface,
                borderColor: line,
              },
            ]}
          />

          {isDuplicate ? (
            <Text style={[styles.warn, { color: '#c98e6b' }]}>
              That name’s already taken.
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                tapLight();
                onCancel();
              }}
              style={[styles.btnGhost, { borderColor: line, backgroundColor: surface }]}
              hitSlop={6}
            >
              <Text style={[styles.btnGhostLabel, { color: ink }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={!isValid}
              style={[
                styles.btnPrimary,
                { backgroundColor: isValid ? ink : surface, opacity: isValid ? 1 : 0.6 },
              ]}
              hitSlop={6}
            >
              <Text
                style={[
                  styles.btnPrimaryLabel,
                  { color: isValid ? '#fff' : inkSoft },
                ]}
              >
                Save
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 22,
    gap: 10,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  helper: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
  },
  warn: {
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    justifyContent: 'flex-end',
  },
  btnGhost: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  btnGhostLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  btnPrimary: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
  },
  btnPrimaryLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
