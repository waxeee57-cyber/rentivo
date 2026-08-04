import { useState } from 'react'
import { Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Config } from '@/constants/config'

const MOCK_PHOTO_URI = 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=400'

export function useCamera() {
  const [loading, setLoading] = useState(false)

  const takePicture = async (): Promise<string | null> => {
    if (Config.useMock) {
      setLoading(true)
      await new Promise(r => setTimeout(r, 400))
      setLoading(false)
      return MOCK_PHOTO_URI
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed to take photos.')
      return null
    }
    setLoading(true)
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      })
      // `!canceled` does not guarantee a non-empty assets array — reading [0].uri
      // blind crashed the damage-photo capture with a TypeError.
      if (result.canceled) return null
      return result.assets?.[0]?.uri ?? null
    } finally {
      setLoading(false)
    }
  }

  const pickFromGallery = async (): Promise<string | null> => {
    if (Config.useMock) {
      setLoading(true)
      await new Promise(r => setTimeout(r, 400))
      setLoading(false)
      return MOCK_PHOTO_URI
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Photo library access is needed.')
      return null
    }
    setLoading(true)
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      })
      // Same bounds guard as takePicture — assets can be empty on some pickers.
      if (result.canceled) return null
      return result.assets?.[0]?.uri ?? null
    } finally {
      setLoading(false)
    }
  }

  const showPhotoOptions = (): Promise<string | null> => {
    return new Promise(resolve => {
      Alert.alert('Add photo', 'Choose a source', [
        { text: 'Camera', onPress: async () => resolve(await takePicture()) },
        { text: 'Gallery', onPress: async () => resolve(await pickFromGallery()) },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ])
    })
  }

  return { takePicture, pickFromGallery, showPhotoOptions, loading }
}
