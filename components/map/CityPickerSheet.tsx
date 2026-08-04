import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  TextInput, Modal, Animated,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Spacing, Radius, Fonts } from '@/constants/colors'
import { useColors } from '@/lib/hooks/useColors'

export interface City {
  name: string
  country: string
  /** Country flag. Empty for non-country entries, which use `icon` instead. */
  emoji: string
  icon?: React.ComponentProps<typeof Ionicons>['name']
  lat: number | null
  lng: number | null
}

export const CITIES: City[] = [
  { name: 'Marbella', country: 'ES', emoji: '🇪🇸', lat: 36.5101, lng: -4.8824 },
  { name: 'Ibiza', country: 'ES', emoji: '🇪🇸', lat: 38.9067, lng: 1.4206 },
  { name: 'Mallorca', country: 'ES', emoji: '🇪🇸', lat: 39.6953, lng: 3.0176 },
  { name: 'Barcelona', country: 'ES', emoji: '🇪🇸', lat: 41.3851, lng: 2.1734 },
  { name: 'Budapest', country: 'HU', emoji: '🇭🇺', lat: 47.4979, lng: 19.0402 },
  { name: 'Balaton', country: 'HU', emoji: '🇭🇺', lat: 46.8349, lng: 17.7219 },
  { name: 'Győr', country: 'HU', emoji: '🇭🇺', lat: 47.6875, lng: 17.6504 },
  { name: 'Near me', country: '', emoji: '', icon: 'locate-outline', lat: null, lng: null },
]

interface CityPickerSheetProps {
  visible: boolean
  selectedCity: string
  onSelect: (city: City) => void
  onClose: () => void
}

// Fixed row height: paddingVertical Spacing.md (16) * 2 + text lineHeight ~24 + marginBottom 2 ≈ 58
const CITY_ROW_HEIGHT = 58

export function CityPickerSheet({ visible, selectedCity, onSelect, onClose }: CityPickerSheetProps) {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const [search, setSearch] = useState('')
  const slideAnim = useRef(new Animated.Value(500)).current

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 15,
        stiffness: 200,
        useNativeDriver: true,
      }).start()
    } else {
      Animated.timing(slideAnim, {
        toValue: 500,
        duration: 200,
        useNativeDriver: true,
      }).start()
    }
  }, [visible, slideAnim])

  const filtered = CITIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const getCityItemLayout = useCallback((_data: ArrayLike<City> | null | undefined, index: number) => ({
    length: CITY_ROW_HEIGHT,
    offset: CITY_ROW_HEIGHT * index,
    index,
  }), [])

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Where do you want to go?</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search destinations..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={C.textTertiary}
        />
        <FlatList
          data={filtered}
          keyExtractor={c => c.name}
          showsVerticalScrollIndicator={false}
          windowSize={10}
          maxToRenderPerBatch={10}
          getItemLayout={getCityItemLayout}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.cityRow, selectedCity === item.name && styles.cityRowActive]}
              onPress={() => { onSelect(item); setSearch(''); onClose() }}
              activeOpacity={0.7}
            >
              {item.icon
                ? (
                  <Ionicons
                    name={item.icon}
                    size={22}
                    color={C.textSecondary}
                    style={styles.cityIcon}
                    importantForAccessibility="no"
                  />
                )
                : <Text style={styles.cityEmoji}>{item.emoji}</Text>}
              <View style={styles.cityInfo}>
                <Text style={[styles.cityName, selectedCity === item.name && styles.cityNameActive]}>
                  {item.name}
                </Text>
                {item.country ? <Text style={styles.cityCountry}>{item.country}</Text> : null}
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
        />
      </Animated.View>
    </Modal>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.base,
    paddingTop: Spacing.md,
    maxHeight: '75%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: C.border,
    borderRadius: Radius.pill,
    alignSelf: 'center',
    marginBottom: Spacing.base,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: C.text,
    marginBottom: Spacing.base,
  },
  searchInput: {
    backgroundColor: C.surfaceWarm,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    fontFamily: Fonts.regular, fontSize: 15,
    color: C.text,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: C.border,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
    marginBottom: 2,
  },
  cityRowActive: {
    backgroundColor: C.primarySurface,
    borderLeftWidth: 3,
    borderLeftColor: C.primary,
  },
  cityEmoji: { fontFamily: Fonts.regular, fontSize: 24, marginRight: Spacing.md },
  cityIcon: { width: 24, textAlign: 'center', marginRight: Spacing.md },
  cityInfo: { flex: 1 },
  cityName: { fontSize: 16, fontFamily: Fonts.semibold, color: C.text },
  cityNameActive: { color: C.primaryDark },
  cityCountry: { fontFamily: Fonts.regular, fontSize: 12, color: C.textTertiary, marginTop: 1 },
  chevron: { fontFamily: Fonts.regular, fontSize: 20, color: C.textTertiary },
  })
}
