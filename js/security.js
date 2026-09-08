const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'api', 'about', 'analytics', 'auth', 'dashboard', 'discover',
  'forgot-password', 'help', 'login', 'payments', 'payment', 'privacy', 'settings',
  'signup', 'support', 'terms', 'notifications', 'system', 'supportly', 'www',
]);

export function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

export function validateUsername(value) {
  const username = normalizeUsername(value);
  if (!/^[a-z0-9_-]{3,24}$/.test(username)) return { valid: false, message: 'Use 3–24 lowercase letters, numbers, underscores, or hyphens.' };
  if (RESERVED_USERNAMES.has(username)) return { valid: false, message: 'That username is reserved. Choose another one.' };
  return { valid: true, value: username };
}

export function validateName(value, field = 'Name') {
  const name = String(value || '').trim().replace(/[\u0000-\u001f\u007f]/g, ' ');
  if (!name || name.length > 80) return { valid: false, message: `${field} is required and must be 80 characters or fewer.` };
  return { valid: true, value: name };
}

export function sanitizeText(value, maxLength = 500) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function validateUpiId(value) {
  const upiId = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,255}@[a-z0-9][a-z0-9.-]{1,126}$/.test(upiId)) return { valid: false, message: 'Enter a valid UPI ID such as creator@upi.' };
  return { valid: true, value: upiId };
}

export function validateAmount(value, min = 20, max = 5000) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < min || amount > max) return { valid: false, message: `Enter an amount from ₹${min} to ₹${max}.` };
  return { valid: true, value: amount };
}

export function validateUtr(value) {
  const raw = String(value || '').trim();
  const normalized = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalized.length < 6 || normalized.length > 40) return { valid: false, message: 'Enter a 6–40 character transaction reference.' };
  if (/^(.)\1+$/.test(normalized) || /^0+$/.test(normalized)) return { valid: false, message: 'Enter the transaction reference shown by your UPI app.' };
  return { valid: true, raw, normalized };
}

export function validateYoutubeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return { valid: true, value: '' };
  try {
    const url = new URL(raw);
    const allowed = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'];
    if (url.protocol !== 'https:' || !allowed.includes(url.hostname.toLowerCase())) throw new Error('invalid');
    return { valid: true, value: url.href };
  } catch {
    return { valid: false, message: 'Use a valid HTTPS YouTube channel URL.' };
  }
}

export async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function sanitizeImageFile(file) {
  if (!file) return Promise.reject(new Error('Choose an image first.'));
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return Promise.reject(new Error('Choose a JPG, PNG, or WebP image.'));
  if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error('Choose an image smaller than 5 MB.'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The image could not be read.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('The image could not be decoded.'));
      image.onload = () => {
        const max = 512;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d', { alpha: false });
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        if (dataUrl.length > 260000) return reject(new Error('This image is still too large after compression.'));
        resolve(dataUrl);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
