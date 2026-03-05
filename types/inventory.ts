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
export type PurchaseOrderStatus = 'PENDING' | 'DISPATCHED' | 'REJECTED';

// ── Purchase Order Item (embedded) ────────────────────────────
export interface PurchaseOrderItem {
    productId: string;
    productName: string;
    unit: string;
    requestedQty: number;
    approvedQty?: number;        // Set by admin when dispatching
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
    timestamp: string;           // ISO timestamp
    dispatchedAt?: string;       // ISO timestamp when dispatched
    note?: string;
}
