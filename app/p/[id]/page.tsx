"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPublicTournament, getBackendBaseUrl, Tournament, Player, Team } from "@/lib/api";
import { Trophy, User, Users, CheckCircle2, AlertCircle, XCircle, X } from "lucide-react";

// Rewrite photo URLs to use the same backend host the API uses.
// Cloud storage URLs (R2, S3, etc.) are passed through as-is.
function fixUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const backendHost = new URL(getBackendBaseUrl()).host;
    // Only rewrite URLs that point to the backend (local storage)
    if (parsed.host === backendHost || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return `${getBackendBaseUrl()}${parsed.pathname}`;
    }
    // Cloud storage URLs (R2, S3, etc.) — return as-is
    return url;
  } catch {
    // If it's already a relative path, just prepend the base
    return `${getBackendBaseUrl()}${url.startsWith('/') ? url : '/' + url}`;
  }
}

export default function PublicTournamentPage() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState<"players" | "teams">("players");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await getPublicTournament(tournamentId);
        setTournament(res.tournament);
        if (res.players) setPlayers(res.players);
        if (res.teams) setTeams(res.teams);
      } catch (err: any) {
        setError(err.message || "Failed to load tournament data.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [tournamentId]);

  // Group players by team for the Teams tab
  const playersByTeam = useMemo(() => {
    const grouped: Record<string, Player[]> = {};
    teams.forEach(t => {
      grouped[t.id] = [];
    });
    players.forEach(p => {
      if (p.team_id && grouped[p.team_id]) {
        grouped[p.team_id].push(p);
      }
    });
    // Sort players within each team by sold_at ascending
    Object.keys(grouped).forEach(teamId => {
      grouped[teamId].sort((a, b) => {
        if (!a.sold_at) return 1;
        if (!b.sold_at) return -1;
        return new Date(a.sold_at).getTime() - new Date(b.sold_at).getTime();
      });
    });
    return grouped;
  }, [players, teams]);

  if (loading) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="spinner border-primary w-8 h-8 mb-4"></div>
      <p className="text-text-muted">Loading tournament details...</p>
    </div>
  );

  if (error || !tournament) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Error</h2>
        <p className="text-text-muted">{error || "Tournament not found."}</p>
        <button onClick={() => router.push('/')} className="mt-6 text-primary hover:underline">
          Go Back
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header Banner */}
      <div className="relative w-full h-48 md:h-64 bg-surface-alt overflow-hidden">
        {tournament.logo_url ? (
          <img src={fixUrl(tournament.logo_url)!} alt={tournament.name} className="w-full h-full object-cover opacity-80" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-alt to-surface-highlight">
            <Trophy className="w-16 h-16 text-text-subtle opacity-50" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full p-6 text-center">
          <h1 className="text-2xl md:text-4xl font-extrabold text-foreground drop-shadow-lg">{tournament.name}</h1>
          <p className="text-text-muted font-semibold mt-2 flex items-center justify-center gap-4">
            <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {players.length} Players</span>
            <span className="flex items-center gap-1"><Trophy className="w-4 h-4" /> {teams.length} Teams</span>
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-8">
        {/* Tabs */}
        <div className="flex bg-surface border border-border rounded-xl p-1 mb-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab("players")}
            className={`flex-1 py-3 px-6 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === "players" ? "bg-primary text-primary-foreground shadow-md" : "text-text-muted hover:text-foreground hover:bg-surface-alt"
            }`}
          >
            <User className="w-4 h-4" /> Players
          </button>
          <button
            onClick={() => setActiveTab("teams")}
            className={`flex-1 py-3 px-6 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === "teams" ? "bg-primary text-primary-foreground shadow-md" : "text-text-muted hover:text-foreground hover:bg-surface-alt"
            }`}
          >
            <Users className="w-4 h-4" /> Teams
          </button>
        </div>

        {/* Players Tab Content */}
        {activeTab === "players" && (
          <div>
            {players.length === 0 ? (
              <p className="text-center text-text-muted py-12">No players registered yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {players.map((player) => {
                  const team = teams.find(t => t.id === player.team_id);
                  return (
                    <div
                      key={player.id}
                      onClick={() => setSelectedPlayer(player)}
                      className="bg-surface-alt border border-border rounded-2xl overflow-hidden cursor-pointer hover:border-primary/50 hover:shadow-xl transition-all flex flex-col group"
                    >
                      {/* Image Section */}
                      <div className="aspect-[3/4] w-full bg-surface overflow-hidden relative">
                        {player.photo_url ? (
                          <img 
                            src={fixUrl(player.photo_url)!} 
                            alt={player.full_name} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface to-surface-highlight">
                            <User className="w-1/3 h-1/3 text-text-subtle opacity-30" />
                          </div>
                        )}
                        
                        {/* Overlay ID Badge */}
                        <div className="absolute top-3 left-3">
                           <span className="bg-black/40 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-lg border border-white/10 shadow-lg">
                             #{player.sort_order}
                           </span>
                        </div>

                        {/* Text Overlay for Name and Role */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-12">
                           <h3 className="font-bold text-white text-lg leading-tight truncate drop-shadow-sm">{player.full_name}</h3>
                           <p className="text-white/70 text-xs font-semibold">{player.player_role}</p>
                        </div>
                      </div>

                      {/* Info Section */}
                      <div className="p-4 bg-surface-alt">
                        <div className="flex flex-wrap items-center gap-2">
                          {player.label && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded bg-blue-500/10 text-blue-500 uppercase border border-blue-500/20">
                              {player.label}
                            </span>
                          )}
                          {player.status === "Sold" && (
                            <>
                              <span className="text-[10px] font-bold px-2 py-1 rounded bg-green-500/10 text-green-500 flex items-center gap-1 border border-green-500/20">
                                <CheckCircle2 className="w-3 h-3" /> {player.sold_price} PTS
                              </span>
                              {team && (
                                <span className="text-[10px] font-bold px-2 py-1 rounded bg-primary/10 text-primary truncate max-w-[120px] border border-primary/20">
                                  {team.name}
                                </span>
                              )}
                            </>
                          )}
                          {player.status === "Unsold" && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded bg-orange-500/10 text-orange-500 flex items-center gap-1 border border-orange-500/20">
                              <AlertCircle className="w-3 h-3" /> UNSOLD
                            </span>
                          )}
                          {player.status === "Rejected" && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded bg-red-500/10 text-red-500 flex items-center gap-1 border border-red-500/20">
                              <XCircle className="w-3 h-3" /> REJECTED
                            </span>
                          )}
                          {player.status === "Pending" && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded bg-surface border border-border text-text-muted">
                              PENDING
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Teams Tab Content */}
        {activeTab === "teams" && (
          <div className="space-y-8">
            {teams.length === 0 ? (
              <p className="text-center text-text-muted py-12">No teams created yet.</p>
            ) : (
              teams.map(team => {
                const teamPlayers = playersByTeam[team.id] || [];
                return (
                  <div key={team.id} className="bg-surface-alt border border-border rounded-2xl overflow-hidden">
                    <div className="p-4 bg-surface border-b border-border flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-background overflow-hidden border border-border">
                          {team.logo_url ? (
                            <img src={fixUrl(team.logo_url)!} alt={team.name} className="w-full h-full object-cover" />
                          ) : (
                            <Trophy className="w-full h-full p-2 text-text-subtle" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-foreground">{team.name}</h3>
                          <p className="text-xs text-text-muted">{teamPlayers.length} Players</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4">
                      {teamPlayers.length === 0 ? (
                        <p className="text-sm text-text-muted italic py-2">No players bought yet.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {teamPlayers.map(player => (
                            <div key={player.id} onClick={() => setSelectedPlayer(player)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface cursor-pointer transition-colors border border-transparent hover:border-border">
                              <div className="w-10 h-10 rounded-full bg-background overflow-hidden shrink-0">
                                {player.photo_url ? (
                                  <img src={fixUrl(player.photo_url)!} alt={player.full_name} className="w-full h-full object-cover" />
                                ) : (
                                  <User className="w-full h-full p-2 text-text-subtle" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-foreground truncate">{player.full_name}</p>
                                <p className="text-xs text-text-muted">{player.player_role}</p>
                              </div>
                              <div className="flex flex-col items-end justify-center gap-1">
                                <p className="text-xs font-bold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">{player.sold_price}</p>
                                {player.label && (
                                  <p className="text-[9px] font-bold text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded uppercase">{player.label}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Player Detail Modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPlayer(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-surface-alt border border-border rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedPlayer(null)} className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-background/80 border border-border hover:bg-surface text-text-muted hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>

            <div className="relative w-full aspect-square bg-surface overflow-hidden rounded-t-2xl">
              {selectedPlayer.photo_url ? (
                <img src={fixUrl(selectedPlayer.photo_url)!} alt={selectedPlayer.full_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-24 h-24 text-text-subtle opacity-40" />
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                <h2 className="text-2xl font-extrabold text-white">
                  <span className="text-primary mr-2">#{selectedPlayer.sort_order}</span>
                  {selectedPlayer.full_name}
                </h2>
                <p className="text-white/80 font-semibold">{selectedPlayer.player_role}</p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Status Badge */}
              <div className={`text-center p-3 rounded-xl font-bold text-sm ${
                selectedPlayer.status === 'Sold' ? 'bg-green-500/10 text-green-500' :
                selectedPlayer.status === 'Unsold' ? 'bg-orange-500/10 text-orange-500' :
                selectedPlayer.status === 'Rejected' ? 'bg-red-500/10 text-red-500' :
                'bg-surface border border-border text-text-muted'
              }`}>
                {selectedPlayer.status === 'Sold' ? (
                  <span className="flex flex-col items-center justify-center gap-1">
                    <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> SOLD FOR {selectedPlayer.sold_price} PTS</span>
                    {selectedPlayer.team_id && teams.find(t => t.id === selectedPlayer.team_id) && (
                      <span className="opacity-80">to {teams.find(t => t.id === selectedPlayer.team_id)?.name}</span>
                    )}
                  </span>
                ) : selectedPlayer.status === 'Unsold' ? (
                  <span className="flex items-center justify-center gap-2"><AlertCircle className="w-4 h-4" /> UNSOLD</span>
                ) : selectedPlayer.status === 'Rejected' ? (
                  <span className="flex items-center justify-center gap-2"><XCircle className="w-4 h-4" /> REJECTED</span>
                ) : (
                  <span>PENDING AUCTION</span>
                )}
              </div>

              {/* Detail Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-background border border-border rounded-xl p-3 text-center">
                  <p className="text-[10px] text-text-subtle uppercase tracking-wider mb-1">Age</p>
                  <p className="font-bold text-foreground text-lg">{selectedPlayer.age || '--'}</p>
                </div>
                <div className="bg-background border border-border rounded-xl p-3 text-center">
                  <p className="text-[10px] text-text-subtle uppercase tracking-wider mb-1">Player Role</p>
                  <p className="font-bold text-foreground text-lg">{selectedPlayer.player_role || '--'}</p>
                </div>
                <div className="bg-background border border-border rounded-xl p-3 text-center">
                  <p className="text-[10px] text-text-subtle uppercase tracking-wider mb-1">Batting Hand</p>
                  <p className="font-bold text-foreground text-lg">{selectedPlayer.batting_hand || '--'}</p>
                </div>
                <div className="bg-background border border-border rounded-xl p-3 text-center">
                  <p className="text-[10px] text-text-subtle uppercase tracking-wider mb-1">Bowling Arm</p>
                  <p className="font-bold text-foreground text-lg">{selectedPlayer.bowling_arm || '--'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
