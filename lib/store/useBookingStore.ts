import { create } from 'zustand'
import type { Booking, SearchFilters } from '@/types'

interface BookingStore {
  currentBooking: Partial<Booking> | null
  filters: SearchFilters
  selectedStartDate: Date | null
  selectedEndDate: Date | null
  setCurrentBooking: (booking: Partial<Booking> | null) => void
  setFilters: (filters: SearchFilters) => void
  setDateRange: (start: Date | null, end: Date | null) => void
  clearBooking: () => void
}

export const useBookingStore = create<BookingStore>((set) => ({
  currentBooking: null,
  filters: {},
  selectedStartDate: null,
  selectedEndDate: null,
  setCurrentBooking: (booking) => set({ currentBooking: booking }),
  setFilters: (filters) => set({ filters }),
  setDateRange: (start, end) => set({ selectedStartDate: start, selectedEndDate: end }),
  clearBooking: () => set({ currentBooking: null, selectedStartDate: null, selectedEndDate: null }),
}))
