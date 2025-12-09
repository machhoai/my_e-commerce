// app/(main)/layout.tsx
import Navbar from "@/components/Navbar"; // Ví dụ Navbar của bạn

export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <main className="h-fit pb-16">
                {children}
            </main>
            <div className="w-full fixed h-16 bottom-0 left-0 ">
                <Navbar />
            </div>
        </>
    );
}