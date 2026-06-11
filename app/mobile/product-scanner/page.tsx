import ProductScannerPage from '@/app/desktop/(dashboard)/product-scanner/page';
import MobilePageShell from '@/components/mobile/MobilePageShell';

export default function MobileProductScannerPage() {
    return (
        <MobilePageShell title="Quét SP Xuất Kho">
            <div className=" h-[calc(100vh-100px)]">
                <ProductScannerPage />
            </div>
        </MobilePageShell>
    );
}
