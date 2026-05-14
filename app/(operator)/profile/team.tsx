import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Colors, Spacing, Radius } from '@/constants/colors'
import { Button } from '@/components/ui/Button'
import { useToastStore } from '@/lib/store/useToastStore'
import { Card } from '@/components/ui/Card'

type TeamRole = 'owner' | 'manager' | 'staff'

interface TeamMember {
  id: string
  name: string
  email: string
  role: TeamRole
  phone?: string
}

const ROLE_LABELS: Record<TeamRole, string> = {
  owner: 'Owner — full access',
  manager: 'Manager — bookings + chat',
  staff: 'Staff — pickup/return only',
}

const ROLE_COLORS: Record<TeamRole, string> = {
  owner: Colors.primary,
  manager: Colors.info,
  staff: Colors.textSecondary,
}

const MOCK_TEAM: TeamMember[] = [
  { id: 't-001', name: 'Roland Costa', email: 'roland@costasol.com', role: 'owner', phone: '+34600000000' },
  { id: 't-002', name: 'Maria Sanchez', email: 'maria@costasol.com', role: 'manager' },
  { id: 't-003', name: 'Pedro Garcia', email: 'pedro@costasol.com', role: 'staff' },
]

export default function TeamScreen() {
  const [members, setMembers] = useState<TeamMember[]>(MOCK_TEAM)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<TeamRole>('staff')
  const { showToast } = useToastStore()

  const handleInvite = () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      showToast({ message: 'Enter a valid email address', type: 'error' })
      return
    }
    const newMember: TeamMember = {
      id: `t-${Date.now()}`,
      name: inviteEmail.split('@')[0],
      email: inviteEmail.trim(),
      role: inviteRole,
    }
    setMembers(prev => [...prev, newMember])
    setInviteEmail('')
    showToast({ message: `Invite sent to ${newMember.email}`, type: 'success' })
  }

  const handleRemove = (id: string) => {
    setMembers(prev => prev.filter(m => m.id !== id))
    showToast({ message: 'Team member removed', type: 'success' })
  }

  const ROLES: TeamRole[] = ['owner', 'manager', 'staff']

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="👥 Team" />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Team members</Text>

        {members.map(m => (
          <Card key={m.id} style={styles.memberCard}>
            <View style={styles.memberRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {m.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{m.name}</Text>
                <Text style={styles.memberEmail}>{m.email}</Text>
                <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[m.role] + '20' }]}>
                  <Text style={[styles.roleText, { color: ROLE_COLORS[m.role] }]}>
                    {ROLE_LABELS[m.role]}
                  </Text>
                </View>
              </View>
              {m.role !== 'owner' && (
                <TouchableOpacity
                  onPress={() => handleRemove(m.id)}
                  style={styles.removeBtn}
                  accessibilityLabel={`Remove ${m.name}`}
                  accessibilityRole="button"
                >
                  <Text style={styles.removeText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>Invite team member</Text>

        <Card style={styles.inviteCard}>
          <TextInput
            style={styles.emailInput}
            placeholder="Email address"
            placeholderTextColor={Colors.textTertiary}
            value={inviteEmail}
            onChangeText={setInviteEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            accessibilityLabel="Team member email"
          />

          <Text style={styles.roleLabel}>Role</Text>
          <View style={styles.roleRow}>
            {ROLES.map(role => (
              <TouchableOpacity
                key={role}
                style={[styles.rolePill, inviteRole === role && styles.rolePillActive]}
                onPress={() => setInviteRole(role)}
                accessibilityLabel={role}
                accessibilityRole="radio"
                accessibilityState={{ selected: inviteRole === role }}
              >
                <Text style={[styles.rolePillText, inviteRole === role && styles.rolePillTextActive]}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.roleDescription}>{ROLE_LABELS[inviteRole]}</Text>

          <Button
            title="Send invite"
            onPress={handleInvite}
            fullWidth
            style={{ marginTop: Spacing.base }}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: Colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md,
  },
  memberCard: { marginBottom: Spacing.sm },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.primaryLight,
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: Colors.primaryDark },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  memberEmail: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  roleBadge: {
    alignSelf: 'flex-start', borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm, paddingVertical: 2, marginTop: 4,
  },
  roleText: { fontSize: 11, fontWeight: '700' },
  removeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.errorSurface, alignItems: 'center', justifyContent: 'center',
  },
  removeText: { fontSize: 12, color: Colors.error, fontWeight: '700' },
  inviteCard: {},
  emailInput: {
    backgroundColor: Colors.surfaceWarm, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    fontSize: 14, color: Colors.text, marginBottom: Spacing.md,
  },
  roleLabel: { fontSize: 12, fontWeight: '700', color: Colors.textTertiary, marginBottom: Spacing.sm },
  roleRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  rolePill: {
    flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
    backgroundColor: Colors.surfaceWarm,
  },
  rolePillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  rolePillText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  rolePillTextActive: { color: Colors.textInverse },
  roleDescription: { fontSize: 12, color: Colors.textTertiary, marginBottom: Spacing.sm },
})
