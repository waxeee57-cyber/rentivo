import { create } from 'zustand'

interface LocationStore {
  latitude: number | null
  longitude: number | null
  city: string
  setLocation: (lat: number, lng: number) => void
  setCity: (city: string) => void
}

export const useLocationStore = create<LocationStore>((set) => ({
  latitude: null,
  longitude: null,
  city: 'Marbella',
  setLocation: (latitude, longitude) => set({ latitude, longitude }),
  setCity: (city) => set({ city }),
}))
