import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://www.thesportsdb.com/api/v1/json/123";
const LEAGUE_NAME = "Nippon Baseball League";
const SPORT_NAME = "Baseball";

const TEAM_NAME_MAP: Record<string, string> = {
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

const REVERSE_TEAM_NAME_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(TEAM_NAME_MAP).map(([ja, en]) => [en, ja])
);

const NPB_ENGLISH_NAMES = Object.values(TEAM_NAME_MAP);

function normalizeTeamName(name: string) {
  return TEAM_NAME_MAP[name] ?? name;
}

function toJapaneseTeamName(name: string) {
  return REVERSE_TEAM_NAME_MAP[name] ?? name;
}

function normalizeLoose(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/-/g, " ")
    .replace(/\./g, "")
    .replace(/’/g, "'")
    .trim();
}

function isSameTeam(a: string, b: string) {
  const aa = normalizeLoose(a);
  const bb = normalizeLoose(b);
  return aa === bb || aa.includes(bb) || bb.includes(a);
}

function isKnownNpbTeam(name: string) {
  return NPB_ENGLISH_NAMES.some((team) => isSameTeam(team, name));
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
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

function isValidNpbEvent(event: any, favoriteTeamEnglish: string) {
  const home = event?.strHomeTeam ?? "";
  const away = event?.strAwayTeam ?? "";
  const league = event?.strLeague ?? "";
  const sport = event?.strSport ?? "";

  const leagueOk =
    normalizeLoose(league) === normalizeLoose(LEAGUE_NAME) || league.includes("Nippon");
  const sportOk =
    normalizeLoose(sport) === normalizeLoose(SPORT_NAME) || sport.includes("Baseball");
  const bothAreNpbTeams = isKnownNpbTeam(home) && isKnownNpbTeam(away);
  const involvesFavorite =
    isSameTeam(favoriteTeamEnglish, home) || isSameTeam(favoriteTeamEnglish, away);

  return leagueOk && sportOk && bothAreNpbTeams && involvesFavorite;
}

async function fetchLeagueDayEvents(date: string) {
  const url =
    `${BASE_URL}/eventsday.php?d=${date}` +
    `&s=${encodeURIComponent(SPORT_NAME)}` +
    `&l=${encodeURIComponent(LEAGUE_NAME)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  return data?.events ?? [];
}

function convertEventToGame(event: any, favoriteTeamEnglish: string) {
  const home = event?.strHomeTeam ?? "";
  const away = event?.strAwayTeam ?? "";
  const isHome = isSameTeam(favoriteTeamEnglish, home);

  const teamScore = Number(isHome ? event?.intHomeScore : event?.intAwayScore);
  const opponentScore = Number(isHome ? event?.intAwayScore : event?.intHomeScore);
  const opponentRaw = isHome ? away : home;

  return {
    sourceGameId: event?.idEvent,
    date: event?.dateEvent,
    opponent: toJapaneseTeamName(opponentRaw),
    teamScore,
    opponentScore,
  };
}

export async function GET(req: NextRequest) {
  const favoriteTeam = req.nextUrl.searchParams.get("team");

  if (!favoriteTeam) {
    return NextResponse.json({ error: "team is required" }, { status: 400 });
  }

  const favoriteTeamEnglish = normalizeTeamName(favoriteTeam);

  try {
    const today = new Date();

    // 必要に応じて 30〜90 で調整可能
    const dates = Array.from({ length: 60 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      return formatDate(d);
    });

    const allEvents: any[] = [];

    for (const date of dates) {
      const dayEvents = await fetchLeagueDayEvents(date);
      allEvents.push(...dayEvents);
    }

    const filteredEvents = allEvents.filter((event) =>
      isValidNpbEvent(event, favoriteTeamEnglish)
    );

    const completedEvents = filteredEvents
      .filter(isCompletedEvent)
      .filter((event, index, arr) => {
        return arr.findIndex((e) => e?.idEvent === event?.idEvent) === index;
      })
      .sort((a, b) => parseEventTimestamp(b) - parseEventTimestamp(a));

    if (completedEvents.length === 0) {
      return NextResponse.json({
        games: [],
        message: "結果確定済みの試合がありません",
        debug: {
          favoriteTeam,
          favoriteTeamEnglish,
          scannedDays: dates.length,
          allEventsCount: allEvents.length,
          filteredCount: filteredEvents.length,
          completedCount: 0,
        },
      });
    }

    const games = completedEvents.map((event) =>
      convertEventToGame(event, favoriteTeamEnglish)
    );

    return NextResponse.json({
      games,
      debug: {
        favoriteTeam,
        favoriteTeamEnglish,
        scannedDays: dates.length,
        allEventsCount: allEvents.length,
        filteredCount: filteredEvents.length,
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