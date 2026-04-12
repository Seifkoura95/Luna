import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  RefreshControl,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../src/components/Icon';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius } from '../src/theme/colors';
import { api } from '../src/utils/api';
import { AppBackground } from '../src/components/AppBackground';

const ITEM_CATEGORIES = [
  { id: 'phone', label: 'Phone', icon: 'phone-portrait' },
  { id: 'wallet', label: 'Wallet', icon: 'wallet' },
  { id: 'keys', label: 'Keys', icon: 'key' },
  { id: 'bag', label: 'Bag', icon: 'bag' },
  { id: 'clothing', label: 'Clothing', icon: 'shirt' },
  { id: 'jewelry', label: 'Jewelry', icon: 'diamond' },
  { id: 'other', label: 'Other', icon: 'help-circle' },
];

export default function LostAndFoundPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [myReports, setMyReports] = useState<any[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [venues, setVenues] = useState<any[]>([]);
  
  // Form state
  const [selectedVenue, setSelectedVenue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [description, setDescription] = useState('');
  const [lostDate, setLostDate] = useState(new Date().toISOString().split('T')[0]);
  const [lostTime, setLostTime] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [photoUri, setPhotoUri] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [reportsData, venuesData] = await Promise.all([
        api.getMyLostReports(),
        api.getVenues()
      ]);
      setMyReports(reportsData.reports || []);
      setVenues(venuesData);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      handleHaptic();
    }
  };

  const handleSubmit = async () => {
    if (!selectedVenue || !selectedCategory || !description.trim()) {
      Alert.alert('Required Fields', 'Please fill in venue, category, and description');
      return;
    }

    setSubmitting(true);
    handleHaptic();

    try {
      await api.reportLostItem(
        selectedVenue,
        description,
        selectedCategory,
        lostDate,
        lostTime || undefined,
        contactPhone || undefined,
        photoUri || undefined
      );

      Alert.alert('Reported Successfully', 'We\'ll notify you if your item is found!');
      
      // Reset form
      setSelectedVenue('');
      setSelectedCategory('');
      setDescription('');
      setLostTime('');
      setContactPhone('');
      setPhotoUri('');
      setShowReportModal(false);
      
      // Reload reports
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 20 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Icon name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Lost & Found</Text>
            <Text style={styles.headerSubtitle}>Report or search for items</Text>
          </View>
        </View>

        {/* Report Button */}
        <TouchableOpacity
          style={styles.reportButton}
          onPress={() => {
            handleHaptic();
            setShowReportModal(true);
          }}
        >
          <LinearGradient
            colors={[colors.accent, '#FF6B6B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.reportButtonGradient}
          >
            <Icon name="add-circle" size={24} color="#fff" />
            <Text style={styles.reportButtonText}>REPORT LOST ITEM</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* My Reports */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MY REPORTS</Text>
          {myReports.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="cube-outline" size={64} color={colors.textMuted} />
              <Text style={styles.emptyText}>No lost items reported</Text>
              <Text style={styles.emptySubtext}>Report a lost item and we'll help you find it</Text>
            </View>
          ) : (
            myReports.map((report) => (
              <View key={report.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <View style={styles.categoryBadge}>
                    <Icon 
                      name={ITEM_CATEGORIES.find(c => c.id === report.item_category)?.icon as any || 'help-circle'} 
                      size={20} 
                      color={colors.accent} 
                    />
                    <Text style={styles.categoryText}>{report.item_category}</Text>
                  </View>
                  <View style={[styles.statusBadge, report.status === 'matched' && styles.statusBadgeMatched]}>
                    <Text style={styles.statusText}>{report.status}</Text>
                  </View>
                </View>
                
                <Text style={styles.reportDescription}>{report.item_description}</Text>
                
                <View style={styles.reportMeta}>
                  <View style={styles.metaItem}>
                    <Icon name="location" size={14} color={colors.textMuted} />
                    <Text style={styles.metaText}>{report.venue_id}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Icon name="calendar" size={14} color={colors.textMuted} />
                    <Text style={styles.metaText}>{report.lost_date}</Text>
                  </View>
                </View>

                {report.photo_url && (
                  <Image source={{ uri: report.photo_url }} style={styles.reportImage} />
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Report Modal */}
      <Modal
        visible={showReportModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <LinearGradient
            colors={['#000000', '#1a1a1a']}
            style={styles.modalGradient}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Lost Item</Text>
              <TouchableOpacity onPress={() => setShowReportModal(false)} style={styles.closeButton}>
                <Icon name="close" size={28} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              {/* Venue Selection */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>WHERE DID YOU LOSE IT? *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.venueScroll}>
                  {venues.map((venue) => (
                    <TouchableOpacity
                      key={venue.id}
                      style={[styles.venueChip, selectedVenue === venue.id && styles.venueChipActive]}
                      onPress={() => {
                        setSelectedVenue(venue.id);
                        handleHaptic();
                      }}
                    >
                      <Text style={[styles.venueChipText, selectedVenue === venue.id && styles.venueChipTextActive]}>
                        {venue.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Category Selection */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>ITEM CATEGORY *</Text>
                <View style={styles.categoriesGrid}>
                  {ITEM_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.categoryChip, selectedCategory === cat.id && styles.categoryChipActive]}
                      onPress={() => {
                        setSelectedCategory(cat.id);
                        handleHaptic();
                      }}
                    >
                      <Icon 
                        name={cat.icon as any} 
                        size={24} 
                        color={selectedCategory === cat.id ? colors.accent : colors.textMuted} 
                      />
                      <Text style={[styles.categoryChipText, selectedCategory === cat.id && styles.categoryChipTextActive]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Description */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>DESCRIPTION *</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Describe the item (color, brand, distinctive features...)"
                  placeholderTextColor={colors.textMuted}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                />
              </View>

              {/* Date & Time */}
              <View style={styles.formRow}>
                <View style={[styles.formField, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>DATE LOST</Text>
                  <TextInput
                    style={styles.input}
                    value={lostDate}
                    onChangeText={setLostDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={[styles.formField, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>TIME (APPROX)</Text>
                  <TextInput
                    style={styles.input}
                    value={lostTime}
                    onChangeText={setLostTime}
                    placeholder="e.g., 11:30 PM"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              {/* Contact Phone */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>CONTACT PHONE (OPTIONAL)</Text>
                <TextInput
                  style={styles.input}
                  value={contactPhone}
                  onChangeText={setContactPhone}
                  placeholder="+61 4XX XXX XXX"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Photo Upload */}
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>PHOTO (OPTIONAL)</Text>
                <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
                  {photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Icon name="camera" size={32} color={colors.textMuted} />
                      <Text style={styles.photoText}>Add Photo</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmit}
                disabled={submitting}
              >
                <LinearGradient
                  colors={[colors.accent, '#FF6B6B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitButtonGradient}
                >
                  {submitting ? (
                    <Text style={styles.submitButtonText}>Submitting...</Text>
                  ) : (
                    <>
                      <Icon name="checkmark" size={24} color="#fff" />
                      <Text style={styles.submitButtonText}>SUBMIT REPORT</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </LinearGradient>
        </View>
      </Modal>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
  },
  reportButton: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  reportButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: spacing.sm,
  },
  reportButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  reportCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
    textTransform: 'capitalize',
  },
  statusBadge: {
    backgroundColor: colors.gold + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  statusBadgeMatched: {
    backgroundColor: colors.success + '20',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gold,
    textTransform: 'uppercase',
  },
  reportDescription: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  reportMeta: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  reportImage: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalGradient: {
    flex: 1,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formScroll: {
    flex: 1,
  },
  formField: {
    marginBottom: spacing.lg,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  venueScroll: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  venueChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  venueChipActive: {
    backgroundColor: colors.accent + '20',
    borderColor: colors.accent,
  },
  venueChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  venueChipTextActive: {
    color: colors.accent,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    width: '31%',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryChipActive: {
    backgroundColor: colors.accent + '20',
    borderColor: colors.accent,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 4,
  },
  categoryChipTextActive: {
    color: colors.accent,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
  },
  textArea: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  photoButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
    overflow: 'hidden',
    height: 200,
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  submitButton: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: spacing.sm,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
});
