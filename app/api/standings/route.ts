import { NextRequest, NextResponse } from "next/server";

type StandingsResponse = {
  rank: number | null;
  league: "central" | "pacific" | null;
  updatedAt: string;
  team: string;
};

const TEAM_LEAGUE_MAP: Record<string, "central" | "pacific"> = {
  "オリックス・バファローズ": "pacific",
  "福岡ソフトバンクホークス": "pacific",
  "北海道日本ハムファイターズ": "pacific",
  "東北楽天ゴールデンイーグルス": "pacific",
  "埼玉西武ライオンズ": "pacific",
  "千葉ロッテマリーンズ": "pacific",

  "阪神タイガース": "central",
  "読売ジャイアンツ": "central",
  "横浜DeNAベイスターズ": "central",
  "広島東洋カープ": "central",
  "東京ヤクルトスワローズ": "central",
  "中日ドラゴンズ": "central",
};

const TEAM_ALIASES: Record<string, string[]> = {
  "オリックス・バファローズ": ["オリックス", "オリックス・バファローズ"],
  "福岡ソフトバンクホークス": ["福岡ソフトバンク", "ソフトバンク", "福岡ソフトバンクホークス"],
  "北海道日本ハムファイターズ": ["北海道日本ハム", "日本ハム", "北海道日本ハムファイターズ"],
  "東北楽天ゴールデンイーグルス": ["東北楽天", "楽天", "東北楽天ゴールデンイーグルス"],
  "埼玉西武ライオンズ": ["埼玉西武", "西武", "埼玉西武ライオンズ"],
  "千葉ロッテマリーンズ": ["千葉ロッテ", "ロッテ", "千葉ロッテマリーンズ"],

  "阪神タイガース": ["阪神", "阪神タイガース"],
  "読売ジャイアンツ": ["読売", "巨人", "読売ジャイアンツ"],
  "横浜DeNAベイスターズ": ["横浜", "DeNA", "横浜DeNA", "横浜DeNAベイスターズ"],
  "広島東洋カープ": ["広島", "カープ", "広島東洋カープ"],
  "東京ヤクルトスワローズ": ["ヤクルト", "東京ヤクルト", "東京ヤクルトスワローズ"],
  "中日ドラゴンズ": ["中日", "中日ドラゴンズ"],
};

function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function stripTags(html: string): string {
  return normalizeSpace(decodeHtml(html.replace(/<[^>]*>/g, " ")));
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept-language": "ja,en-US;q=0.9,en;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(`fetch failed: ${res.status} ${url}`);
  }

  return res.text();
}

function findRankInText(text: string, team: string): number | null {
  const aliases = TEAM_ALIASES[team] ?? [team];
  const lines = text
    .split(/(?=\d+\s)/)
    .map((line) => normalizeSpace(line))
    .filter(Boolean);

  for (const line of lines) {
    for (const alias of aliases) {
      if (line.includes(alias)) {
        const match = line.match(/^(\d+)/);
        if (match) return Number(match[1]);
      }
    }
  }

  return null;
}

function extractUpdatedAt(text: string): string {
  const match = text.match(/(\d{4}年\d{1,2}月\d{1,2}日現在)/);
  return match?.[1] ?? "";
}

export async function GET(req: NextRequest) {
  const team = req.nextUrl.searchParams.get("team");

  if (!team) {
    return NextResponse.json({ error: "team is required" }, { status: 400 });
  }

  const league = TEAM_LEAGUE_MAP[team];
  if (!league) {
    return NextResponse.json({ error: "unsupported team" }, { status: 400 });
  }

  try {
    const year = new Date().getFullYear();
    const url =
      league === "pacific"
        ? `https://npb.jp/bis/${year}/stats/std_p.html`
        : `https://npb.jp/bis/${year}/stats/std_c.html`;

    const html = await fetchHtml(url);
    const text = stripTags(html);
    const rank = findRankInText(text, team);
    const updatedAt = extractUpdatedAt(text);

    return NextResponse.json({
      rank,
      league,
      updatedAt,
      team,
    } satisfies StandingsResponse);
  } catch (error) {
    return NextResponse.json(
      {
        rank: null,
        league,
        updatedAt: "",
        team,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}