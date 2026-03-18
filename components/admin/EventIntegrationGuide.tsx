'use client';

import { useState } from 'react';
import {
    Copy, Check, Code2, UserPlus, BarChart3,
    Gamepad2, Settings2, Terminal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Props ──────────────────────────────────────────────────────
interface EventIntegrationGuideProps {
    eventId: string;
    eventName?: string;
}

// ─── Copy button helper ─────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className={cn(
                'absolute top-3 right-3 p-1.5 rounded-lg text-xs font-medium transition-all',
                copied
                    ? 'bg-success-500 text-white'
                    : 'bg-white/10 hover:bg-white/20 text-white/70 hover:text-white'
            )}
            title="Copy to clipboard"
        >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
    );
}

// ─── Code block component ───────────────────────────────────────
function CodeBlock({ code, language = 'typescript' }: { code: string; language?: string }) {
    return (
        <div className="relative group rounded-xl overflow-hidden">
            {/* Header */}
            <div className="bg-[#1a1b26] px-4 py-2 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                        <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                        <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                    </div>
                    <span className="text-[10px] text-white/30 font-mono ml-2">{language}</span>
                </div>
            </div>
            {/* Code */}
            <div className="bg-[#1e1f2e] p-4 overflow-x-auto">
                <CopyButton text={code} />
                <pre className="text-[13px] leading-relaxed font-mono text-[#a9b1d6] whitespace-pre">
                    {code}
                </pre>
            </div>
        </div>
    );
}

