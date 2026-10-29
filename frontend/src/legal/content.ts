// DRAFT legal texts. They describe how the product actually behaves, but they are a template, not
// legal advice: fill the bracketed placeholders in `legalConfig` and have the texts reviewed
// before relying on them.

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LegalDoc {
  title: string;
  summary: string;
  sections: LegalSection[];
}

export type LegalKind = 'terms' | 'privacy' | 'refund';

export const legalConfig = {
  product: 'ResPulse',
  site: 'https://respulse.online',
  operator: 'Individual Entrepreneur Andrii Chuev (ФОП Чуєв Андрій Андрійович)',
  taxId: '3073520397',
  registrationNumber: '20112701197213',
  operatorAddress: '105 Peremohy St, apt. 44, Zaporizhzhia, 69020, Ukraine',
  phone: '+380 73 373 0103',
  supportEmail: 'contact@reslab.pro',
  governingLaw: 'the laws of Ukraine',
  hosting: 'Hetzner Online GmbH (Falkenstein, Germany)',
  refundWindowDays: 14,
  renewalRefundDays: 7,
  updated: 'October 30, 2026',
};

/** True once legal configuration is complete and ready for public display. */
export const legalReady = true;

const c = legalConfig;

export const legalDocs: Record<LegalKind, LegalDoc> = {
  terms: {
    title: 'Terms of Service',
    summary: `These terms govern your use of ${c.product} at ${c.site}, operated by ${c.operator}.`,
    sections: [
      {
        heading: '1. The service',
        paragraphs: [
          `${c.product} is an uptime and synthetic monitoring service: it probes the HTTP(S) endpoints, TCP ports and TLS certificates you configure, receives heartbeat pings from your jobs, records the results, shows them in a dashboard and public status page, and sends alerts to the channels you set up.`,
          'By creating an account or using the service you agree to these terms. If you use it on behalf of a company, you confirm you are authorized to bind that company.',
        ],
      },
      {
        heading: '2. Accounts',
        bullets: [
          'You must provide accurate registration details and keep your credentials confidential. You are responsible for activity under your account and for the members you invite.',
          'Tell us promptly if you suspect unauthorized access.',
          'Organization owners and admins control member access and roles inside their workspace.',
        ],
      },
      {
        heading: '3. Plans, limits, and subscriptions',
        paragraphs: [
          `${c.product} offers a free tier (Free Plan) with up to 20 synthetic monitors, 60-second probe intervals, 30 days of check history retention, and 1 workspace seat.`,
          `For production environments requiring high-frequency monitoring, we offer a paid plan (Pro Plan) priced at $16.00 USD per month (monthly recurring billing). The Pro plan includes up to 100 monitors, turbo 10-second probe intervals, advanced 5-field Cron syntax with timezones, 64KB execution log capture, tag-based alert routing, Prometheus metrics export, 90-day retention, and up to 10 team seats with 4-tier RBAC.`,
          `Payments are processed securely by WayForPay, a licensed Ukrainian payment service provider. Subscriptions renew automatically each month until canceled. You can cancel your subscription at any time directly in the application settings; cancellation takes effect immediately.`,
        ],
      },
      {
        heading: '4. Acceptable use',
        paragraphs: ['You agree not to:'],
        bullets: [
          'monitor or probe systems you do not own or have permission to test;',
          'use the service to attack, scan, overload or gain access to any network, including attempts to reach private or internal addresses (these targets are blocked by design);',
          'send unsolicited or abusive messages through notification channels or webhooks;',
          'circumvent limits, rate limits or security controls, or create accounts in bulk;',
          'upload unlawful content or content that infringes others\' rights, or interfere with the service or other customers.',
        ],
      },
      {
        heading: '5. Your content and data',
        paragraphs: [
          'You keep ownership of everything you submit (monitor configurations, headers, request bodies, tags, incident notes and similar content, together the "Customer Content"). You grant us a limited license to host, process and display it only to operate the service for you.',
          'Monitor credentials and channel secrets you enter (for example HTTP Basic credentials, webhook URLs or bot tokens) are stored in our database so that checks and alerts can run. Use dedicated, low-privilege credentials. How we handle personal data is described in the Privacy Policy.',
        ],
      },
      {
        heading: '6. Availability and changes',
        paragraphs: [
          'We aim for a reliable service but, as a beta, provide it on a best-effort basis without an uptime guarantee. Probes run from our infrastructure, so results reflect what our servers can reach and may differ from what your users experience. We may perform maintenance, and we may change or discontinue features with reasonable notice where practical.',
        ],
      },
      {
        heading: '7. Suspension and termination',
        paragraphs: [
          'We may suspend or terminate access that violates these terms or threatens the service or other customers. You may stop using the service at any time and ask us to delete your workspace. Sections that by their nature should survive termination (such as liability limits) continue to apply.',
        ],
      },
      {
        heading: '8. Disclaimers and liability',
        paragraphs: [
          'The service is provided "as is" and "as available". To the maximum extent permitted by law we disclaim all implied warranties, and we are not liable for indirect, incidental or consequential damages, lost profits or lost data, including losses caused by a missed or delayed alert. Our total liability for any claim is limited to the amount you paid for the service in the three months before the claim. Nothing in these terms limits liability that cannot be limited by law.',
        ],
      },
      {
        heading: '9. Changes to these terms',
        paragraphs: [
          'We may update these terms. Material changes will be announced in the product or by email, and continued use after the effective date means you accept them.',
        ],
      },
      {
        heading: '10. Governing law and contact',
        paragraphs: [
          `These terms are governed by ${c.governingLaw}. Contact: ${c.operator}, ${c.operatorAddress}, ${c.supportEmail}.`,
        ],
      },
    ],
  },

  privacy: {
    title: 'Privacy Policy',
    summary: `This policy explains what personal data ${c.product} (${c.site}) collects, why, and the choices you have. Controller: ${c.operator}.`,
    sections: [
      {
        heading: '1. Data we collect',
        bullets: [
          'Account data: name, email address, organization name, role and a bcrypt hash of your password. Team members you invite are stored with their name, email and role.',
          'Service configuration: monitor targets, check settings, tags, folders, notification channel settings, incident updates and post-mortems that you write.',
          'Sensitive items you choose to enter: HTTP headers or request bodies, HTTP Basic credentials, webhook URLs and bot tokens. They are stored in our database so checks and alerts can run.',
          'Monitoring results: status, response times, status codes, error messages and heartbeat payloads (up to 64 KB) for your monitors.',
          'Billing data: none while the service is free. If paid plans are introduced, our payment provider will share order identifiers, amounts, status and the buyer email with us; card numbers never reach us.',
          'Technical data: IP address, user agent and request metadata in server logs, and the IP address used by rate limiting to curb abuse.',
        ],
      },
      {
        heading: '2. How we use it',
        bullets: [
          'to provide, secure and support the service, including running your checks and delivering alerts;',
          'to authenticate you, prevent abuse and enforce plan limits;',
          'to understand overall usage (such as signups, active teams and number of monitors) and decide how to develop the service; this uses aggregate figures and team names, not your email or the content of your monitors;',
          'to communicate about the service, such as security notices and changes to these policies.',
        ],
        paragraphs: ['We do not sell personal data and do not use it for advertising.'],
      },
      {
        heading: '3. Retention',
        paragraphs: [
          'Monitoring results are kept for 30 days (90 days on any future paid plan), then deleted automatically. Account and configuration data is kept while your account exists. Billing records are kept as long as needed for accounting and legal obligations. Server logs are kept for a limited time for security and troubleshooting. Server backups are rotated and kept for about two weeks.',
        ],
      },
      {
        heading: '4. Who we share data with',
        bullets: [
          'A payment provider, only if paid plans are introduced (it would process payments and taxes under its own privacy policy).',
          `${c.hosting}, which hosts our servers and database.`,
          'The destinations you configure: alert messages are sent to the Telegram, Discord, Slack or webhook endpoints you set up, and probes contact the targets you monitor.',
          'Authorities where the law requires it.',
        ],
      },
      {
        heading: '5. Cookies and local storage',
        paragraphs: [
          'We do not use advertising or tracking cookies. The app stores your sign-in token and interface preferences (such as the compact view) in your browser\'s local storage. Checkout is currently switched off. If it is introduced, a script and frame from the payment provider will be loaded when you open it, and they may set their own cookies.',
          'Avatar images may be loaded from third-party image hosts, which can see your IP address when your browser requests them.',
        ],
      },
      {
        heading: '6. Security',
        paragraphs: [
          'Traffic is encrypted with TLS, passwords are stored only as hashes, access is restricted by roles and by team, and probes cannot reach private network ranges. No system is perfectly secure; please use strong, unique passwords and dedicated low-privilege credentials for monitoring.',
        ],
      },
      {
        heading: '7. Your rights',
        paragraphs: [
          `Depending on where you live (for example under the GDPR) you may have the right to access, correct, export or delete your personal data, to restrict or object to processing, and to complain to a data protection authority. To exercise these rights or to delete your workspace, write to ${c.supportEmail}. We may need to verify your identity first.`,
        ],
      },
      {
        heading: '8. International transfers, children and changes',
        paragraphs: [
          'Data may be processed in countries other than your own; where required we rely on appropriate safeguards. The service is not directed to children under 16. We will post updates to this policy here and note the date below.',
        ],
      },
      {
        heading: '9. Contact',
        paragraphs: [`${c.operator}, ${c.operatorAddress}, ${c.supportEmail}.`],
      },
    ],
  },

  refund: {
    title: 'Refund & Cancellation Policy',
    summary: `This Refund and Cancellation Policy describes how refunds and subscription cancellations work for ${c.product}, operated by ${c.operator}.`,
    sections: [
      {
        heading: '1. Digital Service and Immediate Access',
        paragraphs: [
          `${c.product} is a digital, cloud-hosted SaaS monitoring service. There are no physical goods and nothing is physically shipped. Access to paid features (Pro Plan) is granted immediately upon successful completion of payment through our payment gateway.`,
        ],
      },
      {
        heading: '2. Right of Withdrawal and Refunds',
        paragraphs: [
          `In accordance with the Law of Ukraine "On Digital Content and Digital Services" No. 3321-IX and the Law of Ukraine "On Consumer Rights Protection", digital services that are provided immediately with the express consent of the user are generally non-refundable once service provision has commenced.`,
          `If you subscribed and wish to withdraw prior to utilizing paid Pro features, or if you were charged in error (e.g. duplicate transaction or billing error), please contact us within ${c.refundWindowDays} days of the transaction at ${c.supportEmail}. Approved refunds are returned to the original payment method through WayForPay.`,
        ],
      },
      {
        heading: '3. Subscription Cancellation',
        paragraphs: [
          'You may cancel your recurring Pro subscription at any time from Team Settings inside the application. Cancellation takes effect immediately — no further recurring charges will be made. Canceling stops future renewals and reverts your workspace to the Free plan.',
        ],
      },
      {
        heading: '4. Payment Processing',
        paragraphs: [
          'All card transactions are processed securely by WayForPay, a licensed Ukrainian payment service provider. We never receive or store your payment card numbers.',
        ],
      },
      {
        heading: '5. Contact and Disputes',
        paragraphs: [
          `If you believe a charge was made in error, please contact our support team at ${c.supportEmail} before initiating a bank dispute or chargeback. We resolve billing questions promptly.`,
        ],
      },
    ],
  },
};
