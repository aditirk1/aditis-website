#!/usr/bin/env bash
# Encode a shoreline clip into the Beach theme background files in public/beach/.
#
#   scripts/beach-video.sh <input> [start-s] [duration-s] [portrait-crop-x]
#
# portrait-crop-x (0..1) picks which slice of the frame phones see: 0 = left edge,
# 0.5 = centre. GRADE overrides the colour filter, e.g. GRADE="eq=saturation=0.8".
set -euo pipefail

in=${1:?usage: scripts/beach-video.sh <input> [start-s] [duration-s] [portrait-crop-x]}
ss=${2:-0}
dur=${3:-24}
cx=${4:-0.5}
grade=${GRADE:-eq=saturation=0.88:brightness=0.015:gamma=1.04}
out="$(dirname "$0")/../public/beach"

# Keyframe every second so random-offset seeks in beach-shore.ts land instantly.
common=(-hide_banner -loglevel error -y -ss "$ss" -t "$dur" -i "$in" -an -sn -map_metadata -1)
vp9=(-c:v libvpx-vp9 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 -g 30 -pix_fmt yuv420p)
h264=(-c:v libx264 -preset slow -profile:v high -g 30 -pix_fmt yuv420p -movflags +faststart)

land="scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,$grade"
port="crop=ih*9/16:ih:(iw-ih*9/16)*$cx:0,scale=720:1280,fps=30,$grade"

ffmpeg "${common[@]}" -vf "$land" "${vp9[@]}" -crf 40 "$out/shore.webm"
ffmpeg "${common[@]}" -vf "$land" "${h264[@]}" -crf 27 "$out/shore.mp4"
ffmpeg "${common[@]}" -vf "$port" "${vp9[@]}" -crf 40 "$out/shore-portrait.webm"
ffmpeg "${common[@]}" -vf "$port" "${h264[@]}" -crf 27 "$out/shore-portrait.mp4"

ffmpeg -hide_banner -loglevel error -y -i "$out/shore.mp4" -frames:v 1 -c:v libwebp -quality 72 "$out/shore-poster.webp"
ffmpeg -hide_banner -loglevel error -y -i "$out/shore-portrait.mp4" -frames:v 1 -c:v libwebp -quality 72 "$out/shore-poster-portrait.webp"

ls -lh "$out"/shore*
