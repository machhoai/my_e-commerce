const { createCanvas } = require('canvas');
const JsBarcode = require('jsbarcode');
const fs = require('fs');
const path = require('path');

// 1. Tạo thư mục chứa Barcode
const outputDir = path.join(__dirname, 'barcodes_output');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

// 2. Cấu hình tiền tố và khoảng số
const prefix = "JWS";
const start = 1;
const end = 27;

async function generateBulkBarcode() {
    console.log(`🚀 Đang tiến hành tạo ${end} Barcode...`);

    for (let i = start; i <= end; i++) {
        // Biến số 1 thành "0001", 62 thành "0062"
        const idNumber = String(i).padStart(4, '0');
        const codeString = `${prefix}${idNumber}`;

        const filePath = path.join(outputDir, `${codeString}.png`);

        try {
            // Khởi tạo khung vẽ canvas cho mỗi mã
            const canvas = createCanvas();

            // Cấu hình vẽ Barcode
            JsBarcode(canvas, codeString, {
                format: "CODE128",   // Chuẩn mã vạch phổ biến và tương thích tốt nhất với máy quét POS
                displayValue: true,  // BẬT TÍNH NĂNG HIỂN THỊ KÝ TỰ BÊN DƯỚI MÃ VẠCH
                fontSize: 20,        // Cỡ chữ của mã bên dưới
                textMargin: 5,       // Khoảng cách giữa mã vạch và chữ
                fontOptions: "bold", // In đậm chữ để dễ đọc hơn
                width: 2,            // Độ dày của từng vạch
                height: 50,         // Chiều cao của vạch
                margin: 0,          // Viền trắng xung quanh mã vạch
                background: "#ffffff",
                lineColor: "#000000"
            });

            // Chuyển đổi canvas thành file PNG và lưu xuống ổ cứng
            const buffer = canvas.toBuffer("image/png");
            fs.writeFileSync(filePath, buffer);

            console.log(`✅ Đã tạo: ${codeString}.png`);
        } catch (err) {
            console.error(`❌ Lỗi tại mã ${codeString}:`, err);
        }
    }

    console.log(`\n🎉 HOÀN TẤT! Hãy mở thư mục "barcodes_output" để lấy ${end} file PNG.`);
}

generateBulkBarcode();