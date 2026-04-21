"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type GameResult = "win" | "lose" | "draw";
type ActiveTab = "home" | "history" | "summary" | "mypage";

type Game = {
  id: number;
  sourceGameId?: string;
  date: string;
  opponent: string;
  teamScore: number;
  opponentScore: number;
  result: GameResult;
  savedAmount: number;
  note?: string;
};

type TeamInfo = {
  name: string;
  short: string;
  accentFrom: string;
  accentTo: string;
  soft: string;
  text: string;
};

const teams: TeamInfo[] = [
  {
    name: "オリックス・バファローズ",
    short: "オリ",
    accentFrom: "#6A6CF6",
    accentTo: "#E76FC6",
    soft: "#EEF1FF",
    text: "#4C52D9",
  },
  {
    name: "阪神タイガース",
    short: "阪神",
    accentFrom: "#7C6AF8",
    accentTo: "#F0BE4C",
    soft: "#F8F1D8",
    text: "#8B6A10",
  },
  {
    name: "読売ジャイアンツ",
    short: "読売",
    accentFrom: "#7C6AF8",
    accentTo: "#FF8D5C",
    soft: "#FFF0E6",
    text: "#D46B34",
  },
  {
    name: "横浜DeNAベイスターズ",
    short: "横浜",
    accentFrom: "#5C78FF",
    accentTo: "#6FD3FF",
    soft: "#EEF5FF",
    text: "#3766D9",
  },
  {
    name: "広島東洋カープ",
    short: "広島",
    accentFrom: "#7C6AF8",
    accentTo: "#FF7C8A",
    soft: "#FFF0F3",
    text: "#D95767",
  },
  {
    name: "東京ヤクルトスワローズ",
    short: "ヤク",
    accentFrom: "#65A4FF",
    accentTo: "#66D6A8",
    soft: "#EEFBF5",
    text: "#2F9D74",
  },
  {
    name: "中日ドラゴンズ",
    short: "中日",
    accentFrom: "#5C78FF",
    accentTo: "#8D8CFF",
    soft: "#EEF2FF",
    text: "#4960DA",
  },
  {
    name: "福岡ソフトバンクホークス",
    short: "福岡",
    accentFrom: "#6B7280",
    accentTo: "#111827",
    soft: "#F3F4F6",
    text: "#374151",
  },
  {
    name: "北海道日本ハムファイターズ",
    short: "日ハム",
    accentFrom: "#63A5FF",
    accentTo: "#6A6CF6",
    soft: "#EEF5FF",
    text: "#4566D7",
  },
  {
    name: "千葉ロッテマリーンズ",
    short: "ロッテ",
    accentFrom: "#94A3B8",
    accentTo: "#64748B",
    soft: "#F5F7FA",
    text: "#475569",
  },
  {
    name: "東北楽天ゴールデンイーグルス",
    short: "楽天",
    accentFrom: "#7C6AF8",
    accentTo: "#EF4444",
    soft: "#FFF1F1",
    text: "#D9485F",
  },
  {
    name: "埼玉西武ライオンズ",
    short: "西武",
    accentFrom: "#5C78FF",
    accentTo: "#7C6AF8",
    soft: "#EEF2FF",
    text: "#4B56D9",
  },
];

const STORAGE_KEYS = {
  amount: "npb-savings-amount",
  favoriteTeam: "npb-savings-favorite-team",
  lastSavedAt: "npb-savings-last-saved-at",
  lastSyncedAt: "npb-savings-last-synced-at",
  selectedResult: "npb-savings-selected-result",
};

function gamesStorageKey(teamName: string) {
  return `npb-savings-games-${teamName}`;
}

function notesStorageKey(teamName: string) {
  return `npb-savings-note-${teamName}`;
}

function yen(value: number) {
  return `¥${new Intl.NumberFormat("ja-JP").format(value)}`;
}

