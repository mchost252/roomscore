import { Platform } from 'react-native';
import {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_UPLOAD_PRESET,
  CLOUDINARY_UPLOAD_URL,
  CLOUDINARY_DELETE_URL,
} from '../constants/config';

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
  format: string;
}

export function isCloudinaryUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('https://')) return false;

  try {
    const url = new URL(value);
    return (
      url.hostname === 'res.cloudinary.com' &&
      url.pathname.includes('/image/upload/')
    );
  } catch {
    return false;
  }
}

export async function uploadImage(fileUri: string, folder: string): Promise<string> {
  try {
    if (!fileUri || typeof fileUri !== 'string') {
      throw new Error('An image file URI is required');
    }
    if (fileUri.startsWith('data:') || /^[A-Za-z0-9+/]+=*$/.test(fileUri)) {
      throw new Error('Base64 image data is not accepted; provide a file URI');
    }

    const ext = fileUri.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType =
      ext === 'png'
        ? 'image/png'
        : ext === 'gif'
          ? 'image/gif'
          : ext === 'webp'
            ? 'image/webp'
            : 'image/jpeg';

    const formData = new FormData();
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', folder);
    formData.append('quality', 'auto');
    formData.append('fetch_format', 'auto');

    if (Platform.OS === 'web') {
      const response = await fetch(fileUri);
      const blob = await response.blob();
      formData.append('file', blob, `upload.${ext}`);
    } else {
      formData.append('file', {
        uri: fileUri,
        type: mimeType,
        name: `upload.${ext}`,
      } as any);
    }

    const response = await fetch(CLOUDINARY_UPLOAD_URL, {
      method: 'POST',
      body: formData as any,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudinary upload failed: ${response.status} ${errorText}`);
    }

    const result: CloudinaryUploadResult = await response.json();
    if (!isCloudinaryUrl(result.secure_url)) {
      throw new Error('Cloudinary returned an invalid secure URL');
    }
    return result.secure_url;
  } catch (error: any) {
    console.error('[cloudinaryService] Upload failed:', error);
    throw new Error(error.message || 'Failed to upload image');
  }
}

export async function deleteImage(publicId: string): Promise<void> {
  try {
    const body = new URLSearchParams({
      public_id: publicId,
      upload_preset: CLOUDINARY_UPLOAD_PRESET,
    }).toString();

    const response = await fetch(CLOUDINARY_DELETE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      console.warn('[cloudinaryService] Delete failed:', response.status);
    }
  } catch (error: any) {
    console.error('[cloudinaryService] Delete failed:', error);
  }
}

export function extractPublicIdFromUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('res.cloudinary.com')) return null;

  const match = url.match(
    /res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/
  );
  return match ? decodeURIComponent(match[1]) : null;
}
