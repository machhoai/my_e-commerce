/**
 * Parsed result from a Vietnamese CCCD (Chip-based Citizen ID) QR code.
 */
export interface CCCDParsedData {
    idCard: string;         // Index 0: Số CCCD
    name: string;           // Index 2: Họ tên
    dob: string;            // Index 3: DDMMYYYY → YYYY-MM-DD
    gender: string;         // Index 4: Nam / Nữ
    permanentAddress: string; // Index 5: Địa chỉ thường trú
}

/**
 * Parse a Vietnamese CCCD QR code string.
 *
 * Format: `CCCD_NUMBER|RANDOM|FULL_NAME|DDMMYYYY|GENDER|ADDRESS|ISSUE_DATE`
 *
 * Example: `083171009314|320729340|Mạch Hồng Thúy|18121971|Nữ|176/36 Đông Nam, Vĩnh Thành, Chợ Lách, Bến Tre|21122021`
 *
 * @returns Parsed data or `null` if the format is invalid.
 */
export function parseCCCDQR(raw: string): CCCDParsedData | null {
    if (!raw || typeof raw !== 'string') return null;

    const parts = raw.split('|');
    if (parts.length < 6) return null;

    const idCard = parts[0].trim();
    const name = parts[2]?.trim() || '';
    const dobRaw = parts[3]?.trim() || '';
    const gender = parts[4]?.trim() || '';
    const permanentAddress = parts[5]?.trim() || '';

    // Validate CCCD number (12 digits)
    if (!/^\d{12}$/.test(idCard)) return null;

    // Convert DDMMYYYY → YYYY-MM-DD
    let dob = '';
    if (/^\d{8}$/.test(dobRaw)) {
        const dd = dobRaw.slice(0, 2);
        const mm = dobRaw.slice(2, 4);
        const yyyy = dobRaw.slice(4, 8);
        dob = `${yyyy}-${mm}-${dd}`;
    }

    if (!name) return null;

    return { idCard, name, dob, gender, permanentAddress };
}