function getResult(teamScore: number, opponentScore: number): GameResult {
  if (teamScore > opponentScore) return "win";
  if (teamScore < opponentScore) return "lose";
  return "draw";
}

function resultLabel(result: GameResult) {
  if (result === "win") return "勝ち";
  if (result === "lose") return "負け";
  return "引き分け";
}

function resultPillClass(result: GameResult) {
  if (result === "win") return "result-win";
  if (result === "lose") return "result-lose";
  return "result-draw";
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function createTimestamp() {
  return new Date().toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMonthLabel(month: string) {
  return month.replace("-", "年") + "月";
}

function teamByName(name: string) {
  return teams.find((team) => team.name === name) ?? teams[0];
}

function streakFromGames(games: Game[]) {
  if (games.length === 0) return 0;
  const sorted = [...games].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  let streak = 0;
  for (const game of sorted) {
    if (game.result === "win") streak += 1;
    else break;
  }
  return streak;
}

function averageSavings(games: Game[]) {
  if (games.length === 0) return 0;
  const total = games.reduce((sum, g) => sum + g.savedAmount, 0);
  return Math.round(total / games.length);
}

function winRate(games: Game[]) {
  if (games.length === 0) return 0;
  const wins = games.filter((g) => g.result === "win").length;
  return Math.round((wins / games.length) * 1000) / 10;
}

function changeComparedToPreviousMonth(
  monthlySummary: { month: string; savings: number }[]
) {
  if (monthlySummary.length < 2) return 0;
  return monthlySummary[0].savings - monthlySummary[1].savings;
}

export default function Page() {
  const [favoriteTeam, setFavoriteTeam] = useState("オリックス・バファローズ");
  const [amountPerWin, setAmountPerWin] = useState(3000);
  const [games, setGames] = useState<Game[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [opponent, setOpponent] = useState("");
  const [teamScore, setTeamScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [quickResult, setQuickResult] = useState<GameResult>("win");
  const [note, setNote] = useState("ナイスゲーム！最高！");
  const [activeTab, setActiveTab] = useState<ActiveTab>("home");

  const didInitialSyncRef = useRef(false);
  const currentGamesKey = gamesStorageKey(favoriteTeam);
  const currentNotesKey = notesStorageKey(favoriteTeam);

  useEffect(() => {
    const savedAmount = localStorage.getItem(STORAGE_KEYS.amount);
    const savedTeam = localStorage.getItem(STORAGE_KEYS.favoriteTeam);
    const savedLastSavedAt = localStorage.getItem(STORAGE_KEYS.lastSavedAt);
    const savedLastSyncedAt = localStorage.getItem(STORAGE_KEYS.lastSyncedAt);
    const savedQuickResult = localStorage.getItem(STORAGE_KEYS.selectedResult);

    if (savedAmount) {
      const parsed = Number(savedAmount);
      if (!Number.isNaN(parsed)) setAmountPerWin(parsed);
    }
    if (savedTeam) setFavoriteTeam(savedTeam);
    if (savedLastSavedAt) setLastSavedAt(savedLastSavedAt);
    if (savedLastSyncedAt) setLastSyncedAt(savedLastSyncedAt);
    if (
      savedQuickResult === "win" ||
      savedQuickResult === "lose" ||
      savedQuickResult === "draw"
    ) {
      setQuickResult(savedQuickResult);
    }

    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    const savedGames = localStorage.getItem(currentGamesKey);
    const savedNote = localStorage.getItem(currentNotesKey);

    if (savedGames) {
      try {
        setGames(JSON.parse(savedGames));
      } catch {
        setGames([]);
      }
    } else {
      setGames([]);
    }

    setNote(savedNote || "ナイスゲーム！最高！");
    setSyncMessage("");
    setEditingId(null);
    setOpponent("");
    setTeamScore(0);
    setOpponentScore(0);
    setDate(new Date().toISOString().slice(0, 10));
  }, [favoriteTeam, currentGamesKey, currentNotesKey, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem(currentGamesKey, JSON.stringify(games));
    const now = createTimestamp();
    localStorage.setItem(STORAGE_KEYS.lastSavedAt, now);
    setLastSavedAt(now);
  }, [games, currentGamesKey, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem(STORAGE_KEYS.amount, String(amountPerWin));
    localStorage.setItem(STORAGE_KEYS.lastSavedAt, createTimestamp());
    setLastSavedAt(createTimestamp());
  }, [amountPerWin, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem(STORAGE_KEYS.favoriteTeam, favoriteTeam);
    localStorage.setItem(STORAGE_KEYS.lastSavedAt, createTimestamp());
    setLastSavedAt(createTimestamp());
  }, [favoriteTeam, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem(STORAGE_KEYS.selectedResult, quickResult);
  }, [quickResult, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem(currentNotesKey, note);
  }, [note, currentNotesKey, isHydrated]);

  const selectedTeam = useMemo(
    () => teamByName(favoriteTeam),
    [favoriteTeam]
  );

  const totalSavings = useMemo(
    () => games.reduce((sum, game) => sum + game.savedAmount, 0),
    [games]
  );

  const sortedGames = useMemo(
    () =>
      [...games].sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.id - a.id;
      }),
    [games]
  );

  const monthlySummary = useMemo(() => {
    const grouped = new Map<string, { savings: number; wins: number; games: number }>();

    for (const game of games) {
      const key = monthKey(game.date);
      const current = grouped.get(key) ?? { savings: 0, wins: 0, games: 0 };
      current.savings += game.savedAmount;
      current.games += 1;
      if (game.result === "win") current.wins += 1;
      grouped.set(key, current);
    }

    return Array.from(grouped.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, value]) => ({ month, ...value }));
  }, [games]);

  const currentMonthSummary = monthlySummary[0];
  const previousMonthDiff = changeComparedToPreviousMonth(monthlySummary);

  const stats = useMemo(() => {
    return {
      gameCount: games.length,
      winCount: games.filter((g) => g.result === "win").length,
      average: averageSavings(games),
      streak: streakFromGames(games),
      rate: winRate(games),
    };
  }, [games]);

  const quickAddAmount =
    quickResult === "win"
      ? amountPerWin
      : quickResult === "draw"
      ? Math.floor(amountPerWin / 2)
      : 0;

  const currentResult = getResult(teamScore, opponentScore);
  const manualAddAmount =
    currentResult === "win"
      ? amountPerWin
      : currentResult === "draw"
      ? Math.floor(amountPerWin / 2)
      : 0;

  const monthlyBars = useMemo(() => {
    const max = Math.max(...monthlySummary.map((m) => m.savings), 1);
    return monthlySummary
      .slice()
      .reverse()
      .map((item) => ({
        ...item,
        ratio: item.savings / max,
      }));
  }, [monthlySummary]);

  async function syncLatestGame() {
    try {
      setIsSyncing(true);
      setSyncMessage("試合結果を確認中...");

      const res = await fetch(
        `/api/auto-sync?team=${encodeURIComponent(favoriteTeam)}`,
        { cache: "no-store" }
      );

      const now = createTimestamp();
      localStorage.setItem(STORAGE_KEYS.lastSyncedAt, now);
      setLastSyncedAt(now);

      if (!res.ok) {
        setSyncMessage("同期に失敗しました");
        return;
      }

      const data = await res.json();
      const incomingGames = data?.games ?? [];

      if (incomingGames.length === 0) {
        setSyncMessage(data?.message ?? "新しい試合結果はありません");
        return;
      }

      setGames((prev) => {
        const newItems: Game[] = incomingGames
          .filter((incoming: any) => {
            return !prev.some((g) => {
              if (incoming.sourceGameId && g.sourceGameId) {
                return g.sourceGameId === incoming.sourceGameId;
              }
              return (
                g.date === incoming.date &&
                g.opponent === incoming.opponent &&
                g.teamScore === incoming.teamScore &&
                g.opponentScore === incoming.opponentScore
              );
            });
          })
          .map((incoming: any, index: number) => {
            const result = getResult(incoming.teamScore, incoming.opponentScore);
            const savedAmount =
              result === "win"
                ? amountPerWin
                : result === "draw"
                ? Math.floor(amountPerWin / 2)
                : 0;

            return {
              id: Date.now() + index,
              sourceGameId: incoming.sourceGameId,
              date: incoming.date,
              opponent: incoming.opponent,
              teamScore: incoming.teamScore,
              opponentScore: incoming.opponentScore,
              result,
              savedAmount,
              note: result === "win" ? "自動同期で追加しました！" : "同期で反映しました",
            };
          });

        if (newItems.length === 0) {
          setSyncMessage("最新の試合結果はすべて反映済みです");
          return prev;
        }

        setSyncMessage(`${newItems.length}件の試合結果を反映しました`);
        return [...newItems, ...prev].sort((a, b) => {
          const dateCompare = b.date.localeCompare(a.date);
          if (dateCompare !== 0) return dateCompare;
          return b.id - a.id;
        });
      });
    } catch (error) {
      console.error(error);
      const now = createTimestamp();
      localStorage.setItem(STORAGE_KEYS.lastSyncedAt, now);
      setLastSyncedAt(now);
      setSyncMessage("同期に失敗しました");
    } finally {
      setIsSyncing(false);
    }
  }

  useEffect(() => {
    if (!isHydrated) return;

    if (!didInitialSyncRef.current) {
      didInitialSyncRef.current = true;
      void syncLatestGame();
      return;
    }

    void syncLatestGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoriteTeam, isHydrated]);

  function saveToLocalStorage() {
    const now = createTimestamp();
    localStorage.setItem(currentGamesKey, JSON.stringify(games));
    localStorage.setItem(STORAGE_KEYS.amount, String(amountPerWin));
    localStorage.setItem(STORAGE_KEYS.favoriteTeam, favoriteTeam);
    localStorage.setItem(STORAGE_KEYS.lastSavedAt, now);
    setLastSavedAt(now);
    setSyncMessage("保存しました");
  }

  function resetForm() {
    setDate(new Date().toISOString().slice(0, 10));
    setOpponent("");
    setTeamScore(0);
    setOpponentScore(0);
    setEditingId(null);
  }

  function addQuickGame() {
    if (!opponent) return;

    let team = 0;
    let enemy = 0;
    if (quickResult === "win") {
      team = 5;
      enemy = 2;
    } else if (quickResult === "lose") {
      team = 1;
      enemy = 4;
    } else {
      team = 3;
      enemy = 3;
    }

    const newGame: Game = {
      id: Date.now(),
      date,
      opponent,
      teamScore: team,
      opponentScore: enemy,
      result: quickResult,
      savedAmount: quickAddAmount,
      note,
    };

    setGames((prev) => [newGame, ...prev]);
  }

  function saveManualGame() {
    if (!opponent.trim()) return;

    const result = getResult(teamScore, opponentScore);
    const savedAmount =
      result === "win"
        ? amountPerWin
        : result === "draw"
        ? Math.floor(amountPerWin / 2)
        : 0;

    if (editingId !== null) {
      setGames((prev) =>
        prev.map((game) =>
          game.id === editingId
            ? {
                ...game,
                date,
                opponent: opponent.trim(),
                teamScore,
                opponentScore,
                result,
                savedAmount,
                note,
              }
            : game
        )
      );
    } else {
      const newGame: Game = {
        id: Date.now(),
        date,
        opponent: opponent.trim(),
        teamScore,
        opponentScore,
        result,
        savedAmount,
        note,
      };
      setGames((prev) => [newGame, ...prev]);
    }

    resetForm();
  }

  function deleteGame(id: number) {
    setGames((prev) => prev.filter((g) => g.id !== id));
    if (editingId === id) resetForm();
  }

  function startEdit(game: Game) {
    setEditingId(game.id);
    setDate(game.date);
    setOpponent(game.opponent);
    setTeamScore(game.teamScore);
    setOpponentScore(game.opponentScore);
    setNote(game.note || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetAllData() {
    teams.forEach((team) => {
      localStorage.removeItem(gamesStorageKey(team.name));
      localStorage.removeItem(notesStorageKey(team.name));
    });
    localStorage.removeItem(STORAGE_KEYS.amount);
    localStorage.removeItem(STORAGE_KEYS.favoriteTeam);
    localStorage.removeItem(STORAGE_KEYS.lastSavedAt);
    localStorage.removeItem(STORAGE_KEYS.lastSyncedAt);
    localStorage.removeItem(STORAGE_KEYS.selectedResult);

    setFavoriteTeam("オリックス・バファローズ");
    setAmountPerWin(3000);
    setGames([]);
    setLastSavedAt("");
    setLastSyncedAt("");
    setSyncMessage("");
    setQuickResult("win");
    setNote("ナイスゲーム！最高！");
    resetForm();
  }

  const heroGradient = {
    background: `linear-gradient(135deg, ${selectedTeam.accentFrom} 0%, ${selectedTeam.accentTo} 100%)`,
  };

  const targetAmount = 50000;
  const targetRatio = Math.min(totalSavings / targetAmount, 1);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,106,248,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(231,111,198,0.10),transparent_24%),linear-gradient(180deg,#fafafe_0%,#f4f5fb_100%)] text-slate-700">
      <div className="mx-auto max-w-md px-4 pb-28 pt-4">
        <section className="mobile-hero mb-5 rounded-[34px] p-5 text-white" style={heroGradient}>
          <div className="mb-6 flex items-start justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <h1 className="text-[22px] font-black tracking-tight">推し勝貯金</h1>
                <span className="text-base">✦</span>
              </div>
              <p className="text-sm font-semibold text-white/90">推しの勝利を、未来の自分に。</p>
            </div>
            <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10">
              <span className="text-xl">🔔</span>
              <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#ff5d87]" />
            </div>
          </div>

          <div className="rounded-[28px] bg-white px-5 py-5 text-slate-700 shadow-[0_14px_28px_rgba(40,20,120,0.18)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-base font-black text-slate-500">総貯金額</p>
                <p className="mt-2 text-[54px] font-black leading-none tracking-tight text-[#20285d]">
                  {yen(totalSavings)}
                </p>
                <p className="mt-3 text-base font-black">
                  <span className="text-slate-500">前月比 </span>
                  <span className={previousMonthDiff >= 0 ? "text-[#ff5d87]" : "text-slate-500"}>
                    {previousMonthDiff >= 0 ? "+" : ""}
                    {new Intl.NumberFormat("ja-JP").format(previousMonthDiff)}円
                  </span>
                </p>
              </div>

              <div className="relative">
                <div className="hero-pig flex h-28 w-28 items-center justify-center rounded-full">
                  <span className="text-[64px]">🐷</span>
                </div>
                <div className="absolute -right-1 -top-1 flex h-10 w-10 items-center justify-center rounded-full bg-[#ffd15c] text-xl shadow-md">
                  🪙
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-white" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/45" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/45" />
          </div>
        </section>

        <section className="mb-4 grid grid-cols-2 gap-3">
          {[
            {
              title: "試合数",
              value: `${stats.gameCount}`,
              sub1: "試合",
              sub2: `今月 ${currentMonthSummary ? `+${currentMonthSummary.games}` : "+0"}`,
            },
            {
              title: "勝利数",
              value: `${stats.winCount}`,
              sub1: "勝",
              sub2: `勝率 ${stats.rate}%`,
            },
            {
              title: "平均貯金額",
              value: yen(stats.average),
              sub1: "",
              sub2: "/ 1試合あたり",
            },
            {
              title: "連続記録",
              value: `${stats.streak}`,
              sub1: "連勝中",
              sub2: `最高 ${Math.max(stats.streak, 1)} 連勝`,
            },
          ].map((card) => (
            <div key={card.title} className="glass-card rounded-[24px] p-4">
              <p className="text-sm font-black text-slate-500">{card.title}</p>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-[48px] font-black leading-none tracking-tight text-[#20285d]">
                  {card.value}
                </span>
                {card.sub1 && (
                  <span className="mb-1 text-base font-black text-slate-600">{card.sub1}</span>
                )}
              </div>
              <p className="mt-3 text-sm font-bold text-[#70c79e]">{card.sub2}</p>
            </div>
          ))}
        </section>

        <section className="glass-card mb-4 rounded-[28px] p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[22px] font-black tracking-tight text-[#20285d]">クイック追加</h2>
            <span className="rounded-full bg-[#f3ecff] px-3 py-1 text-xs font-black text-[#8f72db]">
              かんたん入力！
            </span>
          </div>

          <div className="segmented mb-4">
            {[
              { key: "win", label: "勝ち" },
              { key: "draw", label: "引き分け" },
              { key: "lose", label: "負け" },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setQuickResult(item.key as GameResult)}
                className={quickResult === item.key ? "segmented-active" : ""}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <label className="form-label">推し球団</label>
              <select
                value={favoriteTeam}
                onChange={(e) => setFavoriteTeam(e.target.value)}
                className="app-input"
              >
                {teams.map((team) => (
                  <option key={team.name} value={team.name}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">日付</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="app-input"
              />
            </div>

            <div>
              <label className="form-label">対戦相手</label>
              <select
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                className="app-input"
              >
                <option value="">対戦相手を選択</option>
                {teams
                  .filter((team) => team.name !== favoriteTeam)
                  .map((team) => (
                    <option key={team.name} value={team.name}>
                      {team.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="form-label">金額</label>
              <input
                type="number"
                min={0}
                step={500}
                value={amountPerWin}
                onChange={(e) => setAmountPerWin(Number(e.target.value) || 0)}
                className="app-input"
              />
            </div>

            <div>
              <label className="form-label">メモ（任意）</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="app-input"
                placeholder="ナイスゲーム！最高！"
              />
            </div>

            <button onClick={addQuickGame} className="primary-gradient-button">
              ＋ 登録する
            </button>
          </div>
        </section>

        <section className="glass-card mb-4 rounded-[28px] p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[22px] font-black tracking-tight text-[#20285d]">最近の履歴</h2>
            <button
              onClick={() => setActiveTab("history")}
              className="text-sm font-black text-[#8f72db]"
            >
              すべて見る ›
            </button>
          </div>

          {sortedGames.length === 0 ? (
            <div className="rounded-[20px] bg-[#fafbff] p-6 text-center text-sm font-bold text-slate-400">
              まだ試合が登録されていません
            </div>
          ) : (
            <div className="space-y-3">
              {sortedGames.slice(0, 3).map((game) => {
                const opp = teamByName(game.opponent);
                return (
                  <div key={game.id} className="history-row">
                    <div
                      className="history-logo"
                      style={{
                        background: `linear-gradient(135deg, ${opp.accentFrom}, ${opp.accentTo})`,
                      }}
                    >
                      {opp.short}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-black text-slate-500">
                        <span>{game.date.slice(5).replace("-", "/")}</span>
                        <span>vs {game.opponent}</span>
                      </div>

                      <div className="mt-1 flex items-center gap-2">
                        <span className={`result-chip ${resultPillClass(game.result)}`}>
                          {resultLabel(game.result)}
                        </span>
                        <span className="text-sm font-bold text-slate-500">
                          {game.note || "試合を記録しました"}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-[28px] font-black leading-none text-[#20285d]">
                        {yen(game.savedAmount)}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-400">
                        {game.teamScore}-{game.opponentScore}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="glass-card mb-4 rounded-[28px] p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[22px] font-black tracking-tight text-[#20285d]">月次まとめ</h2>
            <span className="text-sm font-black text-slate-400">
              {currentMonthSummary ? formatMonthLabel(currentMonthSummary.month) : "未集計"}
            </span>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="summary-box">
              <p className="summary-label">貯金額</p>
              <p className="summary-value">{yen(currentMonthSummary?.savings ?? 0)}</p>
              <p className="summary-sub">
                前月比 {previousMonthDiff >= 0 ? "+" : ""}
                {new Intl.NumberFormat("ja-JP").format(previousMonthDiff)}円
              </p>
            </div>
            <div className="summary-box">
              <p className="summary-label">試合数</p>
              <p className="summary-value">{currentMonthSummary?.games ?? 0} 試合</p>
              <p className="summary-sub">勝利数 {currentMonthSummary?.wins ?? 0} 勝</p>
            </div>
          </div>

          <div className="chart-wrap">
            <div className="chart-grid">
              {[15000, 10000, 5000].map((value) => (
                <span key={value}>{new Intl.NumberFormat("ja-JP").format(value)}</span>
              ))}
            </div>

            <div className="chart-bars">
              {monthlyBars.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-sm font-bold text-slate-400">
                  まだデータがありません
                </div>
              ) : (
                monthlyBars.map((item) => (
                  <div key={item.month} className="chart-col">
                    <div
                      className="chart-bar"
                      style={{
                        height: `${Math.max(item.ratio * 140, 12)}px`,
                        background: `linear-gradient(180deg, ${selectedTeam.accentFrom}, ${selectedTeam.accentTo})`,
                      }}
                    />
                    <span>{item.month.slice(5)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="glass-card mb-6 rounded-[28px] p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[22px] font-black tracking-tight text-[#20285d]">
              {editingId !== null ? "手動編集" : "手動入力"}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => void syncLatestGame()}
                disabled={isSyncing}
                className="mini-button"
              >
                {isSyncing ? "同期中..." : "同期"}
              </button>
              <button onClick={saveToLocalStorage} className="mini-button secondary">
                保存
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">自チーム得点</label>
                <input
                  type="number"
                  min={0}
                  value={teamScore}
                  onChange={(e) => setTeamScore(Number(e.target.value) || 0)}
                  className="app-input"
                />
              </div>
              <div>
                <label className="form-label">相手得点</label>
                <input
                  type="number"
                  min={0}
                  value={opponentScore}
                  onChange={(e) => setOpponentScore(Number(e.target.value) || 0)}
                  className="app-input"
                />
              </div>
            </div>

            <div className="manual-result-card">
              <span className={`result-chip ${resultPillClass(currentResult)}`}>
                {resultLabel(currentResult)}
              </span>
              <span className="text-base font-black text-[#5c61d6]">
                今回の加算予定 {yen(manualAddAmount)}
              </span>
            </div>

            <button onClick={saveManualGame} className="primary-gradient-button">
              {editingId !== null ? "更新する" : "手動で登録する"}
            </button>

            {editingId !== null && (
              <button onClick={resetForm} className="ghost-button">
                キャンセル
              </button>
            )}

            <button onClick={resetAllData} className="danger-button">
              データをリセット
            </button>
          </div>
        </section>
      </div>

      <nav className="bottom-nav">
        {[
          { key: "home", icon: "🏠", label: "ホーム" },
          { key: "history", icon: "🗓️", label: "履歴" },
          { key: "summary", icon: "📊", label: "月次まとめ" },
          { key: "mypage", icon: "👤", label: "マイページ" },
        ].map((item) => {
          const active = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key as ActiveTab)}
              className={`bottom-nav-item ${active ? "active" : ""}`}
            >
              <span className="text-[26px]">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}

        <button
          onClick={addQuickGame}
          className="bottom-plus-button"
          aria-label="クイック追加"
        >
          ＋
        </button>
      </nav>
    </main>
  );
}