import DesktopPage from '@/app/desktop/(dashboard)/admin/products/categories/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileAdminProductsCategoriesPage() {
    return (
        <MobilePageShell title="Danh mục">
            <DesktopPage />
        </MobilePageShell>
    );
}
