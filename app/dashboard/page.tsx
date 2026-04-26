"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { getTournaments, Tournament } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { Plus, Trophy } from "lucide-react";

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/auth");
    }
  }, [isAuthenticated, isLoading, router]);

  const fetchTournaments = useCallback(async () => {
    try {
      const data = await getTournaments();
      setTournaments(data);
    } catch {
      // User will see empty state
    } finally {
      setLoadingTournaments(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchTournaments();
  }, [isAuthenticated, fetchTournaments]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner spinner-dark w-7 h-7" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="animate-fade-in-up">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Tournaments</h2>
              <p className="text-text-muted text-sm mt-0.5">
                {tournaments.length > 0
                  ? `${tournaments.length} tournament${tournaments.length > 1 ? "s" : ""} created`
                  : "Get started by creating your first tournament"}
              </p>
            </div>
            <button
              onClick={() => router.push("/tournaments/create")}
              className="btn-primary !w-auto !py-2 !px-4 !text-sm"
              id="create-tournament-button"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              New Tournament
            </button>
          </div>

          {/* Loading */}
          {loadingTournaments && (
            <div className="flex items-center justify-center py-24">
              <div className="spinner spinner-dark w-7 h-7" />
            </div>
          )}

          {/* Empty State */}
          {!loadingTournaments && tournaments.length === 0 && (
            <div className="card p-16 text-center max-w-md mx-auto">
              <img
                src="/brand/logo.png"
                alt="BidBuzz Logo"
                className="w-20 h-20 object-contain mx-auto mb-5 opacity-40 grayscale"
              />
              <h3 className="text-lg font-bold mb-1.5">No tournaments yet</h3>
              <p className="text-text-muted text-sm mb-6 max-w-xs mx-auto">
                Create your first cricket auction tournament and start building your league.
              </p>
              <button
                onClick={() => router.push("/tournaments/create")}
                className="btn-primary !w-auto !py-2 !px-4 !text-sm inline-flex"
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} />
                Create Tournament
              </button>
            </div>
          )}

          {/* Tournament Grid */}
          {!loadingTournaments && tournaments.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {tournaments.map((tournament, index) => (
                <div
                  key={tournament.id}
                  className="card card-hover overflow-hidden cursor-pointer group"
                  onClick={() => router.push(`/tournaments/${tournament.id}`)}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  {/* Full-width Logo Banner */}
                  <div className="h-36 bg-gradient-to-br from-primary/[0.07] via-accent/[0.04] to-primary-light relative flex items-center justify-center overflow-hidden">
                    {/* Decorative pattern */}
                    <div className="absolute inset-0 bg-dots opacity-40" />
                    {tournament.logo_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={tournament.logo_url}
                        alt={`${tournament.name} logo`}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="relative z-10 w-16 h-16 rounded-2xl bg-surface/90 border border-border flex items-center justify-center shadow-sm">
                        <Trophy className="w-8 h-8 text-primary/60" strokeWidth={1.5} />
                      </div>
                    )}
                    {/* Season badge */}
                    <span className="absolute top-3 right-3 z-10 badge badge-green shadow-sm">
                      {tournament.season}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="p-5 pb-4">
                    <h3 className="text-[15px] font-bold text-foreground truncate group-hover:text-primary transition-colors">
                      {tournament.name}
                    </h3>
                    <p className="text-xs text-text-subtle mt-0.5 truncate">{tournament.club_name}</p>
                  </div>

                  {/* Stats */}
                  <div className="px-5 pb-4">
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="rounded-xl bg-gradient-to-b from-primary-light/50 to-primary-light/20 border border-primary/[0.08] p-2.5 text-center">
                        <p className="text-sm font-extrabold text-primary leading-none">
                          {Number(tournament.team_budget).toLocaleString()}
                        </p>
                        <p className="text-[10px] font-medium text-primary/60 mt-1 uppercase tracking-wider">Team Budget</p>
                      </div>
                      <div className="rounded-xl bg-gradient-to-b from-accent-light/50 to-accent-light/20 border border-accent/[0.08] p-2.5 text-center">
                        <p className="text-sm font-extrabold text-accent leading-none">
                          {tournament.max_players_per_team}
                        </p>
                        <p className="text-[10px] font-medium text-accent/60 mt-1 uppercase tracking-wider">Max Players</p>
                      </div>
                      <div className="rounded-xl bg-gradient-to-b from-surface-alt to-background border border-border p-2.5 text-center">
                        <p className="text-sm font-extrabold text-foreground leading-none">
                          {Number(tournament.player_base_price).toLocaleString()}
                        </p>
                        <p className="text-[10px] font-medium text-text-subtle mt-1 uppercase tracking-wider">Player Base Price</p>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-3 border-t border-border bg-surface-alt/50 flex items-center justify-between">
                    <span className="text-[11px] text-text-subtle">
                      {new Date(tournament.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
