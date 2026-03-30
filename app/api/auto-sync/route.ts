import { NextRequest, NextResponse } from "next/server";

const LEAGUE_NAME = "Nippon Baseball League";
const SPORT_NAME = "Baseball";
const BASE_URL = "https://www.thesportsdb.com/api/v1/json/123";

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

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
    .trim();
}

function isSameTeam(apiTeamName: string, eventTeamName: string) {
  const a = normalizeLooseTeamName(apiTeamName);
  const b = normalizeLooseTeamName(eventTeamName);

  return a === b || a.includes(b) || b.includes(a);
}

async function fetchEventsByDate(date: string) {
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

export async function GET(req: NextRequest) {
  const favoriteTeam = req.nextUrl.searchParams.get("team");

  if (!favoriteTeam) {
    return NextResponse.json(
      { error: "team is required" },
      { status: 400 }
    );
  }

  const apiTeamName = normalizeTeamName(favoriteTeam);

  const today = new Date();
  const dates = Array.from({ length: 21 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    return formatDate(d);
  });

  let allMatchedEvents: any[] = [];

  for (const date of dates) {
    const events = await fetchEventsByDate(date);

    const matched = events.filter((event: any) => {
      const home = event?.strHomeTeam ?? "";
      const away = event?.strAwayTeam ?? "";
      return isSameTeam(apiTeamName, home) || isSameTeam(apiTeamName, away);
    });

    allMatchedEvents = [...allMatchedEvents, ...matched];
  }

  const completedEvents = allMatchedEvents
    .filter(isCompletedEvent)
    .sort((a, b) => parseEventTimestamp(b) - parseEventTimestamp(a));

  if (completedEvents.length === 0) {
    return NextResponse.json({
      games: [],
      message: "結果確定済みの試合がありません",
    });
  }

  const games = completedEvents.map((event: any) => {
    const isHome = isSameTeam(apiTeamName, event.strHomeTeam ?? "");
    const teamScore = Number(isHome ? event.intHomeScore : event.intAwayScore);
    const opponentScore = Number(
      isHome ? event.intAwayScore : event.intHomeScore
    );
    const opponentRaw = isHome ? event.strAwayTeam : event.strHomeTeam;

    return {
      sourceGameId: event.idEvent,
      date: event.dateEvent,
      opponent: toJapaneseTeamName(opponentRaw),
      teamScore,
      opponentScore,
    };
  });

  return NextResponse.json({
    games,
  });
}