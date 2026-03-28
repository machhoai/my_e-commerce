/**
 * Firebase Storage — Image Upload Utility
 *
 * Uploads base64 images to Firebase Storage and returns download URLs.
 * Idempotent: if the input is already an https:// URL, returns it as-is.
 *
 * Storage path: `users/{uid}/{type}_{timestamp}.webp`
 */

import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export type ImageUploadType = 'avatar' | 'cccd_front' | 'cccd_back';

/**
 * Upload a base64 image to Firebase Storage and return the download URL.
 *
 * @param uid      - Firebase Auth UID (used as folder name)
 * @param base64   - A `data:image/...;base64,...` string OR an existing URL
 * @param type     - One of 'avatar' | 'cccd_front' | 'cccd_back'
 * @returns        - Firebase Storage download URL (https://...)
 */
export async function uploadImageBase64(
    uid: string,
    base64: string,
    type: ImageUploadType,
): Promise<string> {
    // Already a URL (from a previous upload) — return as-is
    if (!base64.startsWith('data:image')) {
        return base64;
    }

    const path = `users/${uid}/${type}_${Date.now()}.webp`;
    const storageRef = ref(storage, path);

    await uploadString(storageRef, base64, 'data_url');
    return getDownloadURL(storageRef);
}
