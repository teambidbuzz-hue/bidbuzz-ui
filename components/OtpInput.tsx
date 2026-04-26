"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";

interface OtpInputProps {
  length?: number;
  onComplete: (otp: string) => void;
  disabled?: boolean;
}

export default function OtpInput({
  length = 6,
  onComplete,
  disabled = false,
}: OtpInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!disabled) {
      inputRefs.current[0]?.focus();
    }
  }, [disabled]);

  const triggerComplete = useCallback(
    (vals: string[]) => {
      const otp = vals.join("");
      if (otp.length === length) {
        onComplete(otp);
      }
    },
    [length, onComplete]
  );

  const handleChange = useCallback(
    (index: number, value: string) => {
      const digit = value.replace(/\D/g, "").slice(-1);
      const newValues = [...values];
      newValues[index] = digit;
      setValues(newValues);

      if (digit && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      triggerComplete(newValues);
    },
    [values, length, triggerComplete]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        if (!values[index] && index > 0) {
          const newValues = [...values];
          newValues[index - 1] = "";
          setValues(newValues);
          inputRefs.current[index - 1]?.focus();
        } else {
          const newValues = [...values];
          newValues[index] = "";
          setValues(newValues);
        }
      }
      if (e.key === "ArrowLeft" && index > 0) inputRefs.current[index - 1]?.focus();
      if (e.key === "ArrowRight" && index < length - 1) inputRefs.current[index + 1]?.focus();
    },
    [values, length]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
      if (pasted.length === 0) return;

      const newValues = [...values];
      for (let i = 0; i < length; i++) {
        newValues[i] = pasted[i] || "";
      }
      setValues(newValues);

      const nextEmpty = newValues.findIndex((v) => !v);
      const focusIndex = nextEmpty === -1 ? length - 1 : nextEmpty;
      inputRefs.current[focusIndex]?.focus();

      triggerComplete(newValues);
    },
    [values, length, triggerComplete]
  );

  return (
    <div className="flex items-center justify-center gap-2.5">
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={values[i]}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={`
            w-12 h-14 text-center text-lg font-bold rounded-xl outline-none
            border-2 transition-all duration-200
            ${values[i]
              ? "border-primary bg-primary-light/50 text-primary"
              : "border-border bg-surface text-foreground"
            }
            focus:border-primary focus:ring-3 focus:ring-primary-glow
            disabled:opacity-40 disabled:cursor-not-allowed
          `}
          aria-label={`OTP digit ${i + 1}`}
          id={`otp-input-${i}`}
        />
      ))}
    </div>
  );
}
