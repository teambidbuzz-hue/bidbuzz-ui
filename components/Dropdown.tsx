'use client';

import React, { useState, useRef, useEffect, ReactNode } from 'react';

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

interface DropdownProps {
    trigger: ReactNode;
    children: ReactNode;
    align?: 'left' | 'right';
    className?: string;
    contentClassName?: string;
}

export function Dropdown({ trigger, children, align = 'left', className, contentClassName }: DropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const toggleDropdown = () => setIsOpen((prev) => !prev);
    const closeDropdown = () => setIsOpen(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            if (target?.closest?.('.aceui-pop-confirm') || target?.closest?.('[role="dialog"]')) {
                return;
            }

            if (dropdownRef.current && !dropdownRef.current.contains(target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div ref={dropdownRef} className={cn("relative inline-block text-left h-full", className)}>
            <div onClick={toggleDropdown} className="cursor-pointer h-full">
                {trigger}
            </div>

            {isOpen && (
                <div
                    className={cn(
                        "absolute z-[100] mt-1.5 min-w-[160px] rounded-xl bg-surface border border-border shadow-lg p-1.5 animate-scale-in duration-200",
                        align === 'right' ? 'right-0' : 'left-0',
                        contentClassName
                    )}
                    onClick={closeDropdown}
                >
                    {children}
                </div>
            )}
        </div>
    );
}

interface DropdownItemProps {
    children: ReactNode;
    onClick?: () => void;
    className?: string;
    isActive?: boolean;
}

export function DropdownItem({ children, onClick, className, isActive }: DropdownItemProps) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "px-3 py-2 text-[13px] rounded-lg cursor-pointer transition-colors flex items-center gap-2",
                isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-text hover:bg-surface-alt hover:text-foreground",
                className
            )}
        >
            {children}
        </div>
    );
}
