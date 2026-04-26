const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

if (!BACKEND_BASE_URL) {
  if (typeof window !== "undefined") {
    console.error("NEXT_PUBLIC_BACKEND_URL is not set. API calls will fail.");
  }
}

const API_BASE_URL = BACKEND_BASE_URL ? `${BACKEND_BASE_URL.replace(/\/+$/, "")}/api` : "";

// Backend base URL (without /api) — used to rewrite photo URLs
export function getBackendBaseUrl(): string {
  return BACKEND_BASE_URL?.replace(/\/+$/, "") || "";
}

interface ApiResponse<T = unknown> {
  data: T;
  status: number;
}

interface SendOtpResponse {
  message: string;
}

interface VerifyOtpResponse {
  message: string;
  token: string;
  organizer: {
    id: number;
    email: string;
    name: string | null;
  };
  is_new: boolean;
}

interface MeResponse {
  organizer: {
    id: number;
    email: string;
    name: string | null;
  };
}

interface LogoutResponse {
  message: string;
}

// ==============================
// Tournament Types
// ==============================

export interface Tournament {
  id: string;
  name: string;
  season: string;
  club_name: string;
  team_budget: string;
  max_players_per_team: number;
  player_base_price: string;
  registration_closing_date: string | null;
  is_registration_closed?: boolean;
  logo_url: string | null;
  created_at: string;
}

export interface TournamentSingleResponse {
  tournament: Tournament;
  players?: Player[];
  teams?: Team[];
}

interface TournamentListResponse {
  tournaments: Tournament[];
}

// ==============================
// API Helpers
// ==============================

class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("bidbuzz_token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      data.message || "Something went wrong",
      response.status,
      data
    );
  }

  return { data, status: response.status };
}

/**
 * Request helper for FormData (file uploads).
 * Does NOT set Content-Type — browser sets it with multipart boundary.
 */
async function requestFormData<T>(
  endpoint: string,
  formData: FormData,
  method: string = "POST"
): Promise<ApiResponse<T>> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("bidbuzz_token") : null;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      data.message || "Something went wrong",
      response.status,
      data
    );
  }

  return { data, status: response.status };
}

// ==============================
// Auth API
// ==============================

export async function sendOtp(email: string): Promise<SendOtpResponse> {
  const { data } = await request<SendOtpResponse>("/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  return data;
}

export async function verifyOtp(
  email: string,
  otp: string
): Promise<VerifyOtpResponse> {
  const { data } = await request<VerifyOtpResponse>("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, otp }),
  });
  return data;
}

export async function getMe(): Promise<MeResponse> {
  const { data } = await request<MeResponse>("/auth/me");
  return data;
}

export async function logout(): Promise<LogoutResponse> {
  const { data } = await request<LogoutResponse>("/auth/logout", {
    method: "POST",
  });
  return data;
}

// ==============================
// Tournament API
// ==============================

export async function getTournaments(): Promise<Tournament[]> {
  const { data } = await request<TournamentListResponse>("/tournaments");
  return data.tournaments;
}

export async function getPublicTournament(id: string): Promise<TournamentSingleResponse> {
  const { data } = await request<TournamentSingleResponse>(`/public/tournaments/${id}`);
  return data;
}

export interface PublicAuctionStateResponse {
  tournament: Tournament;
  live_player: Player | null;
  history: AuctionHistoryRecord[];
}

export async function getPublicAuctionState(id: string): Promise<PublicAuctionStateResponse> {
  const { data } = await request<PublicAuctionStateResponse>(`/public/tournaments/${id}/auction-state`);
  return data;
}

export async function createTournament(
  formData: FormData
): Promise<TournamentSingleResponse> {
  const { data } = await requestFormData<TournamentSingleResponse>(
    "/tournaments",
    formData
  );
  return data;
}

export async function getTournament(id: string): Promise<Tournament> {
  const { data } = await request<TournamentSingleResponse>(`/tournaments/${id}`);
  return data.tournament;
}

export async function updateTournament(
  id: string,
  formData: FormData
): Promise<TournamentSingleResponse> {
  // Laravel doesn't natively support PUT with FormData; use POST with _method override
  formData.append("_method", "PUT");
  const { data } = await requestFormData<TournamentSingleResponse>(
    `/tournaments/${id}`,
    formData
  );
  return data;
}

export async function deleteTournament(id: string): Promise<void> {
  await request(`/tournaments/${id}`, { method: "DELETE" });
}

// ==============================
// Auction History Types & API
// ==============================

export interface AuctionHistoryRecord {
  id: number;
  action: 'Pending' | 'Sold' | 'Unsold' | 'Rejected';
  sold_price: number | null;
  player: Player;
}

export interface AuctionHistoryResponse {
  history: AuctionHistoryRecord[];
}

export async function getAuctionHistory(tournamentId: string): Promise<AuctionHistoryRecord[]> {
  const { data } = await request<AuctionHistoryResponse>(`/tournaments/${tournamentId}/auction-history`);
  return data.history;
}

