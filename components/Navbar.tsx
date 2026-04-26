"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { LogOut } from "lucide-react";

export default function Navbar() {
  const router = useRouter();
  const { organizer, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace("/auth");
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-surface/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <img
            src="/brand/logo.png"
            alt="BidBuzz Logo"
            className="w-10 h-10 object-contain"
          />
          <span className="text-lg font-bold tracking-tight">
            Bid<span className="text-primary">Buzz</span>
          </span>
        </button>

        <div className="flex items-center gap-3">
          {organizer && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-alt border border-border">
              <div className="w-6 h-6 rounded-full bg-primary-light flex items-center justify-center">
                <span className="text-xs font-bold text-primary">
                  {organizer.email[0].toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-text-muted max-w-[180px] truncate">
                {organizer.email}
              </span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="btn-secondary !py-2 !px-3.5 text-xs"
            id="logout-button"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}
