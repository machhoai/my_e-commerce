'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Mobile Dashboard Header — Language Switcher
// Thin client component to add the language toggle to the Server Component page.
// ─────────────────────────────────────────────────────────────────────────────

import MobileLanguageSwitcher from '@/components/mobile/MobileLanguageSwitcher';

export default function MobileDashboardHeader() {
    return (
        <div className="flex justify-end px-4 pt-3 pb-1">
            <MobileLanguageSwitcher />
        </div>
    );
}
