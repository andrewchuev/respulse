import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { CheckCircle2, Mail, MessageSquare, Send, User } from 'lucide-react';
import { ContactKind, sendContactMessage } from '../api/client';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const KINDS: { value: ContactKind; label: string }[] = [
  { value: 'bug', label: 'Bug report' },
  { value: 'question', label: 'Question' },
  { value: 'suggestion', label: 'Suggestion' },
];

const MAX_NAME = 100;
const MIN_MESSAGE = 10;
const MAX_MESSAGE = 5000;
const EMAIL_RE = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;

function validate(name: string, email: string, message: string): string | null {
  if (!name.trim()) return 'Name is required.';
  if (name.trim().length > MAX_NAME) return `Name must be at most ${MAX_NAME} characters.`;
  if (!EMAIL_RE.test(email.trim())) return 'Enter a valid email address.';
  if (message.trim().length < MIN_MESSAGE) return `Message must be at least ${MIN_MESSAGE} characters.`;
  if (message.trim().length > MAX_MESSAGE) return `Message must be at most ${MAX_MESSAGE} characters.`;
  return null;
}

export const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [kind, setKind] = useState<ContactKind>('question');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setLoading(false);
      if (sent) {
        setSent(false);
        setMessage('');
      }
    }
  }, [isOpen, sent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate(name, email, message);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await sendContactMessage({
        name: name.trim(),
        email: email.trim(),
        kind,
        message: message.trim(),
        website,
      });
      setSent(true);
    } catch (err: any) {
      setError(err?.message || 'Could not send your message. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const fieldClass = 'bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-500 text-xs h-10';
  const labelClass = 'text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] bg-slate-900/95 backdrop-blur-2xl border border-white/10 ring-1 ring-white/5 shadow-2xl shadow-black/90 p-6 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        {sent ? (
          <DialogHeader className="text-center sm:text-center pb-2 pr-0 sm:pr-0">
            <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <DialogTitle className="text-2xl font-extrabold tracking-tight text-white">Message sent</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Thanks for reaching out. We will reply to <strong className="text-slate-200">{email.trim()}</strong>.
            </DialogDescription>
            <Button type="button" onClick={onClose} className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs">
              Close
            </Button>
          </DialogHeader>
        ) : (
          <>
            <DialogHeader className="text-center sm:text-center pb-2 pr-0 sm:pr-0">
              <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/15 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                <MessageSquare className="h-6 w-6" />
              </div>
              <DialogTitle className="text-2xl font-extrabold tracking-tight text-white">Contact us</DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Report a bug, ask a question or suggest an improvement
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <span className="font-semibold">Error:</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
              <div className="grid grid-cols-3 p-1 bg-slate-950/80 rounded-xl border border-white/5 text-xs font-medium" role="radiogroup" aria-label="Message type">
                {KINDS.map((k) => (
                  <button
                    key={k.value}
                    type="button"
                    role="radio"
                    aria-checked={kind === k.value}
                    onClick={() => setKind(k.value)}
                    className={`py-2 rounded-lg transition-all ${
                      kind === k.value
                        ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>

              <div>
                <label htmlFor="contact-name" className={labelClass}>
                  <User className="h-3.5 w-3.5 text-emerald-400" />
                  Name
                </label>
                <Input
                  id="contact-name"
                  required
                  maxLength={MAX_NAME}
                  autoComplete="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="contact-email" className={labelClass}>
                  <Mail className="h-3.5 w-3.5 text-emerald-400" />
                  Email
                </label>
                <Input
                  id="contact-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="contact-message" className={labelClass}>
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                  Message
                </label>
                <textarea
                  id="contact-message"
                  required
                  rows={5}
                  maxLength={MAX_MESSAGE}
                  placeholder="Describe the problem, your question or idea"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="flex w-full rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-white placeholder:text-slate-500 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                />
              </div>

              {/* Honeypot: invisible to people and skipped by assistive tech, bots fill it in. */}
              <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
                <label htmlFor="contact-website">Website</label>
                <input
                  id="contact-website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-[0_0_20px_rgba(16,185,129,0.35)] gap-2 mt-2"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Sending...</span>
                  </span>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Send message</span>
                  </>
                )}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
