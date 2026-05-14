import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Spacing } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useListing } from '@/lib/hooks/useListing'
import { updateListing } from '@/lib/api/listings'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { Config } from '@/constants/config'

export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { listing, loading, error } = useListing(id ?? '')
  const [title, setTitle] = useState(listing?.title ?? '')
  const [description, setDescription] = useState(listing?.description ?? '')
  const [saving, setSaving] = useState(false)

  if (loading) return <SafeAreaView style={styles.container}><SkeletonCard /></SafeAreaView>
  if (error || !listing) return <ErrorState message={error ?? 'Not found'} />

  const handleSave = async () => {
    setSaving(true)
    try {
      if (Config.useMock) {
        await new Promise(r => setTimeout(r, 500))
        Alert.alert('Saved (mock)', '', [{ text: 'OK', onPress: () => router.back() }])
        return
      }
      await updateListing(listing.id, { title: title || listing.title, description })
      Alert.alert('Saved', '', [{ text: 'OK', onPress: () => router.back() }])
    } catch (e) {
      Alert.alert('Error', String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Edit Listing</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Input label="Title" value={title || listing.title} onChangeText={setTitle} />
        <Input label="Description" value={description || listing.description || ''} onChangeText={setDescription} multiline numberOfLines={4} />
        <Button title="Save changes" onPress={handleSave} loading={saving} fullWidth />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
  },
  back: { fontSize: 16, color: Colors.primary, fontWeight: '600', width: 50 },
  header: { fontSize: 18, fontWeight: '700', color: Colors.text },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
})
