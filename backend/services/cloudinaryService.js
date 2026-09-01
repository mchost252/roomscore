const crypto = require('crypto');
const https = require('https');

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

function generateSignature(params) {
  const signable = Object.fromEntries(
    Object.entries(params).filter(
      ([k]) => k !== 'file' && k !== 'api_key' && k !== 'signature'
    )
  );
  const sorted = Object.keys(signable)
    .sort()
    .map((k) => `${k}=${signable[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(sorted + CLOUDINARY_API_SECRET).digest('hex');
}

function httpsPost(path, bodyParams) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(bodyParams).toString();
    const req = https.request(
      {
        hostname: 'api.cloudinary.com',
        path: `/v1_1/${CLOUDINARY_CLOUD_NAME}${path}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function extractPublicId(url) {
  if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com')) {
    return null;
  }
  const match = url.match(
    /res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/
  );
  return match ? decodeURIComponent(match[1]) : null;
}

async function uploadImage(buffer, folder) {
  const base64 = buffer.toString('base64');
  const timestamp = Math.round(Date.now() / 1000);
  const signParams = {
    timestamp: timestamp.toString(),
    folder: folder,
  };
  const signature = generateSignature(signParams);

  const result = await httpsPost('/image/upload', {
    file: `data:image/jpeg;base64,${base64}`,
    api_key: CLOUDINARY_API_KEY,
    timestamp: timestamp.toString(),
    folder: folder,
    signature: signature,
  });

  if (result.status !== 200) {
    throw new Error(
      `Cloudinary upload failed: ${result.status} ${JSON.stringify(result.data)}`
    );
  }

  return result.data.secure_url;
}

async function deleteImage(publicId) {
  if (!publicId || !CLOUDINARY_CLOUD_NAME) return;

  const timestamp = Math.round(Date.now() / 1000);
  const signParams = {
    public_id: publicId,
    timestamp: timestamp.toString(),
  };
  const signature = generateSignature(signParams);

  const result = await httpsPost('/image/destroy', {
    ...signParams,
    api_key: CLOUDINARY_API_KEY,
    signature: signature,
  });

  if (result.status !== 200) {
    console.warn(
      `[cloudinaryService] Delete failed for ${publicId}:`,
      result.data
    );
  }
}

async function migrateBase64ToCloudinary(base64String, folder) {
  const matches = base64String.match(/^data:(.+?);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 data URI');
  }

  const buffer = Buffer.from(matches[2], 'base64');
  return uploadImage(buffer, folder);
}

module.exports = {
  uploadImage,
  deleteImage,
  extractPublicId,
  migrateBase64ToCloudinary,
};
