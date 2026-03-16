import OrdersClient from './OrdersClient';

export const metadata = {
    title: 'Đơn hàng | B.Duck Cityfuns Vietnam',
    description: 'Xem danh sách đơn hàng theo ngày từ hệ thống Joyworld.',
};

export default function OrdersPage() {
    return (
        <div className="space-y-6 p-4 md:p-6">
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    🛒 Danh sách đơn hàng
                </h1>
                <p className="text-surface-400 text-sm mt-1">Xem và tìm kiếm đơn hàng theo ngày từ hệ thống Joyworld.</p>
            </div>
            <OrdersClient />
        </div>
    );
}
