/**
 * Helpers to deep-link into WhatsApp / dialer from a 10-digit Indian mobile.
 *
 * `wa.me/91xxxxxxxxxx?text=...` opens WhatsApp (web or app) with a prefilled
 * message — works on every browser and OS. No API key needed.
 *
 * `tel:+91xxxxxxxxxx` opens the dialer. iOS/Android only; on desktop browsers
 * it asks which app to use (usually nothing).
 */

export function normaliseIndianMobile(mobile: string): string {
  return mobile.replace(/\D/g, '').slice(-10);
}

export function whatsappLink(mobile: string, message: string): string {
  const m = normaliseIndianMobile(mobile);
  return `https://wa.me/91${m}?text=${encodeURIComponent(message)}`;
}

export function dialLink(mobile: string): string {
  const m = normaliseIndianMobile(mobile);
  return `tel:+91${m}`;
}

export function feeReminderMessage(
  name: string,
  balance: number,
  buildingShortName: string,
): string {
  const amt = `₹${balance.toLocaleString('en-IN')}`;
  return `Hi ${name}, this is a friendly reminder from PG ${buildingShortName}. Your hostel-fee balance is ${amt}. Please pay at your earliest convenience. Thanks. — Warden`;
}

export function paymentReceivedMessage(
  name: string,
  amount: number,
  buildingShortName: string,
  balance: number,
): string {
  const amt = `₹${amount.toLocaleString('en-IN')}`;
  const bal = `₹${balance.toLocaleString('en-IN')}`;
  return balance <= 0
    ? `Hi ${name}, we've received your payment of ${amt}. Your hostel fee is now fully cleared. Thanks! — PG ${buildingShortName}`
    : `Hi ${name}, we've received your payment of ${amt}. Remaining balance: ${bal}. Thank you. — PG ${buildingShortName}`;
}

export function welcomeMessage(
  name: string,
  mobile: string,
  buildingShortName: string,
  welcomePassword: string,
): string {
  return [
    `Hi ${name}, welcome to PG ${buildingShortName}!`,
    ``,
    `Your student login credentials:`,
    `Mobile: ${mobile}`,
    `Password: ${welcomePassword}`,
    ``,
    `You'll be prompted to set a new password on first sign-in.`,
    `Login at: <production URL>`,
  ].join('\n');
}
