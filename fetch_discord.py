import json
import os
import urllib.request

TOKEN = os.environ["DISCORD_TOKEN"]

CHANNELS = {
    "valheim": "818775614269685772",
    "minecraft": "1559152884916944917",
    "satisfactory": "1559151983082864730",
}


def fetch_messages(channel_id):
    url = f"https://discord.com/api/v10/channels/{channel_id}/messages?limit=10"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bot {TOKEN}",
        "User-Agent": "Thomzone/1.0",
    })
    with urllib.request.urlopen(req) as response:
        messages = json.load(response)

    # Discord ger nyast först, vi vill ha äldst först
    return [
        {
            "author": m["author"].get("global_name") or m["author"]["username"],
            "time": m["timestamp"],
            "text": m["content"],
        }
        for m in reversed(messages)
        if m["content"]  # hoppar över meddelanden som bara innehåller bilder
    ]


os.makedirs("data", exist_ok=True)
for name, channel_id in CHANNELS.items():
    with open(f"data/chat-{name}.json", "w", encoding="utf-8") as f:
        json.dump(fetch_messages(channel_id), f, ensure_ascii=False, indent=2)
