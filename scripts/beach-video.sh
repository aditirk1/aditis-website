#!/usr/bin/env bash
# Encode a beach clip into the Beach theme background files in public/beach/.
#
#   NAME=tropic scripts/beach-video.sh <input> [start-s] [duration-s] [portrait-crop-x]
#
# The output loops seamlessly: its last LOOP_FADE seconds are blended into the
# frames just before its first, so the browser's native loop shows no seam. The
# input needs duration + LOOP_FADE seconds available after start.
#
# NAME prefixes the output files. /beach/* is cached for a year (public/_headers),
# so give every new clip a new NAME and update CLIP in src/scripts/beach-shore.ts
# and the poster URLs in src/styles/global.css.
# portrait-crop-x (0..1) picks which slice of the frame phones see: 0 = left edge,
# 0.5 = centre. GRADE overrides the colour filter chain. CRF_* trade quality for
# size (higher = smaller); the _PORTRAIT ones default to the landscape values.
set -euo pipefail

in=${1:?usage: NAME=<name> scripts/beach-video.sh <input> [start-s] [duration-s] [portrait-crop-x]}
ss=${2:-0}
dur=${3:-24}
cx=${4:-0.5}
name=${NAME:?set NAME to a new file prefix for this clip}
grade=${GRADE:-eq=saturation=1.06:contrast=1.03}
fade=${LOOP_FADE:-1.5}
crf_vp9=${CRF_VP9:-40}
crf_h264=${CRF_H264:-27}
crf_vp9_p=${CRF_VP9_PORTRAIT:-$crf_vp9}
crf_h264_p=${CRF_H264_PORTRAIT:-$crf_h264}
out="$(dirname "$0")/../public/beach"

span=$(echo "$dur + $fade" | bc)
# Keyframe every second so resume-on-next-page seeks land instantly.
common=(-hide_banner -loglevel error -y -ss "$ss" -t "$span" -i "$in" -an -sn -map_metadata -1)
vp9=(-c:v libvpx-vp9 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 -g 30 -pix_fmt yuv420p)
h264=(-c:v libx264 -preset slow -profile:v high -g 30 -pix_fmt yuv420p -movflags +faststart)

land="scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,$grade"
port="crop=ih*9/16:ih:(iw-ih*9/16)*$cx:0,scale=900:1600,fps=30,$grade"

# body = [fade, dur), seam = last fade seconds crossfaded into the first fade seconds.
looped() {
	echo "[0:v]$1,split=3[a][b][c];" \
		"[a]trim=start=$fade:end=$dur,setpts=PTS-STARTPTS[body];" \
		"[b]trim=start=$dur:end=$span,setpts=PTS-STARTPTS[tail];" \
		"[c]trim=start=0:end=$fade,setpts=PTS-STARTPTS[head];" \
		"[tail][head]xfade=transition=fade:duration=$fade:offset=0[seam];" \
		"[body][seam]concat=n=2:v=1:a=0[out]"
}

ffmpeg "${common[@]}" -filter_complex "$(looped "$land")" -map "[out]" "${vp9[@]}" -crf "$crf_vp9" "$out/$name.webm"
ffmpeg "${common[@]}" -filter_complex "$(looped "$land")" -map "[out]" "${h264[@]}" -crf "$crf_h264" "$out/$name.mp4"
ffmpeg "${common[@]}" -filter_complex "$(looped "$port")" -map "[out]" "${vp9[@]}" -crf "$crf_vp9_p" "$out/$name-portrait.webm"
ffmpeg "${common[@]}" -filter_complex "$(looped "$port")" -map "[out]" "${h264[@]}" -crf "$crf_h264_p" "$out/$name-portrait.mp4"

# Posters straight from the source (not the compressed video) so the still is crisp.
ffmpeg -hide_banner -loglevel error -y -ss "$(echo "$ss + $fade" | bc)" -i "$in" -frames:v 1 -vf "$land" -c:v libwebp -quality 82 "$out/$name-poster.webp"
ffmpeg -hide_banner -loglevel error -y -ss "$(echo "$ss + $fade" | bc)" -i "$in" -frames:v 1 -vf "$port" -c:v libwebp -quality 82 "$out/$name-poster-portrait.webp"

ls -lh "$out/$name"*
