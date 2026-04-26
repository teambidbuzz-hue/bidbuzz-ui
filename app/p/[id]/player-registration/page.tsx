"use client";

import React, { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { getPublicTournament, publicRegisterPlayer, Tournament, ApiError } from "@/lib/api";
import { ImagePlus, User, AlertCircle, CheckCircle2 } from "lucide-react";

export default function PlayerRegistrationPage() {
  const params = useParams();
  const tournamentId = params.id as string;
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isClosed, setIsClosed] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    full_name: "",
    age: "",
    phone_number: "",
    batting_hand: "",
    player_role: "",
    bowling_arm: "N/A",
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await getPublicTournament(tournamentId);
        setTournament(res.tournament);
        if (res.tournament.is_registration_closed) {
          setIsClosed(true);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load tournament.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tournamentId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError("Photo must be under 10MB."); return; }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (photoFile) fd.append("photo", photoFile);

      await publicRegisterPlayer(tournamentId, fd);
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError && err.data?.errors) {
        setFieldErrors(err.data.errors as Record<string, string[]>);
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else { setError("Something went wrong."); }
    } finally { setSubmitting(false); }
  };

  const renderRadio = (id: string, label: string, options: string[]) => (
    <div>
      <label className="block text-sm font-medium mb-1.5 text-foreground">{label} <span className="text-danger">*</span></label>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <label key={o} className={`cursor-pointer px-3 py-1.5 rounded-lg border text-[13px] transition-all duration-200 ${form[id as keyof typeof form] === o ? 'border-primary bg-primary/10 text-primary font-semibold shadow-sm' : 'border-border bg-surface-alt text-text-muted hover:border-text-subtle'}`}>
            <input type="radio" name={id} value={o} checked={form[id as keyof typeof form] === o} onChange={handleChange} className="hidden" />
            {o}
          </label>
        ))}
      </div>
      {fieldErrors[id] && <p className="mt-1 text-xs text-danger">{fieldErrors[id][0]}</p>}
    </div>
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="spinner w-8 h-8" /></div>;
  
  if (!tournament || (error && !tournament)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="card p-8 text-center max-w-sm w-full">
          <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Tournament Not Found</h1>
          <p className="text-text-muted text-sm">{error || "This tournament does not exist."}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="card p-8 text-center max-w-sm w-full animate-scale-in">
          <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Registration Successful!</h1>
          <p className="text-text-muted text-sm mb-6">Your registration for {tournament.name} has been submitted. The organizer will review your profile.</p>
          <button onClick={() => window.location.reload()} className="btn-secondary w-full">Register Another Player</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 animate-fade-in-up">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Tournament Header */}
        <div className="card overflow-hidden shadow-sm">
          {tournament.logo_url ? (
            <div className="w-full h-48 sm:h-56 relative bg-gradient-to-br from-primary/[0.07] via-accent/[0.04] to-primary-light flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-dots opacity-40" />
              {/* eslint-disable-next-line @next/next/no-img-element */ }
              <img src={tournament.logo_url} alt="Logo" className="absolute inset-0 w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-full h-32 sm:h-40 bg-gradient-to-br from-primary/[0.07] via-accent/[0.04] to-primary-light relative flex flex-col items-center justify-center border-b border-border overflow-hidden">
              <div className="absolute inset-0 bg-dots opacity-40" />
              <div className="relative z-10 w-16 h-16 rounded-2xl bg-surface/90 border border-border flex items-center justify-center shadow-sm mb-3">
                <span className="text-2xl font-black text-primary/60">{tournament.name.substring(0, 2).toUpperCase()}</span>
              </div>
            </div>
          )}
          <div className="p-6 text-center">
            <h1 className="text-2xl font-bold text-foreground">{tournament.name}</h1>
            <p className="text-primary font-semibold mt-1">{tournament.season}</p>
          </div>
        </div>

        {isClosed ? (
          <div className="card p-8 text-center bg-red-500/5 border-red-500/20 shadow-sm">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-600 mb-2">Registration Closed</h2>
            <p className="text-red-600/80 text-sm">The registration deadline for this tournament has passed.</p>
          </div>
        ) : (
          <div className="card overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border bg-surface-alt">
              <h2 className="text-lg font-bold">Player Registration</h2>
              <p className="text-sm text-text-muted mt-1">Complete your profile to enter the auction pool.</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Photo */}
              <div className="flex items-center gap-5 bg-surface-alt p-4 rounded-xl border border-border">
                <div className="w-20 h-20 rounded-full bg-background border border-border flex items-center justify-center overflow-hidden shrink-0 cursor-pointer shadow-sm" onClick={() => fileRef.current?.click()}>
                  {photoPreview ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-text-subtle" strokeWidth={1.5} />
                  )}
                </div>
                <div>
                  <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary !py-1.5 !px-3 !text-xs mb-1.5">
                    <ImagePlus className="w-3.5 h-3.5 mr-1.5" />
                    Upload Photo
                  </button>
                  <p className="text-[11px] text-text-subtle">Square photo recommended. Max 10MB.</p>
                </div>
                <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
              </div>

              {/* Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-foreground">Full Name <span className="text-danger">*</span></label>
                  <input name="full_name" value={form.full_name} onChange={handleChange} className="input-field" placeholder="E.g. Virat Kohli" required />
                  {fieldErrors.full_name && <p className="mt-1 text-xs text-danger">{fieldErrors.full_name[0]}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground">Phone Number <span className="text-danger">*</span></label>
                    <input name="phone_number" value={form.phone_number} onChange={handleChange} className="input-field" placeholder="+1..." required />
                    {fieldErrors.phone_number && <p className="mt-1 text-xs text-danger">{fieldErrors.phone_number[0]}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground">Age <span className="text-[10px] font-normal text-text-subtle ml-1">(Optional)</span></label>
                    <input name="age" type="number" min={1} max={100} value={form.age} onChange={handleChange} className="input-field" placeholder="25" />
                    {fieldErrors.age && <p className="mt-1 text-xs text-danger">{fieldErrors.age[0]}</p>}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                {renderRadio("player_role", "Player Role", ["Batsman", "Bowler", "Wicketkeeper", "Batting All-rounder", "Bowling All-rounder"])}
                {renderRadio("batting_hand", "Batting Hand", ["Right", "Left"])}
                {renderRadio("bowling_arm", "Bowling Arm", ["Right-arm", "Left-arm", "N/A"])}
              </div>

              {(error && !error.includes("Tournament")) && <p className="text-sm text-danger bg-danger/5 border border-danger/10 rounded-lg p-3 flex items-start gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}</p>}

              <button type="submit" disabled={submitting} className="btn-primary w-full py-3.5 text-[15px] shadow-primary/20">
                {submitting ? <><div className="spinner border-white" /><span>Registering...</span></> : "Submit Registration"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
