Beach theme background: real beach footage on a native, seamless loop, resumed
where it left off on the next page (src/scripts/beach-shore.ts).

Files (all generated from one source clip by scripts/beach-video.sh):
  tropic-loop.webm / tropic-loop.mp4                          1920x1080, desktop and landscape
  tropic-loop-portrait.webm / tropic-loop-portrait.mp4        900x1600, phones
  tropic-loop-poster.webp / tropic-loop-poster-portrait.webp  still frame, shown before the
                                                              video starts and for reduced motion

The loop seam is baked into each file: its last 1.5s are crossfaded into the
frames just before its first, so the browser's own loop shows no jump.

Source: the site owner's screen recording (draft release "beach-footage" on GitHub),
using 0.2s-25.7s so the macOS capture toolbar at the end is left out.

Encoded with:
  NAME=tropic-loop CRF_VP9=46 CRF_H264=30 CRF_VP9_PORTRAIT=40 CRF_H264_PORTRAIT=28 \
  GRADE="eq=saturation=0.92:contrast=1.03:brightness=-0.025,vignette=angle=PI/5" \
  scripts/beach-video.sh recording.mov 0.2 24 0.72

/beach/* is cached for a year (public/_headers). To swap the footage, encode with a
new NAME, then update CLIP in src/scripts/beach-shore.ts and the two poster URLs in
src/styles/global.css.
