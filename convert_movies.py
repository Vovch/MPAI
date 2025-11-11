from __future__ import annotations

import json
import pathlib
import re
import unicodedata

source_path = pathlib.Path("movies copy.json")
target_path = pathlib.Path("movies.json")
source = json.loads(source_path.read_text(encoding="utf-8"))

CYRILLIC_MAP = {
    "\u0410": "A", "\u0430": "a",
    "\u0411": "B", "\u0431": "b",
    "\u0412": "V", "\u0432": "v",
    "\u0413": "G", "\u0433": "g",
    "\u0414": "D", "\u0434": "d",
    "\u0415": "E", "\u0435": "e",
    "\u0401": "Yo", "\u0451": "yo",
    "\u0416": "Zh", "\u0436": "zh",
    "\u0417": "Z", "\u0437": "z",
    "\u0418": "I", "\u0438": "i",
    "\u0419": "Y", "\u0439": "y",
    "\u041a": "K", "\u043a": "k",
    "\u041b": "L", "\u043b": "l",
    "\u041c": "M", "\u043c": "m",
    "\u041d": "N", "\u043d": "n",
    "\u041e": "O", "\u043e": "o",
    "\u041f": "P", "\u043f": "p",
    "\u0420": "R", "\u0440": "r",
    "\u0421": "S", "\u0441": "s",
    "\u0422": "T", "\u0442": "t",
    "\u0423": "U", "\u0443": "u",
    "\u0424": "F", "\u0444": "f",
    "\u0425": "Kh", "\u0445": "kh",
    "\u0426": "Ts", "\u0446": "ts",
    "\u0427": "Ch", "\u0447": "ch",
    "\u0428": "Sh", "\u0448": "sh",
    "\u0429": "Shch", "\u0449": "shch",
    "\u042a": "", "\u044a": "",
    "\u042b": "Y", "\u044b": "y",
    "\u042c": "", "\u044c": "",
    "\u042d": "E", "\u044d": "e",
    "\u042e": "Yu", "\u044e": "yu",
    "\u042f": "Ya", "\u044f": "ya",
    "\u04d8": "A", "\u04d9": "a",
    "\u04e8": "O", "\u04e9": "o"
}

TRANS_TABLE = str.maketrans(CYRILLIC_MAP)


def transliterate(text: str) -> str:
    if not text:
        return ""
    return text.translate(TRANS_TABLE)


def slugify(title: str, year: int) -> str:
    ascii_title = unicodedata.normalize("NFKD", title or "").encode("ascii", "ignore").decode("ascii")
    ascii_title = re.sub(r"[^a-z0-9]+", "-", ascii_title.lower()).strip("-")
    if not ascii_title:
        ascii_title = "film"
    return f"{ascii_title}-{year}" if year else ascii_title


def parse_int(value) -> int:
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return 0


def parse_directors(raw: str) -> list[str]:
    cleaned = transliterate(raw or "")
    for token in (" & ", " and ", ";", "/", "|"):
        cleaned = cleaned.replace(token, ",")
    parts = [part.strip(" \t\r\n.") for part in cleaned.split(",")]
    return [part for part in parts if part]


movies: list[dict] = []
slug_counts: dict[str, int] = {}

for entry in source:
    title = (entry.get("originalName") or entry.get("name") or "").strip()
    release_year = parse_int(entry.get("yearProduced"))
    if not title:
        # Skip entries without enough metadata to generate a useful record.
        continue
    base_slug = slugify(title, release_year)
    occurrence = slug_counts.get(base_slug, 0)
    slug_counts[base_slug] = occurrence + 1
    slug = base_slug if occurrence == 0 else f"{base_slug}-{occurrence + 1}"

    movies.append(
        {
            "slug": slug,
            "title": title,
            "releaseYear": release_year,
            "registryYear": parse_int(entry.get("yearAdded")),
            "directors": parse_directors(entry.get("director")),
            "cast": [],
            "runtimeMinutes": 0,
            "genres": [],
            "logline": "",
            "summary": "",
            "whyImportant": "",
            "watchUrl": "",
            "image": "",
        }
    )


target_path.write_text(json.dumps(movies, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Wrote {len(movies)} movies to {target_path}")
