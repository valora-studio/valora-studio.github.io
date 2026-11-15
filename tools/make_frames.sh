#!/usr/bin/env bash
# Cut a clip into webp frame sequences for canvas scroll-scrubbing.
# Usage: tools/make_frames.sh <clip.mp4> <name> [desktop_frames=90] [mobile_frames=54] [start=0] [end=duration]
# Env: CX = horizontal centre of the 9:16 mobile crop, 0..1 (default 0.5); WD = desktop width (1600); QD/QM = webp quality.
# Output: frames/<name>/d/0001.webp (16:9) and frames/<name>/m/0001.webp (9:16 crop, 720w)
set -euo pipefail
clip="$1"; name="$2"; nd="${3:-90}"; nm="${4:-54}"; ss="${5:-0}"
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$clip")
to="${6:-$dur}"
len=$(python -c "print(float('$to')-float('$ss'))")
root="$(dirname "$0")/../frames/$name"
rm -rf "$root"; mkdir -p "$root/d" "$root/m"
fd=$(python -c "print($nd/$len)"); fm=$(python -c "print($nm/$len)")
cx="${CX:-0.5}"
ffmpeg -loglevel error -y -ss "$ss" -to "$to" -i "$clip" -vf "fps=$fd,scale=${WD:-1600}:-2" -frames:v "$nd" -c:v libwebp -quality ${QD:-70} "$root/d/%04d.webp"
ffmpeg -loglevel error -y -ss "$ss" -to "$to" -i "$clip" -vf "fps=$fm,crop=ih*9/16:ih:'max(0,min(iw-ow,iw*$cx-ow/2))':0,scale=720:-2" -frames:v "$nm" -c:v libwebp -quality ${QM:-68} "$root/m/%04d.webp"
echo "$name: d=$(ls "$root/d" | wc -l) ($(du -sh "$root/d" | cut -f1)), m=$(ls "$root/m" | wc -l) ($(du -sh "$root/m" | cut -f1))"
