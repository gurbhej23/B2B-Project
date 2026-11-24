import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { Category } from '../../../types/models';
import { colors } from '../../../theme/colors';
import { Icon } from '../../../components/common/Icon';

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  categories: Category[];
  selectedCategoryId: string | null;
  onSelectCategory: (catId: string | null) => void;
  inStockOnly: boolean;
  onToggleInStockOnly: (val: boolean) => void;
  sortIndex: number;
  onSelectSortIndex: (idx: number) => void;
  sortOptions: Array<{ label: string; sortBy: string; sortOrder: string }>;
  onApply: () => void;
  onClearAll: () => void;
}

export const FilterModal: React.FC<FilterModalProps> = ({
  visible,
  onClose,
  categories,
  selectedCategoryId,
  onSelectCategory,
  inStockOnly,
  onToggleInStockOnly,
  sortIndex,
  onSelectSortIndex,
  sortOptions,
  onApply,
  onClearAll,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetContainer}>
              {/* Header */}
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.sheetTitle}>Sort & Filter</Text>
                  <Text style={styles.sheetSubtitle}>Refine catalogue products</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Icon name="close" size={16} color={colors.textPrimary} strokeWidth={2} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
                {/* Sort Options */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>SORT BY</Text>
                  <View style={styles.sortGrid}>
                    {sortOptions.map((opt, idx) => {
                      const isSelected = sortIndex === idx;
                      return (
                        <TouchableOpacity
                          key={opt.label}
                          style={[styles.sortOption, isSelected && styles.selectedSortOption]}
                          onPress={() => onSelectSortIndex(idx)}
                        >
                          <View
                            style={[
                              styles.radioCircle,
                              isSelected && styles.selectedRadioCircle,
                            ]}
                          >
                            {isSelected && <View style={styles.radioInner} />}
                          </View>
                          <Text
                            style={[
                              styles.sortOptionText,
                              isSelected && styles.selectedSortOptionText,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Availability Filter */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>AVAILABILITY</Text>
                  <TouchableOpacity
                    style={[styles.toggleRow, inStockOnly && styles.activeToggleRow]}
                    onPress={() => onToggleInStockOnly(!inStockOnly)}
                  >
                    <View style={styles.toggleLeft}>
                      <Text style={styles.toggleTitle}>In-Stock Items Only</Text>
                      <Text style={styles.toggleSubtitle}>
                        Hide temporarily out of stock wholesale lines
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.toggleTrack,
                        inStockOnly ? styles.toggleTrackActive : styles.toggleTrackInactive,
                      ]}
                    >
                      <View
                        style={[
                          styles.toggleThumb,
                          inStockOnly ? styles.toggleThumbActive : styles.toggleThumbInactive,
                        ]}
                      />
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Category Filter */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>CATEGORY</Text>
                  <View style={styles.chipWrap}>
                    <TouchableOpacity
                      style={[
                        styles.filterChip,
                        selectedCategoryId === null && styles.activeFilterChip,
                      ]}
                      onPress={() => onSelectCategory(null)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          selectedCategoryId === null && styles.activeFilterChipText,
                        ]}
                      >
                        All Categories
                      </Text>
                    </TouchableOpacity>

                    {categories.map((cat, idx) => {
                      const catId = cat.id || (cat as any)._id;
                      const isSelected = selectedCategoryId === catId;
                      return (
                        <TouchableOpacity
                          key={catId || `cat-chip-${idx}`}
                          style={[styles.filterChip, isSelected && styles.activeFilterChip]}
                          onPress={() => onSelectCategory(catId)}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              isSelected && styles.activeFilterChipText,
                            ]}
                          >
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>

              {/* Actions Footer */}
              <View style={styles.sheetFooter}>
                <TouchableOpacity style={styles.clearBtn} onPress={onClearAll}>
                  <Text style={styles.clearBtnText}>Reset All</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.applyBtn} onPress={onApply}>
                  <Text style={styles.applyBtnText}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sortGrid: {
    gap: 8,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  selectedSortOption: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBg,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.slate400,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  selectedRadioCircle: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.primary,
  },
  sortOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  selectedSortOptionText: {
    fontWeight: '700',
    color: colors.primary,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  activeToggleRow: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.highlightBg,
  },
  toggleLeft: {
    flex: 1,
    paddingRight: 12,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  toggleSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
  },
  toggleTrackActive: {
    backgroundColor: colors.primary,
  },
  toggleTrackInactive: {
    backgroundColor: '#D1D5DB',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  toggleThumbInactive: {
    alignSelf: 'flex-start',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  activeFilterChip: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  activeFilterChipText: {
    color: colors.white,
    fontWeight: '700',
  },
  sheetFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  clearBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  applyBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
});

