"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getTournament, updateTournament, Tournament,
  getPlayers, createPlayer, updatePlayer, sellPlayer, revertPlayer, rejectPlayer, markUnsoldPlayer, resetPlayerToPending, Player, PlayerStatus,
  getTeams, createTeam, updateTeam, deleteTeam, Team,
  getAuctionHistory, AuctionHistoryRecord, pickRandomPlayer,
  ApiError,
} from "@/lib/api";
import { ChevronLeft, Plus, User, Shield, ImagePlus, Pencil, Trash2, CheckCircle, Search, ChevronDown, LayoutGrid, List, Gavel, Play, SkipForward, Users, XCircle, Trophy, Shuffle, ChevronRight, ToggleLeft, ToggleRight, Maximize, X, Eye, Link as LinkIcon, Share2, Copy } from "lucide-react";
import { PopConfirm } from "@/components/PopConfirm";
import { Dropdown, DropdownItem } from "@/components/Dropdown";

type Tab = "players" | "teams" | "auction" | "links";

const STATUS_COLORS: Record<PlayerStatus, string> = {
  Pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Rejected: "bg-red-100 text-red-700 border-red-200",
  Sold: "bg-green-100 text-green-700 border-green-200",
  Unsold: "bg-gray-100 text-gray-500 border-gray-200",
};