// ─── Section component ──────────────────────────────────────────
function Section({
    icon: Icon,
    number,
    title,
    description,
    children,
}: {
    icon: React.ElementType;
    number: number;
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-3">
            <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-accent-500" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-surface-800">
                        <span className="text-accent-500 mr-1.5">{number}.</span>
                        {title}
                    </h3>
                    <p className="text-xs text-surface-500 mt-0.5">{description}</p>
                </div>
            </div>
            <div className="ml-11">
                {children}
            </div>
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────
export default function EventIntegrationGuide({ eventId, eventName }: EventIntegrationGuideProps) {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-erp-domain.com';

    const envSnippet = `NEXT_PUBLIC_EVENT_ID=${eventId}`;

    const trackSnippet = `// Track a pageview or interaction
await fetch('${baseUrl}/api/v1/events/track', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventId: process.env.NEXT_PUBLIC_EVENT_ID,
    action: 'pageview',  // or 'button_click', 'spin_start', etc.
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    metadata: {
      page: '/landing',
      referrer: document.referrer,
    },
  }),
});`;

    const registerSnippet = `// Register a customer / collect lead data
const res = await fetch('${baseUrl}/api/v1/events/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventId: process.env.NEXT_PUBLIC_EVENT_ID,
    customer: {
      phone: '0909123456',       // Primary key (required)
      fullName: 'Nguyen Van A',  // Required
      email: 'a@email.com',     // Optional
      dob: '1995-10-25',        // Optional (YYYY-MM-DD)
    },
    source: 'qr_code',          // Optional: 'qr_code' | 'social_media' | 'direct'
  }),
});

const data = await res.json();
// Response:
// {
//   success: true,
//   isNewUser: true,             // false if phone already registered
//   spinsRemaining: 3,           // default allocated spins
//   message: 'Đăng ký thành công'
// }`;

    const gachaSnippet = `// Execute a gacha spin (Server Action — call from server component or 'use server')
import { executeGacha } from '@/actions/universal_gacha';

const result = await executeGacha(
  process.env.NEXT_PUBLIC_EVENT_ID!,
  { phone: '0909123456', name: 'Nguyen Van A' }
);

// Response (GachaResult):
// {
//   success: true,
//   status: 'WON_VOUCHER',        // or 'LUCK_NEXT_TIME' | 'NO_SPINS_LEFT' | 'ERROR'
//   spinsRemaining: 2,
//   prizeData: {
//     campaignId: 'CAMP_1',
//     campaignName: 'Giảm 10%',
//     rewardType: 'discount_percent',
//     rewardValue: 10,
//     voucherCode: 'OPEN-X7B9-26',  // Show QR for this code
//   },
//   message: 'You won: Giảm 10%!'
// }`;

    const responseTypesSnippet = `// TypeScript types for responses
interface GachaResult {
  success: boolean;
  status: 'WON_VOUCHER' | 'LUCK_NEXT_TIME' | 'NO_SPINS_LEFT' | 'ERROR';
  spinsRemaining?: number;
  prizeData?: {
    campaignId: string;
    campaignName: string;
    rewardType: string;
    rewardValue: number;
    voucherCode: string;
  };
  message?: string;
}

interface RegisterResponse {
  success: boolean;
  isNewUser: boolean;
  spinsRemaining: number;
  message: string;
}

interface TrackResponse {
  success: boolean;
  id: string;             // analytics doc ID
}`;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-br from-surface-800 to-surface-900 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-accent-500/20 flex items-center justify-center">
                        <Code2 className="w-5 h-5 text-accent-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">Tài liệu Tích hợp API</h2>
                        <p className="text-sm text-white/50">Dành cho Developer xây dựng Event Frontend</p>
                    </div>
                </div>
                {eventName && (
                    <div className="mt-3 px-3 py-1.5 bg-white/5 rounded-lg text-xs font-mono text-white/70 inline-block">
                        Event: {eventName}
                    </div>
                )}
            </div>

            {/* Environment Setup */}
            <Section
                icon={Settings2}
                number={0}
                title="Cấu hình Môi trường"
                description="Thêm Event ID vào file .env.local của custom event app"
            >
                <CodeBlock code={envSnippet} language=".env" />
                <div className="mt-2 px-3 py-2 bg-primary-50 border border-primary-200 rounded-lg">
                    <p className="text-[11px] text-primary-700 font-medium">
                        💡 Event ID này được tạo từ trang Quản lý Sự kiện trong ERP. Cả hai app cùng dùng chung Firebase project.
                    </p>
                </div>
            </Section>

            {/* Section 1: Tracking */}
            <Section
                icon={BarChart3}
                number={1}
                title="Tracking Pageviews & Interactions"
                description="Gửi analytics (pageview, click, scroll) về hệ thống ERP"
            >
                <div className="mb-2">
                    <span className="text-[10px] font-bold text-white bg-success-500 px-2 py-0.5 rounded">POST</span>
                    <code className="text-xs text-surface-600 font-mono ml-2">/api/v1/events/track</code>
                </div>
                <CodeBlock code={trackSnippet} />
            </Section>

            {/* Section 2: Registration */}
            <Section
                icon={UserPlus}
                number={2}
                title="Đăng ký Khách hàng (Lead Collection)"
                description="Thu thập thông tin khách hàng và cấp lượt chơi mặc định"
            >
                <div className="mb-2">
                    <span className="text-[10px] font-bold text-white bg-success-500 px-2 py-0.5 rounded">POST</span>
                    <code className="text-xs text-surface-600 font-mono ml-2">/api/v1/events/register</code>
                </div>
                <CodeBlock code={registerSnippet} />
                <div className="mt-2 px-3 py-2 bg-warning-50 border border-warning-200 rounded-lg">
                    <p className="text-[11px] text-warning-700 font-medium">
                        ⚠️ Phone number là primary key. Nếu phone đã đăng ký trước đó, thông tin sẽ được cập nhật nhưng spins KHÔNG bị reset.
                    </p>
                </div>
            </Section>

            {/* Section 3: Gacha */}
            <Section
                icon={Gamepad2}
                number={3}
                title="Gacha Roll (Quay thưởng)"
                description="Gọi Server Action sau khi hoạt ảnh mini-game kết thúc"
            >
                <CodeBlock code={gachaSnippet} />
                <div className="mt-2 px-3 py-2 bg-accent-50 border border-accent-200 rounded-lg">
                    <p className="text-[11px] text-accent-700 font-medium">
                        🎰 Server Action chạy server-side. Toàn bộ logic gacha nằm trong Firestore transaction — không thể hack từ client.
                    </p>
                </div>
            </Section>

            {/* Section 4: Response Types */}
            <Section
                icon={Terminal}
                number={4}
                title="TypeScript Response Types"
                description="Copy các interface này vào custom event app để type-safe"
            >
                <CodeBlock code={responseTypesSnippet} />
            </Section>
        </div>
    );
}
