let qrModulePromise;

export async function renderUpiQr(canvas, value) {
  if (!canvas || !value) return false;
  try {
    qrModulePromise ||= import('https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm');
    const QRCode = await qrModulePromise;
    await QRCode.toCanvas(canvas, value, { width: 220, margin: 2, color: { dark: '#1e2031', light: '#ffffff' }, errorCorrectionLevel: 'M' });
    return true;
  } catch (error) {
    console.warn('QR library could not be loaded.', error);
    return false;
  }
}
