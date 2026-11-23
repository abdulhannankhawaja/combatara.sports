# Security Specification — Sialkot 3D AI Export Hub

## 1. Data Invariants
1. **Identity Isolation**: Every `exporters/{uid}` document is strictly readable and writable only by the matching verified Firebase user (`request.auth.uid == uid`) or the bootstrapped admin (`khsamar218@gmail.com` with `email_verified == true`).
2. **Lead Ownership**: Every `leads/{leadId}` document MUST store `ownerId == request.auth.uid` on creation; `ownerId` and `createdAt` are immutable across updates.
3. **Campaign Ownership**: Every `campaigns/{campaignId}` document MUST store `ownerId == request.auth.uid` on creation and is append-only/deletable by owner.
4. **No Shadow Fields**: All `create` operations enforce `keys().hasAll(...) && keys().hasOnly(...)` and all `update` operations enforce `affectedKeys().hasOnly(...)` alongside full entity validation.
5. **Terminal State Protection**: Once a lead reaches `won` or `archived`, non-admin updates are blocked to preserve deal audit integrity.
6. **Temporal Integrity**: `createdAt` and `updatedAt` MUST equal `request.time`.
7. **PII & Query Isolation**: `allow list` on `/leads` and `/campaigns` strictly requires `resource.data.ownerId == request.auth.uid || isAdmin()`, preventing cross-tenant scraping. `/exporters` forbids `list` for non-admins.

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Lead Create**: `request.auth == null` writing `/leads/lead1`.
2. **Unverified Email Create**: `request.auth.token.email_verified == false` writing `/leads/lead1`.
3. **UID Spoofing on Exporter**: User `uidA` creating `/exporters/uidB` or setting `uid: "uidB"`.
4. **Owner Spoofing on Lead**: User `uidA` creating `/leads/lead1` with `ownerId: "uidB"`.
5. **Shadow Field Injection**: Creating `/leads/lead1` with extra `isAdmin: true` or `verified: true`.
6. **Oversized ID Poisoning**: Creating `/leads/${'a'.repeat(200)}`.
7. **Unbounded Array Poisoning**: Creating `/exporters/uidA` with `specialties` length > 10.
8. **Type Poisoning on Update**: Updating `/leads/lead1` with `status: 12345` or `companyName: ""`.
9. **Immutable Owner Mutation**: Updating `/leads/lead1` to change `ownerId`.
10. **Terminal State Tampering**: Non-admin updating a lead after `status == 'won'`.
11. **Backdated Timestamp Injection**: Creating `/leads/lead1` with client-forged `createdAt` != `request.time`.
12. **Blanket Collection Scrape**: User `uidA` executing `list` on `/exporters` or querying `/leads` without `ownerId == uidA`.
