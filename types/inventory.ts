/**
 * Inventory Management System — Type Definitions
 *
 * Collections:
 *   products              → ProductDoc
 *   inventory_balances     → InventoryBalanceDoc
 *   inventory_transactions → InventoryTransactionDoc
 *   shift_handovers        → ShiftHandoverDoc
 */

// ── Location Types ────────────────────────────────────────────
export type LocationType = 'CENTRAL' | 'STORE' | 'COUNTER';

// ── Transaction Types ─────────────────────────────────────────
export type InventoryTransactionType =
    | 'IMPORT_CENTRAL'       // Nhập kho trung tâm
    | 'STORE_ORDER'          // Cửa hàng đặt hàng từ kho trung tâm
    | 'DISPATCH_TO_STORE'    // Xuất từ kho trung tâm → cửa hàng
    | 'TRANSFER_TO_COUNTER'  // Chuyển từ kho cửa hàng → quầy
    | 'USAGE'                // Sử dụng / tiêu thụ tại quầy
    | 'ADJUSTMENT';          // Điều chỉnh tồn kho (kiểm kê)

export type TransactionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// ── Shift Handover Status ─────────────────────────────────────
export type HandoverStatus = 'MATCHED' | 'DISCREPANCY_PENDING_APPROVAL' | 'RESOLVED';

// ── Product (products collection) ─────────────────────────────
export interface ProductDoc {
    id: string;
    companyCode: string;         // Mã nội bộ
    barcode: string;             // Mã vạch
    name: string;
    image: string;               // URL ảnh sản phẩm
    invoicePrice: number;        // Giá hóa đơn (giá nhập)
    actualPrice: number;         // Giá thực tế (giá bán)
    origin: string;              // Xuất xứ
    unit: string;                // Đơn vị tính (cái, hộp, kg...)
    category: string;            // Danh mục
    minStock: number;            // Tồn kho tối thiểu (cảnh báo)
    isActive: boolean;
    createdAt: string;           // ISO timestamp
}

// ── Inventory Balance (inventory_balances collection) ─────────
// Tracks the current stock at a specific location.
// Document ID: `${productId}_${locationType}_${locationId}`
export interface InventoryBalanceDoc {
    id: string;
    productId: string;
    locationType: LocationType;
    locationId: string;          // storeId, counterId, or 'CENTRAL'
    currentStock: number;
    lastUpdated: string;         // ISO timestamp
}

// ── Inventory Transaction (inventory_transactions collection) ─
// The irrefutable log of all stock movements (Thẻ kho).
export interface InventoryTransactionDoc {
    id: string;
    productId: string;

    fromLocationType: LocationType | '';
    fromLocationId: string;      // '' for external imports
    toLocationType: LocationType | '';
    toLocationId: string;        // '' for usage/consumption

    quantity: number;
    type: InventoryTransactionType;
    status: TransactionStatus;

    createdByUserId: string;
    approvedByUserId: string | null;
    referenceId: string;         // e.g. shiftId, orderId, importBatchId

    timestamp: string;           // ISO timestamp
    note: string;
}

// ── Counted Item (embedded in ShiftHandoverDoc) ───────────────
export interface HandoverCountedItem {
    productId: string;
    systemQuantity: number;      // Tồn kho hệ thống
    actualQuantity: number;      // Số lượng thực tế đếm được
    diff: number;                // actualQuantity - systemQuantity
}

// ── Shift Handover (shift_handovers collection) ───────────────
// Records cross-checking between shifts at a counter.
export interface ShiftHandoverDoc {
    id: string;
    storeId: string;
    counterId: string;
    date: string;                // YYYY-MM-DD

    outgoingShiftId: string;
    incomingShiftId: string;
    outgoingUserId: string;
    incomingUserId: string;

    countedItems: HandoverCountedItem[];

    status: HandoverStatus;
    note: string;
    timestamp: string;           // ISO timestamp
}

// ── Purchase Order Status ─────────────────────────────────────
export type PurchaseOrderStatus =
    | 'PENDING_OFFICE'      // Chờ văn phòng duyệt (initial state)
    | 'APPROVED_BY_OFFICE'  // VP đã duyệt, chờ kho tổng xuất
    | 'IN_TRANSIT'          // Đang vận chuyển (kho đã xuất, QR tạo)
    | 'COMPLETED'           // Cửa hàng đã nhận, xác nhận qua QR
    | 'REJECTED'            // Bị từ chối (bởi VP hoặc kho)
    | 'CANCELED'            // Bị hủy bởi cửa hàng
    // Legacy statuses — kept for backward-compat with old data
    | 'PENDING' | 'DISPATCHED';

// ── Purchase Order Item (embedded) ────────────────────────────
export interface PurchaseOrderItem {
    productId: string;
    productCode?: string;        // companyCode || barcode — for display priority
    productName: string;
    unit: string;
    requestedQty: number;
    dispatchedQty?: number;      // Set by admin when dispatching (số thực xuất)
    receivedQty?: number;        // Set by store when receiving (số thực nhận)
    approvedQty?: number;        // Legacy alias for dispatchedQty
}

// ── Purchase Order (purchase_orders collection) ───────────────
// Store managers create orders to request products from central warehouse.
export interface PurchaseOrderDoc {
    id: string;
    storeId: string;
    storeName: string;
    items: PurchaseOrderItem[];
    status: PurchaseOrderStatus;
    createdBy: string;           // userId
    createdByName: string;
    approvedBy?: string;         // userId of admin who dispatched
    approvedByName?: string;
    qrCodeToken?: string;        // Secure token for QR-based receiving
    timestamp: string;           // ISO timestamp
    dispatchedAt?: string;       // ISO timestamp when dispatched
    completedAt?: string;        // ISO timestamp when store confirmed receipt
    canceledAt?: string;         // ISO timestamp when canceled by store
    rejectedAt?: string;         // ISO timestamp when rejected
    cancelReason?: string;       // Reason for cancellation by store
    rejectReason?: string;       // Reason for rejection (office or warehouse)
    // 2-Tier Approval Fields
    attachmentUrl?: string | null;  // Firebase Storage URL for proposal file
    officeApprovedBy?: string;      // uid of office user who approved
    officeApprovedByName?: string;
    officeApprovedAt?: string;
    officeRejectedBy?: string;
    officeRejectedByName?: string;
    note?: string;
}
