"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { getPublicAuctionState, getBackendBaseUrl, Tournament, Player, AuctionHistoryRecord } from "@/lib/api";
import { Realtime } from "ably";
import { Trophy, Gavel, User, AlertCircle, XCircle, CheckCircle2, X, PartyPopper, Eye } from "lucide-react";

type ResolvedResult = {
  action: "Sold" | "Unsold" | "Rejected";
  player: Player;
  sold_price?: number | null;
  team_name?: string | null;
};

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

export default function PublicAuctionPage() {
  const params = useParams();
  const tournamentId = params.id as string;
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [livePlayer, setLivePlayer] = useState<Player | null>(null);
  const [history, setHistory] = useState<AuctionHistoryRecord[]>([]);
  const [isUnsoldRound, setIsUnsoldRound] = useState(false);
  const [resolvedResult, setResolvedResult] = useState<ResolvedResult | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<{ player: Player; record?: AuctionHistoryRecord } | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"connecting" | "live" | "result" | "no_live" | "finished">("connecting");
  const [unsoldCount, setUnsoldCount] = useState(0);
  const [viewerCount, setViewerCount] = useState(0);
  const finishedTimerRef = useRef<NodeJS.Timeout | null>(null);

  const ablyRef = useRef<Realtime | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startNoLiveTimeout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setStatus(prev => prev === "connecting" ? "no_live" : prev);
    }, 15000);
  };

  useEffect(() => {
    async function load() {
      try {
        const res = await getPublicAuctionState(tournamentId);
        setTournament(res.tournament);
        setLivePlayer(res.live_player);
        setHistory(res.history);
        
        if (!res.live_player) {
          startNoLiveTimeout();
        } else {
          setStatus("live");
        }

        const ablyKey = process.env.NEXT_PUBLIC_ABLY_KEY;
        if (!ablyKey) {
          console.error("NEXT_PUBLIC_ABLY_KEY not set!");
          return;
        }

        console.log("[Ably] Connecting to channel: public-auction-" + tournamentId);
        const clientId = `viewer-${Math.random().toString(36).substring(2, 10)}`;
        const ably = new Realtime({ key: ablyKey, clientId });
        ablyRef.current = ably;

        ably.connection.on('connected', () => console.log("[Ably] Connected!"));
        ably.connection.on('failed', (s) => console.error("[Ably] Failed:", s));

        const channel = ably.channels.get(`public-auction-${tournamentId}`);

        // --- Presence: track live viewer count ---
        try {
          await channel.presence.enter({ role: 'viewer' });
          const members = await channel.presence.get();
          setViewerCount(members.length);

          channel.presence.subscribe('enter', () => {
            channel.presence.get().then(m => setViewerCount(m.length)).catch(() => {});
          });
          channel.presence.subscribe('leave', () => {
            channel.presence.get().then(m => setViewerCount(m.length)).catch(() => {});
          });
        } catch (presenceErr) {
          console.warn("[Ably] Presence error (non-fatal):", presenceErr);
        }

        channel.subscribe("player.picked", (message) => {
          console.log("[Ably] player.picked:", message.data);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          if (finishedTimerRef.current) clearTimeout(finishedTimerRef.current);
          setResolvedResult(null);
          setLivePlayer(message.data.player);
          setIsUnsoldRound(message.data.is_unsold_round || false);
          setStatus("live");
        });

        const handleResolvedEvent = (message: any, action: "Sold" | "Unsold" | "Rejected") => {
          console.log(`[Ably] player.${action.toLowerCase()}:`, message.data);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          if (finishedTimerRef.current) clearTimeout(finishedTimerRef.current);
          const player = message.data.player;
          const pendingCount = message.data.pending_count ?? null;
          const eventUnsoldCount = message.data.unsold_count ?? 0;

          setResolvedResult({
            action,
            player,
            sold_price: action === "Sold" ? player.sold_price : null,
            team_name: action === "Sold" ? message.data.team_name : null,
          });
          setStatus("result");
          setUnsoldCount(eventUnsoldCount);

          const historyEntry: any = { id: Date.now(), action, sold_price: action === "Sold" ? player.sold_price : null, player };
          if (action === "Sold" && message.data.team_name) {
            historyEntry.team = { name: message.data.team_name };
          }
          setHistory(prev => [...prev, historyEntry]);

          // If this was the last pending player, show finished after 6 seconds
          if (pendingCount !== null && pendingCount === 0) {
            finishedTimerRef.current = setTimeout(() => {
              setStatus("finished");
            }, 6000);
          }
        };

        channel.subscribe("player.sold", (m) => handleResolvedEvent(m, "Sold"));
        channel.subscribe("player.unsold", (m) => handleResolvedEvent(m, "Unsold"));
        channel.subscribe("player.rejected", (m) => handleResolvedEvent(m, "Rejected"));

      } catch (err: any) {
        setError(err.message || "Failed to load auction state.");
      } finally {
        setLoading(false);
      }
    }
    
    load();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (finishedTimerRef.current) clearTimeout(finishedTimerRef.current);
      if (ablyRef.current) {
        ablyRef.current.close();
        ablyRef.current = null;
      }
    };
  }, [tournamentId]);

  if (loading) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="spinner border-primary w-8 h-8 mb-4"></div>
      <p className="text-text-muted">Loading auction...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Error</h2>
        <p className="text-text-muted">{error}</p>
      </div>
    </div>
  );

  if (!tournament) return null;

  // Determine the player to show (either the live player or the resolved one)
  const displayPlayer = resolvedResult?.player || livePlayer;

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
          <div className="flex items-center justify-center gap-3 mt-1">
            <p className="text-primary font-semibold flex items-center gap-2">
              <Gavel className="w-4 h-4" /> Live Auction
            </p>
            {viewerCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-text-muted bg-surface/80 backdrop-blur-sm border border-border px-2.5 py-1 rounded-full">
                <Eye className="w-3.5 h-3.5" />
                {viewerCount} {viewerCount === 1 ? 'viewer' : 'viewers'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Live Area */}
        <div className="lg:col-span-2">
          {isUnsoldRound && (status === "live" || status === "result") && (
            <div className="bg-orange-500/10 border border-orange-500/20 text-orange-500 rounded-xl p-3 mb-6 text-center font-bold flex items-center justify-center gap-2">
              <AlertCircle className="w-5 h-5" /> UNSOLD PLAYERS ROUND
            </div>
          )}

          {/* Connecting State */}
          {status === "connecting" && (
            <div className="bg-surface-alt border border-border rounded-2xl p-12 text-center shadow-sm">
              <div className="spinner border-primary w-8 h-8 mb-4 mx-auto"></div>
              <h2 className="text-xl font-bold mb-2">Connecting live...</h2>
              <p className="text-text-muted text-sm">Waiting for the next player to be brought up for auction.</p>
            </div>
          )}

          {/* No Live State */}
          {status === "no_live" && (
            <div className="bg-surface-alt border border-border rounded-2xl p-12 text-center shadow-sm">
              <Gavel className="w-12 h-12 text-text-subtle mx-auto mb-4 opacity-50" />
              <h2 className="text-xl font-bold mb-2">No live auction happening right now</h2>
              <p className="text-text-muted text-sm">The organizer might be taking a break, hasn&apos;t started yet, or the auction may have finished.</p>
            </div>
          )}

          {/* Auction Finished State */}
          {status === "finished" && (
            <div className="bg-surface-alt border border-border rounded-2xl p-12 text-center shadow-sm">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
                <PartyPopper className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-extrabold mb-3">Auction Round Finished! 🎉</h2>
              <p className="text-text-muted text-sm mb-6">All players in this round have been auctioned.</p>
              
              {unsoldCount > 0 && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 text-center">
                  <p className="text-orange-500 font-bold text-sm flex items-center justify-center gap-2 mb-1">
                    <AlertCircle className="w-4 h-4" /> {unsoldCount} Unsold Player{unsoldCount > 1 ? 's' : ''}
                  </p>
                  <p className="text-text-muted text-xs">An unsold players round may happen next. Stay tuned!</p>
                </div>
              )}

              {unsoldCount === 0 && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                  <p className="text-green-500 font-bold text-sm flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> All players have been sold or resolved!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Live Player Card */}
          {(status === "live" || status === "result") && displayPlayer && (
            /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
            <div onClick={() => setSelectedPlayer({ player: displayPlayer })} className={`bg-surface-alt border rounded-2xl overflow-hidden shadow-xl transition-all duration-500 cursor-pointer hover:shadow-2xl ${
              status === "result" && resolvedResult?.action === "Sold" ? "border-green-500 ring-2 ring-green-500/30" :
              status === "result" && resolvedResult?.action === "Unsold" ? "border-orange-500 ring-2 ring-orange-500/30" :
              status === "result" && resolvedResult?.action === "Rejected" ? "border-red-500 ring-2 ring-red-500/30" :
              "border-border"
            }`}>
              <div className="p-6 bg-gradient-to-b from-primary/10 to-transparent border-b border-border text-center relative">
                {/* Live badge or Result badge */}
                {status === "live" && (
                  <span className="absolute top-4 right-4 flex items-center gap-1.5 text-xs font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded-full animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span> LIVE
                  </span>
                )}

                {status === "result" && resolvedResult && (
                  <span className={`absolute top-4 right-4 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${
                    resolvedResult.action === "Sold" ? "text-green-500 bg-green-500/10" :
                    resolvedResult.action === "Unsold" ? "text-orange-500 bg-orange-500/10" :
                    "text-red-500 bg-red-500/10"
                  }`}>
                    {resolvedResult.action === "Sold" ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                     resolvedResult.action === "Unsold" ? <AlertCircle className="w-3.5 h-3.5" /> :
                     <XCircle className="w-3.5 h-3.5" />}
                    {resolvedResult.action.toUpperCase()}
                  </span>
                )}
                
                <div className="w-32 h-32 mx-auto rounded-full bg-surface border-4 border-background shadow-lg overflow-hidden flex items-center justify-center mb-4">
                  {displayPlayer.photo_url ? (
                    <img src={fixUrl(displayPlayer.photo_url)!} alt={displayPlayer.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-12 h-12 text-text-subtle" />
                  )}
                </div>
                
                <h2 className="text-3xl font-extrabold text-foreground mb-1">
                  <span className="text-primary mr-2">#{displayPlayer.sort_order}</span>
                  {displayPlayer.full_name}
                </h2>
                <p className="text-lg font-semibold text-text-muted">{displayPlayer.player_role}</p>
              </div>

              {/* Result Banner */}
              {status === "result" && resolvedResult && (
                <div className={`p-4 text-center font-extrabold text-xl ${
                  resolvedResult.action === "Sold" ? "bg-green-500/10 text-green-500" :
                  resolvedResult.action === "Unsold" ? "bg-orange-500/10 text-orange-500" :
                  "bg-red-500/10 text-red-500"
                }`}>
                  {resolvedResult.action === "Sold" && (
                    <div className="flex flex-col items-center gap-1">
                      <span className="flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-6 h-6" /> SOLD FOR {resolvedResult.sold_price} PTS!
                      </span>
                      {resolvedResult.team_name && (
                        <span className="text-sm font-semibold opacity-80">to {resolvedResult.team_name}</span>
                      )}
                    </div>
                  )}
                  {resolvedResult.action === "Unsold" && (
                    <span className="flex items-center justify-center gap-2">
                      <AlertCircle className="w-6 h-6" /> UNSOLD
                    </span>
                  )}
                  {resolvedResult.action === "Rejected" && (
                    <span className="flex items-center justify-center gap-2">
                      <XCircle className="w-6 h-6" /> REJECTED
                    </span>
                  )}
                </div>
              )}

              <div className="p-6 grid grid-cols-3 gap-4 text-center divide-x divide-border">
                <div>
                  <p className="text-xs text-text-subtle uppercase tracking-wider mb-1">Age</p>
                  <p className="font-bold text-foreground">{displayPlayer.age || '--'}</p>
                </div>
                <div>
                  <p className="text-xs text-text-subtle uppercase tracking-wider mb-1">Batting</p>
                  <p className="font-bold text-foreground">{displayPlayer.batting_hand || '--'}</p>
                </div>
                <div>
                  <p className="text-xs text-text-subtle uppercase tracking-wider mb-1">Bowling</p>
                  <p className="font-bold text-foreground">{displayPlayer.bowling_arm || '--'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* History Area */}
        <div className="lg:col-span-1">
          <div className="bg-surface-alt border border-border rounded-2xl p-5 shadow-sm sticky top-6 max-h-[80vh] overflow-y-auto">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              Auction History
            </h3>
            
            {history.length === 0 ? (
              <p className="text-text-muted text-sm text-center py-6">No players auctioned yet.</p>
            ) : (
              <div className="space-y-3">
                {[...history].reverse().map((record, idx) => (
                  <div key={`${record.id}-${idx}`} onClick={() => record.player && setSelectedPlayer({ player: record.player, record })} className="p-3 bg-background border border-border rounded-xl flex items-center gap-3 cursor-pointer hover:border-primary/40 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-surface overflow-hidden shrink-0">
                      {record.player?.photo_url ? (
                        <img src={fixUrl(record.player.photo_url)!} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-full h-full p-2 text-text-subtle" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        <span className="text-primary font-bold">#{record.player?.sort_order}</span>{' '}
                        {record.player?.full_name}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {record.action === 'Sold' ? (
                          <>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> {record.sold_price} PTS
                            </span>
                            {(record as any).team?.name && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                → {(record as any).team.name}
                              </span>
                            )}
                          </>
                        ) : record.action === 'Unsold' ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> UNSOLD
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> REJECTED
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Player Detail Modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPlayer(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-surface-alt border border-border rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button onClick={() => setSelectedPlayer(null)} className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-background/80 border border-border hover:bg-surface text-text-muted hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>

            {/* Player Photo */}
            <div className="relative w-full aspect-square bg-surface overflow-hidden rounded-t-2xl">
              {selectedPlayer.player.photo_url ? (
                <img src={fixUrl(selectedPlayer.player.photo_url)!} alt={selectedPlayer.player.full_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-24 h-24 text-text-subtle opacity-40" />
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                <h2 className="text-2xl font-extrabold text-white">
                  <span className="text-primary mr-2">#{selectedPlayer.player.sort_order}</span>
                  {selectedPlayer.player.full_name}
                </h2>
                <p className="text-white/80 font-semibold">{selectedPlayer.player.player_role}</p>
              </div>
            </div>

            {/* Player Stats */}
            <div className="p-5 space-y-4">
              {/* Status Badge */}
              {selectedPlayer.record && (
                <div className={`text-center p-3 rounded-xl font-bold text-sm ${
                  selectedPlayer.record.action === 'Sold' ? 'bg-green-500/10 text-green-500' :
                  selectedPlayer.record.action === 'Unsold' ? 'bg-orange-500/10 text-orange-500' :
                  'bg-red-500/10 text-red-500'
                }`}>
                  {selectedPlayer.record.action === 'Sold' ? (
                    <span className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> SOLD FOR {selectedPlayer.record.sold_price} PTS
                      {(selectedPlayer.record as any).team?.name && (
                        <span className="opacity-80">→ {(selectedPlayer.record as any).team.name}</span>
                      )}
                    </span>
                  ) : selectedPlayer.record.action === 'Unsold' ? (
                    <span className="flex items-center justify-center gap-2"><AlertCircle className="w-4 h-4" /> UNSOLD</span>
                  ) : (
                    <span className="flex items-center justify-center gap-2"><XCircle className="w-4 h-4" /> REJECTED</span>
                  )}
                </div>
              )}

              {/* Detail Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-background border border-border rounded-xl p-3 text-center">
                  <p className="text-[10px] text-text-subtle uppercase tracking-wider mb-1">Age</p>
                  <p className="font-bold text-foreground text-lg">{selectedPlayer.player.age || '--'}</p>
                </div>
                <div className="bg-background border border-border rounded-xl p-3 text-center">
                  <p className="text-[10px] text-text-subtle uppercase tracking-wider mb-1">Player Role</p>
                  <p className="font-bold text-foreground text-lg">{selectedPlayer.player.player_role || '--'}</p>
                </div>
                <div className="bg-background border border-border rounded-xl p-3 text-center">
                  <p className="text-[10px] text-text-subtle uppercase tracking-wider mb-1">Batting Hand</p>
                  <p className="font-bold text-foreground text-lg">{selectedPlayer.player.batting_hand || '--'}</p>
                </div>
                <div className="bg-background border border-border rounded-xl p-3 text-center">
                  <p className="text-[10px] text-text-subtle uppercase tracking-wider mb-1">Bowling Arm</p>
                  <p className="font-bold text-foreground text-lg">{selectedPlayer.player.bowling_arm || '--'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
