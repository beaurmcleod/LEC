#!/usr/bin/env python3
"""
Merge dashboard-tasks.json into Beau's desktop dashboard.

Run this ON YOUR MAC (where the dashboard helper / Plash wallpaper lives):

    python3 dashboard-file.py

It appends the items from dashboard-tasks.json into your live board, de-duped
by title (case-insensitive), and preserves everything already on the board.
It talks to the live helper on http://127.0.0.1:7891 and, if that's not
reachable, falls back to writing ~/.dashboard_hitlist.json directly.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

HELPER = "http://127.0.0.1:7891"
BOARD_FILE = os.path.expanduser("~/.dashboard_hitlist.json")
HERE = os.path.dirname(os.path.abspath(__file__))
TASKS_FILE = os.path.join(HERE, "dashboard-tasks.json")

# Which box each array uses as its human-readable title, for de-duping.
TITLE_KEY = {
    "hitlist": "text",
    "doneByClaude": "headline",
    "needsBeau": "text",
    "needsFullControl": "text",
}
ARRAYS = ["hitlist", "doneByClaude", "needsBeau", "needsFullControl"]


def empty_board():
    return {
        "hitlist": [],
        "doneByClaude": [],
        "needsBeau": [],
        "needsFullControl": [],
        "updatedAt": "",
        "updatedBy": "dashboard",
    }


def get_board():
    """Prefer the live helper; fall back to the on-disk board; else empty."""
    try:
        with urllib.request.urlopen(HELPER + "/hitlist", timeout=5) as r:
            return json.loads(r.read().decode("utf-8")), "helper"
    except Exception:
        pass
    if os.path.exists(BOARD_FILE):
        try:
            with open(BOARD_FILE, "r", encoding="utf-8") as f:
                return json.load(f), "file"
        except Exception:
            pass
    return empty_board(), "new"


def save_board(board):
    """Prefer POST to the helper (live refresh); fall back to writing the file."""
    body = json.dumps(board).encode("utf-8")
    try:
        req = urllib.request.Request(
            HELPER + "/save-hitlist", data=body,
            headers={"Content-Type": "application/json"}, method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as r:
            r.read()
        return "helper"
    except Exception:
        with open(BOARD_FILE, "w", encoding="utf-8") as f:
            f.write(json.dumps(board, indent=2))
        return "file"


def main():
    with open(TASKS_FILE, "r", encoding="utf-8") as f:
        tasks = json.load(f)

    board, src = get_board()
    for arr in ARRAYS:
        board.setdefault(arr, [])

    added = {}
    for arr in ARRAYS:
        incoming = tasks.get(arr, [])
        if not incoming:
            continue
        key = TITLE_KEY[arr]
        existing = {
            str(item.get(key, "")).strip().lower()
            for item in board[arr]
        }
        for item in incoming:
            title = str(item.get(key, "")).strip().lower()
            if title and title in existing:
                continue
            board[arr].append(item)
            existing.add(title)
            added[arr] = added.get(arr, 0) + 1

    board["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    board["updatedBy"] = "dashboard"

    dst = save_board(board)

    if not added:
        print(f"Nothing new to add (already on the board). Read from: {src}")
    else:
        summary = ", ".join(f"{arr}: {n}" for arr, n in added.items())
        print(f"Filed to dashboard ({summary}). Read from {src}, wrote via {dst}.")
        if dst == "file":
            print("Helper wasn't reachable; wrote ~/.dashboard_hitlist.json directly.")
    print("Tip: dashboard polls every ~5s. To force a refresh:")
    print("  osascript -e 'tell application \"Plash\" to quit'; open -a Plash")


if __name__ == "__main__":
    try:
        main()
    except FileNotFoundError as e:
        print(f"Missing file: {e}", file=sys.stderr)
        sys.exit(1)
