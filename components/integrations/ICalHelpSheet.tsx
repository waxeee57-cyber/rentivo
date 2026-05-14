import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Sheet } from '@/components/ui/Sheet'

export const ICAL_INSTRUCTIONS: Record<string, { steps: string[]; url: string }> = {
  airbnb: {
    steps: [
      '1. Menj az Airbnb › Naptár oldalra',
      '2. Kattints a "Rendelkezésre állás" gombra',
      '3. Görgess le a "Szinkronizálás vagy exportálás" részhez',
      '4. Kattints az "Exportálás" gombra',
      '5. Másold ki a megjelenő linket',
    ],
    url: 'https://www.airbnb.com/hosting/calendars',
  },
  booking: {
    steps: [
      '1. Menj a Booking.com Extranet-re',
      '2. Kattints a "Naptár" menüre',
      '3. Válaszd az "iCal szinkronizálás" lehetőséget',
      '4. Másold ki az exportálási linket',
    ],
    url: 'https://admin.booking.com',
  },
  vrbo: {
    steps: [
      '1. Menj a VRBO tulajdonosi oldalra',
      '2. Válaszd a "Naptár" menüt',
      '3. Kattints az "Importálás/Exportálás" gombra',
      '4. Másold ki az iCal exportálási linket',
    ],
    url: 'https://www.vrbo.com/owner',
  },
  turo: {
    steps: [
      '1. Menj a Turo tulajdonosi oldalra',
      '2. Válaszd az "Autók" menüt',
      '3. Nyisd meg az autó beállításait',
      '4. Keresd a "Naptár exportálás" opciót',
    ],
    url: 'https://turo.com/owners',
  },
  holidu: {
    steps: [
      '1. Menj a Holidu tulajdonosi oldalra',
      '2. Válaszd az "Ingatlanok" menüt',
      '3. Kattints a "Naptár exportálás" opcióra',
      '4. Másold ki a megjelenő iCal linket',
    ],
    url: 'https://www.holidu.com',
  },
  other: {
    steps: [
      '1. Menj a platform beállításaiba',
      '2. Keresd a "Naptár" vagy "Calendar" opciót',
      '3. Keresd az "iCal exportálás" vagy "Calendar export" funkciót',
      '4. Másold ki a generált linket',
    ],
    url: '',
  },
}

const PLATFORM_LABELS: Record<string, string> = {
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  vrbo: 'VRBO',
  turo: 'Turo',
  holidu: 'Holidu',
  other: 'Egyéb platform',
}

interface ICalHelpSheetProps {
  visible: boolean
  platform: string
  onClose: () => void
}

export function ICalHelpSheet({ visible, platform, onClose }: ICalHelpSheetProps) {
  const instructions = ICAL_INSTRUCTIONS[platform] ?? ICAL_INSTRUCTIONS.other
  const label = PLATFORM_LABELS[platform] ?? platform

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.container}>
        <Text style={styles.title}>iCal URL megkeresése</Text>
        <Text style={styles.subtitle}>{label} platformon</Text>

        <View style={styles.stepsCard}>
          {instructions.steps.map((step, index) => (
            <View key={index} style={styles.stepRow}>
              <View style={styles.stepDot} />
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Az iCal URL egy webcím (https://...) amely automatikusan frissülő naptáradatot tartalmaz.
            Ez egy nyílt szabvány — teljesen legális és biztonságos.
          </Text>
        </View>

        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Bezárás</Text>
        </TouchableOpacity>
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.xxl },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  stepsCard: {
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: Spacing.md,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 5,
    flexShrink: 0,
  },
  stepText: { flex: 1, fontSize: 14, color: Colors.text, lineHeight: 20 },
  infoBox: {
    backgroundColor: Colors.infoSurface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.info,
    marginBottom: Spacing.xl,
  },
  infoText: { fontSize: 13, color: Colors.info, lineHeight: 18 },
  closeBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.base,
    alignItems: 'center',
  },
  closeBtnText: { fontSize: 16, fontWeight: '700', color: Colors.textInverse },
})
