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
  operator: '[Operator legal name]',
  operatorAddress: '[Registered address]',
  supportEmail: '[support email address]',
  governingLaw: '[Governing law and courts]',
  hosting: '[Hosting provider and region]',
  refundWindowDays: 14,
  renewalRefundDays: 7,
  updated: 'October 28, 2026',
};

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
        heading: '3. Plans, limits and billing',
        paragraphs: [
          'The Free plan includes up to 10 monitors, a 60-second minimum check interval and 14 days of history. The Pro plan costs USD 8 per month excluding VAT and sales tax and includes up to 100 monitors, 10-second checks, up to 10 team members and 90 days of history. Current limits are shown in the product and may be updated for new customers.',
          'Payments are processed by FastSpring, our merchant of record. FastSpring charges you, collects applicable taxes, issues receipts and handles payment-method data; we never see your card details. The Pro subscription renews monthly until canceled.',
          'You can cancel at any time using the links in your FastSpring order emails or by contacting us. After cancellation Pro stays active until the end of the paid period, then the workspace returns to the Free plan. Refunds are described in the Refund Policy.',
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
          'We aim for a reliable service but provide it on a best-effort basis without an uptime guarantee. Probes run from our infrastructure, so results reflect what our servers can reach and may differ from what your users experience. We may perform maintenance, and we may change or discontinue features with reasonable notice where practical.',
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
          'Billing data: order and subscription identifiers, amounts, currency, status and the buyer email received from FastSpring. We do not receive or store payment card numbers.',
          'Technical data: IP address, user agent and request metadata in server logs, and the IP address used by rate limiting to curb abuse.',
        ],
      },
      {
        heading: '2. How we use it',
        bullets: [
          'to provide, secure and support the service, including running your checks and delivering alerts;',
          'to authenticate you, prevent abuse and enforce plan limits;',
          'to process subscriptions and refunds through FastSpring;',
          'to communicate about the service, such as security notices and changes to these policies.',
        ],
        paragraphs: ['We do not sell personal data and do not use it for advertising.'],
      },
      {
        heading: '3. Retention',
        paragraphs: [
          'Monitoring results are kept for 14 days on the Free plan and 90 days on Pro, then deleted automatically. Account and configuration data is kept while your account exists. Billing records are kept as long as needed for accounting and legal obligations. Server logs are kept for a limited time for security and troubleshooting. Server backups are rotated and kept for about two weeks.',
        ],
      },
      {
        heading: '4. Who we share data with',
        bullets: [
          'FastSpring, the merchant of record, which processes payments and taxes under its own privacy policy.',
          `${c.hosting}, which hosts our servers and database.`,
          'The destinations you configure: alert messages are sent to the Telegram, Discord, Slack or webhook endpoints you set up, and probes contact the targets you monitor.',
          'Authorities where the law requires it.',
        ],
      },
      {
        heading: '5. Cookies and local storage',
        paragraphs: [
          'We do not use advertising or tracking cookies. The app stores your sign-in token and interface preferences (such as the compact view) in your browser\'s local storage. When you open the checkout, a script and frame from FastSpring are loaded, which may set their own cookies.',
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
          'Data may be processed in countries other than your own, including by FastSpring; where required we rely on appropriate safeguards. The service is not directed to children under 16. We will post updates to this policy here and note the date below.',
        ],
      },
      {
        heading: '9. Contact',
        paragraphs: [`${c.operator}, ${c.operatorAddress}, ${c.supportEmail}.`],
      },
    ],
  },

  refund: {
    title: 'Refund Policy',
    summary: `How refunds and cancellations work for ${c.product} Pro. Payments are handled by FastSpring, our merchant of record.`,
    sections: [
      {
        heading: '1. Cancelling',
        paragraphs: [
          'You can cancel the Pro subscription at any time using the link in your FastSpring order emails or by contacting us. Cancelling stops future charges; Pro stays active until the end of the period you already paid for, and then the workspace returns to the Free plan. Charges already made are not refunded automatically when you cancel.',
        ],
      },
      {
        heading: '2. Refunds',
        bullets: [
          `First payment: if the service does not meet your needs, you can request a full refund within ${c.refundWindowDays} days of your initial purchase.`,
          `Renewals: you can request a refund of a renewal charge within ${c.renewalRefundDays} days of that charge; we will generally approve it if you did not rely on the renewed period.`,
          'Later requests and partial-period refunds are considered case by case, for example after a prolonged outage on our side.',
          'Taxes collected on the order are refunded together with the amount.',
        ],
      },
      {
        heading: '3. How to request a refund',
        paragraphs: [
          `Email ${c.supportEmail} from the address used at checkout and include your FastSpring order reference (it is on your receipt). We reply within a few business days. The refund is issued by FastSpring to your original payment method; banks usually need 5 to 10 business days to show it.`,
        ],
      },
      {
        heading: '4. What happens to your plan',
        paragraphs: [
          'When a refund also ends the subscription, your workspace returns to the Free plan right away. Your data is kept, but Free plan limits and 14-day history apply, and results older than that are deleted by the retention process.',
        ],
      },
      {
        heading: '5. Chargebacks and your rights',
        paragraphs: [
          'Please contact us before opening a dispute with your bank so we can resolve the problem quickly. Nothing in this policy limits any statutory rights you have as a consumer.',
        ],
      },
      {
        heading: '6. Contact',
        paragraphs: [`${c.operator}, ${c.operatorAddress}, ${c.supportEmail}.`],
      },
    ],
  },
};
