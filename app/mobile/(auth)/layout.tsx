// Auth route group — no AuthGuard wrapper so login/change-password can render
export default function MobileAuthLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
