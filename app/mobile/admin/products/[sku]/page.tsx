import DesktopPage from '@/app/desktop/(dashboard)/admin/products/[sku]/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default async function MobileAdminProductsDetailPage(props: { params: Promise<{ sku: string }> }) {
    return (
        <MobilePageShell title="Chi tiết sản phẩm">
            <DesktopPage {...props} />
        </MobilePageShell>
    );
}
