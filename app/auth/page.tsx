"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { sendOtp, verifyOtp, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import OtpInput from "@/components/OtpInput";
import TermsModal from "@/components/TermsModal";
import { AlertCircle, CheckCircle2 } from "lucide-react";

type AuthStep = "email" | "otp";

export default function AuthPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();

  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [successMessage, setSuccessMessage] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setTimeout(() => setCountdown((c) => c - 1), 1000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [countdown]);

  const handleSendOtp = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      setError("");
      setIsLoading(true);
      try {
        await sendOtp(email);
        setStep("otp");
        setCountdown(300);
        setSuccessMessage("We've sent a verification code to your email.");
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 429) {
            setError("Too many requests. Please wait a moment.");
          } else if (err.data?.errors && typeof err.data.errors === "object") {
            const errors = err.data.errors as Record<string, string[]>;
            const firstError = Object.values(errors)[0];
            setError(Array.isArray(firstError) ? firstError[0] : String(firstError));
          } else {
            setError(err.message);
          }
        } else {
          setError("Failed to send OTP. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [email]
  );

  const handleVerifyOtp = useCallback(
    async (otp: string) => {
      setError("");
      setIsLoading(true);
      try {
        const data = await verifyOtp(email, otp);
        login(data.token, data.organizer);
        setSuccessMessage(
          data.is_new ? "Account created! Redirecting..." : "Welcome back! Redirecting..."
        );
        setTimeout(() => router.replace("/dashboard"), 600);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.status === 429 ? "Too many attempts. Please wait." : err.message);
        } else {
          setError("Verification failed. Please try again.");
        }
        setIsLoading(false);
      }
    },
    [email, login, router]
  );

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner spinner-dark w-7 h-7" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-glow pointer-events-none" />
      <div className="absolute top-1/4 -left-32 w-64 h-64 rounded-full bg-primary/[0.06] blur-[100px] animate-float" />
      <div
        className="absolute bottom-1/4 -right-32 w-80 h-80 rounded-full bg-accent/[0.06] blur-[120px] animate-float"
        style={{ animationDelay: "2s" }}
      />

      {/* Auth Card */}
      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        {/* Logo & Brand */}
        <div className="text-center mb-8">
          <img
            src="/brand/logo.png"
            alt="BidBuzz Logo"
            className="w-20 h-20 object-contain mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold tracking-tight">
            Bid<span className="text-primary">Buzz</span>
          </h1>
          <p className="mt-2 text-sm text-text-muted tracking-wide uppercase">
            Own the Game. Win the Bid.
          </p>
        </div>

        {/* Card */}
        <div className="card p-8">
          {step === "email" ? (
            /* ============ STEP 1: Email ============ */
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div className="text-center mb-2">
                <h2 className="text-lg font-bold text-foreground">
                  Welcome to BidBuzz
                </h2>
                <p className="text-sm text-text-muted mt-1">
                  Enter your email to sign in or create an account
                </p>
              </div>

              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-sm font-medium text-foreground mb-1.5"
                >
                  Email Address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  placeholder="you@example.com"
                  className="input-field"
                  required
                  autoFocus
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-danger bg-danger/5 border border-danger/10 rounded-lg p-3 animate-scale-in">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !email.trim()}
                className="btn-primary"
                id="send-otp-button"
              >
                {isLoading ? (
                  <>
                    <div className="spinner" />
                    <span>Sending...</span>
                  </>
                ) : (
                  "Continue with Email"
                )}
              </button>
            </form>
          ) : (
            /* ============ STEP 2: OTP Verification ============ */
            <div className="space-y-5 animate-fade-in">
              <div className="text-center mb-2">
                <h2 className="text-lg font-bold text-foreground">
                  Check your email
                </h2>
                <p className="text-sm text-text-muted mt-1">
                  We sent a 6-digit code to
                </p>
                <p className="text-sm font-semibold text-primary mt-0.5">{email}</p>
              </div>

              {successMessage && !error && (
                <div className="flex items-center justify-center gap-2 text-sm text-primary bg-primary-light/60 border border-primary/10 rounded-lg p-3 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              <OtpInput onComplete={handleVerifyOtp} disabled={isLoading} />

              {isLoading && (
                <div className="flex items-center justify-center gap-2 text-sm text-text-muted animate-fade-in">
                  <div className="spinner spinner-dark" />
                  <span>Verifying...</span>
                </div>
              )}

              {error && (
                <div className="flex items-center justify-center gap-2 text-sm text-danger bg-danger/5 border border-danger/10 rounded-lg p-3 animate-scale-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Timer & Resend */}
              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-sm text-text-subtle">
                    Code expires in{" "}
                    <span className="font-mono font-medium text-text-muted">
                      {formatCountdown(countdown)}
                    </span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setError(""); setSuccessMessage(""); handleSendOtp(); }}
                    disabled={isLoading}
                    className="btn-ghost text-sm text-primary"
                    id="resend-otp-button"
                  >
                    Resend verification code
                  </button>
                )}
              </div>

              {/* Change Email */}
              <div className="text-center pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => { setStep("email"); setError(""); setSuccessMessage(""); setCountdown(0); }}
                  disabled={isLoading}
                  className="btn-ghost text-sm"
                  id="change-email-button"
                >
                  ← Use a different email
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-text-subtle leading-relaxed">
            By continuing, you agree to BidBuzz&apos;s{" "}
            <button
              onClick={() => setShowTerms(true)}
              className="text-primary hover:underline font-medium"
            >
              Terms of Service
            </button>
          </p>
        </div>
      </div>

      {/* Modals */}
      <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
    </div>
  );
}
