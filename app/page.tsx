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
  note?: string;
};

type TeamInfo = {
  name: string;
  short: string;
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

function teamByName(name: string) {
  return teams.find((team) => team.name === name) ?? teams[0];
}

function averageSavings(games: Game[]) {
  if (games.length === 0) return 0;
  return Math.round(games.reduce((sum, game) => sum + game.savedAmount, 0) / games.length);
}

function winRate(games: Game[]) {
  if (games.length === 0) return 0;
  const wins = games.filter((g) => g.result === "win").length;
  return Math.round((wins / games.length) * 1000) / 1000;
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

  const sortedGames = useMemo(
    () =>
      [...games].sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.id - a.id;
      }),
    [games]
  );

  const totalSavings = useMemo(
    () => games.reduce((sum, game) => sum + game.savedAmount, 0),
    [games]
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

  const currentMonth = monthlySummary[0];

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

            <div className="pill-dark">1 勝 {yen(amountPerWin)}</div>
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
                <h3>今回の加算予定</h3>
              </div>

              <div className="bonus-stack">
                <div className="bonus-card muted">
                  <div className="bonus-card__icon gray">⊖</div>
                  <div className="bonus-card__main">
                    <p className="bonus-card__title">引き分け</p>
                    <p className="bonus-card__sub">追加予定：¥0</p>
                  </div>
                </div>

                <div className="bonus-arrow">↑</div>

                <div className="bonus-card active">
                  <div className="bonus-card__icon gold">🏆</div>
                  <div className="bonus-card__main">
                    <p className="bonus-card__title strong">勝利</p>
                    <p className="bonus-card__sub strong">追加予定：{yen(amountPerWin)}</p>
                  </div>
                  <div className="bonus-card__amount">{yen(amountPerWin)}</div>
                </div>
              </div>
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
                  <button className="small-outline" onClick={() => void syncLatestGame()} disabled={isSyncing}>
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
          </div>

          <div className="responsive-main-grid__right">
            <section className="white-card">
              <div className="section-header">
                <h3>試合履歴</h3>
                <button className="section-link" type="button">
                  すべて見る ›
                </button>
              </div>

              {sortedGames.length === 0 ? (
                <div className="empty-box">まだ試合が登録されていません</div>
              ) : (
                <div className="history-list">
                  {sortedGames.slice(0, 8).map((game) => (
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

              {currentMonth ? (
                <div className="monthly-table">
                  <div className="monthly-table__month">{currentMonth.month.replace("-", "年")}月</div>
                  <div>
                    <span>貯金額</span>
                    <strong>{yen(currentMonth.savings)}</strong>
                  </div>
                  <div>
                    <span>勝</span>
                    <strong>{currentMonth.wins}</strong>
                  </div>
                  <div>
                    <span>敗</span>
                    <strong>{currentMonth.loses}</strong>
                  </div>
                  <div>
                    <span>分</span>
                    <strong>{currentMonth.draws}</strong>
                  </div>
                  <div>
                    <span>勝率</span>
                    <strong>{winRate(games).toFixed(3)}</strong>
                  </div>
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
    </main>
  );
}