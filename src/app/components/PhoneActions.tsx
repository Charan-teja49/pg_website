import { Phone, MessageCircle } from 'lucide-react';
import { dialLink, whatsappLink } from '../lib/whatsapp';

interface Props {
  mobile: string;
  /** Optional pre-filled message for the WhatsApp deep-link. */
  whatsappMessage?: string;
  /** Render style. */
  size?: 'sm' | 'md';
  /** Hide the call (tel:) button. */
  hideDial?: boolean;
  /** Hide the WhatsApp button. */
  hideWhatsapp?: boolean;
  /** Extra Tailwind classes on the container. */
  className?: string;
}

/**
 * Compact pair of icon buttons that deep-link to the dialer / WhatsApp with
 * an optional prefilled message. Used in row actions on Students / Complaints /
 * Payments lists so the warden can call or message a student/parent without
 * leaving the app.
 */
export default function PhoneActions({
  mobile,
  whatsappMessage,
  size = 'sm',
  hideDial = false,
  hideWhatsapp = false,
  className = '',
}: Props) {
  if (!mobile) return null;
  const btnSize =
    size === 'sm' ? 'p-1 w-7 h-7' : 'p-2 w-9 h-9';
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      {!hideDial && (
        <a
          href={dialLink(mobile)}
          onClick={(e) => e.stopPropagation()}
          className={`grid place-items-center rounded-md text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors ${btnSize}`}
          title={`Call ${mobile}`}
          aria-label={`Call ${mobile}`}
        >
          <Phone className={iconSize} />
        </a>
      )}
      {!hideWhatsapp && (
        <a
          href={
            whatsappMessage
              ? whatsappLink(mobile, whatsappMessage)
              : `https://wa.me/91${mobile.replace(/\D/g, '').slice(-10)}`
          }
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`grid place-items-center rounded-md text-[#0F766E] bg-[#CCFBF1] hover:bg-[#A7F3D0] transition-colors ${btnSize}`}
          title={`WhatsApp ${mobile}`}
          aria-label={`WhatsApp ${mobile}`}
        >
          <MessageCircle className={iconSize} />
        </a>
      )}
    </div>
  );
}
