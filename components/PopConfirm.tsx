"use client";

import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export type PopConfirmPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface PopConfirmProps {
  /** Element that triggers the popover (e.g. Button) */
  trigger: React.ReactElement<any>;

  /** Called when user confirms. Call callback() to close. setLoading controls confirm button loading state. */
  onConfirm: (callback: () => void, setLoading: (loading: boolean) => void) => void;

  /** Called when user cancels. Call callback() to close. */
  onCancel?: (callback: () => void) => void;

  /** Text for the confirm button (default: 'Yes') */
  confirmText?: string;

  /** Text for the cancel button (default: 'Cancel') */
  cancelText?: string;

  /** Title shown in the popover */
  title?: string;

  /** Body/description text shown in the popover */
  body?: string;

  /** Optional icon shown in the popover */
  icon?: React.ReactNode;

  /** Placement of the popover relative to the trigger */
  placement?: PopConfirmPlacement;

  /** Additional class name for the popover */
  className?: string;

  /** Additional class name for the trigger wrapper (default: 'inline-block') */
  triggerClassName?: string;
}

const defaultConfirmText = 'Yes';
const defaultTitleText = 'Confirmation';
const defaultBodyText = 'Are you sure?';
const defaultCancelText = 'Cancel';
const defaultIcon = <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"><path opacity="0.12" d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="currentColor"></path><path d="M12 16V12M12 8H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>

