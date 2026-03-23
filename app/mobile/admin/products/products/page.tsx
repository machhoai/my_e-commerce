import DesktopPage from '@/app/desktop/(dashboard)/admin/products/products/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileAdminProductsProductsPage() {
    return (
        <MobilePageShell title="Sản phẩm">
            <DesktopPage />
        </MobilePageShell>
    );
}