export default function TournamentViewPage() {
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.id as string;
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("players");

  // Modal state
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [sellingPlayer, setSellingPlayer] = useState<Player | null>(null);
  const [labelingPlayer, setLabelingPlayer] = useState<Player | null>(null);
  const [viewingPlayerDetails, setViewingPlayerDetails] = useState<Player | null>(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [showTeamViewModal, setShowTeamViewModal] = useState(false);
  const [viewingTeam, setViewingTeam] = useState<Team | null>(null);

  // Filters & View Mode
  const [playerViewMode, setPlayerViewMode] = useState<"table" | "grid">("table");
  const [playerSearch, setPlayerSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // Auction state
  const [auctionHistory, setAuctionHistory] = useState<AuctionHistoryRecord[]>([]);
  const [spinnerActive, setSpinnerActive] = useState(false);
  const [auctionSellingPlayer, setAuctionSellingPlayer] = useState<Player | null>(null);
  const [auctionProcessing, setAuctionProcessing] = useState<"unsold" | "reject" | false>(false);
  const [showPlayerDetails, setShowPlayerDetails] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(`bidbuzz_playerDetails_${tournamentId}`);
    return stored !== null ? stored === 'true' : true;
  });

  // Sync showPlayerDetails to localStorage
  useEffect(() => {
    localStorage.setItem(`bidbuzz_playerDetails_${tournamentId}`, String(showPlayerDetails));
  }, [showPlayerDetails, tournamentId]);
  const [fullscreenPlayer, setFullscreenPlayer] = useState(false);
  const [showTeamDetails, setShowTeamDetails] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(`bidbuzz_teamDetails_${tournamentId}`);
    return stored !== null ? stored === 'true' : true;
  });

  // Sync showTeamDetails to localStorage
  useEffect(() => {
    localStorage.setItem(`bidbuzz_teamDetails_${tournamentId}`, String(showTeamDetails));
  }, [showTeamDetails, tournamentId]);

  // Derive current auction player from history (last record with action === 'Pending')
  const currentAuctionPlayer = auctionHistory.find(h => h.action === 'Pending')?.player || null;

  const filteredPlayers = players.filter(p => {
    if (roleFilter !== "All" && p.player_role !== roleFilter) return false;
    if (statusFilter !== "All" && p.status !== statusFilter) return false;
    if (playerSearch) {
      const s = playerSearch.toLowerCase();
      return p.full_name.toLowerCase().includes(s) || p.sort_order.toString().includes(s);
    }
    return true;
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/auth");
  }, [isAuthenticated, authLoading, router]);

  const fetchData = useCallback(async () => {
    try {
      const [t, p, tm, hist] = await Promise.all([
        getTournament(tournamentId),
        getPlayers(tournamentId),
        getTeams(tournamentId),
        getAuctionHistory(tournamentId),
      ]);
      setTournament(t);
      setPlayers(p);
      setTeams(tm);
      setAuctionHistory(hist);
    } catch { router.replace("/dashboard"); }
    finally { setLoading(false); }
  }, [tournamentId, router]);

  useEffect(() => {
    if (isAuthenticated && tournamentId) fetchData();
  }, [isAuthenticated, tournamentId, fetchData]);

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="spinner spinner-dark w-7 h-7" /></div>;
  }
  if (!tournament) return null;

  const handleAuctionSoldFromModal = (updatedPlayer: Player, keepModalOpen = false) => {
    setPlayers(prev => prev.map(x => x.id === updatedPlayer.id ? updatedPlayer : x));
    // Remove Pending record from local history, add Sold record
    setAuctionHistory(prev => [
      ...prev.filter(h => !(h.action === 'Pending' && h.player.id === updatedPlayer.id)),
      { id: Date.now(), action: 'Sold', sold_price: updatedPlayer.sold_price ? Number(updatedPlayer.sold_price) : null, player: updatedPlayer }
    ]);
    if (!keepModalOpen) {
      setAuctionSellingPlayer(null);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Tournament Nav */}
      <nav className="sticky top-0 z-40 bg-surface/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.push("/dashboard")} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-alt border border-border text-text-muted hover:text-primary hover:border-primary/20 hover:bg-primary-light/30 transition-all text-xs font-medium cursor-pointer">
              <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
              Dashboard
            </button>
            <div className="w-px h-5 bg-border shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-sm font-bold truncate">{tournament.name}</h1>
              {tournament.season && (
                <span className="shrink-0 text-[10px] font-semibold text-text-muted bg-surface-alt px-1.5 py-0.5 rounded-md border border-border">
                  {tournament.season}
                </span>
              )}
            </div>
            <div className="hidden md:flex items-center gap-1.5">
              <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-primary-light text-primary border border-primary/10">
                Team Budget: {Number(tournament.team_budget).toLocaleString()}
              </span>
              <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-accent-light text-accent border border-accent/10">
                Max Players Per Team: {tournament.max_players_per_team}
              </span>
              <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-surface-alt text-foreground border border-border">
                Player Base Price: {Number(tournament.player_base_price).toLocaleString()}
              </span>
            </div>
          </div>
          <button onClick={() => router.push(`/tournaments/${tournamentId}/edit`)} className="btn-secondary !w-auto !py-1.5 !px-3 !text-xs shrink-0">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            Edit
          </button>
        </div>
        {/* Mobile stats */}
        <div className="flex md:hidden items-center gap-1.5 px-6 pb-2.5 flex-wrap">
          <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-primary-light text-primary border border-primary/10">Team Budget: {Number(tournament.team_budget).toLocaleString()}</span>
          <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-accent-light text-accent border border-accent/10">Max Players Per Team: {tournament.max_players_per_team}</span>
          <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-surface-alt text-foreground border border-border">Player Base Price: {Number(tournament.player_base_price).toLocaleString()}</span>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8 animate-fade-in-up">

        {/* Tabs & Actions Row */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="flex gap-1 p-1 bg-surface border border-border rounded-xl w-fit">
            {([
              { key: "players" as Tab, label: `Players (${players.length})` },
              { key: "teams" as Tab, label: `Teams (${teams.length})` },
              { key: "auction" as Tab, label: "Auction" },
              { key: "links" as Tab, label: "Links" },
            ]).map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${activeTab === tab.key ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-foreground"}`}>
                {tab.key === "auction" && <Gavel className="w-3.5 h-3.5" />}
                {tab.key === "links" && <LinkIcon className="w-3.5 h-3.5" />}
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "players" && (
            <button onClick={() => { setEditingPlayer(null); setShowPlayerModal(true); }} className="btn-primary !w-auto !py-2 !px-4 !text-sm">
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Add Player
            </button>
          )}
          {activeTab === "teams" && (
            <div className="flex items-center gap-3">
              <p className="hidden sm:block text-xs text-text-subtle mr-2">Budget & max players inherited</p>
              <button onClick={() => { setEditingTeam(null); setShowTeamModal(true); }} className="btn-primary !w-auto !py-2 !px-4 !text-sm">
                <Plus className="w-4 h-4" strokeWidth={2.5} />
                Add Team
              </button>
            </div>
          )}
          {activeTab === "auction" && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] text-text-muted font-medium uppercase tracking-wider">Pending</span>
                <span className="text-sm font-bold text-yellow-600">{players.filter(p => p.status === "Pending").length}</span>
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] text-text-muted font-medium uppercase tracking-wider">Sold</span>
                <span className="text-sm font-bold text-green-600">{players.filter(p => p.status === "Sold").length}</span>
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] text-text-muted font-medium uppercase tracking-wider">Unsold</span>
                <span className="text-sm font-bold text-gray-500">{players.filter(p => p.status === "Unsold").length}</span>
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] text-text-muted font-medium uppercase tracking-wider">Rejected</span>
                <span className="text-sm font-bold text-red-500">{players.filter(p => p.status === "Rejected").length}</span>
              </div>
            </div>
          )}
        </div>

        {/* Players Tab */}
        {activeTab === "players" && (
          <div className="space-y-4">
            {players.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Search players by name..."
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                    className="input-field !pl-9 !py-2 !text-sm"
                  />
                </div>
                <Dropdown
                  trigger={
                    <button className="input-field !w-auto !py-2 !text-sm bg-surface-alt cursor-pointer border-border flex items-center gap-2 h-full">
                      <span>{roleFilter === "All" ? "All Roles" : roleFilter}</span>
                      <ChevronDown className="w-4 h-4 text-text-muted" />
                    </button>
                  }
                  align="right"
                >
                  {["All", "Batsman", "Bowler", "Wicketkeeper", "Batting All-rounder", "Bowling All-rounder"].map(role => (
                    <DropdownItem key={role} isActive={roleFilter === role} onClick={() => setRoleFilter(role)}>
                      {role === "All" ? "All Roles" : role}
                    </DropdownItem>
                  ))}
                </Dropdown>

                <Dropdown
                  trigger={
                    <button className="input-field !w-auto !py-2 !text-sm bg-surface-alt cursor-pointer border-border flex items-center gap-2 h-full">
                      <span>{statusFilter === "All" ? "All Statuses" : statusFilter}</span>
                      <ChevronDown className="w-4 h-4 text-text-muted" />
                    </button>
                  }
                  align="right"
                >
                  {["All", "Pending", "Sold", "Unsold", "Rejected"].map(status => (
                    <DropdownItem key={status} isActive={statusFilter === status} onClick={() => setStatusFilter(status)}>
                      {status === "All" ? "All Statuses" : status}
                    </DropdownItem>
                  ))}
                </Dropdown>

                <div className="flex bg-surface-alt/50 border border-border rounded-xl p-1 shrink-0 h-[38px]">
                  <button title="Table View" onClick={() => setPlayerViewMode("table")} className={`p-1.5 rounded-lg transition-colors ${playerViewMode === "table" ? "bg-surface shadow-sm text-foreground" : "text-text-muted hover:text-foreground"}`}>
                    <List className="w-4 h-4" />
                  </button>
                  <button title="Grid View" onClick={() => setPlayerViewMode("grid")} className={`p-1.5 rounded-lg transition-colors ${playerViewMode === "grid" ? "bg-surface shadow-sm text-foreground" : "text-text-muted hover:text-foreground"}`}>
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {filteredPlayers.length === 0 ? (
              <div className="card p-12 text-center">
                <User className="w-10 h-10 mx-auto mb-3 text-text-muted" strokeWidth={1.5} />
                <p className="text-text-muted text-sm">{players.length === 0 ? "No players registered yet. Add your first player to get started." : "No players found matching your criteria."}</p>
              </div>
            ) : playerViewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredPlayers.map(player => (
                  <div key={player.id} onClick={() => setViewingPlayerDetails(player)} className="card card-hover flex flex-col overflow-hidden relative group cursor-pointer">
                    <div className="absolute top-3 left-3 z-10">
                      <span className="inline-flex px-2 py-0.5 text-xs font-bold bg-surface/90 backdrop-blur-sm border border-border rounded-lg shadow-sm text-text-muted">
                        #{player.sort_order}
                      </span>
                    </div>
                    <div className="absolute top-3 right-3 z-10">
                      <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border shadow-sm ${STATUS_COLORS[player.status]}`}>
                        {player.status}
                      </span>
                    </div>
                    <div className="p-5 flex flex-col items-center text-center border-b border-border bg-surface-alt/20">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-light to-accent-light/40 border-2 border-surface shadow-sm flex items-center justify-center overflow-hidden shrink-0 mb-3">
                        {player.photo_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={player.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-8 h-8 text-primary/60" strokeWidth={1.5} />
                        )}
                      </div>
                      <h3 className="font-bold text-foreground text-[15px] truncate w-full">{player.full_name}</h3>
                      <div className="flex flex-col items-center gap-1.5 mt-0.5 w-full">
                        <p className="text-xs text-primary font-medium truncate w-full">{player.player_role}</p>
                        {player.label && (
                          <span className="inline-flex px-2 py-0.5 text-[10px] font-bold text-purple-700 bg-purple-100 border border-purple-200 rounded-full truncate max-w-[90%]">
                            {player.label}
                          </span>
                        )}
                      </div>
                      {player.status === "Sold" && player.team_id && (
                        <div className="mt-3 text-[11px] bg-primary/5 text-primary-dark px-3 py-1.5 rounded-lg border border-primary/20 font-medium max-w-full truncate">
                          Sold to <span className="font-bold">{teams.find(t => t.id === player.team_id)?.name || 'Unknown'}</span> for <span className="font-bold">{player.sold_price} pts</span>
                        </div>
                      )}
                    </div>
                    <div className="p-4 bg-surface flex-1 grid grid-cols-2 gap-y-3 gap-x-2 text-xs">
                      <div>
                        <p className="text-text-muted mb-0.5">Age</p>
                        <p className="font-medium text-foreground">{player.age || '-'}</p>
                      </div>
                      <div>
                        <p className="text-text-muted mb-0.5">Phone</p>
                        <p className="font-medium text-foreground">{player.phone_number || '-'}</p>
                      </div>
                      <div>
                        <p className="text-text-muted mb-0.5">Batting</p>
                        <p className="font-medium text-foreground">{player.batting_hand}</p>
                      </div>
                      <div>
                        <p className="text-text-muted mb-0.5">Bowling</p>
                        <p className="font-medium text-foreground">{player.bowling_arm}</p>
                      </div>
                    </div>
                    <div className="p-3 border-t border-border bg-surface-alt/30 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      {player.status !== "Sold" && player.status !== "Rejected" && (
                        <button onClick={() => setSellingPlayer(player)} className="btn-primary !py-1.5 !px-4 !text-xs !w-auto bg-green-500 hover:bg-green-600 border-none shadow-green-500/20 mr-auto">Sell</button>
                      )}
                      {player.status === "Sold" && (
                        <PopConfirm
                          placement="top"
                          title="Undo Sale"
                          body={`Are you sure you want to undo the sale of ${player.full_name}?`}
                          confirmText="Undo"
                          triggerClassName="block mr-auto"
                          onConfirm={async (close, setLoading) => {
                            setLoading(true);
                            try {
                              const res = await revertPlayer(tournamentId, player.id);
                              setPlayers(prev => prev.map(x => x.id === res.player.id ? res.player : x));
                              close();
                            } catch (error) {
                              console.error("Failed to undo sale", error);
                              setLoading(false);
                            }
                          }}
                          trigger={
                            <button className="btn-ghost text-xs text-danger !py-1.5 !px-3 hover:bg-danger/10">Undo</button>
                          }
                        />
                      )}
                      {player.status === "Rejected" && (
                        <PopConfirm
                          placement="top"
                          title="Restore Player"
                          body={`Are you sure you want to restore ${player.full_name} to Pending?`}
                          confirmText="Restore"
                          triggerClassName="block mr-auto"
                          onConfirm={async (close, setLoading) => {
                            setLoading(true);
                            try {
                              const res = await revertPlayer(tournamentId, player.id);
                              setPlayers(prev => prev.map(x => x.id === res.player.id ? res.player : x));
                              close();
                            } catch (error) {
                              console.error("Failed to restore player", error);
                              setLoading(false);
                            }
                          }}
                          trigger={
                            <button className="btn-ghost text-xs text-primary !py-1.5 !px-3 hover:bg-primary/10">Restore</button>
                          }
                        />
                      )}
                      {player.status === "Pending" && (
                        <PopConfirm
                          placement="top"
                          title="Reject Player"
                          body={`Are you sure you want to reject ${player.full_name}?`}
                          confirmText="Reject"
                          triggerClassName="block"
                          onConfirm={async (close, setLoading) => {
                            setLoading(true);
                            try {
                              const res = await rejectPlayer(tournamentId, player.id);
                              setPlayers(prev => prev.map(x => x.id === res.player.id ? res.player : x));
                              close();
                            } catch (error) {
                              console.error("Failed to reject player", error);
                              setLoading(false);
                            }
                          }}
                          trigger={
                            <button className="btn-ghost text-xs text-danger !py-1.5 !px-3 hover:bg-danger/10">Reject</button>
                          }
                        />
                      )}
                      <div className="flex items-center gap-1 ml-auto">
                        <button onClick={() => setLabelingPlayer(player)} className="btn-ghost text-xs text-text-muted hover:text-purple-600 !py-1.5 !px-2 hover:bg-purple-50">Label</button>
                        <button onClick={() => { setEditingPlayer(player); setShowPlayerModal(true); }} className="btn-ghost text-xs text-primary !py-1.5 !px-3 hover:bg-primary/10">Edit</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border bg-surface-alt/50">
                      <th className="text-left px-4 py-3 font-medium text-text-subtle w-12">#</th>
                      <th className="text-left px-4 py-3 font-medium text-text-subtle">Player</th>
                      <th className="text-left px-4 py-3 font-medium text-text-subtle">Role</th>
                      <th className="text-left px-4 py-3 font-medium text-text-subtle">Batting</th>
                      <th className="text-left px-4 py-3 font-medium text-text-subtle">Bowling</th>
                      <th className="text-left px-4 py-3 font-medium text-text-subtle">Age</th>
                      <th className="text-left px-4 py-3 font-medium text-text-subtle">Status</th>
                      <th className="text-right px-4 py-3 font-medium text-text-subtle">Actions</th>
                    </tr></thead>
                    <tbody>
                      {filteredPlayers.map((player) => (
                        <tr key={player.id} onClick={() => setViewingPlayerDetails(player)} className="border-b border-border last:border-0 hover:bg-surface-alt/30 transition-colors cursor-pointer">
                          <td className="px-4 py-3 text-text-muted font-bold text-sm">#{player.sort_order}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-primary-light border border-border flex items-center justify-center overflow-hidden shrink-0">
                                {player.photo_url ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={player.photo_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-xs font-bold text-primary">{player.full_name[0]}</span>
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-foreground">{player.full_name}</p>
                                  {player.label && (
                                    <span className="inline-flex px-1.5 py-0.5 text-[9px] font-bold text-purple-700 bg-purple-100 border border-purple-200 rounded-full truncate max-w-[100px]">
                                      {player.label}
                                    </span>
                                  )}
                                </div>
                                {player.phone_number && <p className="text-xs text-text-subtle">{player.phone_number}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-text-muted">{player.player_role}</td>
                          <td className="px-4 py-3 text-text-muted">{player.batting_hand}</td>
                          <td className="px-4 py-3 text-text-muted">{player.bowling_arm}</td>
                          <td className="px-4 py-3 text-text-muted">{player.age}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full border ${STATUS_COLORS[player.status]}`}>{player.status}</span>
                            {player.status === "Sold" && player.team_id && (
                              <div className="mt-1.5 text-[11px] text-text-subtle font-medium">
                                To: <span className="text-foreground">{teams.find(t => t.id === player.team_id)?.name || 'Unknown'}</span> <br />
                                For: <span className="text-primary">{player.sold_price}</span> pts
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              {player.status !== "Sold" && player.status !== "Rejected" && (
                                <button onClick={() => setSellingPlayer(player)} className="btn-primary !py-1 !px-3 !text-xs !w-auto bg-green-500 hover:bg-green-600 border-none shadow-green-500/20">Sell</button>
                              )}
                              {player.status === "Sold" && (
                                <PopConfirm
                                  placement="left"
                                  title="Undo Sale"
                                  body={`Are you sure you want to undo the sale of ${player.full_name}?`}
                                  confirmText="Undo"
                                  triggerClassName="block"
                                  onConfirm={async (close, setLoading) => {
                                    setLoading(true);
                                    try {
                                      const res = await revertPlayer(tournamentId, player.id);
                                      setPlayers(prev => prev.map(x => x.id === res.player.id ? res.player : x));
                                      close();
                                    } catch (error) {
                                      console.error("Failed to undo sale", error);
                                      setLoading(false);
                                    }
                                  }}
                                  trigger={
                                    <button className="btn-ghost text-xs text-danger !py-1 !px-2 hover:bg-danger/10">Undo</button>
                                  }
                                />
                              )}
                              {player.status === "Rejected" && (
                                <PopConfirm
                                  placement="left"
                                  title="Restore Player"
                                  body={`Are you sure you want to restore ${player.full_name} to Pending?`}
                                  confirmText="Restore"
                                  triggerClassName="block"
                                  onConfirm={async (close, setLoading) => {
                                    setLoading(true);
                                    try {
                                      const res = await revertPlayer(tournamentId, player.id);
                                      setPlayers(prev => prev.map(x => x.id === res.player.id ? res.player : x));
                                      close();
                                    } catch (error) {
                                      console.error("Failed to restore player", error);
                                      setLoading(false);
                                    }
                                  }}
                                  trigger={
                                    <button className="btn-ghost text-xs text-primary !py-1.5 !px-2 hover:bg-primary/10">Restore</button>
                                  }
                                />
                              )}
                              {player.status === "Pending" && (
                                <PopConfirm
                                  placement="left"
                                  title="Reject Player"
                                  body={`Are you sure you want to reject ${player.full_name}?`}
                                  confirmText="Reject"
                                  triggerClassName="block"
                                  onConfirm={async (close, setLoading) => {
                                    setLoading(true);
                                    try {
                                      const res = await rejectPlayer(tournamentId, player.id);
                                      setPlayers(prev => prev.map(x => x.id === res.player.id ? res.player : x));
                                      close();
                                    } catch (error) {
                                      console.error("Failed to reject player", error);
                                      setLoading(false);
                                    }
                                  }}
                                  trigger={
                                    <button className="btn-ghost text-xs text-danger !py-1 !px-2 hover:bg-danger/10">Reject</button>
                                  }
                                />
                              )}
                              <button onClick={() => setLabelingPlayer(player)} className="btn-ghost text-xs text-text-muted hover:text-purple-600 !py-1 !px-2 hover:bg-purple-50">Label</button>
                              <button onClick={() => { setEditingPlayer(player); setShowPlayerModal(true); }} className="btn-ghost text-xs text-primary !py-1 !px-2 hover:bg-primary/10">Edit</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Teams Tab */}
        {activeTab === "teams" && (
          <div>

            {teams.length === 0 ? (
              <div className="card p-12 text-center">
                <Shield className="w-10 h-10 mx-auto mb-3 text-text-muted" strokeWidth={1.5} />
                <p className="text-text-muted text-sm">No teams created yet. Add teams to prepare for the auction.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {teams.map((team) => {
                  const teamPlayers = players.filter(p => p.team_id === team.id && p.status === 'Sold');
                  const pointsSpent = teamPlayers.reduce((sum, p) => sum + Number(p.sold_price || 0), 0);
                  const remainingPlayers = Math.max(0, Number(tournament?.max_players_per_team || 0) - teamPlayers.length);
                  const basePrice = Number(tournament?.player_base_price || 0);
                  const teamBudget = Number(tournament?.team_budget || 0);

                  const maxBid = remainingPlayers > 0
                    ? (teamBudget - pointsSpent) - (basePrice * remainingPlayers) + basePrice
                    : 0;

                  return (
                    <div key={team.id} className="card card-hover overflow-hidden text-center group flex flex-col relative bg-surface-alt border-primary/10 hover:border-primary/30">
                      {remainingPlayers === 0 && (
                        <div title="Team complete" className="absolute top-3 right-3 bg-green-500 text-white rounded-full p-0.5 shadow-md z-10 animate-scale-in">
                          <CheckCircle className="w-4 h-4" />
                        </div>
                      )}
                      <div className="p-5 flex-1 flex flex-col">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-light to-accent-light/40 border border-border mx-auto mb-3 flex items-center justify-center overflow-hidden shrink-0">
                          {team.logo_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={team.logo_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <Shield className="w-6 h-6 text-primary/60" strokeWidth={1.5} />
                          )}
                        </div>
                        <h3 className="text-[15px] font-bold text-foreground truncate px-2 group-hover:text-primary transition-colors">{team.name}</h3>

                        <div className="mt-4 text-left space-y-1.5 bg-surface-alt/50 rounded-xl p-3 border border-border/50 flex-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-text-muted">Budget:</span>
                            <span className="font-semibold text-foreground">{teamBudget.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-text-muted">Spent:</span>
                            <span className="font-semibold text-danger">{pointsSpent.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-text-muted">Players:</span>
                            <span className="font-semibold text-primary">{teamPlayers.length}/{tournament?.max_players_per_team}</span>
                          </div>
                        </div>
                      </div>

                      {/* Hover Overlay Actions */}
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 flex items-center justify-center gap-4">
                        <button
                          onClick={() => { setViewingTeam(team); setShowTeamViewModal(true); }}
                          title="View Players"
                          className="w-12 h-12 rounded-full bg-white/20 hover:bg-primary text-white flex items-center justify-center transition-all hover:scale-110 shadow-lg"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => { setEditingTeam(team); setShowTeamModal(true); }}
                          title="Edit Team"
                          className="w-12 h-12 rounded-full bg-white/20 hover:bg-blue-500 text-white flex items-center justify-center transition-all hover:scale-110 shadow-lg"
                        >
                          <Pencil className="w-5 h-5" />
                        </button>
                        <PopConfirm
                          placement="top"
                          title="Delete Team"
                          body={`Are you sure you want to delete "${team.name}"?`}
                          confirmText="Delete"
                          onConfirm={async (close, setLoading) => {
                            setLoading(true);
                            try {
                              await deleteTeam(tournamentId, team.id);
                              setTeams(prev => prev.filter(t => t.id !== team.id));
                              setPlayers(prev => prev.map(p => p.team_id === team.id ? { ...p, team_id: undefined, sold_price: undefined, status: "Pending" as PlayerStatus } : p));
                              close();
                            } catch (error) {
                              console.error("Failed to delete team", error);
                              setLoading(false);
                            }
                          }}
                          trigger={
                            <button title="Delete Team" className="w-12 h-12 rounded-full bg-white/20 hover:bg-danger text-white flex items-center justify-center transition-all hover:scale-110 shadow-lg">
                              <Trash2 className="w-5 h-5" />
                            </button>
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Auction Tab */}
        {activeTab === "auction" && tournament && (() => {
          const basePrice = Number(tournament.player_base_price);
          const teamBudget = Number(tournament.team_budget);
          const pendingCount = players.filter(p => p.status === "Pending").length;

          const handlePickRandom = async () => {
            setSpinnerActive(true);
            try {
              const is_unsold_round = pendingCount === 0;
              const hist = await pickRandomPlayer(tournamentId, is_unsold_round);
              setAuctionHistory(prev => [...prev, hist]);
            } catch (e) { console.error("Failed to pick player", e); }
            finally { setSpinnerActive(false); }
          };

          const handleUnsold = async () => {
            if (!currentAuctionPlayer) return;
            setAuctionProcessing("unsold");
            try {
              const res = await markUnsoldPlayer(tournamentId, currentAuctionPlayer.id);
              setPlayers(prev => prev.map(x => x.id === res.player.id ? res.player : x));
              setAuctionHistory(prev => [
                ...prev.filter(h => !(h.action === 'Pending' && h.player.id === currentAuctionPlayer.id)),
                { id: Date.now(), action: 'Unsold', sold_price: null, player: res.player }
              ]);
            } catch (e) { console.error("Failed to mark unsold", e); }
            finally { setAuctionProcessing(false); }
          };

          const handleReject = async () => {
            if (!currentAuctionPlayer) return;
            setAuctionProcessing("reject");
            try {
              const res = await rejectPlayer(tournamentId, currentAuctionPlayer.id);
              setPlayers(prev => prev.map(x => x.id === res.player.id ? res.player : x));
              setAuctionHistory(prev => [
                ...prev.filter(h => !(h.action === 'Pending' && h.player.id === currentAuctionPlayer.id)),
                { id: Date.now(), action: 'Rejected', sold_price: null, player: res.player }
              ]);
            } catch (e) { console.error("Failed to reject player", e); }
            finally { setAuctionProcessing(false); }
          };

          return (
            <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 180px)' }}>
              {/* Left Column — 30% — Fixed/Sticky */}
              <div className="w-[30%] shrink-0">
                <div className="sticky top-[72px]" style={{ height: 'calc(100vh - 110px - 4rem)' }}>
                  {currentAuctionPlayer ? (
                    <div className="card overflow-hidden animate-scale-in h-full flex flex-col group">
                      <div className={`${showPlayerDetails ? 'h-[70%]' : 'h-full'} w-full relative bg-gradient-to-br from-primary-light to-accent-light/40 flex items-center justify-center overflow-hidden shrink-0 border-b border-border transition-all duration-300`}>
                        <button
                          onClick={() => setShowPlayerDetails(!showPlayerDetails)}
                          className="absolute top-3 left-3 z-10 px-3 py-1.5 flex items-center gap-2 rounded-full bg-black/50 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all hover:bg-black/70"
                        >
                          <span className="text-[11px] font-bold tracking-wider uppercase opacity-90">Details</span>
                          {showPlayerDetails ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                        </button>
                        <button
                          onClick={() => setFullscreenPlayer(true)}
                          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/50 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all hover:bg-black/70"
                          title="Fullscreen"
                        >
                          <Maximize className="w-4 h-4" />
                        </button>
                        {currentAuctionPlayer.photo_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={currentAuctionPlayer.photo_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <User className="w-24 h-24 text-primary/60" strokeWidth={1.5} />
                        )}
                      </div>
                      {showPlayerDetails && (
                        <div className="p-3 flex flex-col items-center text-center bg-gradient-to-br from-surface to-surface-alt/30 flex-1 justify-center animate-fade-in">
                          <h2 className="text-lg font-bold text-foreground mb-0.5">
                            <span className="text-primary font-bold mr-1.5">#{currentAuctionPlayer.sort_order}</span>
                            {currentAuctionPlayer.full_name}
                          </h2>
                          <p className="text-primary font-semibold text-sm mb-4">{currentAuctionPlayer.player_role}</p>
                          <div className="grid grid-cols-2 gap-3 w-full">
                            <div className="bg-surface-alt/60 rounded-xl p-2.5 border border-border/50">
                              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Batting</p>
                              <p className="font-bold text-foreground text-sm">{currentAuctionPlayer.batting_hand}</p>
                            </div>
                            <div className="bg-surface-alt/60 rounded-xl p-2.5 border border-border/50">
                              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Bowling</p>
                              <p className="font-bold text-foreground text-sm">{currentAuctionPlayer.bowling_arm}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="card p-8 flex flex-col items-center text-center justify-center h-full">
                      {pendingCount === 0 ? (
                        <>
                          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                            <CheckCircle className="w-8 h-8 text-green-500" />
                          </div>
                          <p className="text-sm font-medium text-text-muted">No pending players remaining.</p>
                          {players.filter(p => p.status === "Unsold").length > 0 && (
                            <button
                              onClick={handlePickRandom}
                              disabled={spinnerActive}
                              className="inline-flex items-center justify-center font-bold rounded-xl transition-all mt-6 px-6 py-2.5 text-sm bg-yellow-500 hover:bg-yellow-600 text-yellow-950 border-none shadow-md shadow-yellow-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {spinnerActive ? (
                                <><div className="spinner" /> Picking...</>
                              ) : (
                                "Re-Auction Unsold Players"
                              )}
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 mb-4">
                            <Shuffle className="w-9 h-9 text-white" />
                          </div>
                          <p className="text-sm text-text-muted mb-4">
                            <span className="font-bold text-foreground">{pendingCount}</span> pending player{pendingCount > 1 ? 's' : ''}
                          </p>
                          <button
                            onClick={handlePickRandom}
                            disabled={spinnerActive}
                            className="btn-primary !w-auto !px-8 !py-3 !text-base"
                          >
                            {spinnerActive ? (
                              <><div className="spinner" /> Picking...</>
                            ) : (
                              <><Shuffle className="w-5 h-5" /> Pick Player</>
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column — 70% — Scrollable */}
              <div className="flex-1 space-y-5">
                {/* Teams Grid */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-text-subtle uppercase tracking-wider">Teams</h3>
                    <button
                      onClick={() => setShowTeamDetails(!showTeamDetails)}
                      className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-foreground transition-colors"
                    >
                      <span className="font-medium">{showTeamDetails ? 'Hide' : 'Show'} Details</span>
                      {showTeamDetails ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {teams.map((team) => {
                      const tp = players.filter(p => p.team_id === team.id && p.status === 'Sold');
                      const spent = tp.reduce((sum, p) => sum + Number(p.sold_price || 0), 0);
                      const remaining = Math.max(0, Number(tournament.max_players_per_team) - tp.length);
                      const mb = remaining > 0 ? (teamBudget - spent) - (basePrice * remaining) + basePrice : 0;
                      return (
                        <div key={team.id} className={`card p-4 flex items-start gap-3 relative transition-all ${remaining === 0 ? "opacity-60 !border-2 !border-primary/60 shadow-md shadow-primary/10" : "border border-transparent"}`}>
                          {remaining === 0 && (
                            <div className="absolute top-2 right-2"><CheckCircle className="w-4 h-4 text-green-500" /></div>
                          )}
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-light to-accent-light/40 flex items-center justify-center overflow-hidden shrink-0">
                            {team.logo_url ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={team.logo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Shield className="w-5 h-5 text-primary/60" strokeWidth={1.5} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-foreground truncate">{team.name}</p>
                            <div className="mt-1.5 space-y-0.5 text-[11px]">
                              {showTeamDetails && (
                                <div className="flex justify-between"><span className="text-text-muted">Remaining</span><span className="font-semibold text-foreground">{(teamBudget - spent).toLocaleString()}</span></div>
                              )}
                              <div className="flex justify-between"><span className="text-text-muted">Players</span><span className="font-semibold">{tp.length}/{tournament.max_players_per_team}</span></div>
                              {showTeamDetails && (
                                <div className="flex justify-between"><span className="text-text-muted">Max Bid</span><span className="font-bold text-green-600">{Math.max(0, mb).toLocaleString()}</span></div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons — only when a player is showing */}
                {currentAuctionPlayer && (
                  <div className="card p-4 sticky bottom-6 z-10 shadow-2xl border-primary/10">
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => setAuctionSellingPlayer(currentAuctionPlayer)}
                        disabled={auctionProcessing !== false}
                        className="py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-sm shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Trophy className="w-5 h-5" /> SOLD
                      </button>
                      <button
                        onClick={handleUnsold}
                        disabled={auctionProcessing !== false}
                        className="py-4 rounded-xl bg-gradient-to-r from-gray-400 to-gray-500 text-white font-bold text-sm shadow-lg shadow-gray-500/15 hover:shadow-gray-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {auctionProcessing === "unsold" ? <><div className="spinner" /> ...</> : <><XCircle className="w-5 h-5" /> UNSOLD</>}
                      </button>
                      <button
                        onClick={handleReject}
                        disabled={auctionProcessing !== false}
                        className="py-4 rounded-xl bg-gradient-to-r from-red-400 to-red-500 text-white font-bold text-sm shadow-lg shadow-red-500/15 hover:shadow-red-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {auctionProcessing === "reject" ? <><div className="spinner" /> ...</> : <><XCircle className="w-5 h-5" /> REJECT</>}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Fullscreen Player Overlay */}
        {fullscreenPlayer && currentAuctionPlayer && ReactDOM.createPortal(
          <div className="fixed inset-0 z-[9999] bg-black flex flex-col overflow-hidden" onClick={() => setFullscreenPlayer(false)}>
            <button
              onClick={() => setFullscreenPlayer(false)}
              className="absolute top-6 right-6 z-50 p-3 rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white/20 transition-all"
            >
              <X className="w-6 h-6" />
            </button>
            {/* Photo — fills entire screen */}
            <div className="flex-1 relative flex items-center justify-center overflow-hidden" onClick={e => e.stopPropagation()}>
              {currentAuctionPlayer.photo_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={currentAuctionPlayer.photo_url} alt="" className="absolute inset-0 w-full h-full object-contain" />
              ) : (
                <User className="w-40 h-40 text-white/40" strokeWidth={1.5} />
              )}
            </div>
            {/* Details bar — fixed at bottom */}
            <div className="bg-black/70 backdrop-blur-xl px-8 py-4 flex items-center justify-between gap-6 border-t border-white/10" onClick={e => e.stopPropagation()}>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  <span className="text-primary font-bold mr-2">#{currentAuctionPlayer.sort_order}</span>
                  {currentAuctionPlayer.full_name}
                </h2>
                <p className="text-primary font-semibold mt-0.5">{currentAuctionPlayer.player_role}</p>
              </div>
              <div className="flex gap-3">
                <div className="bg-white/10 rounded-xl px-4 py-2.5 text-center">
                  <p className="text-[10px] text-white/60 uppercase tracking-wider mb-0.5">Batting</p>
                  <p className="font-bold text-white text-sm">{currentAuctionPlayer.batting_hand}</p>
                </div>
                <div className="bg-white/10 rounded-xl px-4 py-2.5 text-center">
                  <p className="text-[10px] text-white/60 uppercase tracking-wider mb-0.5">Bowling</p>
                  <p className="font-bold text-white text-sm">{currentAuctionPlayer.bowling_arm}</p>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Links Tab */}
        {activeTab === "links" && tournament && (
          <div className="grid gap-6 max-w-3xl mx-auto animate-fade-in-up">
            <div className="card p-6">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-primary" />
                Tournament Links
              </h2>
              
              <div className="space-y-8">
                {/* Player Registration Link */}
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-foreground">Player Registration Link</h3>
                    <p className="text-sm text-text-muted">Share this link with players so they can register for the auction.</p>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 bg-surface-alt border border-border rounded-xl p-1 transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50">
                      <input 
                        readOnly 
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/p/${tournamentId}/player-registration`} 
                        className="flex-1 bg-transparent px-3 py-2 outline-none text-sm font-medium text-text-subtle w-full"
                        onClick={e => e.currentTarget.select()}
                      />
                      <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/p/${tournamentId}/player-registration`)} className="btn-secondary !py-2 px-3 text-xs whitespace-nowrap">
                        <Copy className="w-3.5 h-3.5" /> Copy
                      </button>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <a href={`https://wa.me/?text=Register for ${encodeURIComponent(tournament.name)}: ${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/p/${tournamentId}/player-registration`)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-600 hover:bg-green-500/20 rounded-lg text-xs font-semibold transition-colors">
                         WhatsApp
                      </a>
                      <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/p/${tournamentId}/player-registration`)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 rounded-lg text-xs font-semibold transition-colors">
                         Facebook
                      </a>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-border w-full" />

                {/* Tournament Detail Link */}
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-foreground">Tournament Detail Link</h3>
                    <p className="text-sm text-text-muted">Public page showing tournament details, teams, and players.</p>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 bg-surface-alt border border-border rounded-xl p-1 transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50">
                      <input 
                        readOnly 
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/p/${tournamentId}`} 
                        className="flex-1 bg-transparent px-3 py-2 outline-none text-sm font-medium text-text-subtle w-full"
                        onClick={e => e.currentTarget.select()}
                      />
                      <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/p/${tournamentId}`)} className="btn-secondary !py-2 px-3 text-xs whitespace-nowrap">
                        <Copy className="w-3.5 h-3.5" /> Copy
                      </button>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <a href={`https://wa.me/?text=Check out ${encodeURIComponent(tournament.name)}: ${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/p/${tournamentId}`)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-600 hover:bg-green-500/20 rounded-lg text-xs font-semibold transition-colors">
                         WhatsApp
                      </a>
                      <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/p/${tournamentId}`)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 rounded-lg text-xs font-semibold transition-colors">
                         Facebook
                      </a>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-border w-full" />

                {/* Auction Live Link */}
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-foreground">Auction Live Link</h3>
                    <p className="text-sm text-text-muted">Public live view of the auction for fans and teams to watch.</p>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 bg-surface-alt border border-border rounded-xl p-1 transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50">
                      <input 
                        readOnly 
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/p/${tournamentId}/auction`} 
                        className="flex-1 bg-transparent px-3 py-2 outline-none text-sm font-medium text-text-subtle w-full"
                        onClick={e => e.currentTarget.select()}
                      />
                      <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/p/${tournamentId}/auction`)} className="btn-secondary !py-2 px-3 text-xs whitespace-nowrap">
                        <Copy className="w-3.5 h-3.5" /> Copy
                      </button>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <a href={`https://wa.me/?text=Watch the live auction for ${encodeURIComponent(tournament.name)}: ${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/p/${tournamentId}/auction`)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-600 hover:bg-green-500/20 rounded-lg text-xs font-semibold transition-colors">
                         WhatsApp
                      </a>
                      <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/p/${tournamentId}/auction`)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 rounded-lg text-xs font-semibold transition-colors">
                         Facebook
                      </a>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="card p-6">
              <h2 className="text-lg font-bold mb-4">Registration Settings</h2>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-subtle">Registration Closing Date</label>
                <input 
                  type="datetime-local" 
                  className="input-field max-w-[240px]"
                  defaultValue={tournament.registration_closing_date ? tournament.registration_closing_date.replace(' ', 'T').slice(0, 16) : ''}
                  onChange={async (e) => {
                    const val = e.target.value;
                    const formData = new FormData();
                    if (val) {
                      // e.target.value for datetime-local is usually YYYY-MM-DDThh:mm
                      formData.append("registration_closing_date", val.replace('T', ' ') + ':00');
                    } else {
                      formData.append("registration_closing_date", "");
                    }
                    try {
                      const updated = await updateTournament(tournamentId, formData);
                      setTournament(updated.tournament);
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                />
                <p className="text-xs text-text-muted mt-1.5">Players will not be able to register after this date and time.</p>
              </div>
            </div>
          </div>
        )}

        {/* Auction Sell Modal */}
        {auctionSellingPlayer && tournament && ReactDOM.createPortal(
          <AuctionSellModal
            tournament={tournament}
            player={auctionSellingPlayer}
            teams={teams}
            players={players}
            onClose={() => setAuctionSellingPlayer(null)}
            onSold={handleAuctionSoldFromModal}
          />,
          document.body
        )}
      </main>

      {/* Player Modal */}
      {showPlayerModal && (
        <PlayerModal
          tournamentId={tournamentId}
          player={editingPlayer}
          onClose={() => { setShowPlayerModal(false); setEditingPlayer(null); }}
          onSaved={(p, isNew) => {
            if (isNew) setPlayers(prev => [...prev, p]);
            else setPlayers(prev => prev.map(x => x.id === p.id ? p : x));
          }}
        />
      )}

      {/* Sell Player Modal */}
      {sellingPlayer && tournament && (
        <SellPlayerModal
          tournament={tournament}
          player={sellingPlayer}
          teams={teams}
          players={players}
          onClose={() => setSellingPlayer(null)}
          onSold={(p) => {
            setPlayers(prev => prev.map(x => x.id === p.id ? p : x));
            setSellingPlayer(null);
          }}
        />
      )}

      {/* Team Modal */}
      {showTeamModal && (
        <TeamModal
          tournamentId={tournamentId}
          team={editingTeam}
          onClose={() => { setShowTeamModal(false); setEditingTeam(null); }}
          onSaved={(t, isNew) => {
            if (isNew) setTeams(prev => [...prev, t]);
            else setTeams(prev => prev.map(x => x.id === t.id ? t : x));
            setShowTeamModal(false);
            setEditingTeam(null);
          }}
        />
      )}
      {/* Team View Modal */}
      {showTeamViewModal && viewingTeam && (
        <TeamViewModal
          tournament={tournament}
          team={viewingTeam}
          players={players}
          onClose={() => { setShowTeamViewModal(false); setViewingTeam(null); }}
        />
      )}

      {/* Label Player Modal */}
      {labelingPlayer && (
        <LabelPlayerModal
          player={labelingPlayer}
          onClose={() => setLabelingPlayer(null)}
          onUpdate={async (label) => {
            const formData = new FormData();
            if (label !== null) formData.append("label", label);
            else formData.append("label", "");

            // We just need to hit the update endpoint
            const res = await updatePlayer(tournamentId, labelingPlayer.id, formData);
            setPlayers(prev => prev.map(x => x.id === res.player.id ? res.player : x));
          }}
        />
      )}

      {/* Player Full View Modal */}
      {viewingPlayerDetails && ReactDOM.createPortal(
        <PlayerFullViewModal
          player={viewingPlayerDetails}
          onClose={() => setViewingPlayerDetails(null)}
        />,
        document.body
      )}
    </div>
  );
}

/* ============================================================
   Player Modal Component
   ============================================================ */
function PlayerModal({ tournamentId, player, onClose, onSaved }: {
  tournamentId: string;
  player: Player | null;
  onClose: () => void;
  onSaved: (p: Player, isNew: boolean) => void;
}) {
  const isEdit = !!player;
  const fileRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [photoPreview, setPhotoPreview] = useState<string | null>(player?.photo_url || null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [toastMessage, setToastMessage] = useState("");

  const [form, setForm] = useState({
    full_name: player?.full_name || "",
    age: player?.age?.toString() || "",
    phone_number: player?.phone_number || "",
    batting_hand: player?.batting_hand || "",
    player_role: player?.player_role || "",
    bowling_arm: player?.bowling_arm || "N/A",
    status: player?.status || "Pending",
  });

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

      if (isEdit) {
        const res = await updatePlayer(tournamentId, player!.id, fd);
        onSaved(res.player, false);
        onClose();
      } else {
        const res = await createPlayer(tournamentId, fd);
        onSaved(res.player, true);
        setToastMessage("Player added successfully!");
        setForm({
          full_name: "",
          age: "",
          phone_number: "",
          batting_hand: "",
          player_role: "",
          bowling_arm: "N/A",
          status: "Pending",
        });
        setPhotoPreview(null);
        setPhotoFile(null);
        if (fileRef.current) fileRef.current.value = "";
      }
      setTimeout(() => setToastMessage(""), 3000);
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
      <label className="block text-sm font-medium mb-1.5">{label} <span className="text-danger">*</span></label>
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      {toastMessage && (
        <div className="absolute bottom-6 left-6 z-[9999] bg-green-500 text-white px-5 py-3 rounded-xl text-sm font-bold shadow-2xl flex items-center gap-3 transition-all duration-300">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          {toastMessage}
        </div>
      )}

      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-bold">
            {isEdit ? (
              <><span className="text-primary mr-2">#{player?.sort_order}</span>Edit Player</>
            ) : "Add Player"}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Photo */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary-light border border-border flex items-center justify-center overflow-hidden shrink-0 cursor-pointer" onClick={() => fileRef.current?.click()}>
              {photoPreview ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={photoPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus className="w-6 h-6 text-text-subtle" strokeWidth={1.5} />
              )}
            </div>
            <div>
              <button type="button" onClick={() => fileRef.current?.click()} className="text-sm font-medium text-primary">Upload Photo</button>
              <p className="text-xs text-text-subtle">Optional • Max 10MB</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
          </div>

          {/* Fields */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Full Name <span className="text-danger">*</span></label>
            <input name="full_name" value={form.full_name} onChange={handleChange} className="input-field" required />
            {fieldErrors.full_name && <p className="mt-1 text-xs text-danger">{fieldErrors.full_name[0]}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Phone Number</label>
              <input name="phone_number" value={form.phone_number} onChange={handleChange} className="input-field" placeholder="Optional" />
              {fieldErrors.phone_number && <p className="mt-1 text-xs text-danger">{fieldErrors.phone_number[0]}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Age <span className="text-xs font-normal text-text-subtle ml-1">(Optional)</span></label>
              <input name="age" type="number" min={1} max={100} value={form.age} onChange={handleChange} className="input-field" placeholder="Optional" />
              {fieldErrors.age && <p className="mt-1 text-xs text-danger">{fieldErrors.age[0]}</p>}
            </div>
          </div>

          <div className="space-y-5">
            {renderRadio("player_role", "Player Role", ["Batsman", "Bowler", "Wicketkeeper", "Batting All-rounder", "Bowling All-rounder"])}
            {renderRadio("batting_hand", "Batting Hand", ["Right", "Left"])}
            {renderRadio("bowling_arm", "Bowling Arm", ["Right-arm", "Left-arm", "N/A"])}
          </div>

          {error && <p className="text-sm text-danger bg-danger/5 border border-danger/10 rounded-lg p-3">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={submitting} className="btn-primary !w-auto flex-1">
              {submitting ? <><div className="spinner" /><span>Saving...</span></> : (isEdit ? "Save Changes" : "Add Player")}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   Label Player Modal Component
   ============================================================ */
function LabelPlayerModal({ player, onClose, onUpdate }: {
  player: Player;
  onClose: () => void;
  onUpdate: (label: string | null) => Promise<void>;
}) {
  const [label, setLabel] = useState(player.label || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await onUpdate(label.trim() || null);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update label.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="card w-full max-w-sm animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border">
          <h3 className="text-base font-bold">
            <span className="text-primary mr-1.5">#{player.sort_order}</span>
            Label {player.full_name}
          </h3>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Label Name</label>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              className="input-field"
              placeholder="e.g. Captain, Retained..."
              autoFocus
            />
            <p className="mt-1.5 text-xs text-text-subtle">Leave empty to remove label.</p>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1" disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={submitting}>
              {submitting ? "Saving..." : "Save Label"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   Sell Player Modal Component
   ============================================================ */
function SellPlayerModal({ tournament, player, teams, players, onClose, onSold }: {
  tournament: Tournament;
  player: Player;
  teams: Team[];
  players: Player[];
  onClose: () => void;
  onSold: (p: Player) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [teamId, setTeamId] = useState("");
  const [soldPrice, setSoldPrice] = useState(tournament.player_base_price.toString());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId) return setError("Please select a team.");
    if (!soldPrice || isNaN(Number(soldPrice)) || Number(soldPrice) < 0) return setError("Please enter a valid sold price.");

    setError("");
    setSubmitting(true);
    try {
      const res = await sellPlayer(tournament.id, player.id, teamId, Number(soldPrice));
      onSold(res.player);
    } catch (err: any) {
      setError(err.message || "Failed to sell player.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="card w-full max-w-4xl animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-bold">
            <span className="text-primary mr-2">#{player.sort_order}</span>
            Sell {player.full_name}
          </h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium mb-3">Select Team <span className="text-danger">*</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto p-1">
              {teams.map(t => {
                const teamPlayers = players.filter(p => p.team_id === t.id && p.status === 'Sold');
                const pointsSpent = teamPlayers.reduce((sum, p) => sum + Number(p.sold_price || 0), 0);
                const remainingPlayers = Math.max(0, Number(tournament.max_players_per_team) - teamPlayers.length);
                const basePrice = Number(tournament.player_base_price);
                const teamBudget = Number(tournament.team_budget);

                const maxBid = remainingPlayers > 0
                  ? (teamBudget - pointsSpent) - (basePrice * remainingPlayers) + basePrice
                  : 0;

                if (remainingPlayers === 0) return null;

                const isSelected = teamId === t.id;

                return (
                  <label key={t.id} className={`cursor-pointer rounded-xl border p-3 flex items-center gap-3 transition-all duration-200 ${isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm' : 'border-border bg-surface-alt hover:border-primary/30 hover:bg-primary/[0.02]'}`}>
                    <input type="radio" name="team_id" value={t.id} checked={isSelected} onChange={(e) => setTeamId(e.target.value)} className="hidden" />
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-light to-accent-light/40 flex items-center justify-center overflow-hidden shrink-0">
                      {t.logo_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={t.logo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Shield className="w-4 h-4 text-primary/60" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{t.name}</p>
                      <p className="text-[10px] text-text-muted">
                        Budget: {(teamBudget - pointsSpent).toLocaleString()} • Max Bid: <span className="font-bold text-green-600">{Math.max(0, maxBid).toLocaleString()}</span>
                      </p>
                    </div>
                    {isSelected && <CheckCircle className="w-5 h-5 text-primary shrink-0" />}
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Sold Points <span className="text-danger">*</span></label>
            <input type="number" min={0} value={soldPrice} onChange={e => setSoldPrice(e.target.value)} className="input-field" required placeholder="e.g. 500" />
          </div>

          {error && <p className="text-sm text-danger bg-danger/5 border border-danger/10 rounded-lg p-3">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={submitting} className="btn-primary !w-auto flex-1 bg-green-500 hover:bg-green-600 border-none shadow-green-500/20">
              {submitting ? <><div className="spinner" /><span>Processing...</span></> : "Confirm Sale"}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   Team Modal Component
   ============================================================ */
function TeamModal({ tournamentId, team, onClose, onSaved }: {
  tournamentId: string;
  team: Team | null;
  onClose: () => void;
  onSaved: (t: Team, isNew: boolean) => void;
}) {
  const isEdit = !!team;
  const fileRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(team?.logo_url || null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [name, setName] = useState(team?.name || "");

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError("Logo must be under 10MB."); return; }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("name", name);
      if (logoFile) fd.append("logo", logoFile);

      if (isEdit) {
        const res = await updateTeam(tournamentId, team!.id, fd);
        onSaved(res.team, false);
      } else {
        const res = await createTeam(tournamentId, fd);
        onSaved(res.team, true);
      }
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Something went wrong.");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="card w-full max-w-md animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-bold">{isEdit ? "Edit Team" : "Add Team"}</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary-light border border-border flex items-center justify-center overflow-hidden shrink-0 cursor-pointer" onClick={() => fileRef.current?.click()}>
              {logoPreview ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={logoPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <Shield className="w-6 h-6 text-primary/60" strokeWidth={1.5} />
              )}
            </div>
            <div>
              <button type="button" onClick={() => fileRef.current?.click()} className="text-sm font-medium text-primary">Upload Logo</button>
              <p className="text-xs text-text-subtle">Optional • Max 10MB</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleLogo} className="hidden" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Team Name <span className="text-danger">*</span></label>
            <input value={name} onChange={e => { setName(e.target.value); setError(""); }} className="input-field" required placeholder="e.g. Royal Strikers" />
          </div>

          {error && <p className="text-sm text-danger bg-danger/5 border border-danger/10 rounded-lg p-3">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={submitting} className="btn-primary !w-auto flex-1">
              {submitting ? <><div className="spinner" /><span>Saving...</span></> : (isEdit ? "Save Changes" : "Add Team")}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   Auction Sell Modal Component
   ============================================================ */
function AuctionSellModal({ tournament, player, teams, players, onClose, onSold }: {
  tournament: Tournament;
  player: Player;
  teams: Team[];
  players: Player[];
  onClose: () => void;
  onSold: (p: Player, keepModalOpen?: boolean) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [teamId, setTeamId] = useState("");
  const [soldPrice, setSoldPrice] = useState(String(tournament.player_base_price));
  const [error, setError] = useState("");
  const [completedTeam, setCompletedTeam] = useState<Team | null>(null);
  const tournamentId = tournament.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId) { setError("Please select a team."); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await sellPlayer(tournamentId, player.id, teamId, Number(soldPrice));

      const team = teams.find(t => t.id === teamId);
      const teamPlayersCount = players.filter(p => p.team_id === teamId && p.status === 'Sold').length;

      if (team && teamPlayersCount + 1 >= Number(tournament.max_players_per_team)) {
        onSold(res.player, true);
        setCompletedTeam(team);
      } else {
        onSold(res.player);
      }
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to sell player.");
    } finally {
      setSubmitting(false);
    }
  };

  const basePrice = Number(tournament.player_base_price);
  const teamBudget = Number(tournament.team_budget);

  if (completedTeam) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4" onClick={onClose}>
        {/* Celebration Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-500/20 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/20 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '1s' }} />
          <svg className="absolute top-[0%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] min-w-[1200px] max-w-[1920px] opacity-90 animate-fade-in" xmlns="http://www.w3.org/2000/svg" xmlSpace="preserve" viewBox="0 0 1240 100"><path fill="#FFD336" d="M133.9 13.9c0-.1-.7-.2-.8-.2s-.8-.1-.8-.2c.3.8-.2 1.4-.5 2.1-.4.8-.3 1.5.4 2.1.1.1.6.2.8.2s.7 0 .8.2c-.6-.6-.7-1.3-.4-2.1.3-.6.9-1.3.5-2.1m160.8 7.6c.3.3 1.3.5 1.6.6.4.1 1.3.2 1.6.6-1.3-1.4-1.6-3.1-1.1-4.6.5-1.4 1.3-2.7.5-4.5-.1-.2-1.4-.5-1.6-.6s-1.5-.4-1.6-.6c.8 1.8 0 3.1-.5 4.5-.5 1.6-.2 3.2 1.1 4.6" /><path fill="#3CA8F1" d="M214.2 25.3c.3.3 1.3.5 1.6.6.4.1 1.3.2 1.6.6-1.3-1.4-1.6-3.1-1.1-4.6.5-1.4 1.3-2.7.5-4.5-.1-.2-1.4-.5-1.6-.6s-1.5-.4-1.6-.6c.8 1.8 0 3.1-.5 4.5-.6 1.5-.3 3.2 1.1 4.6" /><path fill="#FFD336" d="M188.2 63.3c.3.3 1.3.5 1.7.6s1.4.3 1.7.6c-1.4-1.5-1.7-3.2-1.2-4.8.5-1.5 1.4-2.8.5-4.7-.1-.2-1.5-.5-1.7-.6s-1.6-.4-1.7-.6c.9 1.9 0 3.2-.5 4.7-.5 1.6-.1 3.4 1.2 4.8" /><path fill="#FF639E" d="M22.4 50.7c.3.2 1.1.1 1.4.1s1.1-.1 1.4.1c-1.1-.8-1.5-1.9-1.1-3.2.3-1.2 1-2.3.2-3.5-.1-.1-1.2-.1-1.4-.1s-1.3.1-1.4-.1c.8 1.1.1 2.3-.2 3.5-.4 1.3 0 2.5 1.1 3.2" /><path fill="#00DDC8" d="M143.8 42.8c-.2.1-.9-.1-1.2-.1s-.9-.2-1.2-.1c-1.3.7-1.9 2.2-1.5 3.6 0 .1 1.1.1 1.2.1s1.2 0 1.2.1c-.5-1.4.1-3 1.5-3.6" /><path fill="#F42B75" d="M26.4 8.5c-.1-1.8-2.9-1.7-2.8.1s2.9 1.7 2.8-.1" /><path fill="#FFD336" d="M349.4 7.1c-.1-1.8-2.9-1.7-2.8.1s2.9 1.7 2.8-.1" /><path fill="#3CA8F1" d="M350.8 37.2c-.1-1.8-2.9-1.7-2.8.1 0 1.8 2.8 1.7 2.8-.1m-22.9-.4c.1 1.8 2.9 1.7 2.8-.1s-2.9-1.7-2.8.1" /><path fill="#F42B75" d="M388 46.6c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-1.9-1.1-1.9.1m112-17c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-1.9-1.1-1.9.1M369.5 9.1c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#FFD336" d="M691.1 11.8c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#3CA8F1" d="M312.3 0H310c.5.7 1.7.7 2.3 0M116.9 86.9c.1 1.8 2.9 1.7 2.8-.1s-2.9-1.7-2.8.1m303.5-64.7c.1 1.8 2.9 1.7 2.8-.1s-2.9-1.7-2.8.1m61-12c.1 1.8 2.9 1.7 2.8-.1s-2.9-1.7-2.8.1M230.7 44.1c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1m367-36c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#F42B75" d="M245.3 52.6c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1m54.6-10.5c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#FF639E" d="M255.7 61.8c.1 1.2 1.9 1.1 1.9-.1s-1.9-1.1-1.9.1" /><path fill="#FFD336" d="M285.2 15.1c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#FF639E" d="M194.5 12.9c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#F42B75" d="M68.7 37.4c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#3CA8F1" d="m172.7 18.2-.6-.9-.4 1-1.1.3.9.7-.1 1.2 1-.6 1.1.4-.3-1.1.7-.9z" /><path fill="#00DDC8" d="m328.7 64-1.1-1.6-.6 1.8-1.9.6 1.6 1.1-.1 2 1.6-1.1 1.8.6-.6-1.8 1.2-1.6zM122 63.1l.5 1.2.6-1.2 1.4-.1-.9-1 .3-1.3-1.3.6-1.1-.7.1 1.3-1 .9zM0 79.9l1 .2.6 1.3.7-1.3 1.4-.1-.9-1 .3-1.4-1.3.5-1.3-.7.2 1.4-.7.7z" /><path fill="#FF639E" d="m103.3 14.5 1.1 2 1-2 2.2-.4-1.6-1.6.3-2.3-2 1.1-2.1-1 .5 2.3-1.7 1.6z" /><path fill="#00DDC8" d="M53 1.9c.1-.4.2-.7.3-1l.3-.9h-.8c0 .1.1.2.1.3.1.5.2 1 .1 1.6m-3.1 2.3c0 .2-.1.3-.2.5 0-.1.1-.1.1-.2-.1.6 0 1.2.6 1.9 1.2 1.4 2.6 2.6 3.9 3.8-.3-.2 1.1-2.5.8-2.7-1-.9-2-1.8-2.9-2.7-.4-.4-.8-.8-1.1-1.2-.4-.5-.6-1-.6-1.6-.2.7-.4 1.4-.6 2.2" /><path fill="#00CCB3" d="M52.9.3c-.6.3-1.3.4-1.8.9-.6.6-.8 1.7-1 2.4-.1.3-.2.4-.2.6.2-.7.4-1.5.7-2.2 0 .6.2 1.1.6 1.6.3-.1.6-.2.9-.4.5-.3.8-.7 1-1.2 0-.7-.1-1.2-.2-1.7" /><path fill="#F42B75" d="M94.2 51c1.1.1 2-.4 2.4-1.4.1-.2-.1-.9-.2-1.1 0-.3-.3-.9-.2-1.1-.4 1-1.3 1.5-2.4 1.4-1-.1-2-.4-2.8.4-.1.1.1 1 .2 1.1 0 .1.3 1 .2 1.1.8-.8 1.8-.5 2.8-.4" /><path fill="#00DDC8" d="M157.7 71.6c1.3-.7 2.8-1.1 3.2-2.7 0-.2-.9-1.1-1.1-1.2-.1-.2-1.1-1-1.1-1.2-.3 1.6-1.9 2-3.2 2.7-1.4.8-2.1 2-1.8 3.7.1.4.8 1 1.1 1.2.2.3 1 .8 1.1 1.2-.3-1.6.4-2.9 1.8-3.7" /><path fill="#FF639E" d="M58 76.5c.3-.1 1.2.3 1.6.4s1.2.5 1.6.3c1.9-.6 3-2.5 2.7-4.5 0-.1-1.4-.3-1.6-.4-.1 0-1.5-.2-1.6-.3.3 2-.9 3.9-2.7 4.5m189.9-62.2c.2-1.8-2.6-2.1-2.8-.3s2.5 2.1 2.8.3" /><path fill="#F42B75" d="M39.6 100h1.9c-.6-.4-1.4-.4-1.9 0m6.5-37.5c-.2 1.8 2.6 2.1 2.8.3s-2.6-2.1-2.8-.3" /><path fill="#FF639E" d="m90.2 80.3-.7-1.7-.9 1.6-1.8.2 1.2 1.3-.4 1.8 1.7-.7 1.5.9-.2-1.8 1.4-1.2z" /><path fill="#FFD336" d="M266.4 36c-.1-.2-1.2-.3-1.4-.3s-1.3-.1-1.4-.3c.6 1.3-.3 2.3-.8 3.4-.6 1.2-.4 2.5.6 3.4.2.2 1.1.2 1.4.3s1.1.1 1.4.3c-1-.9-1.2-2.2-.6-3.4.6-1.1 1.4-2.1.8-3.4m538.5-11.1c0-.1-.7-.2-.8-.2s-.8-.1-.8-.2c.3.8-.2 1.4-.5 2.1-.4.8-.3 1.5.4 2.1.1.1.6.2.8.2s.7 0 .8.2c-.6-.6-.7-1.3-.4-2.1.3-.6.9-1.3.5-2.1m313.9-23.8c.1-.1.6-.1.8-.2.2 0 .7-.1.8-.2.2-.2.4-.5.5-.8h-1.6c0 .5-.1.9-.5 1.2m-163.1 0c.5 1.6.2 3.2-1.1 4.6.3-.3 1.3-.4 1.6-.6.4-.1 1.3-.3 1.6-.6 1.3-1.4 1.6-3 1.1-4.5h-3.7c.2.3.4.7.5 1.1" /><path fill="#3CA8F1" d="M1036.4 0c-.3.1-.6.2-.6.3-.8 1.8 0 3.1.5 4.5.5 1.6.2 3.2-1.1 4.6.3-.3 1.3-.4 1.6-.6.4-.1 1.3-.3 1.6-.6 1.3-1.4 1.7-3.1 1.1-4.6-.4-1.2-1-2.3-.8-3.6z" /><path fill="#FFD336" d="M1062.6 46.9c.4-.1 1.4-.3 1.7-.6 1.4-1.5 1.7-3.2 1.2-4.8-.5-1.5-1.4-2.8-.5-4.7-.1.2-1.5.5-1.7.6s-1.6.4-1.7.6c-.9 1.9 0 3.2.5 4.7.5 1.6.2 3.4-1.2 4.8.3-.3 1.3-.4 1.7-.6" /><path fill="#FF639E" d="M1231 27c-.1.1-1.2 0-1.4.1-.2 0-1.3-.1-1.4.1-.8 1.1-.1 2.3.2 3.5.4 1.3 0 2.5-1.1 3.2.3-.2 1.1 0 1.4-.1.3 0 1.1.1 1.4-.1 1.1-.8 1.5-1.9 1.1-3.2-.3-1.2-.9-2.3-.2-3.5" /><path fill="#00DDC8" d="M1111.5 29.3c.1 0 1.2 0 1.2-.1.5-1.4-.2-2.9-1.5-3.6-.3-.1-.9.1-1.2.1-.2 0-1 .2-1.2.1 1.3.7 1.9 2.2 1.5 3.6 0-.1 1.1-.1 1.2-.1" /><path fill="#3CA8F1" d="M901.8 20.2c-.1 1.8 2.7 1.9 2.8.1s-2.7-1.9-2.8-.1m22.9-.4c.1-1.8-2.7-1.9-2.8-.1s2.7 1.9 2.8.1" /><path fill="#F42B75" d="M862.7 29.5c-.1 1.2 1.8 1.3 1.9.1 0-1.2-1.9-1.3-1.9-.1" /><path fill="#FFD336" d="M782.6 34.7c-.1 1.2 1.8 1.3 1.9.1s-1.8-1.3-1.9-.1" /><path fill="#3CA8F1" d="M1135.7 69.9c.1-1.8-2.7-1.9-2.8-.1s2.7 1.9 2.8.1M829.4 5.1c-.1 1.8 2.7 1.9 2.8.1s-2.7-1.9-2.8-.1M1020 27c-.1 1.2 1.8 1.3 1.9.1 0-1.2-1.8-1.3-1.9-.1" /><path fill="#F42B75" d="M1005.4 35.5c-.1 1.2 1.8 1.3 1.9.1s-1.8-1.3-1.9-.1M950.8 25c-.1 1.2 1.8 1.3 1.9.1s-1.8-1.3-1.9-.1" /><path fill="#FF639E" d="M994.9 44.7c-.1 1.2 1.8 1.3 1.9.1s-1.8-1.3-1.9-.1" /><path fill="#F42B75" d="M1183.9 20.4c.1-1.2-1.8-1.3-1.9-.1 0 1.2 1.8 1.3 1.9.1" /><path fill="#3CA8F1" d="m1080.8 1.3-.4-1-.6.9-1.1.1.7.9-.3 1.1 1.1-.4.9.6V2.3l.9-.7z" /><path fill="#00DDC8" d="m925.6 47.2-.6-1.8-1.1 1.6h-2l1.2 1.6-.6 1.8 1.9-.6 1.6 1.1-.1-2 1.6-1.1zm203.8-1.1.7 1.2.5-1.2 1.3-.3-1-.9.2-1.3-1.2.7-1.2-.6.3 1.3-.9 1z" /><path fill="#F42B75" d="M1155.9 32.6c.4 1 1.3 1.5 2.4 1.4 1-.1 2-.4 2.8.4-.1-.1.2-1 .2-1.1s.2-1 .2-1.1c-.8-.8-1.8-.5-2.8-.4-1.1.1-2-.4-2.4-1.4.1.2-.1.9-.2 1.1s-.3.8-.2 1.1" /><path fill="#00DDC8" d="M1097.8 57c.2-.3 1-.9 1.1-1.2.3-1.6-.4-2.9-1.8-3.7-1.3-.7-2.8-1.1-3.2-2.7 0 .2-1 1.1-1.1 1.2-.1.2-1.1 1-1.1 1.2.3 1.6 1.9 2 3.2 2.7 1.4.8 2.1 2 1.8 3.7.1-.3.8-.9 1.1-1.2" /><path fill="#FF639E" d="M1190.3 55.4c-.1 0-1.5.3-1.6.4-.3 1.9.9 3.8 2.7 4.5.4.1 1.2-.3 1.6-.3.3-.1 1.2-.5 1.6-.4-1.9-.6-3-2.5-2.7-4.5-.1.1-1.5.3-1.6.3" /><path fill="#F42B75" d="M1213.4 83.9c-.2-1.8-3-1.5-2.8.3s3 1.5 2.8-.3m-6.9-38.4c-.2-1.8-3-1.5-2.8.3s3 1.5 2.8-.3" /><path fill="#FF639E" d="m1163.9 63.2-.9-1.6-.7 1.7-1.8.4 1.4 1.2-.2 1.8 1.6-.9 1.7.7-.5-1.8 1.3-1.3z" /><path fill="#FFD336" d="M987.7 25.6c.3-.1 1.1-.1 1.4-.3 1-.9 1.2-2.2.6-3.4-.5-1.1-1.4-2.2-.8-3.4-.1.1-1.2.2-1.4.3-.2 0-1.3.1-1.4.3-.6 1.3.3 2.3.8 3.4.6 1.2.4 2.5-.6 3.4.3-.3 1.1-.3 1.4-.3" /></svg>
          <svg className="absolute top-[20%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] min-w-[1200px] max-w-[1920px] opacity-90 animate-fade-in" xmlns="http://www.w3.org/2000/svg" xmlSpace="preserve" viewBox="0 0 1240 100"><path fill="#FFD336" d="M133.9 13.9c0-.1-.7-.2-.8-.2s-.8-.1-.8-.2c.3.8-.2 1.4-.5 2.1-.4.8-.3 1.5.4 2.1.1.1.6.2.8.2s.7 0 .8.2c-.6-.6-.7-1.3-.4-2.1.3-.6.9-1.3.5-2.1m160.8 7.6c.3.3 1.3.5 1.6.6.4.1 1.3.2 1.6.6-1.3-1.4-1.6-3.1-1.1-4.6.5-1.4 1.3-2.7.5-4.5-.1-.2-1.4-.5-1.6-.6s-1.5-.4-1.6-.6c.8 1.8 0 3.1-.5 4.5-.5 1.6-.2 3.2 1.1 4.6" /><path fill="#3CA8F1" d="M214.2 25.3c.3.3 1.3.5 1.6.6.4.1 1.3.2 1.6.6-1.3-1.4-1.6-3.1-1.1-4.6.5-1.4 1.3-2.7.5-4.5-.1-.2-1.4-.5-1.6-.6s-1.5-.4-1.6-.6c.8 1.8 0 3.1-.5 4.5-.6 1.5-.3 3.2 1.1 4.6" /><path fill="#FFD336" d="M188.2 63.3c.3.3 1.3.5 1.7.6s1.4.3 1.7.6c-1.4-1.5-1.7-3.2-1.2-4.8.5-1.5 1.4-2.8.5-4.7-.1-.2-1.5-.5-1.7-.6s-1.6-.4-1.7-.6c.9 1.9 0 3.2-.5 4.7-.5 1.6-.1 3.4 1.2 4.8" /><path fill="#FF639E" d="M22.4 50.7c.3.2 1.1.1 1.4.1s1.1-.1 1.4.1c-1.1-.8-1.5-1.9-1.1-3.2.3-1.2 1-2.3.2-3.5-.1-.1-1.2-.1-1.4-.1s-1.3.1-1.4-.1c.8 1.1.1 2.3-.2 3.5-.4 1.3 0 2.5 1.1 3.2" /><path fill="#00DDC8" d="M143.8 42.8c-.2.1-.9-.1-1.2-.1s-.9-.2-1.2-.1c-1.3.7-1.9 2.2-1.5 3.6 0 .1 1.1.1 1.2.1s1.2 0 1.2.1c-.5-1.4.1-3 1.5-3.6" /><path fill="#F42B75" d="M26.4 8.5c-.1-1.8-2.9-1.7-2.8.1s2.9 1.7 2.8-.1" /><path fill="#FFD336" d="M349.4 7.1c-.1-1.8-2.9-1.7-2.8.1s2.9 1.7 2.8-.1" /><path fill="#3CA8F1" d="M350.8 37.2c-.1-1.8-2.9-1.7-2.8.1 0 1.8 2.8 1.7 2.8-.1m-22.9-.4c.1 1.8 2.9 1.7 2.8-.1s-2.9-1.7-2.8.1" /><path fill="#F42B75" d="M388 46.6c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-1.9-1.1-1.9.1m112-17c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-1.9-1.1-1.9.1M369.5 9.1c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#FFD336" d="M691.1 11.8c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#3CA8F1" d="M312.3 0H310c.5.7 1.7.7 2.3 0M116.9 86.9c.1 1.8 2.9 1.7 2.8-.1s-2.9-1.7-2.8.1m303.5-64.7c.1 1.8 2.9 1.7 2.8-.1s-2.9-1.7-2.8.1m61-12c.1 1.8 2.9 1.7 2.8-.1s-2.9-1.7-2.8.1M230.7 44.1c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1m367-36c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#F42B75" d="M245.3 52.6c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1m54.6-10.5c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#FF639E" d="M255.7 61.8c.1 1.2 1.9 1.1 1.9-.1s-1.9-1.1-1.9.1" /><path fill="#FFD336" d="M285.2 15.1c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#FF639E" d="M194.5 12.9c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#F42B75" d="M68.7 37.4c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#3CA8F1" d="m172.7 18.2-.6-.9-.4 1-1.1.3.9.7-.1 1.2 1-.6 1.1.4-.3-1.1.7-.9z" /><path fill="#00DDC8" d="m328.7 64-1.1-1.6-.6 1.8-1.9.6 1.6 1.1-.1 2 1.6-1.1 1.8.6-.6-1.8 1.2-1.6zM122 63.1l.5 1.2.6-1.2 1.4-.1-.9-1 .3-1.3-1.3.6-1.1-.7.1 1.3-1 .9zM0 79.9l1 .2.6 1.3.7-1.3 1.4-.1-.9-1 .3-1.4-1.3.5-1.3-.7.2 1.4-.7.7z" /><path fill="#FF639E" d="m103.3 14.5 1.1 2 1-2 2.2-.4-1.6-1.6.3-2.3-2 1.1-2.1-1 .5 2.3-1.7 1.6z" /><path fill="#00DDC8" d="M53 1.9c.1-.4.2-.7.3-1l.3-.9h-.8c0 .1.1.2.1.3.1.5.2 1 .1 1.6m-3.1 2.3c0 .2-.1.3-.2.5 0-.1.1-.1.1-.2-.1.6 0 1.2.6 1.9 1.2 1.4 2.6 2.6 3.9 3.8-.3-.2 1.1-2.5.8-2.7-1-.9-2-1.8-2.9-2.7-.4-.4-.8-.8-1.1-1.2-.4-.5-.6-1-.6-1.6-.2.7-.4 1.4-.6 2.2" /><path fill="#00CCB3" d="M52.9.3c-.6.3-1.3.4-1.8.9-.6.6-.8 1.7-1 2.4-.1.3-.2.4-.2.6.2-.7.4-1.5.7-2.2 0 .6.2 1.1.6 1.6.3-.1.6-.2.9-.4.5-.3.8-.7 1-1.2 0-.7-.1-1.2-.2-1.7" /><path fill="#F42B75" d="M94.2 51c1.1.1 2-.4 2.4-1.4.1-.2-.1-.9-.2-1.1 0-.3-.3-.9-.2-1.1-.4 1-1.3 1.5-2.4 1.4-1-.1-2-.4-2.8.4-.1.1.1 1 .2 1.1 0 .1.3 1 .2 1.1.8-.8 1.8-.5 2.8-.4" /><path fill="#00DDC8" d="M157.7 71.6c1.3-.7 2.8-1.1 3.2-2.7 0-.2-.9-1.1-1.1-1.2-.1-.2-1.1-1-1.1-1.2-.3 1.6-1.9 2-3.2 2.7-1.4.8-2.1 2-1.8 3.7.1.4.8 1 1.1 1.2.2.3 1 .8 1.1 1.2-.3-1.6.4-2.9 1.8-3.7" /><path fill="#FF639E" d="M58 76.5c.3-.1 1.2.3 1.6.4s1.2.5 1.6.3c1.9-.6 3-2.5 2.7-4.5 0-.1-1.4-.3-1.6-.4-.1 0-1.5-.2-1.6-.3.3 2-.9 3.9-2.7 4.5m189.9-62.2c.2-1.8-2.6-2.1-2.8-.3s2.5 2.1 2.8.3" /><path fill="#F42B75" d="M39.6 100h1.9c-.6-.4-1.4-.4-1.9 0m6.5-37.5c-.2 1.8 2.6 2.1 2.8.3s-2.6-2.1-2.8-.3" /><path fill="#FF639E" d="m90.2 80.3-.7-1.7-.9 1.6-1.8.2 1.2 1.3-.4 1.8 1.7-.7 1.5.9-.2-1.8 1.4-1.2z" /><path fill="#FFD336" d="M266.4 36c-.1-.2-1.2-.3-1.4-.3s-1.3-.1-1.4-.3c.6 1.3-.3 2.3-.8 3.4-.6 1.2-.4 2.5.6 3.4.2.2 1.1.2 1.4.3s1.1.1 1.4.3c-1-.9-1.2-2.2-.6-3.4.6-1.1 1.4-2.1.8-3.4m538.5-11.1c0-.1-.7-.2-.8-.2s-.8-.1-.8-.2c.3.8-.2 1.4-.5 2.1-.4.8-.3 1.5.4 2.1.1.1.6.2.8.2s.7 0 .8.2c-.6-.6-.7-1.3-.4-2.1.3-.6.9-1.3.5-2.1m313.9-23.8c.1-.1.6-.1.8-.2.2 0 .7-.1.8-.2.2-.2.4-.5.5-.8h-1.6c0 .5-.1.9-.5 1.2m-163.1 0c.5 1.6.2 3.2-1.1 4.6.3-.3 1.3-.4 1.6-.6.4-.1 1.3-.3 1.6-.6 1.3-1.4 1.6-3 1.1-4.5h-3.7c.2.3.4.7.5 1.1" /><path fill="#3CA8F1" d="M1036.4 0c-.3.1-.6.2-.6.3-.8 1.8 0 3.1.5 4.5.5 1.6.2 3.2-1.1 4.6.3-.3 1.3-.4 1.6-.6.4-.1 1.3-.3 1.6-.6 1.3-1.4 1.7-3.1 1.1-4.6-.4-1.2-1-2.3-.8-3.6z" /><path fill="#FFD336" d="M1062.6 46.9c.4-.1 1.4-.3 1.7-.6 1.4-1.5 1.7-3.2 1.2-4.8-.5-1.5-1.4-2.8-.5-4.7-.1.2-1.5.5-1.7.6s-1.6.4-1.7.6c-.9 1.9 0 3.2.5 4.7.5 1.6.2 3.4-1.2 4.8.3-.3 1.3-.4 1.7-.6" /><path fill="#FF639E" d="M1231 27c-.1.1-1.2 0-1.4.1-.2 0-1.3-.1-1.4.1-.8 1.1-.1 2.3.2 3.5.4 1.3 0 2.5-1.1 3.2.3-.2 1.1 0 1.4-.1.3 0 1.1.1 1.4-.1 1.1-.8 1.5-1.9 1.1-3.2-.3-1.2-.9-2.3-.2-3.5" /><path fill="#00DDC8" d="M1111.5 29.3c.1 0 1.2 0 1.2-.1.5-1.4-.2-2.9-1.5-3.6-.3-.1-.9.1-1.2.1-.2 0-1 .2-1.2.1 1.3.7 1.9 2.2 1.5 3.6 0-.1 1.1-.1 1.2-.1" /><path fill="#3CA8F1" d="M901.8 20.2c-.1 1.8 2.7 1.9 2.8.1s-2.7-1.9-2.8-.1m22.9-.4c.1-1.8-2.7-1.9-2.8-.1s2.7 1.9 2.8.1" /><path fill="#F42B75" d="M862.7 29.5c-.1 1.2 1.8 1.3 1.9.1 0-1.2-1.9-1.3-1.9-.1" /><path fill="#FFD336" d="M782.6 34.7c-.1 1.2 1.8 1.3 1.9.1s-1.8-1.3-1.9-.1" /><path fill="#3CA8F1" d="M1135.7 69.9c.1-1.8-2.7-1.9-2.8-.1s2.7 1.9 2.8.1M829.4 5.1c-.1 1.8 2.7 1.9 2.8.1s-2.7-1.9-2.8-.1M1020 27c-.1 1.2 1.8 1.3 1.9.1 0-1.2-1.8-1.3-1.9-.1" /><path fill="#F42B75" d="M1005.4 35.5c-.1 1.2 1.8 1.3 1.9.1s-1.8-1.3-1.9-.1M950.8 25c-.1 1.2 1.8 1.3 1.9.1s-1.8-1.3-1.9-.1" /><path fill="#FF639E" d="M994.9 44.7c-.1 1.2 1.8 1.3 1.9.1s-1.8-1.3-1.9-.1" /><path fill="#F42B75" d="M1183.9 20.4c.1-1.2-1.8-1.3-1.9-.1 0 1.2 1.8 1.3 1.9.1" /><path fill="#3CA8F1" d="m1080.8 1.3-.4-1-.6.9-1.1.1.7.9-.3 1.1 1.1-.4.9.6V2.3l.9-.7z" /><path fill="#00DDC8" d="m925.6 47.2-.6-1.8-1.1 1.6h-2l1.2 1.6-.6 1.8 1.9-.6 1.6 1.1-.1-2 1.6-1.1zm203.8-1.1.7 1.2.5-1.2 1.3-.3-1-.9.2-1.3-1.2.7-1.2-.6.3 1.3-.9 1z" /><path fill="#F42B75" d="M1155.9 32.6c.4 1 1.3 1.5 2.4 1.4 1-.1 2-.4 2.8.4-.1-.1.2-1 .2-1.1s.2-1 .2-1.1c-.8-.8-1.8-.5-2.8-.4-1.1.1-2-.4-2.4-1.4.1.2-.1.9-.2 1.1s-.3.8-.2 1.1" /><path fill="#00DDC8" d="M1097.8 57c.2-.3 1-.9 1.1-1.2.3-1.6-.4-2.9-1.8-3.7-1.3-.7-2.8-1.1-3.2-2.7 0 .2-1 1.1-1.1 1.2-.1.2-1.1 1-1.1 1.2.3 1.6 1.9 2 3.2 2.7 1.4.8 2.1 2 1.8 3.7.1-.3.8-.9 1.1-1.2" /><path fill="#FF639E" d="M1190.3 55.4c-.1 0-1.5.3-1.6.4-.3 1.9.9 3.8 2.7 4.5.4.1 1.2-.3 1.6-.3.3-.1 1.2-.5 1.6-.4-1.9-.6-3-2.5-2.7-4.5-.1.1-1.5.3-1.6.3" /><path fill="#F42B75" d="M1213.4 83.9c-.2-1.8-3-1.5-2.8.3s3 1.5 2.8-.3m-6.9-38.4c-.2-1.8-3-1.5-2.8.3s3 1.5 2.8-.3" /><path fill="#FF639E" d="m1163.9 63.2-.9-1.6-.7 1.7-1.8.4 1.4 1.2-.2 1.8 1.6-.9 1.7.7-.5-1.8 1.3-1.3z" /><path fill="#FFD336" d="M987.7 25.6c.3-.1 1.1-.1 1.4-.3 1-.9 1.2-2.2.6-3.4-.5-1.1-1.4-2.2-.8-3.4-.1.1-1.2.2-1.4.3-.2 0-1.3.1-1.4.3-.6 1.3.3 2.3.8 3.4.6 1.2.4 2.5-.6 3.4.3-.3 1.1-.3 1.4-.3" /></svg>
          <svg className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] min-w-[1200px] max-w-[1920px] opacity-90 animate-fade-in" xmlns="http://www.w3.org/2000/svg" xmlSpace="preserve" viewBox="0 0 1240 100"><path fill="#FFD336" d="M133.9 13.9c0-.1-.7-.2-.8-.2s-.8-.1-.8-.2c.3.8-.2 1.4-.5 2.1-.4.8-.3 1.5.4 2.1.1.1.6.2.8.2s.7 0 .8.2c-.6-.6-.7-1.3-.4-2.1.3-.6.9-1.3.5-2.1m160.8 7.6c.3.3 1.3.5 1.6.6.4.1 1.3.2 1.6.6-1.3-1.4-1.6-3.1-1.1-4.6.5-1.4 1.3-2.7.5-4.5-.1-.2-1.4-.5-1.6-.6s-1.5-.4-1.6-.6c.8 1.8 0 3.1-.5 4.5-.5 1.6-.2 3.2 1.1 4.6" /><path fill="#3CA8F1" d="M214.2 25.3c.3.3 1.3.5 1.6.6.4.1 1.3.2 1.6.6-1.3-1.4-1.6-3.1-1.1-4.6.5-1.4 1.3-2.7.5-4.5-.1-.2-1.4-.5-1.6-.6s-1.5-.4-1.6-.6c.8 1.8 0 3.1-.5 4.5-.6 1.5-.3 3.2 1.1 4.6" /><path fill="#FFD336" d="M188.2 63.3c.3.3 1.3.5 1.7.6s1.4.3 1.7.6c-1.4-1.5-1.7-3.2-1.2-4.8.5-1.5 1.4-2.8.5-4.7-.1-.2-1.5-.5-1.7-.6s-1.6-.4-1.7-.6c.9 1.9 0 3.2-.5 4.7-.5 1.6-.1 3.4 1.2 4.8" /><path fill="#FF639E" d="M22.4 50.7c.3.2 1.1.1 1.4.1s1.1-.1 1.4.1c-1.1-.8-1.5-1.9-1.1-3.2.3-1.2 1-2.3.2-3.5-.1-.1-1.2-.1-1.4-.1s-1.3.1-1.4-.1c.8 1.1.1 2.3-.2 3.5-.4 1.3 0 2.5 1.1 3.2" /><path fill="#00DDC8" d="M143.8 42.8c-.2.1-.9-.1-1.2-.1s-.9-.2-1.2-.1c-1.3.7-1.9 2.2-1.5 3.6 0 .1 1.1.1 1.2.1s1.2 0 1.2.1c-.5-1.4.1-3 1.5-3.6" /><path fill="#F42B75" d="M26.4 8.5c-.1-1.8-2.9-1.7-2.8.1s2.9 1.7 2.8-.1" /><path fill="#FFD336" d="M349.4 7.1c-.1-1.8-2.9-1.7-2.8.1s2.9 1.7 2.8-.1" /><path fill="#3CA8F1" d="M350.8 37.2c-.1-1.8-2.9-1.7-2.8.1 0 1.8 2.8 1.7 2.8-.1m-22.9-.4c.1 1.8 2.9 1.7 2.8-.1s-2.9-1.7-2.8.1" /><path fill="#F42B75" d="M388 46.6c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-1.9-1.1-1.9.1m112-17c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-1.9-1.1-1.9.1M369.5 9.1c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#FFD336" d="M691.1 11.8c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#3CA8F1" d="M312.3 0H310c.5.7 1.7.7 2.3 0M116.9 86.9c.1 1.8 2.9 1.7 2.8-.1s-2.9-1.7-2.8.1m303.5-64.7c.1 1.8 2.9 1.7 2.8-.1s-2.9-1.7-2.8.1m61-12c.1 1.8 2.9 1.7 2.8-.1s-2.9-1.7-2.8.1M230.7 44.1c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1m367-36c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#F42B75" d="M245.3 52.6c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1m54.6-10.5c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#FF639E" d="M255.7 61.8c.1 1.2 1.9 1.1 1.9-.1s-1.9-1.1-1.9.1" /><path fill="#FFD336" d="M285.2 15.1c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#FF639E" d="M194.5 12.9c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#F42B75" d="M68.7 37.4c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#3CA8F1" d="m172.7 18.2-.6-.9-.4 1-1.1.3.9.7-.1 1.2 1-.6 1.1.4-.3-1.1.7-.9z" /><path fill="#00DDC8" d="m328.7 64-1.1-1.6-.6 1.8-1.9.6 1.6 1.1-.1 2 1.6-1.1 1.8.6-.6-1.8 1.2-1.6zM122 63.1l.5 1.2.6-1.2 1.4-.1-.9-1 .3-1.3-1.3.6-1.1-.7.1 1.3-1 .9zM0 79.9l1 .2.6 1.3.7-1.3 1.4-.1-.9-1 .3-1.4-1.3.5-1.3-.7.2 1.4-.7.7z" /><path fill="#FF639E" d="m103.3 14.5 1.1 2 1-2 2.2-.4-1.6-1.6.3-2.3-2 1.1-2.1-1 .5 2.3-1.7 1.6z" /><path fill="#00DDC8" d="M53 1.9c.1-.4.2-.7.3-1l.3-.9h-.8c0 .1.1.2.1.3.1.5.2 1 .1 1.6m-3.1 2.3c0 .2-.1.3-.2.5 0-.1.1-.1.1-.2-.1.6 0 1.2.6 1.9 1.2 1.4 2.6 2.6 3.9 3.8-.3-.2 1.1-2.5.8-2.7-1-.9-2-1.8-2.9-2.7-.4-.4-.8-.8-1.1-1.2-.4-.5-.6-1-.6-1.6-.2.7-.4 1.4-.6 2.2" /><path fill="#00CCB3" d="M52.9.3c-.6.3-1.3.4-1.8.9-.6.6-.8 1.7-1 2.4-.1.3-.2.4-.2.6.2-.7.4-1.5.7-2.2 0 .6.2 1.1.6 1.6.3-.1.6-.2.9-.4.5-.3.8-.7 1-1.2 0-.7-.1-1.2-.2-1.7" /><path fill="#F42B75" d="M94.2 51c1.1.1 2-.4 2.4-1.4.1-.2-.1-.9-.2-1.1 0-.3-.3-.9-.2-1.1-.4 1-1.3 1.5-2.4 1.4-1-.1-2-.4-2.8.4-.1.1.1 1 .2 1.1 0 .1.3 1 .2 1.1.8-.8 1.8-.5 2.8-.4" /><path fill="#00DDC8" d="M157.7 71.6c1.3-.7 2.8-1.1 3.2-2.7 0-.2-.9-1.1-1.1-1.2-.1-.2-1.1-1-1.1-1.2-.3 1.6-1.9 2-3.2 2.7-1.4.8-2.1 2-1.8 3.7.1.4.8 1 1.1 1.2.2.3 1 .8 1.1 1.2-.3-1.6.4-2.9 1.8-3.7" /><path fill="#FF639E" d="M58 76.5c.3-.1 1.2.3 1.6.4s1.2.5 1.6.3c1.9-.6 3-2.5 2.7-4.5 0-.1-1.4-.3-1.6-.4-.1 0-1.5-.2-1.6-.3.3 2-.9 3.9-2.7 4.5m189.9-62.2c.2-1.8-2.6-2.1-2.8-.3s2.5 2.1 2.8.3" /><path fill="#F42B75" d="M39.6 100h1.9c-.6-.4-1.4-.4-1.9 0m6.5-37.5c-.2 1.8 2.6 2.1 2.8.3s-2.6-2.1-2.8-.3" /><path fill="#FF639E" d="m90.2 80.3-.7-1.7-.9 1.6-1.8.2 1.2 1.3-.4 1.8 1.7-.7 1.5.9-.2-1.8 1.4-1.2z" /><path fill="#FFD336" d="M266.4 36c-.1-.2-1.2-.3-1.4-.3s-1.3-.1-1.4-.3c.6 1.3-.3 2.3-.8 3.4-.6 1.2-.4 2.5.6 3.4.2.2 1.1.2 1.4.3s1.1.1 1.4.3c-1-.9-1.2-2.2-.6-3.4.6-1.1 1.4-2.1.8-3.4m538.5-11.1c0-.1-.7-.2-.8-.2s-.8-.1-.8-.2c.3.8-.2 1.4-.5 2.1-.4.8-.3 1.5.4 2.1.1.1.6.2.8.2s.7 0 .8.2c-.6-.6-.7-1.3-.4-2.1.3-.6.9-1.3.5-2.1m313.9-23.8c.1-.1.6-.1.8-.2.2 0 .7-.1.8-.2.2-.2.4-.5.5-.8h-1.6c0 .5-.1.9-.5 1.2m-163.1 0c.5 1.6.2 3.2-1.1 4.6.3-.3 1.3-.4 1.6-.6.4-.1 1.3-.3 1.6-.6 1.3-1.4 1.6-3 1.1-4.5h-3.7c.2.3.4.7.5 1.1" /><path fill="#3CA8F1" d="M1036.4 0c-.3.1-.6.2-.6.3-.8 1.8 0 3.1.5 4.5.5 1.6.2 3.2-1.1 4.6.3-.3 1.3-.4 1.6-.6.4-.1 1.3-.3 1.6-.6 1.3-1.4 1.7-3.1 1.1-4.6-.4-1.2-1-2.3-.8-3.6z" /><path fill="#FFD336" d="M1062.6 46.9c.4-.1 1.4-.3 1.7-.6 1.4-1.5 1.7-3.2 1.2-4.8-.5-1.5-1.4-2.8-.5-4.7-.1.2-1.5.5-1.7.6s-1.6.4-1.7.6c-.9 1.9 0 3.2.5 4.7.5 1.6.2 3.4-1.2 4.8.3-.3 1.3-.4 1.7-.6" /><path fill="#FF639E" d="M1231 27c-.1.1-1.2 0-1.4.1-.2 0-1.3-.1-1.4.1-.8 1.1-.1 2.3.2 3.5.4 1.3 0 2.5-1.1 3.2.3-.2 1.1 0 1.4-.1.3 0 1.1.1 1.4-.1 1.1-.8 1.5-1.9 1.1-3.2-.3-1.2-.9-2.3-.2-3.5" /><path fill="#00DDC8" d="M1111.5 29.3c.1 0 1.2 0 1.2-.1.5-1.4-.2-2.9-1.5-3.6-.3-.1-.9.1-1.2.1-.2 0-1 .2-1.2.1 1.3.7 1.9 2.2 1.5 3.6 0-.1 1.1-.1 1.2-.1" /><path fill="#3CA8F1" d="M901.8 20.2c-.1 1.8 2.7 1.9 2.8.1s-2.7-1.9-2.8-.1m22.9-.4c.1-1.8-2.7-1.9-2.8-.1s2.7 1.9 2.8.1" /><path fill="#F42B75" d="M862.7 29.5c-.1 1.2 1.8 1.3 1.9.1 0-1.2-1.9-1.3-1.9-.1" /><path fill="#FFD336" d="M782.6 34.7c-.1 1.2 1.8 1.3 1.9.1s-1.8-1.3-1.9-.1" /><path fill="#3CA8F1" d="M1135.7 69.9c.1-1.8-2.7-1.9-2.8-.1s2.7 1.9 2.8.1M829.4 5.1c-.1 1.8 2.7 1.9 2.8.1s-2.7-1.9-2.8-.1M1020 27c-.1 1.2 1.8 1.3 1.9.1 0-1.2-1.8-1.3-1.9-.1" /><path fill="#F42B75" d="M1005.4 35.5c-.1 1.2 1.8 1.3 1.9.1s-1.8-1.3-1.9-.1M950.8 25c-.1 1.2 1.8 1.3 1.9.1s-1.8-1.3-1.9-.1" /><path fill="#FF639E" d="M994.9 44.7c-.1 1.2 1.8 1.3 1.9.1s-1.8-1.3-1.9-.1" /><path fill="#F42B75" d="M1183.9 20.4c.1-1.2-1.8-1.3-1.9-.1 0 1.2 1.8 1.3 1.9.1" /><path fill="#3CA8F1" d="m1080.8 1.3-.4-1-.6.9-1.1.1.7.9-.3 1.1 1.1-.4.9.6V2.3l.9-.7z" /><path fill="#00DDC8" d="m925.6 47.2-.6-1.8-1.1 1.6h-2l1.2 1.6-.6 1.8 1.9-.6 1.6 1.1-.1-2 1.6-1.1zm203.8-1.1.7 1.2.5-1.2 1.3-.3-1-.9.2-1.3-1.2.7-1.2-.6.3 1.3-.9 1z" /><path fill="#F42B75" d="M1155.9 32.6c.4 1 1.3 1.5 2.4 1.4 1-.1 2-.4 2.8.4-.1-.1.2-1 .2-1.1s.2-1 .2-1.1c-.8-.8-1.8-.5-2.8-.4-1.1.1-2-.4-2.4-1.4.1.2-.1.9-.2 1.1s-.3.8-.2 1.1" /><path fill="#00DDC8" d="M1097.8 57c.2-.3 1-.9 1.1-1.2.3-1.6-.4-2.9-1.8-3.7-1.3-.7-2.8-1.1-3.2-2.7 0 .2-1 1.1-1.1 1.2-.1.2-1.1 1-1.1 1.2.3 1.6 1.9 2 3.2 2.7 1.4.8 2.1 2 1.8 3.7.1-.3.8-.9 1.1-1.2" /><path fill="#FF639E" d="M1190.3 55.4c-.1 0-1.5.3-1.6.4-.3 1.9.9 3.8 2.7 4.5.4.1 1.2-.3 1.6-.3.3-.1 1.2-.5 1.6-.4-1.9-.6-3-2.5-2.7-4.5-.1.1-1.5.3-1.6.3" /><path fill="#F42B75" d="M1213.4 83.9c-.2-1.8-3-1.5-2.8.3s3 1.5 2.8-.3m-6.9-38.4c-.2-1.8-3-1.5-2.8.3s3 1.5 2.8-.3" /><path fill="#FF639E" d="m1163.9 63.2-.9-1.6-.7 1.7-1.8.4 1.4 1.2-.2 1.8 1.6-.9 1.7.7-.5-1.8 1.3-1.3z" /><path fill="#FFD336" d="M987.7 25.6c.3-.1 1.1-.1 1.4-.3 1-.9 1.2-2.2.6-3.4-.5-1.1-1.4-2.2-.8-3.4-.1.1-1.2.2-1.4.3-.2 0-1.3.1-1.4.3-.6 1.3.3 2.3.8 3.4.6 1.2.4 2.5-.6 3.4.3-.3 1.1-.3 1.4-.3" /></svg>
          <svg className="absolute top-[60%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] min-w-[1200px] max-w-[1920px] opacity-90 animate-fade-in" xmlns="http://www.w3.org/2000/svg" xmlSpace="preserve" viewBox="0 0 1240 100"><path fill="#FFD336" d="M133.9 13.9c0-.1-.7-.2-.8-.2s-.8-.1-.8-.2c.3.8-.2 1.4-.5 2.1-.4.8-.3 1.5.4 2.1.1.1.6.2.8.2s.7 0 .8.2c-.6-.6-.7-1.3-.4-2.1.3-.6.9-1.3.5-2.1m160.8 7.6c.3.3 1.3.5 1.6.6.4.1 1.3.2 1.6.6-1.3-1.4-1.6-3.1-1.1-4.6.5-1.4 1.3-2.7.5-4.5-.1-.2-1.4-.5-1.6-.6s-1.5-.4-1.6-.6c.8 1.8 0 3.1-.5 4.5-.5 1.6-.2 3.2 1.1 4.6" /><path fill="#3CA8F1" d="M214.2 25.3c.3.3 1.3.5 1.6.6.4.1 1.3.2 1.6.6-1.3-1.4-1.6-3.1-1.1-4.6.5-1.4 1.3-2.7.5-4.5-.1-.2-1.4-.5-1.6-.6s-1.5-.4-1.6-.6c.8 1.8 0 3.1-.5 4.5-.6 1.5-.3 3.2 1.1 4.6" /><path fill="#FFD336" d="M188.2 63.3c.3.3 1.3.5 1.7.6s1.4.3 1.7.6c-1.4-1.5-1.7-3.2-1.2-4.8.5-1.5 1.4-2.8.5-4.7-.1-.2-1.5-.5-1.7-.6s-1.6-.4-1.7-.6c.9 1.9 0 3.2-.5 4.7-.5 1.6-.1 3.4 1.2 4.8" /><path fill="#FF639E" d="M22.4 50.7c.3.2 1.1.1 1.4.1s1.1-.1 1.4.1c-1.1-.8-1.5-1.9-1.1-3.2.3-1.2 1-2.3.2-3.5-.1-.1-1.2-.1-1.4-.1s-1.3.1-1.4-.1c.8 1.1.1 2.3-.2 3.5-.4 1.3 0 2.5 1.1 3.2" /><path fill="#00DDC8" d="M143.8 42.8c-.2.1-.9-.1-1.2-.1s-.9-.2-1.2-.1c-1.3.7-1.9 2.2-1.5 3.6 0 .1 1.1.1 1.2.1s1.2 0 1.2.1c-.5-1.4.1-3 1.5-3.6" /><path fill="#F42B75" d="M26.4 8.5c-.1-1.8-2.9-1.7-2.8.1s2.9 1.7 2.8-.1" /><path fill="#FFD336" d="M349.4 7.1c-.1-1.8-2.9-1.7-2.8.1s2.9 1.7 2.8-.1" /><path fill="#3CA8F1" d="M350.8 37.2c-.1-1.8-2.9-1.7-2.8.1 0 1.8 2.8 1.7 2.8-.1m-22.9-.4c.1 1.8 2.9 1.7 2.8-.1s-2.9-1.7-2.8.1" /><path fill="#F42B75" d="M388 46.6c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-1.9-1.1-1.9.1m112-17c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-1.9-1.1-1.9.1M369.5 9.1c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#FFD336" d="M691.1 11.8c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#3CA8F1" d="M312.3 0H310c.5.7 1.7.7 2.3 0M116.9 86.9c.1 1.8 2.9 1.7 2.8-.1s-2.9-1.7-2.8.1m303.5-64.7c.1 1.8 2.9 1.7 2.8-.1s-2.9-1.7-2.8.1m61-12c.1 1.8 2.9 1.7 2.8-.1s-2.9-1.7-2.8.1M230.7 44.1c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1m367-36c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#F42B75" d="M245.3 52.6c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1m54.6-10.5c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#FF639E" d="M255.7 61.8c.1 1.2 1.9 1.1 1.9-.1s-1.9-1.1-1.9.1" /><path fill="#FFD336" d="M285.2 15.1c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#FF639E" d="M194.5 12.9c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#F42B75" d="M68.7 37.4c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#3CA8F1" d="m172.7 18.2-.6-.9-.4 1-1.1.3.9.7-.1 1.2 1-.6 1.1.4-.3-1.1.7-.9z" /><path fill="#00DDC8" d="m328.7 64-1.1-1.6-.6 1.8-1.9.6 1.6 1.1-.1 2 1.6-1.1 1.8.6-.6-1.8 1.2-1.6zM122 63.1l.5 1.2.6-1.2 1.4-.1-.9-1 .3-1.3-1.3.6-1.1-.7.1 1.3-1 .9zM0 79.9l1 .2.6 1.3.7-1.3 1.4-.1-.9-1 .3-1.4-1.3.5-1.3-.7.2 1.4-.7.7z" /><path fill="#FF639E" d="m103.3 14.5 1.1 2 1-2 2.2-.4-1.6-1.6.3-2.3-2 1.1-2.1-1 .5 2.3-1.7 1.6z" /><path fill="#00DDC8" d="M53 1.9c.1-.4.2-.7.3-1l.3-.9h-.8c0 .1.1.2.1.3.1.5.2 1 .1 1.6m-3.1 2.3c0 .2-.1.3-.2.5 0-.1.1-.1.1-.2-.1.6 0 1.2.6 1.9 1.2 1.4 2.6 2.6 3.9 3.8-.3-.2 1.1-2.5.8-2.7-1-.9-2-1.8-2.9-2.7-.4-.4-.8-.8-1.1-1.2-.4-.5-.6-1-.6-1.6-.2.7-.4 1.4-.6 2.2" /><path fill="#00CCB3" d="M52.9.3c-.6.3-1.3.4-1.8.9-.6.6-.8 1.7-1 2.4-.1.3-.2.4-.2.6.2-.7.4-1.5.7-2.2 0 .6.2 1.1.6 1.6.3-.1.6-.2.9-.4.5-.3.8-.7 1-1.2 0-.7-.1-1.2-.2-1.7" /><path fill="#F42B75" d="M94.2 51c1.1.1 2-.4 2.4-1.4.1-.2-.1-.9-.2-1.1 0-.3-.3-.9-.2-1.1-.4 1-1.3 1.5-2.4 1.4-1-.1-2-.4-2.8.4-.1.1.1 1 .2 1.1 0 .1.3 1 .2 1.1.8-.8 1.8-.5 2.8-.4" /><path fill="#00DDC8" d="M157.7 71.6c1.3-.7 2.8-1.1 3.2-2.7 0-.2-.9-1.1-1.1-1.2-.1-.2-1.1-1-1.1-1.2-.3 1.6-1.9 2-3.2 2.7-1.4.8-2.1 2-1.8 3.7.1.4.8 1 1.1 1.2.2.3 1 .8 1.1 1.2-.3-1.6.4-2.9 1.8-3.7" /><path fill="#FF639E" d="M58 76.5c.3-.1 1.2.3 1.6.4s1.2.5 1.6.3c1.9-.6 3-2.5 2.7-4.5 0-.1-1.4-.3-1.6-.4-.1 0-1.5-.2-1.6-.3.3 2-.9 3.9-2.7 4.5m189.9-62.2c.2-1.8-2.6-2.1-2.8-.3s2.5 2.1 2.8.3" /><path fill="#F42B75" d="M39.6 100h1.9c-.6-.4-1.4-.4-1.9 0m6.5-37.5c-.2 1.8 2.6 2.1 2.8.3s-2.6-2.1-2.8-.3" /><path fill="#FF639E" d="m90.2 80.3-.7-1.7-.9 1.6-1.8.2 1.2 1.3-.4 1.8 1.7-.7 1.5.9-.2-1.8 1.4-1.2z" /><path fill="#FFD336" d="M266.4 36c-.1-.2-1.2-.3-1.4-.3s-1.3-.1-1.4-.3c.6 1.3-.3 2.3-.8 3.4-.6 1.2-.4 2.5.6 3.4.2.2 1.1.2 1.4.3s1.1.1 1.4.3c-1-.9-1.2-2.2-.6-3.4.6-1.1 1.4-2.1.8-3.4m538.5-11.1c0-.1-.7-.2-.8-.2s-.8-.1-.8-.2c.3.8-.2 1.4-.5 2.1-.4.8-.3 1.5.4 2.1.1.1.6.2.8.2s.7 0 .8.2c-.6-.6-.7-1.3-.4-2.1.3-.6.9-1.3.5-2.1m313.9-23.8c.1-.1.6-.1.8-.2.2 0 .7-.1.8-.2.2-.2.4-.5.5-.8h-1.6c0 .5-.1.9-.5 1.2m-163.1 0c.5 1.6.2 3.2-1.1 4.6.3-.3 1.3-.4 1.6-.6.4-.1 1.3-.3 1.6-.6 1.3-1.4 1.6-3 1.1-4.5h-3.7c.2.3.4.7.5 1.1" /><path fill="#3CA8F1" d="M1036.4 0c-.3.1-.6.2-.6.3-.8 1.8 0 3.1.5 4.5.5 1.6.2 3.2-1.1 4.6.3-.3 1.3-.4 1.6-.6.4-.1 1.3-.3 1.6-.6 1.3-1.4 1.7-3.1 1.1-4.6-.4-1.2-1-2.3-.8-3.6z" /><path fill="#FFD336" d="M1062.6 46.9c.4-.1 1.4-.3 1.7-.6 1.4-1.5 1.7-3.2 1.2-4.8-.5-1.5-1.4-2.8-.5-4.7-.1.2-1.5.5-1.7.6s-1.6.4-1.7.6c-.9 1.9 0 3.2.5 4.7.5 1.6.2 3.4-1.2 4.8.3-.3 1.3-.4 1.7-.6" /><path fill="#FF639E" d="M1231 27c-.1.1-1.2 0-1.4.1-.2 0-1.3-.1-1.4.1-.8 1.1-.1 2.3.2 3.5.4 1.3 0 2.5-1.1 3.2.3-.2 1.1 0 1.4-.1.3 0 1.1.1 1.4-.1 1.1-.8 1.5-1.9 1.1-3.2-.3-1.2-.9-2.3-.2-3.5" /><path fill="#00DDC8" d="M1111.5 29.3c.1 0 1.2 0 1.2-.1.5-1.4-.2-2.9-1.5-3.6-.3-.1-.9.1-1.2.1-.2 0-1 .2-1.2.1 1.3.7 1.9 2.2 1.5 3.6 0-.1 1.1-.1 1.2-.1" /><path fill="#3CA8F1" d="M901.8 20.2c-.1 1.8 2.7 1.9 2.8.1s-2.7-1.9-2.8-.1m22.9-.4c.1-1.8-2.7-1.9-2.8-.1s2.7 1.9 2.8.1" /><path fill="#F42B75" d="M862.7 29.5c-.1 1.2 1.8 1.3 1.9.1 0-1.2-1.9-1.3-1.9-.1" /><path fill="#FFD336" d="M782.6 34.7c-.1 1.2 1.8 1.3 1.9.1s-1.8-1.3-1.9-.1" /><path fill="#3CA8F1" d="M1135.7 69.9c.1-1.8-2.7-1.9-2.8-.1s2.7 1.9 2.8.1M829.4 5.1c-.1 1.8 2.7 1.9 2.8.1s-2.7-1.9-2.8-.1M1020 27c-.1 1.2 1.8 1.3 1.9.1 0-1.2-1.8-1.3-1.9-.1" /><path fill="#F42B75" d="M1005.4 35.5c-.1 1.2 1.8 1.3 1.9.1s-1.8-1.3-1.9-.1M950.8 25c-.1 1.2 1.8 1.3 1.9.1s-1.8-1.3-1.9-.1" /><path fill="#FF639E" d="M994.9 44.7c-.1 1.2 1.8 1.3 1.9.1s-1.8-1.3-1.9-.1" /><path fill="#F42B75" d="M1183.9 20.4c.1-1.2-1.8-1.3-1.9-.1 0 1.2 1.8 1.3 1.9.1" /><path fill="#3CA8F1" d="m1080.8 1.3-.4-1-.6.9-1.1.1.7.9-.3 1.1 1.1-.4.9.6V2.3l.9-.7z" /><path fill="#00DDC8" d="m925.6 47.2-.6-1.8-1.1 1.6h-2l1.2 1.6-.6 1.8 1.9-.6 1.6 1.1-.1-2 1.6-1.1zm203.8-1.1.7 1.2.5-1.2 1.3-.3-1-.9.2-1.3-1.2.7-1.2-.6.3 1.3-.9 1z" /><path fill="#F42B75" d="M1155.9 32.6c.4 1 1.3 1.5 2.4 1.4 1-.1 2-.4 2.8.4-.1-.1.2-1 .2-1.1s.2-1 .2-1.1c-.8-.8-1.8-.5-2.8-.4-1.1.1-2-.4-2.4-1.4.1.2-.1.9-.2 1.1s-.3.8-.2 1.1" /><path fill="#00DDC8" d="M1097.8 57c.2-.3 1-.9 1.1-1.2.3-1.6-.4-2.9-1.8-3.7-1.3-.7-2.8-1.1-3.2-2.7 0 .2-1 1.1-1.1 1.2-.1.2-1.1 1-1.1 1.2.3 1.6 1.9 2 3.2 2.7 1.4.8 2.1 2 1.8 3.7.1-.3.8-.9 1.1-1.2" /><path fill="#FF639E" d="M1190.3 55.4c-.1 0-1.5.3-1.6.4-.3 1.9.9 3.8 2.7 4.5.4.1 1.2-.3 1.6-.3.3-.1 1.2-.5 1.6-.4-1.9-.6-3-2.5-2.7-4.5-.1.1-1.5.3-1.6.3" /><path fill="#F42B75" d="M1213.4 83.9c-.2-1.8-3-1.5-2.8.3s3 1.5 2.8-.3m-6.9-38.4c-.2-1.8-3-1.5-2.8.3s3 1.5 2.8-.3" /><path fill="#FF639E" d="m1163.9 63.2-.9-1.6-.7 1.7-1.8.4 1.4 1.2-.2 1.8 1.6-.9 1.7.7-.5-1.8 1.3-1.3z" /><path fill="#FFD336" d="M987.7 25.6c.3-.1 1.1-.1 1.4-.3 1-.9 1.2-2.2.6-3.4-.5-1.1-1.4-2.2-.8-3.4-.1.1-1.2.2-1.4.3-.2 0-1.3.1-1.4.3-.6 1.3.3 2.3.8 3.4.6 1.2.4 2.5-.6 3.4.3-.3 1.1-.3 1.4-.3" /></svg>
          <svg className="absolute top-[80%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] min-w-[1200px] max-w-[1920px] opacity-90 animate-fade-in" xmlns="http://www.w3.org/2000/svg" xmlSpace="preserve" viewBox="0 0 1240 100"><path fill="#FFD336" d="M133.9 13.9c0-.1-.7-.2-.8-.2s-.8-.1-.8-.2c.3.8-.2 1.4-.5 2.1-.4.8-.3 1.5.4 2.1.1.1.6.2.8.2s.7 0 .8.2c-.6-.6-.7-1.3-.4-2.1.3-.6.9-1.3.5-2.1m160.8 7.6c.3.3 1.3.5 1.6.6.4.1 1.3.2 1.6.6-1.3-1.4-1.6-3.1-1.1-4.6.5-1.4 1.3-2.7.5-4.5-.1-.2-1.4-.5-1.6-.6s-1.5-.4-1.6-.6c.8 1.8 0 3.1-.5 4.5-.5 1.6-.2 3.2 1.1 4.6" /><path fill="#3CA8F1" d="M214.2 25.3c.3.3 1.3.5 1.6.6.4.1 1.3.2 1.6.6-1.3-1.4-1.6-3.1-1.1-4.6.5-1.4 1.3-2.7.5-4.5-.1-.2-1.4-.5-1.6-.6s-1.5-.4-1.6-.6c.8 1.8 0 3.1-.5 4.5-.6 1.5-.3 3.2 1.1 4.6" /><path fill="#FFD336" d="M188.2 63.3c.3.3 1.3.5 1.7.6s1.4.3 1.7.6c-1.4-1.5-1.7-3.2-1.2-4.8.5-1.5 1.4-2.8.5-4.7-.1-.2-1.5-.5-1.7-.6s-1.6-.4-1.7-.6c.9 1.9 0 3.2-.5 4.7-.5 1.6-.1 3.4 1.2 4.8" /><path fill="#FF639E" d="M22.4 50.7c.3.2 1.1.1 1.4.1s1.1-.1 1.4.1c-1.1-.8-1.5-1.9-1.1-3.2.3-1.2 1-2.3.2-3.5-.1-.1-1.2-.1-1.4-.1s-1.3.1-1.4-.1c.8 1.1.1 2.3-.2 3.5-.4 1.3 0 2.5 1.1 3.2" /><path fill="#00DDC8" d="M143.8 42.8c-.2.1-.9-.1-1.2-.1s-.9-.2-1.2-.1c-1.3.7-1.9 2.2-1.5 3.6 0 .1 1.1.1 1.2.1s1.2 0 1.2.1c-.5-1.4.1-3 1.5-3.6" /><path fill="#F42B75" d="M26.4 8.5c-.1-1.8-2.9-1.7-2.8.1s2.9 1.7 2.8-.1" /><path fill="#FFD336" d="M349.4 7.1c-.1-1.8-2.9-1.7-2.8.1s2.9 1.7 2.8-.1" /><path fill="#3CA8F1" d="M350.8 37.2c-.1-1.8-2.9-1.7-2.8.1 0 1.8 2.8 1.7 2.8-.1m-22.9-.4c.1 1.8 2.9 1.7 2.8-.1s-2.9-1.7-2.8.1" /><path fill="#F42B75" d="M388 46.6c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-1.9-1.1-1.9.1m112-17c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-1.9-1.1-1.9.1M369.5 9.1c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#FFD336" d="M691.1 11.8c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#3CA8F1" d="M312.3 0H310c.5.7 1.7.7 2.3 0M116.9 86.9c.1 1.8 2.9 1.7 2.8-.1s-2.9-1.7-2.8.1m303.5-64.7c.1 1.8 2.9 1.7 2.8-.1s-2.9-1.7-2.8.1m61-12c.1 1.8 2.9 1.7 2.8-.1s-2.9-1.7-2.8.1M230.7 44.1c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1m367-36c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#F42B75" d="M245.3 52.6c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1m54.6-10.5c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#FF639E" d="M255.7 61.8c.1 1.2 1.9 1.1 1.9-.1s-1.9-1.1-1.9.1" /><path fill="#FFD336" d="M285.2 15.1c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#FF639E" d="M194.5 12.9c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#F42B75" d="M68.7 37.4c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#3CA8F1" d="m172.7 18.2-.6-.9-.4 1-1.1.3.9.7-.1 1.2 1-.6 1.1.4-.3-1.1.7-.9z" /><path fill="#00DDC8" d="m328.7 64-1.1-1.6-.6 1.8-1.9.6 1.6 1.1-.1 2 1.6-1.1 1.8.6-.6-1.8 1.2-1.6zM122 63.1l.5 1.2.6-1.2 1.4-.1-.9-1 .3-1.3-1.3.6-1.1-.7.1 1.3-1 .9zM0 79.9l1 .2.6 1.3.7-1.3 1.4-.1-.9-1 .3-1.4-1.3.5-1.3-.7.2 1.4-.7.7z" /><path fill="#FF639E" d="m103.3 14.5 1.1 2 1-2 2.2-.4-1.6-1.6.3-2.3-2 1.1-2.1-1 .5 2.3-1.7 1.6z" /><path fill="#00DDC8" d="M53 1.9c.1-.4.2-.7.3-1l.3-.9h-.8c0 .1.1.2.1.3.1.5.2 1 .1 1.6m-3.1 2.3c0 .2-.1.3-.2.5 0-.1.1-.1.1-.2-.1.6 0 1.2.6 1.9 1.2 1.4 2.6 2.6 3.9 3.8-.3-.2 1.1-2.5.8-2.7-1-.9-2-1.8-2.9-2.7-.4-.4-.8-.8-1.1-1.2-.4-.5-.6-1-.6-1.6-.2.7-.4 1.4-.6 2.2" /><path fill="#00CCB3" d="M52.9.3c-.6.3-1.3.4-1.8.9-.6.6-.8 1.7-1 2.4-.1.3-.2.4-.2.6.2-.7.4-1.5.7-2.2 0 .6.2 1.1.6 1.6.3-.1.6-.2.9-.4.5-.3.8-.7 1-1.2 0-.7-.1-1.2-.2-1.7" /><path fill="#F42B75" d="M94.2 51c1.1.1 2-.4 2.4-1.4.1-.2-.1-.9-.2-1.1 0-.3-.3-.9-.2-1.1-.4 1-1.3 1.5-2.4 1.4-1-.1-2-.4-2.8.4-.1.1.1 1 .2 1.1 0 .1.3 1 .2 1.1.8-.8 1.8-.5 2.8-.4" /><path fill="#00DDC8" d="M157.7 71.6c1.3-.7 2.8-1.1 3.2-2.7 0-.2-.9-1.1-1.1-1.2-.1-.2-1.1-1-1.1-1.2-.3 1.6-1.9 2-3.2 2.7-1.4.8-2.1 2-1.8 3.7.1.4.8 1 1.1 1.2.2.3 1 .8 1.1 1.2-.3-1.6.4-2.9 1.8-3.7" /><path fill="#FF639E" d="M58 76.5c.3-.1 1.2.3 1.6.4s1.2.5 1.6.3c1.9-.6 3-2.5 2.7-4.5 0-.1-1.4-.3-1.6-.4-.1 0-1.5-.2-1.6-.3.3 2-.9 3.9-2.7 4.5m189.9-62.2c.2-1.8-2.6-2.1-2.8-.3s2.5 2.1 2.8.3" /><path fill="#F42B75" d="M39.6 100h1.9c-.6-.4-1.4-.4-1.9 0m6.5-37.5c-.2 1.8 2.6 2.1 2.8.3s-2.6-2.1-2.8-.3" /><path fill="#FF639E" d="m90.2 80.3-.7-1.7-.9 1.6-1.8.2 1.2 1.3-.4 1.8 1.7-.7 1.5.9-.2-1.8 1.4-1.2z" /><path fill="#FFD336" d="M266.4 36c-.1-.2-1.2-.3-1.4-.3s-1.3-.1-1.4-.3c.6 1.3-.3 2.3-.8 3.4-.6 1.2-.4 2.5.6 3.4.2.2 1.1.2 1.4.3s1.1.1 1.4.3c-1-.9-1.2-2.2-.6-3.4.6-1.1 1.4-2.1.8-3.4m538.5-11.1c0-.1-.7-.2-.8-.2s-.8-.1-.8-.2c.3.8-.2 1.4-.5 2.1-.4.8-.3 1.5.4 2.1.1.1.6.2.8.2s.7 0 .8.2c-.6-.6-.7-1.3-.4-2.1.3-.6.9-1.3.5-2.1m313.9-23.8c.1-.1.6-.1.8-.2.2 0 .7-.1.8-.2.2-.2.4-.5.5-.8h-1.6c0 .5-.1.9-.5 1.2m-163.1 0c.5 1.6.2 3.2-1.1 4.6.3-.3 1.3-.4 1.6-.6.4-.1 1.3-.3 1.6-.6 1.3-1.4 1.6-3 1.1-4.5h-3.7c.2.3.4.7.5 1.1" /><path fill="#3CA8F1" d="M1036.4 0c-.3.1-.6.2-.6.3-.8 1.8 0 3.1.5 4.5.5 1.6.2 3.2-1.1 4.6.3-.3 1.3-.4 1.6-.6.4-.1 1.3-.3 1.6-.6 1.3-1.4 1.7-3.1 1.1-4.6-.4-1.2-1-2.3-.8-3.6z" /><path fill="#FFD336" d="M1062.6 46.9c.4-.1 1.4-.3 1.7-.6 1.4-1.5 1.7-3.2 1.2-4.8-.5-1.5-1.4-2.8-.5-4.7-.1.2-1.5.5-1.7.6s-1.6.4-1.7.6c-.9 1.9 0 3.2.5 4.7.5 1.6.2 3.4-1.2 4.8.3-.3 1.3-.4 1.7-.6" /><path fill="#FF639E" d="M1231 27c-.1.1-1.2 0-1.4.1-.2 0-1.3-.1-1.4.1-.8 1.1-.1 2.3.2 3.5.4 1.3 0 2.5-1.1 3.2.3-.2 1.1 0 1.4-.1.3 0 1.1.1 1.4-.1 1.1-.8 1.5-1.9 1.1-3.2-.3-1.2-.9-2.3-.2-3.5" /><path fill="#00DDC8" d="M1111.5 29.3c.1 0 1.2 0 1.2-.1.5-1.4-.2-2.9-1.5-3.6-.3-.1-.9.1-1.2.1-.2 0-1 .2-1.2.1 1.3.7 1.9 2.2 1.5 3.6 0-.1 1.1-.1 1.2-.1" /><path fill="#3CA8F1" d="M901.8 20.2c-.1 1.8 2.7 1.9 2.8.1s-2.7-1.9-2.8-.1m22.9-.4c.1-1.8-2.7-1.9-2.8-.1s2.7 1.9 2.8.1" /><path fill="#F42B75" d="M862.7 29.5c-.1 1.2 1.8 1.3 1.9.1 0-1.2-1.9-1.3-1.9-.1" /><path fill="#FFD336" d="M782.6 34.7c-.1 1.2 1.8 1.3 1.9.1s-1.8-1.3-1.9-.1" /><path fill="#3CA8F1" d="M1135.7 69.9c.1-1.8-2.7-1.9-2.8-.1s2.7 1.9 2.8.1M829.4 5.1c-.1 1.8 2.7 1.9 2.8.1s-2.7-1.9-2.8-.1M1020 27c-.1 1.2 1.8 1.3 1.9.1 0-1.2-1.8-1.3-1.9-.1" /><path fill="#F42B75" d="M1005.4 35.5c-.1 1.2 1.8 1.3 1.9.1s-1.8-1.3-1.9-.1M950.8 25c-.1 1.2 1.8 1.3 1.9.1s-1.8-1.3-1.9-.1" /><path fill="#FF639E" d="M994.9 44.7c-.1 1.2 1.8 1.3 1.9.1s-1.8-1.3-1.9-.1" /><path fill="#F42B75" d="M1183.9 20.4c.1-1.2-1.8-1.3-1.9-.1 0 1.2 1.8 1.3 1.9.1" /><path fill="#3CA8F1" d="m1080.8 1.3-.4-1-.6.9-1.1.1.7.9-.3 1.1 1.1-.4.9.6V2.3l.9-.7z" /><path fill="#00DDC8" d="m925.6 47.2-.6-1.8-1.1 1.6h-2l1.2 1.6-.6 1.8 1.9-.6 1.6 1.1-.1-2 1.6-1.1zm203.8-1.1.7 1.2.5-1.2 1.3-.3-1-.9.2-1.3-1.2.7-1.2-.6.3 1.3-.9 1z" /><path fill="#F42B75" d="M1155.9 32.6c.4 1 1.3 1.5 2.4 1.4 1-.1 2-.4 2.8.4-.1-.1.2-1 .2-1.1s.2-1 .2-1.1c-.8-.8-1.8-.5-2.8-.4-1.1.1-2-.4-2.4-1.4.1.2-.1.9-.2 1.1s-.3.8-.2 1.1" /><path fill="#00DDC8" d="M1097.8 57c.2-.3 1-.9 1.1-1.2.3-1.6-.4-2.9-1.8-3.7-1.3-.7-2.8-1.1-3.2-2.7 0 .2-1 1.1-1.1 1.2-.1.2-1.1 1-1.1 1.2.3 1.6 1.9 2 3.2 2.7 1.4.8 2.1 2 1.8 3.7.1-.3.8-.9 1.1-1.2" /><path fill="#FF639E" d="M1190.3 55.4c-.1 0-1.5.3-1.6.4-.3 1.9.9 3.8 2.7 4.5.4.1 1.2-.3 1.6-.3.3-.1 1.2-.5 1.6-.4-1.9-.6-3-2.5-2.7-4.5-.1.1-1.5.3-1.6.3" /><path fill="#F42B75" d="M1213.4 83.9c-.2-1.8-3-1.5-2.8.3s3 1.5 2.8-.3m-6.9-38.4c-.2-1.8-3-1.5-2.8.3s3 1.5 2.8-.3" /><path fill="#FF639E" d="m1163.9 63.2-.9-1.6-.7 1.7-1.8.4 1.4 1.2-.2 1.8 1.6-.9 1.7.7-.5-1.8 1.3-1.3z" /><path fill="#FFD336" d="M987.7 25.6c.3-.1 1.1-.1 1.4-.3 1-.9 1.2-2.2.6-3.4-.5-1.1-1.4-2.2-.8-3.4-.1.1-1.2.2-1.4.3-.2 0-1.3.1-1.4.3-.6 1.3.3 2.3.8 3.4.6 1.2.4 2.5-.6 3.4.3-.3 1.1-.3 1.4-.3" /></svg>
          <svg className="absolute top-[100%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] min-w-[1200px] max-w-[1920px] opacity-90 animate-fade-in" xmlns="http://www.w3.org/2000/svg" xmlSpace="preserve" viewBox="0 0 1240 100"><path fill="#FFD336" d="M133.9 13.9c0-.1-.7-.2-.8-.2s-.8-.1-.8-.2c.3.8-.2 1.4-.5 2.1-.4.8-.3 1.5.4 2.1.1.1.6.2.8.2s.7 0 .8.2c-.6-.6-.7-1.3-.4-2.1.3-.6.9-1.3.5-2.1m160.8 7.6c.3.3 1.3.5 1.6.6.4.1 1.3.2 1.6.6-1.3-1.4-1.6-3.1-1.1-4.6.5-1.4 1.3-2.7.5-4.5-.1-.2-1.4-.5-1.6-.6s-1.5-.4-1.6-.6c.8 1.8 0 3.1-.5 4.5-.5 1.6-.2 3.2 1.1 4.6" /><path fill="#3CA8F1" d="M214.2 25.3c.3.3 1.3.5 1.6.6.4.1 1.3.2 1.6.6-1.3-1.4-1.6-3.1-1.1-4.6.5-1.4 1.3-2.7.5-4.5-.1-.2-1.4-.5-1.6-.6s-1.5-.4-1.6-.6c.8 1.8 0 3.1-.5 4.5-.6 1.5-.3 3.2 1.1 4.6" /><path fill="#FFD336" d="M188.2 63.3c.3.3 1.3.5 1.7.6s1.4.3 1.7.6c-1.4-1.5-1.7-3.2-1.2-4.8.5-1.5 1.4-2.8.5-4.7-.1-.2-1.5-.5-1.7-.6s-1.6-.4-1.7-.6c.9 1.9 0 3.2-.5 4.7-.5 1.6-.1 3.4 1.2 4.8" /><path fill="#FF639E" d="M22.4 50.7c.3.2 1.1.1 1.4.1s1.1-.1 1.4.1c-1.1-.8-1.5-1.9-1.1-3.2.3-1.2 1-2.3.2-3.5-.1-.1-1.2-.1-1.4-.1s-1.3.1-1.4-.1c.8 1.1.1 2.3-.2 3.5-.4 1.3 0 2.5 1.1 3.2" /><path fill="#00DDC8" d="M143.8 42.8c-.2.1-.9-.1-1.2-.1s-.9-.2-1.2-.1c-1.3.7-1.9 2.2-1.5 3.6 0 .1 1.1.1 1.2.1s1.2 0 1.2.1c-.5-1.4.1-3 1.5-3.6" /><path fill="#F42B75" d="M26.4 8.5c-.1-1.8-2.9-1.7-2.8.1s2.9 1.7 2.8-.1" /><path fill="#FFD336" d="M349.4 7.1c-.1-1.8-2.9-1.7-2.8.1s2.9 1.7 2.8-.1" /><path fill="#3CA8F1" d="M350.8 37.2c-.1-1.8-2.9-1.7-2.8.1 0 1.8 2.8 1.7 2.8-.1m-22.9-.4c.1 1.8 2.9 1.7 2.8-.1s-2.9-1.7-2.8.1" /><path fill="#F42B75" d="M388 46.6c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-1.9-1.1-1.9.1m112-17c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-1.9-1.1-1.9.1M369.5 9.1c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#FFD336" d="M691.1 11.8c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#3CA8F1" d="M312.3 0H310c.5.7 1.7.7 2.3 0M116.9 86.9c.1 1.8 2.9 1.7 2.8-.1s-2.9-1.7-2.8.1m303.5-64.7c.1 1.8 2.9 1.7 2.8-.1s-2.9-1.7-2.8.1m61-12c.1 1.8 2.9 1.7 2.8-.1s-2.9-1.7-2.8.1M230.7 44.1c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1m367-36c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#F42B75" d="M245.3 52.6c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1m54.6-10.5c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#FF639E" d="M255.7 61.8c.1 1.2 1.9 1.1 1.9-.1s-1.9-1.1-1.9.1" /><path fill="#FFD336" d="M285.2 15.1c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#FF639E" d="M194.5 12.9c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#F42B75" d="M68.7 37.4c.1 1.2 1.9 1.1 1.9-.1-.1-1.2-2-1.1-1.9.1" /><path fill="#3CA8F1" d="m172.7 18.2-.6-.9-.4 1-1.1.3.9.7-.1 1.2 1-.6 1.1.4-.3-1.1.7-.9z" /><path fill="#00DDC8" d="m328.7 64-1.1-1.6-.6 1.8-1.9.6 1.6 1.1-.1 2 1.6-1.1 1.8.6-.6-1.8 1.2-1.6zM122 63.1l.5 1.2.6-1.2 1.4-.1-.9-1 .3-1.3-1.3.6-1.1-.7.1 1.3-1 .9zM0 79.9l1 .2.6 1.3.7-1.3 1.4-.1-.9-1 .3-1.4-1.3.5-1.3-.7.2 1.4-.7.7z" /><path fill="#FF639E" d="m103.3 14.5 1.1 2 1-2 2.2-.4-1.6-1.6.3-2.3-2 1.1-2.1-1 .5 2.3-1.7 1.6z" /><path fill="#00DDC8" d="M53 1.9c.1-.4.2-.7.3-1l.3-.9h-.8c0 .1.1.2.1.3.1.5.2 1 .1 1.6m-3.1 2.3c0 .2-.1.3-.2.5 0-.1.1-.1.1-.2-.1.6 0 1.2.6 1.9 1.2 1.4 2.6 2.6 3.9 3.8-.3-.2 1.1-2.5.8-2.7-1-.9-2-1.8-2.9-2.7-.4-.4-.8-.8-1.1-1.2-.4-.5-.6-1-.6-1.6-.2.7-.4 1.4-.6 2.2" /><path fill="#00CCB3" d="M52.9.3c-.6.3-1.3.4-1.8.9-.6.6-.8 1.7-1 2.4-.1.3-.2.4-.2.6.2-.7.4-1.5.7-2.2 0 .6.2 1.1.6 1.6.3-.1.6-.2.9-.4.5-.3.8-.7 1-1.2 0-.7-.1-1.2-.2-1.7" /><path fill="#F42B75" d="M94.2 51c1.1.1 2-.4 2.4-1.4.1-.2-.1-.9-.2-1.1 0-.3-.3-.9-.2-1.1-.4 1-1.3 1.5-2.4 1.4-1-.1-2-.4-2.8.4-.1.1.1 1 .2 1.1 0 .1.3 1 .2 1.1.8-.8 1.8-.5 2.8-.4" /><path fill="#00DDC8" d="M157.7 71.6c1.3-.7 2.8-1.1 3.2-2.7 0-.2-.9-1.1-1.1-1.2-.1-.2-1.1-1-1.1-1.2-.3 1.6-1.9 2-3.2 2.7-1.4.8-2.1 2-1.8 3.7.1.4.8 1 1.1 1.2.2.3 1 .8 1.1 1.2-.3-1.6.4-2.9 1.8-3.7" /><path fill="#FF639E" d="M58 76.5c.3-.1 1.2.3 1.6.4s1.2.5 1.6.3c1.9-.6 3-2.5 2.7-4.5 0-.1-1.4-.3-1.6-.4-.1 0-1.5-.2-1.6-.3.3 2-.9 3.9-2.7 4.5m189.9-62.2c.2-1.8-2.6-2.1-2.8-.3s2.5 2.1 2.8.3" /><path fill="#F42B75" d="M39.6 100h1.9c-.6-.4-1.4-.4-1.9 0m6.5-37.5c-.2 1.8 2.6 2.1 2.8.3s-2.6-2.1-2.8-.3" /><path fill="#FF639E" d="m90.2 80.3-.7-1.7-.9 1.6-1.8.2 1.2 1.3-.4 1.8 1.7-.7 1.5.9-.2-1.8 1.4-1.2z" /><path fill="#FFD336" d="M266.4 36c-.1-.2-1.2-.3-1.4-.3s-1.3-.1-1.4-.3c.6 1.3-.3 2.3-.8 3.4-.6 1.2-.4 2.5.6 3.4.2.2 1.1.2 1.4.3s1.1.1 1.4.3c-1-.9-1.2-2.2-.6-3.4.6-1.1 1.4-2.1.8-3.4m538.5-11.1c0-.1-.7-.2-.8-.2s-.8-.1-.8-.2c.3.8-.2 1.4-.5 2.1-.4.8-.3 1.5.4 2.1.1.1.6.2.8.2s.7 0 .8.2c-.6-.6-.7-1.3-.4-2.1.3-.6.9-1.3.5-2.1m313.9-23.8c.1-.1.6-.1.8-.2.2 0 .7-.1.8-.2.2-.2.4-.5.5-.8h-1.6c0 .5-.1.9-.5 1.2m-163.1 0c.5 1.6.2 3.2-1.1 4.6.3-.3 1.3-.4 1.6-.6.4-.1 1.3-.3 1.6-.6 1.3-1.4 1.6-3 1.1-4.5h-3.7c.2.3.4.7.5 1.1" /><path fill="#3CA8F1" d="M1036.4 0c-.3.1-.6.2-.6.3-.8 1.8 0 3.1.5 4.5.5 1.6.2 3.2-1.1 4.6.3-.3 1.3-.4 1.6-.6.4-.1 1.3-.3 1.6-.6 1.3-1.4 1.7-3.1 1.1-4.6-.4-1.2-1-2.3-.8-3.6z" /><path fill="#FFD336" d="M1062.6 46.9c.4-.1 1.4-.3 1.7-.6 1.4-1.5 1.7-3.2 1.2-4.8-.5-1.5-1.4-2.8-.5-4.7-.1.2-1.5.5-1.7.6s-1.6.4-1.7.6c-.9 1.9 0 3.2.5 4.7.5 1.6.2 3.4-1.2 4.8.3-.3 1.3-.4 1.7-.6" /><path fill="#FF639E" d="M1231 27c-.1.1-1.2 0-1.4.1-.2 0-1.3-.1-1.4.1-.8 1.1-.1 2.3.2 3.5.4 1.3 0 2.5-1.1 3.2.3-.2 1.1 0 1.4-.1.3 0 1.1.1 1.4-.1 1.1-.8 1.5-1.9 1.1-3.2-.3-1.2-.9-2.3-.2-3.5" /><path fill="#00DDC8" d="M1111.5 29.3c.1 0 1.2 0 1.2-.1.5-1.4-.2-2.9-1.5-3.6-.3-.1-.9.1-1.2.1-.2 0-1 .2-1.2.1 1.3.7 1.9 2.2 1.5 3.6 0-.1 1.1-.1 1.2-.1" /><path fill="#3CA8F1" d="M901.8 20.2c-.1 1.8 2.7 1.9 2.8.1s-2.7-1.9-2.8-.1m22.9-.4c.1-1.8-2.7-1.9-2.8-.1s2.7 1.9 2.8.1" /><path fill="#F42B75" d="M862.7 29.5c-.1 1.2 1.8 1.3 1.9.1 0-1.2-1.9-1.3-1.9-.1" /><path fill="#FFD336" d="M782.6 34.7c-.1 1.2 1.8 1.3 1.9.1s-1.8-1.3-1.9-.1" /><path fill="#3CA8F1" d="M1135.7 69.9c.1-1.8-2.7-1.9-2.8-.1s2.7 1.9 2.8.1M829.4 5.1c-.1 1.8 2.7 1.9 2.8.1s-2.7-1.9-2.8-.1M1020 27c-.1 1.2 1.8 1.3 1.9.1 0-1.2-1.8-1.3-1.9-.1" /><path fill="#F42B75" d="M1005.4 35.5c-.1 1.2 1.8 1.3 1.9.1s-1.8-1.3-1.9-.1M950.8 25c-.1 1.2 1.8 1.3 1.9.1s-1.8-1.3-1.9-.1" /><path fill="#FF639E" d="M994.9 44.7c-.1 1.2 1.8 1.3 1.9.1s-1.8-1.3-1.9-.1" /><path fill="#F42B75" d="M1183.9 20.4c.1-1.2-1.8-1.3-1.9-.1 0 1.2 1.8 1.3 1.9.1" /><path fill="#3CA8F1" d="m1080.8 1.3-.4-1-.6.9-1.1.1.7.9-.3 1.1 1.1-.4.9.6V2.3l.9-.7z" /><path fill="#00DDC8" d="m925.6 47.2-.6-1.8-1.1 1.6h-2l1.2 1.6-.6 1.8 1.9-.6 1.6 1.1-.1-2 1.6-1.1zm203.8-1.1.7 1.2.5-1.2 1.3-.3-1-.9.2-1.3-1.2.7-1.2-.6.3 1.3-.9 1z" /><path fill="#F42B75" d="M1155.9 32.6c.4 1 1.3 1.5 2.4 1.4 1-.1 2-.4 2.8.4-.1-.1.2-1 .2-1.1s.2-1 .2-1.1c-.8-.8-1.8-.5-2.8-.4-1.1.1-2-.4-2.4-1.4.1.2-.1.9-.2 1.1s-.3.8-.2 1.1" /><path fill="#00DDC8" d="M1097.8 57c.2-.3 1-.9 1.1-1.2.3-1.6-.4-2.9-1.8-3.7-1.3-.7-2.8-1.1-3.2-2.7 0 .2-1 1.1-1.1 1.2-.1.2-1.1 1-1.1 1.2.3 1.6 1.9 2 3.2 2.7 1.4.8 2.1 2 1.8 3.7.1-.3.8-.9 1.1-1.2" /><path fill="#FF639E" d="M1190.3 55.4c-.1 0-1.5.3-1.6.4-.3 1.9.9 3.8 2.7 4.5.4.1 1.2-.3 1.6-.3.3-.1 1.2-.5 1.6-.4-1.9-.6-3-2.5-2.7-4.5-.1.1-1.5.3-1.6.3" /><path fill="#F42B75" d="M1213.4 83.9c-.2-1.8-3-1.5-2.8.3s3 1.5 2.8-.3m-6.9-38.4c-.2-1.8-3-1.5-2.8.3s3 1.5 2.8-.3" /><path fill="#FF639E" d="m1163.9 63.2-.9-1.6-.7 1.7-1.8.4 1.4 1.2-.2 1.8 1.6-.9 1.7.7-.5-1.8 1.3-1.3z" /><path fill="#FFD336" d="M987.7 25.6c.3-.1 1.1-.1 1.4-.3 1-.9 1.2-2.2.6-3.4-.5-1.1-1.4-2.2-.8-3.4-.1.1-1.2.2-1.4.3-.2 0-1.3.1-1.4.3-.6 1.3.3 2.3.8 3.4.6 1.2.4 2.5-.6 3.4.3-.3 1.1-.3 1.4-.3" /></svg>
        </div>

        <div className="card w-full max-w-md animate-scale-in p-8 text-center relative z-10 border-2 border-green-500/30 shadow-2xl shadow-green-500/20 mt-12" onClick={e => e.stopPropagation()}>
          {/* Team Logo Badge overlapping top */}
          <div className="absolute -top-12 left-1/2 -translate-x-1/2">
            <div className="w-24 h-24 bg-surface rounded-2xl border-4 border-green-500 flex items-center justify-center shadow-xl shadow-green-500/30 overflow-hidden relative">
              {completedTeam.logo_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={completedTeam.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Shield className="w-12 h-12 text-primary/60" strokeWidth={1.5} />
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-green-500 text-white p-1.5 rounded-full border-2 border-surface shadow-md">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-12 mb-6">
            <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-4 animate-bounce" />
            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-primary mb-2">Team Complete!</h2>
            <p className="text-text-muted mb-8 text-[15px] leading-relaxed">
              <strong className="text-foreground text-lg block mb-1">{completedTeam.name}</strong>
              has successfully filled their roster with <span className="font-bold text-foreground">{tournament.max_players_per_team}</span> players.
            </p>
          </div>

          <button onClick={onClose} className="py-3.5 w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-[15px] shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            Continue Auction
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="card w-full max-w-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-border">
          <h3 className="text-base font-bold">
            <span className="text-primary mr-1.5">#{player.sort_order}</span>
            Sell {player.full_name}
          </h3>
          <p className="text-xs text-text-muted mt-0.5">Select a team and set the sold price</p>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Team <span className="text-danger">*</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto p-1">
              {teams.map(t => {
                const teamPlayers = players.filter(p => p.team_id === t.id && p.status === 'Sold');
                const pointsSpent = teamPlayers.reduce((sum, p) => sum + Number(p.sold_price || 0), 0);
                const remainingPlayers = Math.max(0, Number(tournament.max_players_per_team) - teamPlayers.length);
                const maxBid = remainingPlayers > 0
                  ? (teamBudget - pointsSpent) - (basePrice * remainingPlayers) + basePrice
                  : 0;

                if (remainingPlayers <= 0 || maxBid < basePrice) return null;

                const isSelected = teamId === t.id;
                return (
                  <label key={t.id} className={`cursor-pointer rounded-xl border p-3 flex items-center gap-3 transition-all duration-200 ${isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm' : 'border-border bg-surface-alt hover:border-primary/30 hover:bg-primary/[0.02]'}`}>
                    <input type="radio" name="team_id" value={t.id} checked={isSelected} onChange={(e) => setTeamId(e.target.value)} className="hidden" />
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-light to-accent-light/40 flex items-center justify-center overflow-hidden shrink-0">
                      {t.logo_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={t.logo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Shield className="w-4 h-4 text-primary/60" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{t.name}</p>
                      <p className="text-[10px] text-text-muted">
                        Budget: {(teamBudget - pointsSpent).toLocaleString()} • Max Bid: <span className="font-bold text-green-600">{Math.max(0, maxBid).toLocaleString()}</span>
                      </p>
                    </div>
                    {isSelected && <CheckCircle className="w-5 h-5 text-primary shrink-0" />}
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Sold Price (pts) <span className="text-danger">*</span></label>
            <input type="number" min={0} value={soldPrice} onChange={e => setSoldPrice(e.target.value)} className="input-field" required />
          </div>

          {error && <p className="text-sm text-danger bg-danger/5 border border-danger/10 rounded-lg p-3">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={submitting} className="btn-primary !w-auto flex-1 bg-green-500 hover:bg-green-600 border-none">
              {submitting ? <><div className="spinner" /><span>Selling...</span></> : "Confirm Sale"}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
/* ============================================================
   Team View Modal Component
   ============================================================ */
function TeamViewModal({ tournament, team, players, onClose }: { tournament: Tournament; team: Team; players: Player[]; onClose: () => void }) {
  const teamPlayers = players
    .filter(p => p.team_id === team.id && p.status === 'Sold')
    .sort((a, b) => new Date(a.sold_at || 0).getTime() - new Date(b.sold_at || 0).getTime());
  const spent = teamPlayers.reduce((sum, p) => sum + Number(p.sold_price || 0), 0);
  const remainingBudget = Number(tournament.team_budget) - spent;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className="card w-full max-w-md animate-scale-in flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-light to-accent-light/40 flex items-center justify-center overflow-hidden shrink-0">
              {team.logo_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={team.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Shield className="w-6 h-6 text-primary/60" strokeWidth={1.5} />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{team.name}</h2>
              <div className="text-[13px] text-text-muted mt-0.5 space-x-2">
                <span>Players: <strong className="text-foreground">{teamPlayers.length}/{tournament.max_players_per_team}</strong></span>
                <span>•</span>
                <span>Left: <strong className="text-foreground">{remainingBudget.toLocaleString()}</strong></span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-alt text-text-muted hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Player List */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1 bg-surface-alt/30">
          {teamPlayers.length === 0 ? (
            <div className="text-center py-10 text-text-muted">
              <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No players sold to this team yet.</p>
            </div>
          ) : (
            teamPlayers.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-surface rounded-xl border border-border hover:border-primary/30 transition-colors shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-alt flex items-center justify-center overflow-hidden border border-border">
                    {p.photo_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-text-muted" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-text-muted">#{p.sort_order}</span>
                      <p className="font-bold text-[14px] text-foreground">{p.full_name}</p>
                      {p.label && (
                        <span className="inline-flex px-1.5 py-0.5 text-[9px] font-bold text-purple-700 bg-purple-100 border border-purple-200 rounded-full">
                          {p.label}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] font-medium text-primary mt-0.5">{p.player_role}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-[15px] text-green-600 bg-green-500/10 px-2.5 py-1 rounded-lg">
                    {Number(p.sold_price).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Player Full View Modal Component
   ============================================================ */
function PlayerFullViewModal({ player, onClose }: { player: Player; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col overflow-hidden animate-fade-in" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-50 p-3 rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white/20 transition-all"
      >
        <X className="w-6 h-6" />
      </button>
      <div className="flex-1 relative flex items-center justify-center overflow-hidden" onClick={e => e.stopPropagation()}>
        {player.photo_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={player.photo_url} alt="" className="absolute inset-0 w-full h-full object-contain" />
        ) : (
          <User className="w-40 h-40 text-white/40" strokeWidth={1.5} />
        )}
      </div>
      <div className="bg-black/70 backdrop-blur-xl px-8 py-4 flex items-center justify-between gap-6 border-t border-white/10" onClick={e => e.stopPropagation()}>
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="text-primary font-bold">#{player.sort_order}</span>
            {player.full_name}
            {player.label && (
              <span className="inline-flex px-2 py-1 text-[11px] font-bold text-purple-200 bg-purple-500/20 border border-purple-500/30 rounded-full">
                {player.label}
              </span>
            )}
          </h2>
          <p className="text-primary font-semibold mt-0.5">{player.player_role}</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white/10 rounded-xl px-4 py-2.5 text-center">
            <p className="text-[10px] text-white/60 uppercase tracking-wider mb-0.5">Batting</p>
            <p className="font-bold text-white text-sm">{player.batting_hand}</p>
          </div>
          <div className="bg-white/10 rounded-xl px-4 py-2.5 text-center">
            <p className="text-[10px] text-white/60 uppercase tracking-wider mb-0.5">Bowling</p>
            <p className="font-bold text-white text-sm">{player.bowling_arm}</p>
          </div>
          <div className="bg-white/10 rounded-xl px-4 py-2.5 text-center">
            <p className="text-[10px] text-white/60 uppercase tracking-wider mb-0.5">Age</p>
            <p className="font-bold text-white text-sm">{player.age || '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