export const PopConfirm = ({
  trigger,
  onConfirm,
  onCancel,
  confirmText = defaultConfirmText,
  cancelText = defaultCancelText,
  title = defaultTitleText,
  body = defaultBodyText,
  icon = defaultIcon,
  placement = 'bottom',
  className,
  triggerClassName,
}: PopConfirmProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setIsOpen(false);
    setIsLoading(false);
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(close, setIsLoading);
  }, [onConfirm, close]);

  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel(close);
    } else {
      close();
    }
  }, [onCancel, close]);

  const handleTriggerClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen((prev) => !prev);
    },
    []
  );

  const triggerWithProps = React.cloneElement(trigger, {
    onClick: (e: React.MouseEvent) => {
      trigger.props.onClick?.(e);
      handleTriggerClick(e);
    },
  });

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      close();
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, close]);

  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [resolvedPlacement, setResolvedPlacement] = useState<PopConfirmPlacement>(placement);

  const updatePosition = useCallback(() => {
    const triggerEl = triggerRef.current;
    if (!triggerEl) return;

    const rect = triggerEl.getBoundingClientRect();
    const gap = 8;
    const popoverWidth = 280;
    const popoverHeight = 120;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const calcPosition = (p: PopConfirmPlacement) => {
      let top = 0;
      let left = 0;
      switch (p) {
        case 'top':
          top = rect.top - popoverHeight - gap;
          left = rect.left + rect.width / 2 - popoverWidth / 2;
          break;
        case 'bottom':
          top = rect.bottom + gap;
          left = rect.left + rect.width / 2 - popoverWidth / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - popoverHeight / 2;
          left = rect.left - popoverWidth - gap;
          break;
        case 'right':
          top = rect.top + rect.height / 2 - popoverHeight / 2;
          left = rect.right + gap;
          break;
      }
      return { top, left };
    };

    const fitsInViewport = (pos: { top: number; left: number }) => {
      return (
        pos.top >= 0 &&
        pos.left >= 0 &&
        pos.top + popoverHeight <= viewportHeight &&
        pos.left + popoverWidth <= viewportWidth
      );
    };

    let pos = calcPosition(placement);
    if (fitsInViewport(pos)) {
      setResolvedPlacement(placement);
      pos.left = Math.max(8, Math.min(pos.left, viewportWidth - popoverWidth - 8));
      setPosition(pos);
      return;
    }

    const opposite: Record<PopConfirmPlacement, PopConfirmPlacement> = {
      top: 'bottom', bottom: 'top', left: 'right', right: 'left',
    };
    const fallbackOrder: PopConfirmPlacement[] = [
      opposite[placement],
      ...(['top', 'bottom', 'left', 'right'] as PopConfirmPlacement[]).filter(
        (p) => p !== placement && p !== opposite[placement]
      ),
    ];

    for (const fallback of fallbackOrder) {
      const fallbackPos = calcPosition(fallback);
      if (fitsInViewport(fallbackPos)) {
        setResolvedPlacement(fallback);
        fallbackPos.left = Math.max(8, Math.min(fallbackPos.left, viewportWidth - popoverWidth - 8));
        setPosition(fallbackPos);
        return;
      }
    }

    const finalPlacement = opposite[placement];
    const finalPos = calcPosition(finalPlacement);
    finalPos.top = Math.max(8, Math.min(finalPos.top, viewportHeight - popoverHeight - 8));
    finalPos.left = Math.max(8, Math.min(finalPos.left, viewportWidth - popoverWidth - 8));
    setResolvedPlacement(finalPlacement);
    setPosition(finalPos);
  }, [placement]);

  useLayoutEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    updatePosition();

    const triggerEl = triggerRef.current;
    if (!triggerEl) return;

    const resizeObserver = new ResizeObserver(updatePosition);
    resizeObserver.observe(triggerEl);

    return () => resizeObserver.disconnect();
  }, [isOpen, placement, updatePosition]);

  useEffect(() => {
    if (!isOpen) setPosition(null);
  }, [isOpen]);

  const popoverContent = (
    <AnimatePresence>
      {isOpen && position && (
        <>
          <motion.div
            className="fixed inset-0 z-[9998] bg-transparent"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            aria-hidden="true"
          />
          <motion.div
            ref={popoverRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'pop-confirm-title' : undefined}
            aria-describedby={body ? 'pop-confirm-body' : undefined}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'fixed z-[9999] w-[280px] min-h-[80px] rounded-[12px] bg-surface border border-border shadow-[0_4px_24px_rgba(0,0,0,0.12)] p-4 flex flex-col gap-3',
              className
            )}
            style={{
              top: position.top,
              left: position.left,
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            {/* Arrow pointer */}
            <div
              className={cn(
                'absolute w-3 h-3 bg-surface border border-border rotate-45 border-t-0 border-l-0',
                resolvedPlacement === 'bottom' && 'top-[-6px] left-1/2 -translate-x-1/2 rotate-[225deg]',
                resolvedPlacement === 'top' && 'bottom-[-6px] left-1/2 -translate-x-1/2 rotate-45',
                resolvedPlacement === 'left' && 'right-[-6px] top-1/2 -translate-y-1/2 rotate-[-45deg]',
                resolvedPlacement === 'right' && 'left-[-6px] top-1/2 -translate-y-1/2 rotate-[135deg]',
              )}
            />
            
            {(title || body || icon) && (
              <div className="flex gap-3 relative z-10">
                {icon && (
                  <div className="flex-shrink-0 text-danger [&>svg]:w-5 [&>svg]:h-5">
                    {icon}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {title && (
                    <h3
                      id="pop-confirm-title"
                      className="text-sm font-semibold text-foreground"
                    >
                      {title}
                    </h3>
                  )}
                  {body && (
                    <p
                      id="pop-confirm-body"
                      className="text-sm text-text-muted mt-0.5"
                    >
                      {body}
                    </p>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex justify-end gap-2 mt-1 relative z-10">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isLoading}
                className="px-3 py-1.5 text-sm font-medium rounded-[8px] bg-surface-alt text-foreground border border-border hover:bg-surface-alt/80 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isLoading}
                className="px-3 py-1.5 text-sm font-medium rounded-[8px] bg-danger text-white hover:bg-danger/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-2"
              >
                {isLoading && (
                  <span
                    className="inline-block w-3.5 h-3.5 border-2 border-current border-r-transparent rounded-full animate-spin"
                    aria-hidden="true"
                  />
                )}
                {confirmText}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <div ref={triggerRef} className={triggerClassName || 'inline-block'}>
      {triggerWithProps}
      {typeof document !== 'undefined' &&
        createPortal(popoverContent, document.body)}
    </div>
  );
};

PopConfirm.displayName = 'PopConfirm';
