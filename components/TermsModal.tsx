"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldCheck, Mail } from "lucide-react";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TermsModal({ isOpen, onClose }: TermsModalProps) {
  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (typeof document === "undefined") return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-3xl max-h-[85vh] bg-surface border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-surface-alt/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Terms of Service</h2>
                  <p className="text-xs text-text-subtle uppercase tracking-wider">Last Updated: April 2026</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full hover:bg-surface-highlight border border-transparent hover:border-border flex items-center justify-center transition-all"
              >
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
              <div className="prose prose-invert max-w-none space-y-8">
                {/* Intro */}
                <section>
                  <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-primary rounded-full" />
                    1. Acceptance of Terms
                  </h3>
                  <p className="text-text-muted leading-relaxed">
                    By accessing or using the BidBuzz platform ("Platform", "Service", "we", "us", or "our"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use our Service.
                  </p>
                  <p className="text-text-muted leading-relaxed mt-2">
                    These Terms apply to all users of BidBuzz, including administrators, team managers, auction organizers, and viewers.
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-primary rounded-full" />
                    2. Description of Service
                  </h3>
                  <p className="text-text-muted leading-relaxed">
                    BidBuzz is a sports auction management platform that enables organizers to conduct live player auctions. The platform provides:
                  </p>
                  <ul className="list-disc list-inside text-text-muted mt-3 space-y-2 ml-2">
                    <li>Live real-time auction broadcasting and viewing</li>
                    <li>Player profile and statistics management</li>
                    <li>Team and tournament administration tools</li>
                    <li>Bidding management and result tracking</li>
                    <li>Media storage for player, team, and tournament images</li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-primary rounded-full" />
                    3. User Accounts
                  </h3>
                  <div className="space-y-4 ml-2">
                    <div>
                      <h4 className="text-sm font-bold text-foreground mb-1">3.1 Registration</h4>
                      <p className="text-text-muted text-sm leading-relaxed">To use certain features, you must create an account. You agree to provide accurate, current, and complete information.</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground mb-1">3.2 Account Security</h4>
                      <p className="text-text-muted text-sm leading-relaxed">You are responsible for maintaining credentials confidentiality. Notify us immediately of unauthorized use.</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground mb-1">3.3 Account Types</h4>
                      <p className="text-text-muted text-sm leading-relaxed">Organizer (Management), Viewer (Spectating), and Administrator (Internal).</p>
                    </div>
                  </div>
                </section>

                <section className="bg-primary/5 border border-primary/10 rounded-2xl p-5">
                  <h3 className="text-lg font-bold text-primary mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-primary rounded-full" />
                    4. Image and Media Storage Policy
                  </h3>
                  <div className="space-y-4">
                    <p className="text-text-muted text-sm leading-relaxed">
                      BidBuzz allows uploading images for tournaments, teams, and players.
                    </p>
                    <div className="bg-surface p-4 rounded-xl border border-border shadow-inner">
                      <h4 className="text-sm font-bold text-danger mb-2 flex items-center gap-1.5">
                        ⚠️ 90-Day Retention Policy
                      </h4>
                      <p className="text-text-muted text-xs leading-relaxed">
                        All uploaded images are retained for **90 days** from the tournament creation date. After this period, files are **permanently and automatically deleted**.
                      </p>
                      <ul className="list-disc list-inside text-text-subtle text-[11px] mt-3 space-y-1">
                        <li>Player profile images</li>
                        <li>Team logos and branding</li>
                        <li>Tournament cover photos</li>
                      </ul>
                    </div>
                    <p className="text-text-subtle text-xs italic">
                      We strongly recommend retaining your own copies of all uploaded media.
                    </p>
                  </div>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-primary rounded-full" />
                    5. User Content and Conduct
                  </h3>
                  <p className="text-text-muted leading-relaxed">
                    You are solely responsible for content you upload. Content must not infringe intellectual property, contain offensive material, or violate laws.
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-primary rounded-full" />
                    6. Auction Conduct
                  </h3>
                  <p className="text-text-muted leading-relaxed">
                    Organizers must ensure fair practices, clear rules, and accurate data. BidBuzz is a platform and not a party to agreements between teams or players.
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-primary rounded-full" />
                    7. Privacy & Liability
                  </h3>
                  <p className="text-text-muted text-sm leading-relaxed mb-4">
                    Usage is governed by our Privacy Policy. The service is provided "as is" without warranties.
                  </p>
                  <h4 className="text-sm font-bold text-foreground mb-1">Limitation of Liability</h4>
                  <p className="text-text-muted text-sm leading-relaxed">
                    BidBuzz shall not be liable for incidental or consequential damages, including loss of data or profits.
                  </p>
                </section>

                <section className="pt-6 border-t border-border">
                  <div className="flex items-center gap-4 text-text-subtle">
                    <Mail className="w-5 h-5" />
                    <div>
                      <p className="text-xs font-bold text-foreground uppercase tracking-wider">Contact Us</p>
                      <a href="mailto:team.bidbuzz@gmail.com" className="text-sm text-primary hover:underline">team.bidbuzz@gmail.com</a>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-surface-alt/50 border-t border-border flex justify-end">
              <button
                onClick={onClose}
                className="btn-primary !w-auto !px-8 !py-2.5 text-sm"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
