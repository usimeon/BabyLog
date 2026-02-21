import React, { useMemo } from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavBaby } from './navigation.types';
import { useAppTheme } from '../theme/useAppTheme';
import { createNavigationStyles } from './navigation.styles';

type BabySwitcherModalProps = {
  open: boolean;
  onClose: () => void;
  hint: string | null;
  babies: NavBaby[];
  activeBabyId: string;
  switchActiveBaby: (babyId: string) => Promise<void>;
};

export const BabySwitcherModal = ({ open, onClose, hint, babies, activeBabyId, switchActiveBaby }: BabySwitcherModalProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createNavigationStyles(theme), [theme]);

  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={[styles.switcherOverlay, { backgroundColor: theme.colors.overlay }]}>
        <Pressable
          onPress={() => {}}
          style={[
            styles.switcherSheet,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
            theme.shadows.level2,
          ]}
        >
          <Text style={[styles.switcherTitle, { color: theme.colors.textPrimary }]}>Switch Baby</Text>
          <Text style={[styles.switcherSubtitle, { color: theme.colors.textSecondary }]}>Choose active baby</Text>
          {hint ? <Text style={[styles.switcherHint, { color: theme.colors.textSecondary }]}>{hint}</Text> : null}

          {babies.map((baby) => {
            const isActive = baby.id === activeBabyId;
            const initial = (baby.name.trim().charAt(0) || 'B').toUpperCase();
            return (
              <Pressable
                key={baby.id}
                onPress={() => {
                  onClose();
                  if (isActive) return;
                  void switchActiveBaby(baby.id);
                }}
                style={[
                  styles.switcherRow,
                  {
                    backgroundColor: isActive ? theme.colors.primarySoft : theme.colors.background,
                    borderColor: isActive ? theme.colors.primary : theme.colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Switch to ${baby.name}`}
                accessibilityState={{ selected: isActive }}
              >
                <View style={styles.switcherRowLeft}>
                  <View
                    style={[
                      styles.switcherRowAvatar,
                      {
                        borderColor: isActive ? theme.colors.primary : theme.colors.border,
                        backgroundColor: isActive ? theme.colors.primarySoft : theme.colors.surfaceAlt,
                      },
                    ]}
                  >
                    {baby.photoUri ? (
                      <Image source={{ uri: baby.photoUri }} style={styles.switcherRowAvatarImage} />
                    ) : (
                      <Text
                        style={[
                          styles.switcherRowAvatarText,
                          { color: isActive ? theme.colors.primary : theme.colors.textSecondary },
                        ]}
                      >
                        {initial}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.switcherRowText, { color: isActive ? theme.colors.primary : theme.colors.textPrimary }]}>
                    {baby.name}
                  </Text>
                </View>
                {isActive ? <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} /> : null}
              </Pressable>
            );
          })}

          <Pressable
            onPress={onClose}
            style={[styles.cancelButton, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Cancel switching baby"
          >
            <Text style={[styles.cancelButtonText, { color: theme.colors.textPrimary }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
