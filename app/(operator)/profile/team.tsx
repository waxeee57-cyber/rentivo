import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Spacing, Radius } from '@/constants/colors'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToastStore } from '@/lib/store/useToastStore'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { Config } from '@/constants/config'
import { supabase } from '@/lib/supabase'
import type { OperatorStaffMember } from '@/types'
import { useColors } from '@/lib/hooks/useColors'

type StaffRole = 'admin' | 'staff' | 'viewer'

const ROLES: { key: StaffRole; label: string; desc: string }[] = [
  { key: 'admin', label: 'Admin', desc: 'Full access' },
  { key: 'staff', label: 'Staff', desc: 'Manage bookings' },
  { key: 'viewer', label: 'Viewer', desc: 'Read only' },
]

const MOCK_STAFF: OperatorStaffMember[] = [
  {
    id: 's-001',
    operator_id: 'op-001',
    user_id: null,
    email: 'maria@example.com',
    role: 'admin',
    status: 'active',
    invited_at: '2026-01-15T00:00:00Z',
    joined_at: '2026-01-16T00:00:00Z',
  },
  {
    id: 's-002',
    operator_id: 'op-001',
    user_id: null,
    email: 'carlos@example.com',
    role: 'staff',
    status: 'invited',
    invited_at: '2026-05-01T00:00:00Z',
    joined_at: null,
  },
]

export default function TeamScreen() {
  const C = useColors()
  const styles = useMemo(() => makeStyles(C), [C])
  const roleColor: Record<StaffRole, string> = {
    admin: C.primary,
    staff: C.success,
    viewer: C.textSecondary,
  }
  const { operator } = useAuthStore()
  const { showToast } = useToastStore()
  const operatorId = Config.useMock ? 'op-001' : (operator?.id ?? '')

  const [staff, setStaff] = useState<OperatorStaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<StaffRole>('staff')
  const [inviting, setInviting] = useState(false)

  const loadStaff = useCallback(async () => {
    if (Config.useMock) {
      setStaff(MOCK_STAFF)
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('rentivo_operator_staff')
      .select('*')
      .eq('operator_id', operatorId)
      .order('invited_at', { ascending: false })
    setStaff((data as OperatorStaffMember[]) ?? [])
    setLoading(false)
  }, [operatorId])

  useEffect(() => { void loadStaff() }, [loadStaff])

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      showToast({ message: 'Enter a valid email address', type: 'error' })
      return
    }
    setInviting(true)
    if (!Config.useMock) {
      const { error } = await supabase
        .from('rentivo_operator_staff')
        .insert({
          operator_id: operatorId,
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          status: 'invited',
        })
      if (error) {
        showToast({ message: 'Failed to send invite', type: 'error' })
        setInviting(false)
        return
      }
    }
    showToast({ message: `Invite sent to ${inviteEmail.trim()}`, type: 'success' })
    setInviteEmail('')
    void loadStaff()
    setInviting(false)
  }

  const handleRemove = async (memberId: string) => {
    if (!Config.useMock) {
      await supabase.from('rentivo_operator_staff').delete().eq('id', memberId)
    }
    setStaff(prev => prev.filter(s => s.id !== memberId))
    showToast({ message: 'Member removed', type: 'success' })
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="Team Members" />
      <ScrollView contentContainerStyle={styles.content}>

        <Card style={styles.inviteCard}>
          <Text style={styles.sectionTitle}>Invite Member</Text>
          <TextInput
            style={styles.emailInput}
            value={inviteEmail}
            onChangeText={setInviteEmail}
            placeholder="email@example.com"
            placeholderTextColor={C.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            accessibilityLabel="Email address to invite"
          />
          <View style={styles.roleRow}>
            {ROLES.map(r => (
              <TouchableOpacity
                key={r.key}
                style={[styles.roleChip, inviteRole === r.key && styles.roleChipActive]}
                onPress={() => setInviteRole(r.key)}
                accessibilityLabel={`Select role ${r.label}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: inviteRole === r.key }}
              >
                <Text style={[styles.roleText, inviteRole === r.key && styles.roleTextActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.roleDesc}>
            {ROLES.find(r => r.key === inviteRole)?.desc}
          </Text>
          <Button
            title={inviting ? 'Sending...' : 'Send Invite'}
            onPress={handleInvite}
            loading={inviting}
            fullWidth
            style={{ marginTop: Spacing.md }}
          />
        </Card>

        {loading ? (
          <ActivityIndicator color={C.primary} style={{ marginTop: 20 }} />
        ) : (
          <>
            <Text style={styles.listTitle}>Team ({staff.length})</Text>
            {staff.map(member => (
              <Card key={member.id} style={styles.memberCard}>
                <View style={styles.memberRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {member.email.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberEmail}>{member.email}</Text>
                    <View style={styles.badgeRow}>
                      <View style={[styles.roleBadge, { borderColor: roleColor[member.role] }]}>
                        <Text style={[styles.roleBadgeText, { color: roleColor[member.role] }]}>
                          {member.role}
                        </Text>
                      </View>
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: member.status === 'active' ? C.successSurface : C.surface },
                      ]}>
                        <Text style={[
                          styles.statusText,
                          { color: member.status === 'active' ? C.success : C.textSecondary },
                        ]}>
                          {member.status === 'active' ? '● Active' : '○ Invited'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => handleRemove(member.id)}
                    accessibilityLabel={`Remove ${member.email}`}
                    accessibilityRole="button"
                  >
                    <Text style={styles.removeText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))}
            {staff.length === 0 && (
              <Text style={styles.emptyText}>No team members yet. Invite someone above.</Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { padding: Spacing.base, paddingBottom: 100 },
  inviteCard: { padding: Spacing.base, marginBottom: Spacing.lg },
  sectionTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  emailInput: {
    backgroundColor: C.surfaceWarm,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.md,
    color: C.text,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    fontSize: 14,
    minHeight: 44,
    marginBottom: Spacing.md,
  },
  roleRow: { flexDirection: 'row', gap: Spacing.sm },
  roleChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: C.surfaceWarm,
  },
  roleChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  roleText: { color: C.textSecondary, fontSize: 13, fontWeight: '600' },
  roleTextActive: { color: C.textInverse },
  roleDesc: {
    color: C.textTertiary,
    fontSize: 12,
    marginTop: Spacing.sm,
  },
  listTitle: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  memberCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.primaryLight,
  },
  avatarText: { color: C.primaryDark, fontWeight: '700', fontSize: 18 },
  memberInfo: { flex: 1 },
  memberEmail: { color: C.text, fontSize: 14, fontWeight: '500', marginBottom: 4 },
  badgeRow: { flexDirection: 'row', gap: Spacing.sm },
  roleBadge: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '700' },
  statusBadge: { borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: '600' },
  removeBtn: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: { color: C.error, fontSize: 16, fontWeight: '700' },
  emptyText: {
    color: C.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xl,
    fontSize: 14,
  },
  })
}
