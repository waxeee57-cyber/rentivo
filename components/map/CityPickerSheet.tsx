import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  TextInput, Modal, Animated,
} from 'react-native'
import { Colors, Spacing, Radius } from '@/constants/colors'

export interface City {
  name: string
  country: string
  emoji: string
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
  { name: 'Near me', country: '', emoji: '📍', lat: null, lng: null },
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
          placeholderTextColor={Colors.textTertiary}
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
              <Text style={styles.cityEmoji}>{item.emoji}</Text>
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.base,
    paddingTop: Spacing.md,
    maxHeight: '75%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: Radius.pill,
    alignSelf: 'center',
    marginBottom: Spacing.base,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.base,
  },
  searchInput: {
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    fontSize: 15,
    color: Colors.text,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
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
    backgroundColor: Colors.primarySurface,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  cityEmoji: { fontSize: 24, marginRight: Spacing.md },
  cityInfo: { flex: 1 },
  cityName: { fontSize: 16, fontWeight: '600', color: Colors.text },
  cityNameActive: { color: Colors.primaryDark },
  cityCountry: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
  chevron: { fontSize: 20, color: Colors.textTertiary },
})
