# 🎮 Event Integration Guide — Headless Promotion Engine

This guide is for developers building **custom event frontends** (bespoke mini-games, landing pages, etc.) that connect to the shared Promotion Engine.

---

## Architecture

```
┌──────────────────────┐      ┌─────────────────────────────┐
│  Custom Event App    │      │  ERP (Admin Dashboard)      │
│  (Bespoke UI/Game)   │      │  Manages events, campaigns, │
│                      │      │  prize pools, daily limits   │
│  calls:              │      └─────────────────────────────┘
│  - fetchEventConfig  │                    │
│  - getParticipation  │                    │
│  - executeGacha      │                    ▼
│                      │      ┌─────────────────────────────┐
└──────────┬───────────┘      │  Firebase (Shared Project)  │
           │                  │  - events                   │
           └─────────────────►│  - voucher_campaigns        │
                              │  - voucher_codes            │
                              │  - event_participations     │
                              │  - audit_logs               │
                              └─────────────────────────────┘
```

---

## Setup

### 1. Environment Variable

Add to your `.env.local`:

```env
NEXT_PUBLIC_EVENT_ID=your_event_id_here
```

The `eventId` is created by admins in the ERP's Event Management page.

### 2. Firebase Admin

Your app must share the same Firebase project credentials:

```env
FIREBASE_ADMIN_PROJECT_ID=xxx
FIREBASE_ADMIN_CLIENT_EMAIL=xxx
FIREBASE_ADMIN_PRIVATE_KEY=xxx
```

---

## API Reference

### `fetchEventConfig(eventId)`

**Location:** `lib/event-engine.ts`  
**Type:** Server-side only

Returns sanitized event info. **Does NOT leak stock numbers.**

```typescript
import { fetchEventConfig } from '@/lib/event-engine';

const config = await fetchEventConfig('EVENT_ID');
// Returns:
// {
//   id: string;
//   name: string;
//   startDate: string;
//   endDate: string;
//   status: string;
//   prizes: [{ campaignName: string, rewardType: string }]
// }
```

**Error codes:** `EVENT_NOT_FOUND`, `EVENT_NOT_ACTIVE`, `EVENT_NOT_STARTED`, `EVENT_EXPIRED`

---

### `getParticipation(eventId, phone)`

**Location:** `lib/event-engine.ts`  
**Type:** Server-side only

Returns the player's spin data.

```typescript
import { getParticipation } from '@/lib/event-engine';

const info = await getParticipation('EVENT_ID', '0912345678');
// Returns:
// {
//   totalSpins: 3,
//   usedSpins: 1,
//   spinsRemaining: 2,
//   prizesWon: 0
// }
```

---

### `executeGacha(eventId, customerData)`

**Location:** `actions/universal_gacha.ts`  
**Type:** Server Action (`'use server'`)

The core engine. Call this when the player finishes their mini-game interaction.

```typescript
import { executeGacha } from '@/actions/universal_gacha';

const result = await executeGacha('EVENT_ID', {
    phone: '0912345678',
    name: 'Nguyen Van A',
    dob: '1995-10-25',      // Ngày sinh YYYY-MM-DD (bắt buộc)
    email: 'a@email.com',   // Email (tùy chọn)
});
```

**Response type (`GachaResult`):**

```typescript
{
    success: boolean;
    status: 'WON_VOUCHER' | 'LUCK_NEXT_TIME' | 'NO_SPINS_LEFT' | 'ERROR';
    spinsRemaining?: number;
    prizeData?: {
        campaignId: string;
        campaignName: string;
        rewardType: string;
        rewardValue: number;
        voucherCode: string;   // The physical code to show the user
    };
    message?: string;
}
```

---

## Example: Minimal Event Component

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { executeGacha } from '@/actions/universal_gacha';
import type { GachaResult } from '@/types';

const EVENT_ID = process.env.NEXT_PUBLIC_EVENT_ID!;

export default function MyCustomEvent() {
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [registered, setRegistered] = useState(false);
    const [spinning, setSpinning] = useState(false);
    const [result, setResult] = useState<GachaResult | null>(null);

    const handlePlay = useCallback(async () => {
        setSpinning(true);
        setResult(null);

        // ── Your custom animation plays here ──
        // await playMyCustomAnimation();

        // ── Call the universal gacha engine ──
        const gachaResult = await executeGacha(EVENT_ID, { phone, name });
        setResult(gachaResult);
        setSpinning(false);
    }, [phone, name]);

    // ── Registration form ──
    if (!registered) {
        return (
            <form onSubmit={(e) => { e.preventDefault(); setRegistered(true); }}>
                <input
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />
                <input
                    placeholder="Phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                />
                <button type="submit">Start Playing</button>
            </form>
        );
    }

    // ── Game UI ──
    return (
        <div>
            <button onClick={handlePlay} disabled={spinning}>
                {spinning ? 'Spinning...' : '🎁 Open Gift Box'}
            </button>

            {result && (
                <div>
                    {result.status === 'WON_VOUCHER' && result.prizeData && (
                        <div>
                            <h2>🎉 You won: {result.prizeData.campaignName}!</h2>
                            <p>Your code: <strong>{result.prizeData.voucherCode}</strong></p>
                            <p>Show this to staff to redeem.</p>
                        </div>
                    )}

                    {result.status === 'LUCK_NEXT_TIME' && (
                        <p>😢 Better luck next time!</p>
                    )}

                    {result.status === 'NO_SPINS_LEFT' && (
                        <p>You&apos;ve used all your spins. Thanks for playing!</p>
                    )}

                    {result.status === 'ERROR' && (
                        <p>⚠️ {result.message}</p>
                    )}

                    {result.spinsRemaining !== undefined && result.spinsRemaining > 0 && (
                        <p>Spins remaining: {result.spinsRemaining}</p>
                    )}
                </div>
            )}
        </div>
    );
}
```

---

## Security Notes

- ❌ **Never trust the client** — all prize logic runs server-side inside a Firestore transaction
- ❌ **No stock data on client** — `fetchEventConfig()` only returns prize names, never counts
- ✅ **Spin enforcement** — `event_participations` tracks spins atomically
- ✅ **Daily limits** — enforced per campaign inside the transaction
- ✅ **Audit trail** — every issuance is logged to `audit_logs`
