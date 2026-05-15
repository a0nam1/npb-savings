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
};

type TodayGameInfo = {
  today: {
    hasGame: boolean;
    date: string;
    opponent: string;
    venue: string;
    startTime: string;
    note?: string;
  };
  tomorrowStarter: {
    hasAnnouncement: boolean;
    date: string;
    opponent: string;
    venue: string;
    startTime: string;
    favoriteStarter: string;
    opponentStarter: string;
    note?: string;
  };
  debug?: {
    team: string;
    year: number;
    month: number;
    todaySource: "monthly-detail" | "none";
    tomorrowSource: "starter" | "monthly-detail" | "none";
  };
};

type TopicInfo = {
  ok: boolean;
  topic: {
    videoId: string;
    title: string;
    publishedAt: string;
    thumbnailUrl: string;
    channelTitle: string;
    watchUrl: string;
    embedUrl: string;
  } | null;
  debug?: {
    team: string;
    query: string;
    usedKeywords: string[];
    itemCount: number;
    reason?: string;
  };
};

const teams: TeamInfo[] = [
  { name: "オリックス・バファローズ", short: "オリ" },
  { name: "阪神タイガース", short: "阪神" },
  { name: "読売ジャイアンツ", short: "読売" },
  { name: "横浜DeNAベイスターズ", short: "横浜" },
  { name: "広島東洋カープ", short: "広島" },
  { name: "東京ヤクルトスワローズ", short: "ヤク" },
  { name: "中日ドラゴンズ", short: "中日" },
  { name: "福岡ソフトバンクホークス", short: "福岡" },
  { name: "北海道日本ハムファイターズ", short: "日ハム" },
  { name: "千葉ロッテマリーンズ", short: "ロッテ" },
  { name: "東北楽天ゴールデンイーグルス", short: "楽天" },
  { name: "埼玉西武ライオンズ", short: "西武" },
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

function createTimestamp() {
  return new Date().toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function averageSavings(games: Game[]) {
  if (games.length === 0) return 0;
  return Math.round(games.reduce((sum, game) => sum + game.savedAmount, 0) / games.length);
}

function formatPublishedAt(value: string) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export default function Page() {
  const [favoriteTeam, setFavoriteTeam] = useState("オリックス・バファローズ");
  const [amountPerWin, setAmountPerWin] = useState(1500);
  const [games, setGames] = useState<Game[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const [todayGame, setTodayGame] = useState<TodayGameInfo | null>(null);
  const [todayGameLoading, setTodayGameLoading] = useState(false);

  const [topicInfo, setTopicInfo] = useState<TopicInfo | null>(null);
  const [topicLoading, setTopicLoading] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [opponent, setOpponent] = useState("");
  const [teamScore, setTeamScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [debugEnabled, setDebugEnabled] = useState(true);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const didInitialSyncRef = useRef(false);
  const currentGamesKey = gamesStorageKey(favoriteTeam);

  function addDebugLog(message: string, payload?: unknown) {
    const text =
      payload === undefined
        ? message
        : `${message}: ${JSON.stringify(payload, null, 2)}`;
    console.log(message, payload ?? "");
    setDebugLogs((prev) => [`${new Date().toLocaleTimeString("ja-JP")} ${text}`, ...prev].slice(0, 50));
  }

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
    addDebugLog("hydrate complete", {
      savedAmount,
      savedTeam,
      savedLastSavedAt,
      savedLastSyncedAt,
    });
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    const savedGames = localStorage.getItem(currentGamesKey);
    if (savedGames) {
      try {
        const parsed = JSON.parse(savedGames);
        setGames(parsed);
        addDebugLog("loaded team games", { key: currentGamesKey, count: parsed.length });
      } catch {
        setGames([]);
        addDebugLog("failed to parse team games", { key: currentGamesKey });
      }
    } else {
      setGames([]);
      addDebugLog("no saved games for team", { key: currentGamesKey });
    }

    setShowAllHistory(false);
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

  const sortedGames = useMemo(
    () =>
      [...games].sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.id - a.id;
      }),
    [games],
  );

  const visibleGames = showAllHistory ? sortedGames : sortedGames.slice(0, 5);

  const totalSavings = useMemo(
    () => games.reduce((sum, game) => sum + game.savedAmount, 0),
    [games],
  );

  const winCount = useMemo(() => games.filter((g) => g.result === "win").length, [games]);
  const loseCount = useMemo(() => games.filter((g) => g.result === "lose").length, [games]);
  const drawCount = useMemo(() => games.filter((g) => g.result === "draw").length, [games]);

  const currentResult = getResult(teamScore, opponentScore);
  const currentSavedAmount =
    currentResult === "win"
      ? amountPerWin
      : currentResult === "draw"
        ? Math.floor(amountPerWin / 2)
        : 0;

  const monthlySummary = useMemo(() => {
    const grouped = new Map<string, { savings: number; wins: number; loses: number; draws: number }>();

    for (const game of games) {
      const key = monthKey(game.date);
      const current = grouped.get(key) ?? { savings: 0, wins: 0, loses: 0, draws: 0 };
      current.savings += game.savedAmount;
      if (game.result === "win") current.wins += 1;
      if (game.result === "lose") current.loses += 1;
      if (game.result === "draw") current.draws += 1;
      grouped.set(key, current);
    }

    return Array.from(grouped.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, value]) => ({ month, ...value }));
  }, [games]);

  async function fetchTodayGame(team: string) {
    try {
      setTodayGameLoading(true);
      addDebugLog("fetchTodayGame start", { team });

      const res = await fetch(`/api/today-game?team=${encodeURIComponent(team)}`, {
        cache: "no-store",
      });
      const data: TodayGameInfo = await res.json();

      setTodayGame(data);
      addDebugLog("fetchTodayGame response", data);
    } catch (error) {
      console.error("fetchTodayGame error:", error);
      addDebugLog("fetchTodayGame error", {
        message: error instanceof Error ? error.message : String(error),
      });
      setTodayGame(null);
    } finally {
      setTodayGameLoading(false);
    }
  }

  async function fetchTopics(team: string) {
    try {
      setTopicLoading(true);
      addDebugLog("fetchTopics start", { team });

      const res = await fetch(`/api/topics?team=${encodeURIComponent(team)}`, {
        cache: "no-store",
      });
      const data: TopicInfo = await res.json();

      setTopicInfo(data);
      addDebugLog("fetchTopics response", data);
    } catch (error) {
      console.error("fetchTopics error:", error);
      addDebugLog("fetchTopics error", {
        message: error instanceof Error ? error.message : String(error),
      });
      setTopicInfo(null);
    } finally {
      setTopicLoading(false);
    }
  }

  useEffect(() => {
    if (!isHydrated) return;
    void fetchTodayGame(favoriteTeam);
    void fetchTopics(favoriteTeam);
  }, [favoriteTeam, isHydrated]);

  async function syncLatestGame() {
    try {
      addDebugLog("syncLatestGame start", { favoriteTeam });
      setIsSyncing(true);
      setSyncMessage("試合結果を確認中...");

      const url = `/api/auto-sync?team=${encodeURIComponent(favoriteTeam)}&season=2026`;
      addDebugLog("fetch start", { url });

      const res = await fetch(url, { cache: "no-store" });

      const now = createTimestamp();
      localStorage.setItem(STORAGE_KEYS.lastSyncedAt, now);
      setLastSyncedAt(now);

      addDebugLog("fetch response", {
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
      });

      if (!res.ok) {
        setSyncMessage("同期に失敗しました");
        return;
      }

      const data = await res.json();
      addDebugLog("sync response", data);

      const incomingGames = data?.games ?? [];

      if (incomingGames.length === 0) {
        setSyncMessage(data?.message ?? "新しい試合結果はありません");
        addDebugLog("incomingGames empty", data);
        return;
      }

      setGames((prev) => {
        addDebugLog("prev games count", { count: prev.length });

        const newItems: Game[] = incomingGames
          .filter((incoming: any) => {
            const exists = prev.some((g) => {
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

            addDebugLog("dedupe check", { incoming, exists });
            return !exists;
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

        addDebugLog("newItems", newItems);

        if (newItems.length === 0) {
          setSyncMessage("最新の試合結果はすべて反映済みです");
          return prev;
        }

        setSyncMessage(`${newItems.length}件の試合結果を反映しました`);

        const merged = [...newItems, ...prev].sort((a, b) => {
          const dateCompare = b.date.localeCompare(a.date);
          if (dateCompare !== 0) return dateCompare;
          return b.id - a.id;
        });

        addDebugLog("merged games count", { count: merged.length });
        return merged;
      });
    } catch (error) {
      console.error(error);
      addDebugLog("sync error", {
        message: error instanceof Error ? error.message : String(error),
      });
      const now = createTimestamp();
      localStorage.setItem(STORAGE_KEYS.lastSyncedAt, now);
      setLastSyncedAt(now);
      setSyncMessage("同期に失敗しました");
    } finally {
      setIsSyncing(false);
      addDebugLog("syncLatestGame end");
    }
  }

  useEffect(() => {
    if (!isHydrated) return;

    if (!didInitialSyncRef.current) {
      didInitialSyncRef.current = true;
      addDebugLog("initial auto sync");
      void syncLatestGame();
      return;
    }

    addDebugLog("team changed auto sync", { favoriteTeam });
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
    addDebugLog("manual save", { key: currentGamesKey, count: games.length });
  }

  function resetForm() {
    setDate(new Date().toISOString().slice(0, 10));
    setOpponent("");
    setTeamScore(0);
    setOpponentScore(0);
    setEditingId(null);
    addDebugLog("form reset");
  }

  function saveGame() {
    if (!opponent.trim()) {
      addDebugLog("saveGame blocked", { reason: "opponent empty" });
      return;
    }

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
            : game,
        ),
      );
      addDebugLog("game updated", { editingId, date, opponent, teamScore, opponentScore, result });
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
      addDebugLog("game added", newGame);
    }

    resetForm();
  }

  function deleteGame(id: number) {
    setGames((prev) => prev.filter((g) => g.id !== id));
    addDebugLog("game deleted", { id });
    if (editingId === id) resetForm();
  }

  function startEdit(game: Game) {
    setEditingId(game.id);
    setDate(game.date);
    setOpponent(game.opponent);
    setTeamScore(game.teamScore);
    setOpponentScore(game.opponentScore);
    addDebugLog("start edit", game);
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
    setAmountPerWin(1500);
    setGames([]);
    setLastSavedAt("");
    setLastSyncedAt("");
    setSyncMessage("");
    setTodayGame(null);
    setTopicInfo(null);
    addDebugLog("reset all data");
    resetForm();
  }

  return (
    <main className="sports-app-shell">
      <div className="sports-app-container sports-app-container--wide">
        <section className="hero-navy">
          <div className="hero-navy__content">
            <div>
              <p className="hero-navy__eyebrow">推し活 × 貯金</p>
              <h1 className="hero-navy__title">推し勝貯金</h1>
              <p className="hero-navy__team">
                現在の推し球団：
                <span>{favoriteTeam}</span>
              </p>
            </div>

            <button className="profile-circle" type="button" aria-label="profile">
              <span>◯</span>
            </button>
          </div>

          <div className="hero-ball" />
        </section>

        <section className="white-card summary-top-card">
          <div className="summary-top-card__row">
            <div className="money-icon-box">¥</div>

            <div className="summary-top-card__main">
              <p className="section-mini-label">累計貯金額</p>
              <h2>{yen(totalSavings)}</h2>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                justifyContent: "flex-end",
                alignItems: "center",
              }}
            >
              <div className="pill-dark">1 勝 {yen(amountPerWin)}</div>
            </div>
          </div>

          <div className="stats-strip">
            <div>
              <p>勝</p>
              <strong>{winCount}</strong>
            </div>
            <div>
              <p>敗</p>
              <strong>{loseCount}</strong>
            </div>
            <div>
              <p>分</p>
              <strong>{drawCount}</strong>
            </div>
          </div>
        </section>

        <div className="responsive-main-grid">
          <div className="responsive-main-grid__left">
            <section className="white-card">
              <div className="section-header">
                <h3>試合</h3>
              </div>

              {todayGameLoading ? (
                <div className="empty-box">試合情報を読み込み中...</div>
              ) : !todayGame ? (
                <div className="empty-box">試合情報を取得できませんでした。</div>
              ) : (
                <>
                  <div className="game-scroll-wrap">
                    <div className="game-scroll-track">
                      <article className="game-slide game-slide--today">
                        <div className="game-slide__badge">TODAY</div>

                        {todayGame.today.hasGame ? (
                          <>
                            <div className="game-slide__title">本日の試合</div>
                            <div className="game-slide__match">vs {todayGame.today.opponent}</div>

                            <div className="game-info-grid">
                              <div className="game-info-box">
                                <div className="game-info-box__label">開催場所</div>
                                <div className="game-info-box__value">
                                  {todayGame.today.venue || "未定"}
                                </div>
                              </div>

                              <div className="game-info-box">
                                <div className="game-info-box__label">開始時刻</div>
                                <div className="game-info-box__value">
                                  {todayGame.today.startTime || "--:--"}
                                </div>
                              </div>
                            </div>

                            {todayGame.today.note ? (
                              <div className="game-slide__note">{todayGame.today.note}</div>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <div className="game-slide__title">本日の試合</div>
                            <div className="game-slide__empty">本日は試合予定がありません</div>
                            {todayGame.today.note ? (
                              <div className="game-slide__note">{todayGame.today.note}</div>
                            ) : null}
                          </>
                        )}
                      </article>

                      <article className="game-slide game-slide--tomorrow">
                        <div className="game-slide__badge">TOMORROW</div>

                        <div className="game-slide__title">翌日の試合</div>

                        {todayGame.tomorrowStarter.hasAnnouncement ? (
                          <>
                            <div className="game-slide__match">
                              vs {todayGame.tomorrowStarter.opponent}
                            </div>

                            <div className="game-info-grid">
                              <div className="game-info-box">
                                <div className="game-info-box__label">開催場所</div>
                                <div className="game-info-box__value">
                                  {todayGame.tomorrowStarter.venue || "未定"}
                                </div>
                              </div>

                              <div className="game-info-box">
                                <div className="game-info-box__label">開始時刻</div>
                                <div className="game-info-box__value">
                                  {todayGame.tomorrowStarter.startTime || "--:--"}
                                </div>
                              </div>
                            </div>

                            {todayGame.tomorrowStarter.note ? (
                              <div className="game-slide__note">
                                {todayGame.tomorrowStarter.note}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <div className="game-slide__empty">翌日は試合予定がありません</div>

                            {todayGame.tomorrowStarter.note ? (
                              <div className="game-slide__note">
                                {todayGame.tomorrowStarter.note}
                              </div>
                            ) : null}
                          </>
                        )}
                      </article>
                    </div>
                  </div>

                  <div className="game-scroll-hint">横にスワイプして確認</div>
                </>
              )}
            </section>

            <section className="white-card">
              <div className="section-header">
                <h3>今日のトピックス</h3>
              </div>

              {topicLoading ? (
                <div className="empty-box">トピックスを読み込み中...</div>
              ) : !topicInfo?.topic ? (
                <div className="empty-box">
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>動画が見つかりませんでした</div>
                  <div style={{ color: "#7b8598", fontSize: 14 }}>
                    {topicInfo?.debug?.reason ?? "YouTubeのハイライトを取得できませんでした。"}
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      paddingTop: "56.25%",
                      borderRadius: 18,
                      overflow: "hidden",
                      background: "#0f172a",
                    }}
                  >
                    <iframe
                      src={topicInfo.topic.embedUrl}
                      title={topicInfo.topic.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        border: "none",
                      }}
                    />
                  </div>

                  <div
                    style={{
                      border: "1px solid #e7e9ef",
                      borderRadius: 18,
                      background: "#fff",
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: "#2f66d8",
                        marginBottom: 8,
                      }}
                    >
                      PACIFIC LEAGUE TV
                    </div>

                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 900,
                        lineHeight: 1.5,
                        color: "#1f2a44",
                        marginBottom: 10,
                      }}
                    >
                      {topicInfo.topic.title}
                    </div>

                    <div style={{ fontSize: 13, color: "#6c7890", marginBottom: 12 }}>
                      公開日時: {formatPublishedAt(topicInfo.topic.publishedAt)}
                    </div>

                    <a
                      href={topicInfo.topic.watchUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="small-outline"
                      style={{
                        display: "inline-flex",
                        textDecoration: "none",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      YouTubeで見る
                    </a>
                  </div>
                </div>
              )}
            </section>

            <section className="white-card">
              <div className="section-header">
                <h3>試合を追加</h3>
              </div>

              <div className="form-list">
                <div className="form-row">
                  <span className="form-row__icon">👥</span>
                  <label>推し球団</label>
                  <select value={favoriteTeam} onChange={(e) => setFavoriteTeam(e.target.value)}>
                    {teams.map((team) => (
                      <option key={team.name} value={team.name}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <span className="form-row__icon">📅</span>
                  <label>日付</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>

                <div className="form-row">
                  <span className="form-row__icon">Ⓥ</span>
                  <label>対戦相手</label>
                  <select value={opponent} onChange={(e) => setOpponent(e.target.value)}>
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

                <div className="form-row">
                  <span className="form-row__icon">₿</span>
                  <label>1勝ごとの金額</label>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={amountPerWin}
                    onChange={(e) => setAmountPerWin(Number(e.target.value) || 0)}
                  />
                </div>

                <div className="form-row">
                  <span className="form-row__icon">🖊</span>
                  <label>自チーム得点</label>
                  <input
                    type="number"
                    min={0}
                    value={teamScore}
                    onChange={(e) => setTeamScore(Number(e.target.value) || 0)}
                  />
                </div>

                <div className="form-row">
                  <span className="form-row__icon">⚾</span>
                  <label>相手得点</label>
                  <input
                    type="number"
                    min={0}
                    value={opponentScore}
                    onChange={(e) => setOpponentScore(Number(e.target.value) || 0)}
                  />
                </div>

                <div className="form-row">
                  <span className="form-row__icon">⚑</span>
                  <label>判定結果</label>
                  <div className={`judge-chip ${currentResult}`}>
                    {resultLabel(currentResult)}
                  </div>
                </div>
              </div>

              <div className="action-stack">
                <button className="primary-navy-button" onClick={saveGame}>
                  {editingId !== null ? "更新する" : "試合を追加"}
                </button>

                {editingId !== null && (
                  <button className="secondary-line-button" onClick={resetForm}>
                    キャンセル
                  </button>
                )}

                <div className="mini-actions">
                  <button
                    className="small-outline"
                    onClick={() => {
                      addDebugLog("sync button clicked");
                      void syncLatestGame();
                    }}
                    disabled={isSyncing}
                  >
                    {isSyncing ? "同期中..." : "同期"}
                  </button>
                  <button className="small-outline" onClick={saveToLocalStorage}>
                    保存
                  </button>
                  <button className="small-outline danger" onClick={resetAllData}>
                    リセット
                  </button>
                </div>

                {syncMessage && <p className="sync-message">{syncMessage}</p>}
                {lastSyncedAt && <p className="meta-message">最終同期: {lastSyncedAt}</p>}
                {lastSavedAt && <p className="meta-message">最終保存: {lastSavedAt}</p>}
                <p className="meta-message emphasis">今回の加算予定: {yen(currentSavedAmount)}</p>
              </div>
            </section>

            {debugEnabled && (
              <section className="white-card">
                <div className="section-header">
                  <h3>デバッグ表示</h3>
                  <div className="mini-actions" style={{ marginTop: 0 }}>
                    <button className="small-outline" onClick={() => setDebugLogs([])}>
                      クリア
                    </button>
                    <button className="small-outline" onClick={() => setDebugEnabled(false)}>
                      非表示
                    </button>
                  </div>
                </div>

                <div className="empty-box" style={{ textAlign: "left" }}>
                  <p><strong>現在の球団:</strong> {favoriteTeam}</p>
                  <p><strong>保存キー:</strong> {currentGamesKey}</p>
                  <p><strong>試合数:</strong> {games.length}</p>
                  <p><strong>同期中:</strong> {String(isSyncing)}</p>
                  <p><strong>最終同期:</strong> {lastSyncedAt || "未同期"}</p>
                  <p><strong>最終保存:</strong> {lastSavedAt || "未保存"}</p>
                  <p><strong>本日の試合:</strong> {todayGame?.today?.hasGame ? "あり" : "なし"}</p>
                  <p><strong>今日の取得元:</strong> {todayGame?.debug?.todaySource ?? "未取得"}</p>
                  <p><strong>翌日の試合:</strong> {todayGame?.tomorrowStarter?.hasAnnouncement ? "あり" : "なし"}</p>
                  <p><strong>翌日の取得元:</strong> {todayGame?.debug?.tomorrowSource ?? "未取得"}</p>
                  <p><strong>トピックス動画:</strong> {topicInfo?.topic ? "あり" : "なし"}</p>
                </div>

                <div
                  style={{
                    marginTop: 12,
                    border: "1px solid #e7e9ef",
                    borderRadius: 12,
                    background: "#0f172a",
                    color: "#e2e8f0",
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      marginBottom: 10,
                      color: "#93c5fd",
                    }}
                  >
                    todayGame JSON
                  </div>

                  <div
                    style={{
                      maxHeight: 220,
                      overflow: "auto",
                      fontSize: 12,
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.5,
                    }}
                  >
                    {todayGame ? JSON.stringify(todayGame, null, 2) : "todayGame はまだありません"}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 12,
                    border: "1px solid #e7e9ef",
                    borderRadius: 12,
                    background: "#0f172a",
                    color: "#e2e8f0",
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      marginBottom: 10,
                      color: "#93c5fd",
                    }}
                  >
                    topicInfo JSON
                  </div>

                  <div
                    style={{
                      maxHeight: 220,
                      overflow: "auto",
                      fontSize: 12,
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.5,
                    }}
                  >
                    {topicInfo ? JSON.stringify(topicInfo, null, 2) : "topicInfo はまだありません"}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 12,
                    border: "1px solid #e7e9ef",
                    borderRadius: 12,
                    background: "#0f172a",
                    color: "#e2e8f0",
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      marginBottom: 10,
                      color: "#93c5fd",
                    }}
                  >
                    debug logs
                  </div>

                  <div
                    style={{
                      maxHeight: 320,
                      overflow: "auto",
                      fontSize: 12,
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.5,
                    }}
                  >
                    {debugLogs.length === 0 ? "ログはまだありません" : debugLogs.join("\n\n")}
                  </div>
                </div>
              </section>
            )}

            {!debugEnabled && (
              <section className="white-card">
                <div className="section-header">
                  <h3>デバッグ表示</h3>
                </div>
                <button className="small-outline" onClick={() => setDebugEnabled(true)}>
                  デバッグを再表示
                </button>
              </section>
            )}
          </div>

          <div className="responsive-main-grid__right">
            <section className="white-card">
              <div className="section-header">
                <h3>試合履歴</h3>
                <button
                  className="section-link"
                  type="button"
                  onClick={() => setShowAllHistory((prev) => !prev)}
                >
                  {showAllHistory ? "閉じる" : "すべてを見る ›"}
                </button>
              </div>

              {sortedGames.length === 0 ? (
                <div className="empty-box">まだ試合が登録されていません</div>
              ) : (
                <div className="history-list">
                  {visibleGames.map((game) => (
                    <div key={game.id} className="history-line">
                      <div className="history-line__left">
                        <p className="history-date">{game.date}</p>
                        <p className="history-opponent">vs {game.opponent}</p>
                      </div>

                      <div className={`history-badge ${game.result}`}>
                        {resultLabel(game.result)}
                      </div>

                      <div className="history-score">
                        {game.teamScore} - {game.opponentScore}
                      </div>

                      <div className="history-actions">
                        <button onClick={() => startEdit(game)}>編集</button>
                        <button onClick={() => deleteGame(game.id)}>削除</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="white-card">
              <div className="section-header">
                <h3>月別集計</h3>
              </div>

              {monthlySummary.length > 0 ? (
                <div style={{ display: "grid", gap: 14 }}>
                  {monthlySummary.map((month) => {
                    const monthGames = games.filter((game) => monthKey(game.date) === month.month);
                    const monthWinRate =
                      monthGames.length === 0
                        ? 0
                        : Math.round(
                            (monthGames.filter((g) => g.result === "win").length / monthGames.length) *
                              1000,
                          ) / 1000;

                    return (
                      <div key={month.month} className="monthly-table">
                        <div className="monthly-table__month">
                          {month.month.replace("-", "年")}月
                        </div>
                        <div>
                          <span>貯金額</span>
                          <strong>{yen(month.savings)}</strong>
                        </div>
                        <div>
                          <span>勝</span>
                          <strong>{month.wins}</strong>
                        </div>
                        <div>
                          <span>敗</span>
                          <strong>{month.loses}</strong>
                        </div>
                        <div>
                          <span>分</span>
                          <strong>{month.draws}</strong>
                        </div>
                        <div>
                          <span>勝率</span>
                          <strong>{monthWinRate.toFixed(3)}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-box">月別集計データがありません</div>
              )}

              <div className="sub-metrics">
                <div>
                  <span>試合数</span>
                  <strong>{games.length}</strong>
                </div>
                <div>
                  <span>勝利数</span>
                  <strong>{winCount}</strong>
                </div>
                <div>
                  <span>平均貯金額</span>
                  <strong>{yen(averageSavings(games))}</strong>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <div
        style={{
          textAlign: "center",
          fontSize: 11,
          color: "#94a3b8",
          marginTop: 8,
          paddingBottom: 16,
        }}
      >
        ver. 1.0.0
      </div>
    </main>
  );
}