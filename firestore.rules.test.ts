/**
 * Phase 0 Payload-First Security TDD Spec for Firestore Rules
 * Verifies Dirty Dozen payloads against Sialkot Export Hub security invariants.
 */

export const DIRTY_DOZEN_PAYLOADS = [
  { name: 'Unauthenticated Lead Create', collection: 'leads', auth: null },
  { name: 'Unverified Email Create', collection: 'leads', emailVerified: false },
  { name: 'UID Spoofing on Exporter', collection: 'exporters', targetUid: 'otherUser', authUid: 'attacker' },
  { name: 'Owner Spoofing on Lead', collection: 'leads', payload: { ownerId: 'victimUid' }, authUid: 'attacker' },
  { name: 'Shadow Field Injection', collection: 'leads', payload: { isAdmin: true } },
  { name: 'Oversized ID Poisoning', collection: 'leads', docId: 'a'.repeat(200) },
  { name: 'Unbounded Array Poisoning', collection: 'exporters', payload: { specialties: Array(15).fill('x') } },
  { name: 'Type Poisoning on Update', collection: 'leads', payload: { status: 12345 } },
  { name: 'Immutable Owner Mutation', collection: 'leads', payload: { ownerId: 'newOwner' } },
  { name: 'Terminal State Tampering', collection: 'leads', existingStatus: 'won', payload: { status: 'new' } },
  { name: 'Backdated Timestamp Injection', collection: 'leads', payload: { createdAt: '2020-01-01T00:00:00Z' } },
  { name: 'Blanket Collection Scrape', collection: 'exporters', op: 'list', authUid: 'regularUser' },
];
