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
  short: string;
  accent: string;
  soft: string;
  ring: string;
  button: string;
  text: string;
};

const teams: TeamInfo[] = [
  {
    name: "オリックス・バファローズ",
    short: "オリ",
    accent: "from-[#2f6bff] to-[#1740d8]",
    soft: "bg-[#eef4ff]",
    ring: "ring-[#2f6bff]/20",
    button: "from-[#2f6bff] to-[#1740d8]",
    text: "text-[#1740d8]",
  },
  {
    name: "阪神タイガース",
    short: "阪神",
    accent: "from-[#f3c300] to-[#c89c00]",
    soft: "bg-[#fff8d9]",
    ring: "ring-[#f3c300]/20",
    button: "from-[#222] to-[#111]",
    text: "text-[#8c6a00]",
  },
  {
    name: "読売ジャイアンツ",
    short: "読売",
    accent: "from-[#ff8a2a] to-[#ff5f00]",
    soft: "bg-[#fff0e4]",
    ring: "ring-orange-200",
    button: "from-[#ff8a2a] to-[#ff5f00]",
    text: "text-[#c65200]",
  },
  {
    name: "横浜DeNAベイスターズ",
    short: "横浜",
    accent: "from-[#2f6bff] to-[#0d49dc]",
    soft: "bg-[#eef4ff]",
    ring: "ring-blue-200",
    button: "from-[#2f6bff] to-[#0d49dc]",
    text: "text-[#1740d8]",
  },
  {
    name: "広島東洋カープ",
    short: "広島",
    accent: "from-[#ff6b6b] to-[#e53935]",
    soft: "bg-[#fff0f0]",
    ring: "ring-red-200",
    button: "from-[#ff6b6b] to-[#e53935]",
    text: "text-[#c62828]",
  },
  {
    name: "東京ヤクルトスワローズ",
    short: "ヤク",
    accent: "from-[#4fd67a] to-[#14b86a]",
    soft: "bg-[#eefdf4]",
    ring: "ring-green-200",
    button: "from-[#00a884] to-[#0f766e]",
    text: "text-[#0f766e]",
  },
  {
    name: "中日ドラゴンズ",
    short: "中日",
    accent: "from-[#4f8dff] to-[#1d4ed8]",
    soft: "bg-[#eef4ff]",
    ring: "ring-blue-200",
    button: "from-[#4f8dff] to-[#1d4ed8]",
    text: "text-[#1d4ed8]",
  },
  {
    name: "福岡ソフトバンクホークス",
    short: "福岡",
    accent: "from-[#444] to-[#111]",
    soft: "bg-[#f3f3f3]",
    ring: "ring-slate-200",
    button: "from-[#222] to-[#111]",
    text: "text-[#444]",
  },
  {
    name: "北海道日本ハムファイターズ",
    short: "日ハム",
    accent: "from-[#78b2ff] to-[#245bdb]",
    soft: "bg-[#eef6ff]",
    ring: "ring-sky-200",
    button: "from-[#245bdb] to-[#163d9d]",
    text: "text-[#163d9d]",
  },
  {
    name: "千葉ロッテマリーンズ",
    short: "ロッテ",
    accent: "from-[#8b95a7] to-[#4b5563]",
    soft: "bg-[#f4f6f8]",
    ring: "ring-slate-200",
    button: "from-[#6b7280] to-[#374151]",
    text: "text-[#374151]",
  },
  {
    name: "東北楽天ゴールデンイーグルス",
    short: "楽天",
    accent: "from-[#dc4b4b] to-[#b91c1c]",
    soft: "bg-[#fff1f1]",
    ring: "ring-rose-200",
    button: "from-[#dc4b4b] to-[#b91c1c]",
    text: "text-[#b91c1c]",
  },
  {
    name: "埼玉西武ライオンズ",
    short: "西武",
    accent: "from-[#4f8dff] to-[#245bdb]",
    soft: "bg-[#eef4ff]",
    ring: "ring-blue-200",
    button: "from-[#4f8dff] to-[#245bdb]",
    text: "text-[#245bdb]",
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
  return `¥${new Intl.NumberFormat("ja-JP").format(value)}`;
}

function getResult(teamScore: number, opponentScore: number): GameResult {
  if (teamScore > opponentScore) return "win";
  if (teamScore < opponentScore) return "lose";
  return "draw";
}

function resultLabel(result: GameResult) {
  if (result === "win") return "勝利";
  if (result === "lose") return "敗戦";
  return "引分";
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function teamByName(name: string) {
  return teams.find((team) => team.name === name) ?? teams[0];
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

function badgeStyle(result: GameResult) {
  if (result === "win") return "bg-[#ddf8e4] text-[#24a148]";
  if (result === "lose") return "bg-[#ffe3de] text-[#e85b4f]";
  return "bg-[#dfe9ff] text-[#2f6bff]";
}

function octagonStyle(result: GameResult) {
  if (result === "win") return "bg-[#7fe09b]";
  if (result === "lose") return "bg-[#ff9f92]";
  return "bg-[#6fa7ff]";
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function NeumorphCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "soft-panel pop-in rounded-[28px] border border-white/70 bg-white/80 backdrop-blur",
        className
      )}
    >
      {children}
    </div>
  );
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
    if (savedTeam) setFavoriteTeam(savedTeam);
    if (savedLastSavedAt) setLastSavedAt(savedLastSavedAt);
    if (savedLastSyncedAt) setLastSyncedAt(savedLastSyncedAt);

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
  const currentSavedAmount =
    currentResult === "win"
      ? amountPerWin
      : currentResult === "draw"
      ? Math.floor(amountPerWin / 2)
      : 0;

  const sortedGames = useMemo(
    () =>
      [...games].sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.id - a.id;
      }),
    [games]
  );

  const recentGames = sortedGames.slice(0, 2);

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
    setSyncMessage("保存しました");
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

  const infoRows = [
    { label: "推し球団", value: favoriteTeam, icon: "👕" },
    { label: "日付", value: date, icon: "📅" },
    { label: "対戦相手", value: opponent || "未選択", icon: "VS" },
    { label: "1勝ごとの金額", value: yen(amountPerWin), icon: "🪙" },
    { label: "自チーム得点", value: `${teamScore}`, icon: "🪄" },
    { label: "相手得点", value: `${opponentScore}`, icon: "⚾" },
  ];

  return (
    <main className="min-h-screen pb-28 text-slate-700">
      <div className="mx-auto max-w-md px-4 pb-8 pt-5">
        <header className="mb-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="mb-2 text-sm font-black tracking-wide text-[#2f6bff]">
                推し活 × 貯金
              </p>
              <div className="flex items-end gap-2">
                <h1 className="arcade-title text-[34px] font-black tracking-tight text-[#2450d7]">
                  推し勝貯金
                </h1>
                <span className="mb-2 text-lg">✨</span>
              </div>
              <p className="mt-1 text-base font-semibold text-slate-500">
                現在の推し球団：
                <span className="text-[#2f6bff]">{favoriteTeam}</span>
              </p>
            </div>

            <div className="float-card glossy-white flex h-16 w-16 items-center justify-center rounded-full ring-1 ring-slate-200">
              <span className="text-3xl">🐱</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {lastSavedAt && (
              <div className="soft-inset rounded-[18px] px-4 py-2 text-sm font-bold text-slate-500">
                最終保存: {lastSavedAt}
              </div>
            )}
            {lastSyncedAt && (
              <div className="soft-inset rounded-[18px] px-4 py-2 text-sm font-bold text-slate-500">
                最終同期: {lastSyncedAt}
              </div>
            )}
            {syncMessage && (
              <div className="soft-inset rounded-[18px] px-4 py-3 text-sm font-bold text-slate-600">
                {syncMessage}
              </div>
            )}
          </div>
        </header>

        <NeumorphCard className="float-card arcade-shadow sparkle mb-4 overflow-hidden p-0">
          <div className={cn("h-3 w-full bg-gradient-to-r", selectedTeam.accent)} />
          <div className="grid grid-cols-[1.3fr_1fr] gap-0">
            <div className="p-5">
              <p className="mb-2 text-center text-xl font-black text-[#2446c9]">累計貯金額</p>
              <div className="soft-inset relative overflow-hidden rounded-[24px] border border-[#e6edff] px-4 py-6 text-center">
                <div className="pointer-events-none absolute inset-0 rounded-[24px] border-4 border-dashed border-[#b9d0ff] opacity-60" />
                <p className="relative text-[44px] font-black leading-none tracking-tight text-[#1c45d8]">
                  {yen(totalSavings)}
                </p>
              </div>
            </div>

            <div className="flex flex-col justify-between p-4">
              <div className="soft-inset rounded-[24px] p-4">
                <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#4f8dff] to-[#245bdb] shadow-[0_10px_18px_rgba(47,107,255,0.25)]">
                  <span className="text-4xl">🕹️</span>
                </div>
                <div className="glossy-blue rounded-full px-4 py-2 text-center text-sm font-black text-white">
                  1 勝 {yen(amountPerWin)}
                </div>
              </div>
            </div>
          </div>
        </NeumorphCard>

        <NeumorphCard className="float-card mb-4 p-4">
          <div className="grid grid-cols-3 divide-x divide-slate-100">
            {[
              { label: "勝ち", value: winCount, tone: "win" as GameResult },
              { label: "負け", value: loseCount, tone: "lose" as GameResult },
              { label: "引き分け", value: drawCount, tone: "draw" as GameResult },
            ].map((item) => (
              <div key={item.label} className="px-2 text-center">
                <div
                  className={cn(
                    "mx-auto mb-2 flex h-12 w-12 items-center justify-center text-xl font-black text-white shadow-md",
                    octagonStyle(item.tone)
                  )}
                  style={{
                    clipPath:
                      "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
                  }}
                >
                  {item.label[0]}
                </div>
                <div className="text-[44px] font-black leading-none text-slate-600">
                  {item.value}
                </div>
                <p className="mt-1 text-base font-bold text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        </NeumorphCard>

        <NeumorphCard className="float-card mb-4 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-3xl">⚾</span>
            <h2 className="text-xl font-black text-slate-700">直近の試合結果</h2>
          </div>

          <div className="soft-inset rounded-[28px] border border-[#d8e5ff] p-3">
            <div className="grid grid-cols-2 gap-3">
              {recentGames.length === 0 ? (
                <div className="soft-inset col-span-2 rounded-[24px] p-8 text-center text-slate-400">
                  まだ試合が登録されていません
                </div>
              ) : (
                recentGames.map((game) => (
                  <div
                    key={game.id}
                    className="float-card glossy-white rounded-[24px] border border-slate-100 p-4 text-center"
                  >
                    <p className="text-sm font-bold text-slate-500">
                      {game.date.slice(5).replace("-", "/")}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-slate-400">
                      vs {game.opponent}
                    </p>
                    <p
                      className={cn(
                        "mt-4 text-[56px] font-black leading-none tracking-tight",
                        game.result === "win" && "text-[#2f6bff]",
                        game.result === "lose" && "text-slate-300",
                        game.result === "draw" && "text-[#6fa7ff]"
                      )}
                    >
                      {game.teamScore}-{game.opponentScore}
                    </p>
                    <div className="mt-4 inline-flex rounded-full px-4 py-2 text-sm font-black">
                      <span className={cn("rounded-full px-4 py-2", badgeStyle(game.result))}>
                        {resultLabel(game.result)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex justify-center gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    i === 3 ? "bg-[#2f6bff]" : "bg-slate-200"
                  )}
                />
              ))}
            </div>
          </div>
        </NeumorphCard>

        <NeumorphCard className="float-card mb-4 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xl">⭐</span>
            <h2 className="text-xl font-black text-slate-700">今回の加算予定</h2>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="soft-inset rounded-[22px] border border-[#dfe7ff] p-4">
              <p className="mb-1 text-sm font-bold text-slate-500">勝利で追加</p>
              <p className="text-[34px] font-black text-[#2f6bff]">{yen(amountPerWin)}</p>
            </div>

            <div className="glossy-white flex h-16 w-16 items-center justify-center rounded-full border-4 border-[#2f6bff] text-3xl">
              ⚾
            </div>

            <div className="soft-inset rounded-[22px] border border-[#dff5e5] p-4">
              <p className="mb-1 text-sm font-bold text-slate-500">引き分けで追加</p>
              <p className="text-[34px] font-black text-[#57c779]">
                {yen(Math.floor(amountPerWin / 2))}
              </p>
            </div>
          </div>
        </NeumorphCard>

        <NeumorphCard className="float-card mb-4 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xl">⭐</span>
            <h2 className="text-xl font-black text-slate-700">試合情報</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {infoRows.map((row) => (
              <div
                key={row.label}
                className="soft-inset rounded-[18px] border border-slate-100 p-3"
              >
                <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#eef4ff] text-[#2f6bff]">
                    {row.icon}
                  </span>
                  {row.label}
                </div>
                <p className="mt-2 break-words pl-10 text-sm font-black text-slate-700">
                  {row.value}
                </p>
              </div>
            ))}
          </div>
        </NeumorphCard>

        <NeumorphCard className="float-card mb-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-700">月別集計</h2>
            <span className="text-sm font-bold text-slate-400">{monthlySummary.length}か月</span>
          </div>

          {monthlySummary.length === 0 ? (
            <div className="soft-inset rounded-[20px] p-8 text-center text-slate-400">
              まだ集計できるデータがありません
            </div>
          ) : (
            <div className="space-y-3">
              {monthlySummary.map((item) => {
                const width = `${(item.savings / maxMonthlySavings) * 100}%`;
                return (
                  <div key={item.month} className="soft-inset rounded-[20px] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="font-black text-slate-700">
                          {item.month.replace("-", "年")}月
                        </p>
                        <p className="text-sm font-semibold text-slate-400">
                          {item.games}試合 / {item.wins}勝
                        </p>
                      </div>
                      <p className="text-2xl font-black text-[#2f6bff]">{yen(item.savings)}</p>
                    </div>
                    <div className="h-4 rounded-full bg-slate-100">
                      <div
                        className={cn("h-full rounded-full bg-gradient-to-r", selectedTeam.accent)}
                        style={{ width }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </NeumorphCard>

        <NeumorphCard className="float-card mb-6 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-700">
              {editingId !== null ? "試合を編集" : "試合を追加"}
            </h2>
            <button
              onClick={() => void syncLatestGame()}
              disabled={isSyncing}
              className={cn(
                "glossy-blue rounded-full px-4 py-2 text-sm font-black text-white",
                isSyncing && "opacity-50"
              )}
            >
              {isSyncing ? "同期中..." : "同期"}
            </button>
          </div>

          <div className="space-y-3">
            <select
              value={favoriteTeam}
              onChange={(e) => setFavoriteTeam(e.target.value)}
              className="glossy-white w-full rounded-[18px] border border-[#dbe5ff] px-4 py-4 text-sm font-bold"
            >
              {teams.map((team) => (
                <option key={team.name} value={team.name}>
                  {team.name}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="glossy-white w-full rounded-[18px] border border-[#dbe5ff] px-4 py-4 text-sm font-bold"
            />

            <select
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              className="glossy-white w-full rounded-[18px] border border-[#dbe5ff] px-4 py-4 text-sm font-bold"
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

            <input
              type="number"
              min={0}
              step={500}
              value={amountPerWin}
              onChange={(e) => setAmountPerWin(Number(e.target.value) || 0)}
              placeholder="1勝ごとの金額"
              className="glossy-white w-full rounded-[18px] border border-[#dbe5ff] px-4 py-4 text-sm font-bold"
            />

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min={0}
                value={teamScore}
                onChange={(e) => setTeamScore(Number(e.target.value) || 0)}
                placeholder="自チーム得点"
                className="glossy-white w-full rounded-[18px] border border-[#dbe5ff] px-4 py-4 text-sm font-bold"
              />
              <input
                type="number"
                min={0}
                value={opponentScore}
                onChange={(e) => setOpponentScore(Number(e.target.value) || 0)}
                placeholder="相手得点"
                className="glossy-white w-full rounded-[18px] border border-[#dbe5ff] px-4 py-4 text-sm font-bold"
              />
            </div>

            <div className="soft-inset rounded-[18px] p-4">
              <p className="text-sm font-bold text-slate-400">判定結果</p>
              <div className="mt-2 flex items-center justify-between">
                <span className={cn("rounded-full px-4 py-2 text-sm font-black", badgeStyle(currentResult))}>
                  {resultLabel(currentResult)}
                </span>
                <span className="text-base font-black text-[#2f6bff]">
                  追加予定 {yen(currentSavedAmount)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={saveGame}
                className={cn(
                  "rounded-[18px] bg-gradient-to-r px-4 py-4 text-sm font-black text-white shadow-lg",
                  selectedTeam.button
                )}
              >
                {editingId !== null ? "更新する" : "試合を追加"}
              </button>

              <button
                onClick={saveToLocalStorage}
                className="glossy-blue rounded-[18px] px-4 py-4 text-sm font-black text-white"
              >
                保存
              </button>
            </div>

            {editingId !== null && (
              <button
                onClick={resetForm}
                className="glossy-white w-full rounded-[18px] border border-slate-200 px-4 py-4 text-sm font-black text-slate-500"
              >
                キャンセル
              </button>
            )}

            <button
              onClick={resetAllData}
              className="w-full rounded-[18px] border border-red-100 bg-[#fff7f7] px-4 py-4 text-sm font-black text-[#eb5d55]"
            >
              データをリセット
            </button>
          </div>
        </NeumorphCard>

        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md px-4 pb-4">
          <div className="bottom-dock rounded-[28px] border border-white/70 bg-white/95 p-3 backdrop-blur">
            <div className="grid grid-cols-5 gap-2 text-center">
              {[
                { label: "ホーム", icon: "🏠", active: true },
                { label: "試合履歴", icon: "🧾" },
                { label: "貯金箱", icon: "🐷" },
                { label: "グラフ", icon: "📊" },
                { label: "設定", icon: "⚙️" },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-[18px] text-2xl",
                      item.active
                        ? "glossy-blue text-white"
                        : "text-slate-400"
                    )}
                  >
                    {item.icon}
                  </div>
                  <p
                    className={cn(
                      "text-xs font-black",
                      item.active ? "text-[#2f6bff]" : "text-slate-400"
                    )}
                  >
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}