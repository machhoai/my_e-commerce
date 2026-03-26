// import { NextResponse } from 'next/server';
// import { getAdminDb } from '@/lib/firebase-admin';

// export async function GET() {
//     try {
//         const adminDb = getAdminDb();
//         const usersSnap = await adminDb.collection('users').get();
        
//         const usersData = usersSnap.docs.map(doc => ({
//             id: doc.id,
//             ...doc.data()
//         }));

//         // Trả về file JSON để tải xuống
//         return new NextResponse(JSON.stringify(usersData, null, 2), {
//             status: 200,
//             headers: {
//                 'Content-Type': 'application/json',
//                 // Ép trình duyệt tải file về thay vì hiển thị trên màn hình
//                 'Content-Disposition': 'attachment; filename="firestore_users_backup.json"'
//             }
//         });
//     } catch (error) {
//         return NextResponse.json({ error: 'Lỗi khi backup' }, { status: 500 });
//     }
// }