export async function pickRandomPlayer(tournamentId: string, is_unsold_round: boolean = false): Promise<AuctionHistoryRecord> {
  const { data } = await request<{ message: string; history: AuctionHistoryRecord }>(
    `/tournaments/${tournamentId}/auction/pick-random`,
    {
      method: "POST",
      body: JSON.stringify({ is_unsold_round })
    }
  );
  return data.history;
}

// ==============================
// Player Types & API
// ==============================

export type PlayerStatus = "Pending" | "Rejected" | "Sold" | "Unsold";
export type BattingHand = "Right" | "Left";
export type PlayerRole = "Batsman" | "Bowler" | "All-rounder" | "Wicketkeeper";
export type BowlingArm = "Right-arm" | "Left-arm" | "N/A";

export interface Player {
  id: string;
  full_name: string;
  age: number;
  phone_number: string | null;
  batting_hand: BattingHand;
  player_role: PlayerRole;
  bowling_arm: BowlingArm;
  status: PlayerStatus;
  team_id?: string;
  sold_price?: number;
  sold_at?: string;
  label?: string | null;
  sort_order: number;
  photo_url: string | null;
  created_at: string;
}

interface PlayerListResponse {
  players: Player[];
}

interface PlayerSingleResponse {
  message?: string;
  player: Player;
}

export async function publicRegisterPlayer(
  tournamentId: string,
  data: FormData
): Promise<PlayerSingleResponse> {
  const { data: responseData } = await requestFormData<PlayerSingleResponse>(
    `/public/tournaments/${tournamentId}/register-player`,
    data
  );
  return responseData;
}

export async function getPlayers(tournamentId: string): Promise<Player[]> {
  const { data } = await request<PlayerListResponse>(
    `/tournaments/${tournamentId}/players`
  );
  return data.players;
}

export async function createPlayer(
  tournamentId: string,
  formData: FormData
): Promise<PlayerSingleResponse> {
  const { data } = await requestFormData<PlayerSingleResponse>(
    `/tournaments/${tournamentId}/players`,
    formData
  );
  return data;
}

export async function updatePlayer(
  tournamentId: string,
  playerId: string,
  formData: FormData
): Promise<PlayerSingleResponse> {
  formData.append("_method", "PUT");
  const { data } = await requestFormData<PlayerSingleResponse>(
    `/tournaments/${tournamentId}/players/${playerId}`,
    formData
  );
  return data;
}

export async function sellPlayer(
  tournamentId: string,
  playerId: string,
  teamId: string,
  soldPrice: number
): Promise<PlayerSingleResponse> {
  const { data } = await request<PlayerSingleResponse>(
    `/tournaments/${tournamentId}/players/${playerId}/sell`,
    {
      method: "POST",
      body: JSON.stringify({ team_id: teamId, sold_price: soldPrice }),
    }
  );
  return data;
}

export async function revertPlayer(
  tournamentId: string,
  playerId: string
): Promise<PlayerSingleResponse> {
  const { data } = await request<PlayerSingleResponse>(
    `/tournaments/${tournamentId}/players/${playerId}/revert`,
    { method: "POST" }
  );
  return data;
}

export async function rejectPlayer(
  tournamentId: string,
  playerId: string
): Promise<PlayerSingleResponse> {
  const { data } = await request<PlayerSingleResponse>(
    `/tournaments/${tournamentId}/players/${playerId}/reject`,
    { method: "POST" }
  );
  return data;
}

export async function markUnsoldPlayer(
  tournamentId: string,
  playerId: string
): Promise<PlayerSingleResponse> {
  const { data } = await request<PlayerSingleResponse>(
    `/tournaments/${tournamentId}/players/${playerId}/mark-unsold`,
    { method: "POST" }
  );
  return data;
}

export async function resetPlayerToPending(
  tournamentId: string,
  playerId: string
): Promise<PlayerSingleResponse> {
  const { data } = await request<PlayerSingleResponse>(
    `/tournaments/${tournamentId}/players/${playerId}/reset-to-pending`,
    { method: "POST" }
  );
  return data;
}

// ==============================
// Team Types & API
// ==============================

export interface Team {
  id: string;
  name: string;
  logo_url: string | null;
  created_at: string;
}

interface TeamListResponse {
  teams: Team[];
}

interface TeamSingleResponse {
  message?: string;
  team: Team;
}

export async function getTeams(tournamentId: string): Promise<Team[]> {
  const { data } = await request<TeamListResponse>(
    `/tournaments/${tournamentId}/teams`
  );
  return data.teams;
}

export async function createTeam(
  tournamentId: string,
  formData: FormData
): Promise<TeamSingleResponse> {
  const { data } = await requestFormData<TeamSingleResponse>(
    `/tournaments/${tournamentId}/teams`,
    formData
  );
  return data;
}

export async function updateTeam(
  tournamentId: string,
  teamId: string,
  formData: FormData
): Promise<TeamSingleResponse> {
  formData.append("_method", "PUT");
  const { data } = await requestFormData<TeamSingleResponse>(
    `/tournaments/${tournamentId}/teams/${teamId}`,
    formData
  );
  return data;
}

export async function deleteTeam(
  tournamentId: string,
  teamId: string
): Promise<void> {
  await request(`/tournaments/${tournamentId}/teams/${teamId}`, {
    method: "DELETE",
  });
}

export { ApiError };
