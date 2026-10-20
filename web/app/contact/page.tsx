<<<<<<< HEAD
import Link from "next/link";
import { ContentPage, Section } from "@/components/ContentPage";
import { BUSINESS } from "@/lib/business";

// Only configured details are shown. Fill them in lib/business.ts - `npm run launch-check`
// fails until the essentials are present.
export default function ContactPage() {
  const hasAnyContact = !!(BUSINESS.supportEmail || BUSINESS.whatsapp || BUSINESS.phone);
  return (
    <ContentPage
      eyebrow="SUPPORT"
      title="Need a hand?"
      intro="For payment questions, account access or general feedback, use the details below."
    >
      {BUSINESS.supportEmail && (
        <Section title="Email">
          <p>
            <a href={`mailto:${BUSINESS.supportEmail}`} className="text-amber underline underline-offset-2">
              {BUSINESS.supportEmail}
            </a>
          </p>
        </Section>
      )}
      {BUSINESS.whatsapp && (
        <Section title="WhatsApp">
          <p>
            <a href={`https://wa.me/${BUSINESS.whatsapp}`} className="text-amber underline underline-offset-2">
              Chat with support on WhatsApp
            </a>
          </p>
        </Section>
      )}
      {BUSINESS.phone && (
        <Section title="Phone">
          <p>{BUSINESS.phone}</p>
        </Section>
      )}
      {!hasAnyContact && (
        <Section title="Get in touch">
          <p>Support contact details are being set up. In the meantime, check your payment status on your account page.</p>
        </Section>
      )}
      {BUSINESS.supportHours && (
        <Section title="Support hours">
          <p>{BUSINESS.supportHours}</p>
          {BUSINESS.responseTime && <p className="mt-2">Typical response: {BUSINESS.responseTime}</p>}
        </Section>
      )}
      <Section title="Payment issues">
        <p>
          Keep your M-Pesa confirmation message and the phone number used for checkout, and note the reference shown on
          your <Link href="/account" className="text-amber underline underline-offset-2">account page</Link>. Never send
          your M-Pesa PIN to anyone.
        </p>
      </Section>
    </ContentPage>
  );
}
=======
import { ContentPage, Section } from "@/components/ContentPage";
import { BUSINESS } from "@/lib/business";
export default function ContactPage() { return <ContentPage eyebrow="SUPPORT" title="Need a hand?" intro="For payment questions, account access or general feedback, use the details below."><Section title="Email"><p>{BUSINESS.supportEmail || "TODO(owner): add the support email address in lib/business.ts."}</p></Section><Section title="WhatsApp"><p>{BUSINESS.whatsapp ? `Chat with support on ${BUSINESS.whatsapp}.` : "TODO(owner): add the WhatsApp support number in lib/business.ts."}</p></Section><Section title="Support hours"><p>{BUSINESS.supportHours || "TODO(owner): add support hours in lib/business.ts."}</p>{BUSINESS.responseTime && <p className="mt-2">Typical response: {BUSINESS.responseTime}</p>}</Section><Section title="Payment issues"><p>Keep your M-Pesa confirmation message and the phone number used for checkout. Do not send your M-Pesa PIN.</p></Section></ContentPage> }
>>>>>>> 77b19cc5c52d77a83661efc52622894cf8be2216
