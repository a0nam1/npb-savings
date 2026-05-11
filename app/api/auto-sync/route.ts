import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://www.thesportsdb.com/api/v1/json/123";

function normalizeTeamName(name: string) {
  const map: Record<string, string> = {
    "オリックス・バファローズ": "Orix Buffaloes",
    "阪神タイガース": "Hanshin Tigers",
    "読売ジャイアンツ": "Yomiuri Giants",
    "横浜DeNAベイスターズ": "Yokohama DeNA BayStars",
    "広島東洋カープ": "Hiroshima Toyo Carp",
    "東京ヤクルトスワローズ": "Tokyo Yakult Swallows",
    "中日ドラゴンズ": "Chunichi Dragons",
    "福岡ソフトバンクホークス": "Fukuoka SoftBank Hawks",
    "北海道日本ハムファイターズ": "Hokkaido Nippon-Ham Fighters",
    "千葉ロッテマリーンズ": "Chiba Lotte Marines",
    "東北楽天ゴールデンイーグルス": "Tohoku Rakuten Golden Eagles",
    "埼玉西武ライオンズ": "Saitama Seibu Lions",
  };

  return map[name] ?? name;
}

const reverseTeamMap: Record<string, string> = {
  "Orix Buffaloes": "オリックス・バファローズ",
  "Hanshin Tigers": "阪神タイガース",
  "Yomiuri Giants": "読売ジャイアンツ",
  "Yokohama DeNA BayStars": "横浜DeNAベイスターズ",
  "Hiroshima Toyo Carp": "広島東洋カープ",
  "Tokyo Yakult Swallows": "東京ヤクルトスワローズ",
  "Chunichi Dragons": "中日ドラゴンズ",
  "Fukuoka SoftBank Hawks": "福岡ソフトバンクホークス",
  "Hokkaido Nippon-Ham Fighters": "北海道日本ハムファイターズ",
  "Chiba Lotte Marines": "千葉ロッテマリーンズ",
  "Tohoku Rakuten Golden Eagles": "東北楽天ゴールデンイーグルス",
  "Saitama Seibu Lions": "埼玉西武ライオンズ",
};

function toJapaneseTeamName(name: string) {
  return reverseTeamMap[name] ?? name;
}

function normalizeLooseTeamName(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/-/g, " ")
    .replace(/\./g, "")
    .trim();
}

function isSameTeam(aName: string, bName: string) {
  const a = normalizeLooseTeamName(aName);
  const b = normalizeLooseTeamName(bName);
  return a === b || a.includes(b) || b.includes(a);
}

function parseEventTimestamp(event: any) {
  const datePart = event?.dateEvent ?? "1970-01-01";
  const timePart = event?.strTime ?? "00:00:00";
  return new Date(`${datePart}T${timePart}`).getTime();
}

function isCompletedEvent(event: any) {
  const homeScore = Number(event?.intHomeScore);
  const awayScore = Number(event?.intAwayScore);
  return !Number.isNaN(homeScore) && !Number.isNaN(awayScore);
}

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

async function findTeamId(teamName: string) {
  const url = `${BASE_URL}/searchteams.php?t=${encodeURIComponent(teamName)}`;
  const data = await fetchJson(url);
  const teams = data?.teams ?? [];
  if (!teams.length) return null;

  const exact =
    teams.find((team: any) => isSameTeam(teamName, team?.strTeam ?? "")) ?? teams[0];

  return exact?.idTeam ?? null;
}

async function fetchLastEventsByTeamId(teamId: string) {
  const url = `${BASE_URL}/eventslast.php?id=${encodeURIComponent(teamId)}`;
  const data = await fetchJson(url);
  return data?.results ?? [];
}

async function fetchLeagueDayEvents(date: string) {
  const leagueName = "Nippon Baseball League";
  const sportName = "Baseball";

  const url =
    `${BASE_URL}/eventsday.php?d=${date}` +
    `&s=${encodeURIComponent(sportName)}` +
    `&l=${encodeURIComponent(leagueName)}`;

  const data = await fetchJson(url);
  return data?.events ?? [];
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function convertEventToGame(event: any, apiTeamName: string) {
  const isHome = isSameTeam(apiTeamName, event?.strHomeTeam ?? "");
  const teamScore = Number(isHome ? event?.intHomeScore : event?.intAwayScore);
  const opponentScore = Number(isHome ? event?.intAwayScore : event?.intHomeScore);
  const opponentRaw = isHome ? event?.strAwayTeam : event?.strHomeTeam;

  return {
    sourceGameId: event?.idEvent,
    date: event?.dateEvent,
    opponent: toJapaneseTeamName(opponentRaw ?? ""),
    teamScore,
    opponentScore,
  };
}

export async function GET(req: NextRequest) {
  const favoriteTeam = req.nextUrl.searchParams.get("team");

  if (!favoriteTeam) {
    return NextResponse.json({ error: "team is required" }, { status: 400 });
  }

  const apiTeamName = normalizeTeamName(favoriteTeam);

  try {
    // 1) まずチームID取得 → 直近試合取得
    const teamId = await findTeamId(apiTeamName);

    let collectedEvents: any[] = [];

    if (teamId) {
      const lastEvents = await fetchLastEventsByTeamId(teamId);
      collectedEvents = [...lastEvents];
    }

    // 2) 予備: リーグ日別取得も併用
    if (collectedEvents.length === 0) {
      const today = new Date();
      const dates = Array.from({ length: 60 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        return formatDate(d);
      });

      for (const date of dates) {
        const dayEvents = await fetchLeagueDayEvents(date);
        const matched = dayEvents.filter((event: any) => {
          const home = event?.strHomeTeam ?? "";
          const away = event?.strAwayTeam ?? "";
          return isSameTeam(apiTeamName, home) || isSameTeam(apiTeamName, away);
        });
        collectedEvents.push(...matched);
      }
    }

    // 3) 完了済みだけ
    const completedEvents = collectedEvents
      .filter(isCompletedEvent)
      .filter((event: any, index: number, arr: any[]) => {
        return arr.findIndex((e) => e?.idEvent === event?.idEvent) === index;
      })
      .sort((a, b) => parseEventTimestamp(b) - parseEventTimestamp(a));

    if (completedEvents.length === 0) {
      return NextResponse.json({
        games: [],
        message: "結果確定済みの試合がありません",
        debug: {
          favoriteTeam,
          apiTeamName,
          teamId,
          collectedCount: collectedEvents.length,
          completedCount: 0,
        },
      });
    }

    const games = completedEvents.map((event: any) =>
      convertEventToGame(event, apiTeamName)
    );

    return NextResponse.json({
      games,
      debug: {
        favoriteTeam,
        apiTeamName,
        teamId,
        collectedCount: collectedEvents.length,
        completedCount: completedEvents.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        games: [],
        message: "route error",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}