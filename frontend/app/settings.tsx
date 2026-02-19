import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '../src/theme/colors';
import { AppBackground } from '../src/components/AppBackground';
import { useAuthStore } from '../src/store/authStore';
import { api } from '../src/utils/api';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logout, user } = useAuthStore();
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);

  const handleDeleteAccount = async () => {
    if (deleteStep === 1) {
      setDeleteStep(2);
      return;
    }
    
    setIsDeleting(true);
    try {
      await api.deleteAccount();
      Alert.alert(
        'Account Deleted',
        'Your account and all associated data have been permanently deleted.',
        [
          {
            text: 'OK',
            onPress: async () => {
              await logout();
              router.replace('/login');
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteStep(1);
    }
  };

  const legalItems = [
    {
      id: 'privacy',
      icon: 'shield-checkmark',
      title: 'Privacy Policy',
      subtitle: 'How we handle your data',
      route: '/privacy-policy',
    },
    {
      id: 'terms',
      icon: 'document-text',
      title: 'Terms of Service',
      subtitle: 'Usage terms and conditions',
      route: '/terms-of-service',
    },
  ];

  const accountItems = [
    {
      id: 'notifications',
      icon: 'notifications',
      title: 'Notifications',
      subtitle: 'Manage push notifications',
      route: '/notifications',
    },
  ];

  const dangerItems = [
    {
      id: 'delete',
      icon: 'trash',
      title: 'Delete Account',
      subtitle: 'Permanently delete your account',
      onPress: () => setShowDeleteConfirm(true),
      danger: true,
    },
  ];

  const renderSettingItem = (item: any, index: number, isLast: boolean) => (
    <TouchableOpacity
      key={item.id}
      style={[
        styles.settingItem,
        !isLast && styles.settingItemBorder,
        item.danger && styles.settingItemDanger,
      ]}
      onPress={item.onPress || (() => router.push(item.route))}
      activeOpacity={0.7}
      data-testid={`settings-${item.id}`}
    >
      <View style={[styles.settingIcon, item.danger && styles.settingIconDanger]}>
        <Ionicons
          name={item.icon}
          size={20}
          color={item.danger ? colors.error : colors.accent}
        />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, item.danger && styles.settingTitleDanger]}>
          {item.title}
        </Text>
        <Text style={styles.settingSubtitle}>{item.subtitle}</Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={item.danger ? colors.error : colors.textMuted}
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <AppBackground intensity={30} tint="dark" overlayOpacity={0.4} />

      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          data-testid="settings-back-btn"
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <View style={styles.sectionCard}>
            {accountItems.map((item, index) =>
              renderSettingItem(item, index, index === accountItems.length - 1)
            )}
          </View>
        </View>

        {/* Legal Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LEGAL</Text>
          <View style={styles.sectionCard}>
            {legalItems.map((item, index) =>
              renderSettingItem(item, index, index === legalItems.length - 1)
            )}
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DANGER ZONE</Text>
          <View style={[styles.sectionCard, styles.dangerCard]}>
            {dangerItems.map((item, index) =>
              renderSettingItem(item, index, index === dangerItems.length - 1)
            )}
          </View>
          <Text style={styles.dangerHint}>
            Deleting your account is permanent and cannot be undone. All your data, points, and history will be lost.
          </Text>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>Luna Group v1.0.0</Text>
          <Text style={styles.appCopyright}>2025 Luna Group Pty Ltd</Text>
        </View>
      </ScrollView>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowDeleteConfirm(false);
          setDeleteStep(1);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={[colors.backgroundCard, colors.background]}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalIconContainer}>
                  <Ionicons name="warning" size={32} color={colors.error} />
                </View>
                <Text style={styles.modalTitle}>
                  {deleteStep === 1 ? 'Delete Account?' : 'Are you absolutely sure?'}
                </Text>
              </View>

              <Text style={styles.modalMessage}>
                {deleteStep === 1
                  ? 'This action will permanently delete your account and all associated data, including:'
                  : 'This action CANNOT be undone. Your account will be permanently deleted.'}
              </Text>

              {deleteStep === 1 && (
                <View style={styles.deleteList}>
                  <View style={styles.deleteListItem}>
                    <Ionicons name="star" size={16} color={colors.gold} />
                    <Text style={styles.deleteListText}>
                      {user?.points_balance || 0} Luna Points
                    </Text>
                  </View>
                  <View style={styles.deleteListItem}>
                    <Ionicons name="ticket" size={16} color={colors.accent} />
                    <Text style={styles.deleteListText}>All tickets & reservations</Text>
                  </View>
                  <View style={styles.deleteListItem}>
                    <Ionicons name="trophy" size={16} color={colors.gold} />
                    <Text style={styles.deleteListText}>Auction bids & wins</Text>
                  </View>
                  <View style={styles.deleteListItem}>
                    <Ionicons name="people" size={16} color={colors.accent} />
                    <Text style={styles.deleteListText}>Crew memberships</Text>
                  </View>
                  <View style={styles.deleteListItem}>
                    <Ionicons name="time" size={16} color={colors.textMuted} />
                    <Text style={styles.deleteListText}>All activity history</Text>
                  </View>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowDeleteConfirm(false);
                    setDeleteStep(1);
                  }}
                  disabled={isDeleting}
                  data-testid="delete-cancel-btn"
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
                  onPress={handleDeleteAccount}
                  disabled={isDeleting}
                  data-testid="delete-confirm-btn"
                >
                  {isDeleting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="trash" size={16} color="#fff" />
                      <Text style={styles.deleteButtonText}>
                        {deleteStep === 1 ? 'Continue' : 'Delete Forever'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  dangerCard: {
    borderColor: colors.error + '30',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  settingItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingItemDanger: {
    backgroundColor: colors.error + '08',
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  settingIconDanger: {
    backgroundColor: colors.error + '15',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  settingTitleDanger: {
    color: colors.error,
  },
  settingSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  dangerHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
    marginLeft: 4,
    lineHeight: 18,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  appVersion: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 4,
  },
  appCopyright: {
    fontSize: 12,
    color: colors.textMuted,
    opacity: 0.6,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  modalGradient: {
    padding: spacing.lg,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.error + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  deleteList: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  deleteListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: spacing.sm,
  },
  deleteListText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundElevated,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.error,
    gap: 6,
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
