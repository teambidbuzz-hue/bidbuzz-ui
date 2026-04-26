"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getTournament, updateTournament, ApiError, Tournament } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { ChevronLeft, ImagePlus, AlertCircle, CheckCircle2 } from "lucide-react";

export default function EditTournamentPage() {
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.id as string;
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    season: "",
    club_name: "",
    team_budget: "",
    max_players_per_team: "",
    player_base_price: "",
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/auth");
  }, [isAuthenticated, authLoading, router]);

  const fetchTournament = useCallback(async () => {
    try {
      const t: Tournament = await getTournament(tournamentId);
      setForm({
        name: t.name,
        season: t.season,
        club_name: t.club_name,
        team_budget: t.team_budget,
        max_players_per_team: String(t.max_players_per_team),
        player_base_price: t.player_base_price,
      });
      setCurrentLogoUrl(t.logo_url);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        router.replace("/dashboard");
      } else {
        setError("Failed to load tournament.");
      }
    } finally {
      setLoading(false);
    }
  }, [tournamentId, router]);

  useEffect(() => {
    if (isAuthenticated && tournamentId) fetchTournament();
  }, [isAuthenticated, tournamentId, fetchTournament]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
    setError("");
    setSuccess("");
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError("Logo must be under 10MB."); return; }
    setLogoFile(file);
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, val]) => formData.append(key, val));
      if (logoFile) formData.append("logo", logoFile);

      await updateTournament(tournamentId, formData);
      router.push(`/tournaments/${tournamentId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.data?.errors && typeof err.data.errors === "object") {
          setFieldErrors(err.data.errors as Record<string, string[]>);
        } else {
          setError(err.message);
        }
      } else {
        setError("Failed to update tournament.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner spinner-dark w-7 h-7" />
      </div>
    );
  }

  const displayLogo = logoPreview || currentLogoUrl;

  const renderField = (
    id: string,
    label: string,
    type: string = "text",
    placeholder: string = "",
    extraProps: Record<string, unknown> = {}
  ) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground mb-1.5">
        {label} <span className="text-danger">*</span>
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={form[id as keyof typeof form]}
        onChange={handleChange}
        placeholder={placeholder}
        className="input-field"
        required
        {...extraProps}
      />
      {fieldErrors[id] && <p className="mt-1 text-xs text-danger">{fieldErrors[id][0]}</p>}
    </div>
  );

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="animate-fade-in-up">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push(`/tournaments/${tournamentId}`)} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-surface-alt border border-border text-text-muted hover:text-primary hover:border-primary/20 hover:bg-primary-light/30 transition-all cursor-pointer">
                <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
              </button>
              <h2 className="text-2xl font-bold tracking-tight">Edit Tournament</h2>
            </div>
            <p className="text-text-muted text-sm mt-1.5 ml-11">Update your tournament details and settings</p>
          </div>

          {/* Success */}
          {success && (
            <div className="flex items-center gap-2 text-sm text-primary bg-primary-light/60 border border-primary/10 rounded-lg p-3 mb-5 animate-scale-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Tournament Details */}
            <div className="card p-6 space-y-4">
              <h3 className="text-xs font-bold text-text-subtle uppercase tracking-widest">
                Tournament Details
              </h3>

              {renderField("name", "Tournament Name", "text", "e.g. Premier League Season 5")}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {renderField("season", "Season / Year", "text", "e.g. 2025")}
                {renderField("club_name", "Club / League Name", "text", "e.g. City Cricket Club")}
              </div>
            </div>

            {/* Auction Settings */}
            <div className="card p-6 space-y-4">
              <h3 className="text-xs font-bold text-text-subtle uppercase tracking-widest">
                Auction Settings
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {renderField("team_budget", "Team Budget", "number", "e.g. 10000", { min: 0, step: 1 })}
                {renderField("max_players_per_team", "Max Players / Team", "number", "e.g. 15", { min: 1, step: 1 })}
                {renderField("player_base_price", "Player Base Price", "number", "e.g. 100", { min: 0, step: 1 })}
              </div>
            </div>

            {/* Logo */}
            <div className="card p-6 space-y-4">
              <h3 className="text-xs font-bold text-text-subtle uppercase tracking-widest">
                Tournament Logo
              </h3>

              {displayLogo ? (
                <div className="flex items-center gap-4 p-3 rounded-xl bg-surface-alt border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={displayLogo} alt="Logo" className="w-16 h-16 object-contain rounded-lg" />
                  <div className="flex-1 min-w-0">
                    {logoFile ? (
                      <>
                        <p className="text-sm font-medium truncate">{logoFile.name}</p>
                        <p className="text-xs text-text-subtle">{(logoFile.size / 1024).toFixed(0)} KB • New upload</p>
                      </>
                    ) : (
                      <p className="text-sm font-medium text-text-muted">Current logo</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-ghost text-xs text-primary">
                      Change
                    </button>
                    {logoFile && (
                      <button type="button" onClick={handleRemoveLogo} className="btn-ghost text-xs text-danger">
                        Undo
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-border rounded-xl
                    cursor-pointer hover:border-primary/40 hover:bg-primary-light/20 transition-all duration-200"
                >
                  <div className="w-10 h-10 rounded-xl bg-surface-alt border border-border flex items-center justify-center mb-3">
                    <ImagePlus className="w-5 h-5 text-text-subtle" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-medium">Click to upload logo</p>
                  <p className="text-xs text-text-subtle mt-0.5">PNG, JPG, SVG or WebP • Max 10MB</p>
                </div>
              )}

              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" id="logo-upload" />
              {fieldErrors.logo && <p className="text-xs text-danger">{fieldErrors.logo[0]}</p>}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 text-sm text-danger bg-danger/5 border border-danger/10 rounded-lg p-3 animate-scale-in">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button type="submit" disabled={isSubmitting} className="btn-primary !w-auto flex-1 sm:flex-none sm:min-w-[200px]" id="update-tournament-button">
                {isSubmitting ? <><div className="spinner" /><span>Saving...</span></> : "Save Changes"}
              </button>
              <button type="button" onClick={() => router.push("/dashboard")} className="btn-secondary hidden sm:inline-flex">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
