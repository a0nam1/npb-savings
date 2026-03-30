"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type GameResult = "win" | "lose" | "draw";

type Game = {
  id: number;
  sourceGameId?: string;
  date: string;
  opponent: string;
  teamScore: number;
  opponentScore: number;
  result: GameResult;
  savedAmount: number;
};

type TeamInfo = {
  name: string;
  accent: string;
  soft: string;
  ring: string;
  button: string;
  bannerText: string;
};

const teams: TeamInfo[] = [
  {
    name: "オリックス・バファローズ",
    accent: "bg-[#c8a54b]",
    soft: "bg-[#f7f1df]",
    ring: "ring-[#c8a54b]/30",
    button: "bg-[#8f6b14] hover:bg-[#7a5c11]",
    bannerText: "text-[#6b4f0e]",
  },
  {
    name: "阪神タイガース",
    accent: "bg-[#f0c400]",
    soft: "bg-[#fff9db]",
    ring: "ring-[#f0c400]/30",
    button: "bg-[#222222] hover:bg-black",
    bannerText: "text-[#544300]",
  },
  {
    name: "読売ジャイアンツ",
    accent: "bg-[#f97316]",
    soft: "bg-[#fff1e8]",
    ring: "ring-orange-300",
    button: "bg-[#f97316] hover:bg-[#ea580c]",
    bannerText: "text-[#9a3412]",
  },
  {
    name: "横浜DeNAベイスターズ",
    accent: "bg-[#2563eb]",
    soft: "bg-[#eaf2ff]",
    ring: "ring-blue-300",
    button: "bg-[#2563eb] hover:bg-[#1d4ed8]",
    bannerText: "text-[#1d4ed8]",
  },
  {
    name: "広島東洋カープ",
    accent: "bg-[#dc2626]",
    soft: "bg-[#feecec]",
    ring: "ring-red-300",
    button: "bg-[#dc2626] hover:bg-[#b91c1c]",
    bannerText: "text-[#b91c1c]",
  },
  {
    name: "東京ヤクルトスワローズ",
    accent: "bg-[#22c55e]",
    soft: "bg-[#ebfbef]",
    ring: "ring-green-300",
    button: "bg-[#0f766e] hover:bg-[#115e59]",
    bannerText: "text-[#0f766e]",
  },
  {
    name: "中日ドラゴンズ",
    accent: "bg-[#1d4ed8]",
    soft: "bg-[#ebf2ff]",
    ring: "ring-blue-300",
    button: "bg-[#1d4ed8] hover:bg-[#1e40af]",
    bannerText: "text-[#1e40af]",
  },
  {
    name: "福岡ソフトバンクホークス",
    accent: "bg-[#facc15]",
    soft: "bg-[#fffbea]",
    ring: "ring-yellow-300",
    button: "bg-[#111827] hover:bg-black",
    bannerText: "text-[#854d0e]",
  },
  {
    name: "北海道日本ハムファイターズ",
    accent: "bg-[#60a5fa]",
    soft: "bg-[#edf6ff]",
    ring: "ring-sky-300",
    button: "bg-[#1e3a8a] hover:bg-[#1e40af]",
    bannerText: "text-[#1e3a8a]",
  },
  {
    name: "千葉ロッテマリーンズ",
    accent: "bg-[#6b7280]",
    soft: "bg-[#f3f4f6]",
    ring: "ring-slate-300",
    button: "bg-[#374151] hover:bg-[#1f2937]",
    bannerText: "text-[#374151]",
  },
  {
    name: "東北楽天ゴールデンイーグルス",
    accent: "bg-[#b91c1c]",
    soft: "bg-[#fef0f0]",
    ring: "ring-rose-300",
    button: "bg-[#b91c1c] hover:bg-[#991b1b]",
    bannerText: "text-[#991b1b]",
  },
  {
    name: "埼玉西武ライオンズ",
    accent: "bg-[#2563eb]",
    soft: "bg-[#ecf3ff]",
    ring: "ring-blue-300",
    button: "bg-[#2563eb] hover:bg-[#1d4ed8]",
    bannerText: "text-[#1d4ed8]",
  },
];

