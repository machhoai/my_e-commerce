import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "B.Duck Popup Store | Khai Trương",
    description: "Tham gia mini-game mở quà may mắn tại B.Duck Popup Store!",
};

export default function EventLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <main className="min-h-dvh flex items-center justify-center bg-bduck-yellow p-4">
            {children}
        </main>
    );
}
