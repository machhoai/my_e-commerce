const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// 1. Tạo thư mục chứa QR Code
const outputDir = path.join(__dirname, 'qrcodes_output');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

// 2. Cấu hình tiền tố và khoảng số
const prefix = "JWG";
const start = 1;
const end = 62;

async function generateBulkQR() {
    console.log("🚀 Đang tiến hành tạo 62 QR Code...");

    for (let i = start; i <= end; i++) {
        // Biến số 1 thành "0001", 62 thành "0062"
        const idNumber = String(i).padStart(4, '0');
        const codeString = `${prefix}${idNumber}`;

        const filePath = path.join(outputDir, `${codeString}.png`);

        try {
            await QRCode.toFile(filePath, codeString, {
                type: 'png',
                width: 400,          // Kích thước ảnh 400x400 (độ nét cao để in tem)
                margin: 2,           // Độ dày viền trắng xung quanh QR
                color: {
                    dark: '#000000', // Màu mã QR
                    light: '#FFFFFF' // Màu nền
                },
                errorCorrectionLevel: 'M' // Mức chịu lỗi (M là chuẩn tối ưu cho quét POS/Điện thoại)
            });

            console.log(`✅ Đã tạo: ${codeString}.png`);
        } catch (err) {
            console.error(`❌ Lỗi tại mã ${codeString}:`, err);
        }
    }

    console.log(`\n🎉 HOÀN TẤT! Hãy mở thư mục "qrcodes_output" để lấy 62 file PNG.`);
}

generateBulkQR();