const STORAGE_KEYS = {
  amount: "npb-savings-amount",
  favoriteTeam: "npb-savings-favorite-team",
  lastSavedAt: "npb-savings-last-saved-at",
  lastSyncedAt: "npb-savings-last-synced-at",
};

function gamesStorageKey(teamName: string) {
  return `npb-savings-games-${teamName}`;
}

function yen(value: number) {
  return `${new Intl.NumberFormat("ja-JP").format(value)}円`;
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

function resultBadgeClass(result: GameResult) {
  if (result === "win") return "bg-emerald-100 text-emerald-700";
  if (result === "lose") return "bg-red-100 text-red-700";
  return "bg-slate-200 text-slate-700";
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function teamByName(name: string) {
  return teams.find((team) => team.name === name) ?? teams[0];
}

function initials(name: string) {
  return name.replace(/・/g, "").slice(0, 2);
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

  const didInitialSyncRef = useRef(false);
  const currentGamesKey = gamesStorageKey(favoriteTeam);

  useEffect(() => {
    const savedAmount = localStorage.getItem(STORAGE_KEYS.amount);
    const savedTeam = localStorage.getItem(STORAGE_KEYS.favoriteTeam);
    const savedLastSavedAt = localStorage.getItem(STORAGE_KEYS.lastSavedAt);
    const savedLastSyncedAt = localStorage.getItem(STORAGE_KEYS.lastSyncedAt);

    if (savedAmount) {
      const parsed = Number(savedAmount);
      if (!Number.isNaN(parsed)) setAmountPerWin(parsed);
    }

    if (savedTeam) {
      setFavoriteTeam(savedTeam);
    }

    if (savedLastSavedAt) {
      setLastSavedAt(savedLastSavedAt);
    }

    if (savedLastSyncedAt) {
      setLastSyncedAt(savedLastSyncedAt);
    }

    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    const savedGames = localStorage.getItem(currentGamesKey);

    if (savedGames) {
      try {
        setGames(JSON.parse(savedGames));
      } catch {
        setGames([]);
      }
    } else {
      setGames([]);
    }

    setSyncMessage("");
    setEditingId(null);
    setOpponent("");
    setTeamScore(0);
    setOpponentScore(0);
    setDate(new Date().toISOString().slice(0, 10));
  }, [favoriteTeam, currentGamesKey, isHydrated]);

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
    const now = createTimestamp();
    localStorage.setItem(STORAGE_KEYS.lastSavedAt, now);
    setLastSavedAt(now);
  }, [amountPerWin, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem(STORAGE_KEYS.favoriteTeam, favoriteTeam);
    const now = createTimestamp();
    localStorage.setItem(STORAGE_KEYS.lastSavedAt, now);
    setLastSavedAt(now);
  }, [favoriteTeam, isHydrated]);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.name === favoriteTeam) ?? teams[0],
    [favoriteTeam]
  );

  const totalSavings = useMemo(
    () => games.reduce((sum, g) => sum + g.savedAmount, 0),
    [games]
  );

  const winCount = useMemo(
    () => games.filter((g) => g.result === "win").length,
    [games]
  );

  const loseCount = useMemo(
    () => games.filter((g) => g.result === "lose").length,
    [games]
  );

  const drawCount = useMemo(
    () => games.filter((g) => g.result === "draw").length,
    [games]
  );

  const currentResult = getResult(teamScore, opponentScore);
  const currentSavedAmount = currentResult === "win" ? amountPerWin : 0;

  const sortedGames = useMemo(
    () => [...games].sort((a, b) => {
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

  const maxMonthlySavings = useMemo(() => {
    if (monthlySummary.length === 0) return 1;
    return Math.max(...monthlySummary.map((item) => item.savings), 1);
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
            const savedAmount = result === "win" ? amountPerWin : 0;

            return {
              id: Date.now() + index,
              sourceGameId: incoming.sourceGameId,
              date: incoming.date,
              opponent: incoming.opponent,
              teamScore: incoming.teamScore,
              opponentScore: incoming.opponentScore,
              result,
              savedAmount,
            };
          });

        if (newItems.length === 0) {
          setSyncMessage("最新の試合結果はすべて反映済みです");
          return prev;
        }

        const merged = [...newItems, ...prev].sort((a, b) => {
          const dateCompare = b.date.localeCompare(a.date);
          if (dateCompare !== 0) return dateCompare;
          return b.id - a.id;
        });

        setSyncMessage(`${newItems.length}件の試合結果を反映しました`);
        return merged;
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
    alert("保存しました");
  }

  function resetForm() {
    setDate(new Date().toISOString().slice(0, 10));
    setOpponent("");
    setTeamScore(0);
    setOpponentScore(0);
    setEditingId(null);
  }

  function saveGame() {
    if (!opponent.trim()) return;

    const result = getResult(teamScore, opponentScore);
    const savedAmount = result === "win" ? amountPerWin : 0;

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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetAllData() {
    teams.forEach((team) => {
      localStorage.removeItem(gamesStorageKey(team.name));
    });
    localStorage.removeItem(STORAGE_KEYS.amount);
    localStorage.removeItem(STORAGE_KEYS.favoriteTeam);
    localStorage.removeItem(STORAGE_KEYS.lastSavedAt);
    localStorage.removeItem(STORAGE_KEYS.lastSyncedAt);

    setFavoriteTeam("オリックス・バファローズ");
    setAmountPerWin(3000);
    setGames([]);
    setLastSavedAt("");
    setLastSyncedAt("");
    setSyncMessage("");
    resetForm();
  }

  return (
    <main className={`min-h-screen text-slate-900 ${selectedTeam.soft}`}>
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <header className="mb-8 overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
          <div className={`h-3 w-full ${selectedTeam.accent}`} />
          <div className="p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                  推し勝貯金
                </h1>
                <p className="mt-2 text-sm text-slate-600 md:text-base">
                  推し球団の勝利にあわせて貯金するWebアプリ
                </p>
              </div>

              <div className="flex flex-col gap-2 md:items-end">
                <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                  現在の推し球団: <span className="font-semibold">{favoriteTeam}</span>
                </div>

                {lastSavedAt && (
                  <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-600">
                    最終保存: {lastSavedAt}
                  </div>
                )}

                {lastSyncedAt && (
                  <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-600">
                    最終同期: {lastSyncedAt}
                  </div>
                )}

                {syncMessage && (
                  <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-700">
                    {syncMessage}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => void syncLatestGame()}
                    disabled={isSyncing}
                    className="rounded-2xl border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSyncing ? "同期中..." : "最新試合を同期"}
                  </button>

                  <button
                    onClick={saveToLocalStorage}
                    className="rounded-2xl bg-blue-600 px-4 py-2 text-sm text-white transition hover:bg-blue-500"
                  >
                    保存
                  </button>

                  <button
                    onClick={resetAllData}
                    className="rounded-2xl border border-red-200 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50"
                  >
                    データをリセット
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ${selectedTeam.ring}`}>
            <p className="text-sm text-slate-500">累計貯金額</p>
            <p className="mt-2 text-3xl font-bold">{yen(totalSavings)}</p>
          </div>

          <div className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ${selectedTeam.ring}`}>
            <p className="text-sm text-slate-500">1勝あたり</p>
            <p className="mt-2 text-3xl font-bold">{yen(amountPerWin)}</p>
          </div>

          <div className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ${selectedTeam.ring}`}>
            <p className="text-sm text-slate-500">勝敗数</p>
            <p className="mt-2 text-xl font-semibold">
              {winCount}勝 {loseCount}敗 {drawCount}分
            </p>
          </div>

          <div className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ${selectedTeam.ring}`}>
            <p className="text-sm text-slate-500">今回の加算予定</p>
            <p className="mt-2 text-3xl font-bold">{yen(currentSavedAmount)}</p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <section className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ${selectedTeam.ring}`}>
            <h2 className="mb-4 text-xl font-semibold">
              {editingId !== null ? "試合を編集" : "試合を追加"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  推し球団
                </label>
                <select
                  value={favoriteTeam}
                  onChange={(e) => setFavoriteTeam(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-500"
                >
                  {teams.map((team) => (
                    <option key={team.name} value={team.name}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  日付
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  対戦相手
                </label>
                <select
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-500"
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

              {opponent && (
                <div className={`rounded-2xl p-4 ${teamByName(opponent).soft}`}>
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                        teamByName(opponent).accent
                      } text-sm font-bold text-white shadow-sm`}
                    >
                      {initials(opponent)}
                    </div>
                    <div>
                      <p
                        className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                          teamByName(opponent).bannerText
                        }`}
                      >
                        対戦相手
                      </p>
                      <p className="mt-1 text-lg font-semibold">{opponent}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  1勝ごとの金額
                </label>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={amountPerWin}
                  onChange={(e) => setAmountPerWin(Number(e.target.value) || 0)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    自チーム得点
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={teamScore}
                    onChange={(e) => setTeamScore(Number(e.target.value) || 0)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    相手得点
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={opponentScore}
                    onChange={(e) => setOpponentScore(Number(e.target.value) || 0)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-500"
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-slate-100 p-4">
                <p className="text-sm text-slate-500">判定結果</p>
                <div className="mt-2 flex items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${resultBadgeClass(
                      currentResult
                    )}`}
                  >
                    {resultLabel(currentResult)}
                  </span>
                  <span className="text-sm text-slate-600">
                    追加予定: {yen(currentSavedAmount)}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={saveGame}
                  className={`flex-1 rounded-2xl px-4 py-3 text-sm font-medium text-white transition ${selectedTeam.button}`}
                >
                  {editingId !== null ? "更新する" : "試合を追加"}
                </button>

                {editingId !== null && (
                  <button
                    onClick={resetForm}
                    className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    キャンセル
                  </button>
                )}
              </div>
            </div>
          </section>

          <div className="space-y-6">
            <section className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ${selectedTeam.ring}`}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">試合履歴</h2>
                <span className="text-sm text-slate-500">{games.length}件</span>
              </div>

              {sortedGames.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
                  まだ試合が登録されていません
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedGames.map((game) => {
                    const opponentTeam = teamByName(game.opponent);

                    return (
                      <div key={game.id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm text-slate-500">{game.date}</p>

                            <div className="mt-2 flex items-center gap-3">
                              <div
                                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${opponentTeam.accent} text-sm font-bold text-white shadow-sm`}
                              >
                                {initials(game.opponent)}
                              </div>

                              <div>
                                <p
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${opponentTeam.soft} ${opponentTeam.bannerText}`}
                                >
                                  対戦相手
                                </p>
                                <p className="mt-1 text-lg font-semibold">{game.opponent}</p>
                              </div>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="text-sm text-slate-700">
                                {game.teamScore} - {game.opponentScore}
                              </span>
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${resultBadgeClass(
                                  game.result
                                )}`}
                              >
                                {resultLabel(game.result)}
                              </span>
                            </div>

                            <p className="mt-2 text-sm font-medium text-slate-900">
                              貯金額: {yen(game.savedAmount)}
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => startEdit(game)}
                              className="rounded-2xl border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => deleteGame(game.id)}
                              className="rounded-2xl border border-red-200 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50"
                            >
                              削除
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ${selectedTeam.ring}`}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">月別集計</h2>
                <span className="text-sm text-slate-500">{monthlySummary.length}か月</span>
              </div>

              {monthlySummary.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                  まだ集計できるデータがありません
                </div>
              ) : (
                <div className="space-y-3">
                  {monthlySummary.map((item) => {
                    const width = `${(item.savings / maxMonthlySavings) * 100}%`;

                    return (
                      <div key={item.month} className="rounded-2xl bg-slate-50 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0">
                            <p className="font-semibold">{item.month.replace("-", "年")}月</p>
                            <p className="text-sm text-slate-600">
                              {item.games}試合 / {item.wins}勝
                            </p>
                          </div>
                          <p className="text-lg font-bold">{yen(item.savings)}</p>
                        </div>

                        <div className="mt-4">
                          <div className="mb-2 flex items-end justify-between text-xs text-slate-500">
                            <span>月別貯金額</span>
                            <span>{Math.round((item.savings / maxMonthlySavings) * 100)}%</span>
                          </div>
                          <div className="h-4 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full ${selectedTeam.accent}`}
                              style={{ width }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}