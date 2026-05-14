import { useState } from 'react'
import * as ImagePicker from 'expo-image-picker'

export function useCamera() {
  const [loading, setLoading] = useState(false)

  const takePicture = async (): Promise<string | null> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') return null
    setLoading(true)
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        quality: 0.8,
        allowsEditing: false,
      })
      if (result.canceled) return null
      return result.assets[0].uri
    } finally {
      setLoading(false)
    }
  }

  const pickFromGallery = async (): Promise<string | null> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return null
    setLoading(true)
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.8,
        allowsEditing: false,
      })
      if (result.canceled) return null
      return result.assets[0].uri
    } finally {
      setLoading(false)
    }
  }

  return { takePicture, pickFromGallery, loading }
}
