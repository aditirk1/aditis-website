#!/usr/bin/env bash
# Encode a beach clip into the Beach theme background files in public/beach/.
#
#   NAME=tropic scripts/beach-video.sh <input> [start-s] [duration-s] [portrait-crop-x]
#
# NAME prefixes the output files. /beach/* is cached for a year (public/_headers),
# so give every new clip a new NAME and update CLIP in src/scripts/beach-shore.ts
# and the poster URLs in src/styles/global.css.
# portrait-crop-x (0..1) picks which slice of the frame phones see: 0 = left edge,
# 0.5 = centre. GRADE overrides the colour filter chain. CRF_VP9 / CRF_H264 trade
# quality for size (higher = smaller); busy footage needs higher values.
set -euo pipefail

in=${1:?usage: NAME=<name> scripts/beach-video.sh <input> [start-s] [duration-s] [portrait-crop-x]}
ss=${2:-0}
dur=${3:-24}
cx=${4:-0.5}
name=${NAME:?set NAME to a new file prefix for this clip}
grade=${GRADE:-eq=saturation=1.06:contrast=1.03}
crf_vp9=${CRF_VP9:-40}
crf_h264=${CRF_H264:-27}
out="$(dirname "$0")/../public/beach"

# Keyframe every second so random-offset seeks in beach-shore.ts land instantly.
common=(-hide_banner -loglevel error -y -ss "$ss" -t "$dur" -i "$in" -an -sn -map_metadata -1)
vp9=(-c:v libvpx-vp9 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 -g 30 -pix_fmt yuv420p)
h264=(-c:v libx264 -preset slow -profile:v high -g 30 -pix_fmt yuv420p -movflags +faststart)

land="scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,$grade"
port="crop=ih*9/16:ih:(iw-ih*9/16)*$cx:0,scale=720:1280,fps=30,$grade"

ffmpeg "${common[@]}" -vf "$land" "${vp9[@]}" -crf "$crf_vp9" "$out/$name.webm"
ffmpeg "${common[@]}" -vf "$land" "${h264[@]}" -crf "$crf_h264" "$out/$name.mp4"
ffmpeg "${common[@]}" -vf "$port" "${vp9[@]}" -crf "$crf_vp9" "$out/$name-portrait.webm"
ffmpeg "${common[@]}" -vf "$port" "${h264[@]}" -crf "$crf_h264" "$out/$name-portrait.mp4"

ffmpeg -hide_banner -loglevel error -y -i "$out/$name.mp4" -frames:v 1 -c:v libwebp -quality 72 "$out/$name-poster.webp"
ffmpeg -hide_banner -loglevel error -y -i "$out/$name-portrait.mp4" -frames:v 1 -c:v libwebp -quality 72 "$out/$name-poster-portrait.webp"

ls -lh "$out/$name"*
