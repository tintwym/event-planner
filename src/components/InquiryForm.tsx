import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Mail, Send, Copy, CheckCircle } from 'lucide-react';
import { ItineraryItem } from '../types';
import { buildInquiryMailto, buildInquiryPackageText } from '../lib/export';

interface InquiryFormProps {
  plannerName: string;
  items: ItineraryItem[];
  total: number;
}

export default function InquiryForm({ plannerName, items, total }: InquiryFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const disabled = items.length === 0;

  const payload = () => ({
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim() || undefined,
    message: message.trim() || undefined,
    plannerName,
    items,
    total,
  });

  const handleMailto = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setHint(null);
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }

    const data = payload();
    const { href, truncated } = buildInquiryMailto(data);

    if (truncated) {
      try {
        await navigator.clipboard.writeText(buildInquiryPackageText(data));
        setHint('Full agenda copied — paste it into the email body.');
      } catch {
        setHint('Agenda is long; please attach details manually in your email.');
      }
    }

    window.location.href = href;
  };

  const handleCopy = async () => {
    setError(null);
    setHint(null);
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required before copying.');
      return;
    }

    try {
      await navigator.clipboard.writeText(buildInquiryPackageText(payload()));
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Could not copy to clipboard. Use Send Inquiry instead.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-lg"
      id="inquiry-handoff-form"
    >
      <div className="flex items-center gap-2 mb-1">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          className="p-1.5 bg-gold-premium/10 rounded-lg"
        >
          <Mail className="w-4 h-4 text-gold-premium" aria-hidden="true" />
        </motion.div>
        <h3 className="font-serif font-bold text-dark-text-primary leading-none">
          Request a Proposal
        </h3>
      </div>
      <p className="text-[11px] text-dark-text-tertiary uppercase tracking-wider font-semibold mb-4">
        Send your agenda to Villa &amp; Vale events
      </p>

      <form onSubmit={handleMailto} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="inquiry-name"
              className="block text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1"
            >
              Your Name
            </label>
            <input
              id="inquiry-name"
              type="text"
              required
              disabled={disabled}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium disabled:opacity-50 transition-shadow"
            />
          </div>
          <div>
            <label
              htmlFor="inquiry-email"
              className="block text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1"
            >
              Email
            </label>
            <input
              id="inquiry-email"
              type="email"
              required
              disabled={disabled}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium disabled:opacity-50 transition-shadow"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="inquiry-phone"
            className="block text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1"
          >
            Phone <span className="normal-case font-medium text-dark-text-tertiary">(optional)</span>
          </label>
          <input
            id="inquiry-phone"
            type="tel"
            disabled={disabled}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium disabled:opacity-50 transition-shadow"
          />
        </div>

        <div>
          <label
            htmlFor="inquiry-message"
            className="block text-[11px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1"
          >
            Message <span className="normal-case font-medium text-dark-text-tertiary">(optional)</span>
          </label>
          <textarea
            id="inquiry-message"
            rows={3}
            disabled={disabled}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Preferred celebration dates, budget notes, or questions for our concierge team…"
            className="w-full px-3 py-2 bg-dark-input border border-dark-border rounded-xl text-xs text-dark-text-primary placeholder-dark-text-tertiary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium resize-none disabled:opacity-50 transition-shadow"
          />
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.p
              key="err"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs text-rose-500 font-semibold"
              role="alert"
            >
              {error}
            </motion.p>
          )}
          {hint && !error && (
            <motion.p
              key="hint"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs text-gold-premium font-semibold"
              role="status"
            >
              {hint}
            </motion.p>
          )}
        </AnimatePresence>

        {disabled ? (
          <p className="text-xs text-dark-text-tertiary">
            Add at least one activity to your itinerary before requesting a proposal.
          </p>
        ) : (
          <p className="text-[11px] text-dark-text-tertiary">
            Your current agenda ({items.length} items · ${total.toLocaleString()}) will be attached
            to the message.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <motion.button
            type="submit"
            disabled={disabled}
            whileTap={disabled ? undefined : { scale: 0.98 }}
            className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors ${
              disabled
                ? 'bg-dark-input text-dark-text-tertiary border border-dark-border cursor-not-allowed'
                : 'bg-gold-premium hover:bg-gold-hover text-[#0A0A0A] cursor-pointer'
            }`}
            id="inquiry-send-btn"
          >
            <Send className="w-3.5 h-3.5" aria-hidden="true" /> Send Inquiry
          </motion.button>
          <motion.button
            type="button"
            disabled={disabled}
            onClick={handleCopy}
            whileTap={disabled ? undefined : { scale: 0.98 }}
            className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors border ${
              disabled
                ? 'bg-dark-input text-dark-text-tertiary border-dark-border cursor-not-allowed'
                : 'border-gold-premium text-gold-premium hover:bg-gold-premium/10 cursor-pointer'
            }`}
            id="inquiry-copy-btn"
          >
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.span
                  key="copied"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="inline-flex items-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" /> Copied
                </motion.span>
              ) : (
                <motion.span
                  key="copy"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="inline-flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" /> Copy Package
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </form>
    </motion.div>
  );
}
