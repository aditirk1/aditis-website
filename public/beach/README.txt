Beach theme background: real beach footage, crossfaded between random segments
so the loop point never repeats, and resumed where it left off on the next page
(src/scripts/beach-shore.ts).

Files (all generated from one source clip by scripts/beach-video.sh):
  tropic.webm / tropic.mp4                          1920x1080, desktop and landscape
  tropic-portrait.webm / tropic-portrait.mp4        720x1280, phones
  tropic-poster.webp / tropic-poster-portrait.webp  first frame, shown before the
                                                    video starts and for reduced motion

Source: the site owner's screen recording (draft release "beach-footage" on GitHub),
trimmed to 0.2s-24.2s so the macOS capture toolbar at the end is left out.

Encoded with:
  NAME=tropic CRF_VP9=46 CRF_H264=30 \
  GRADE="eq=saturation=0.92:contrast=1.03:brightness=-0.025,vignette=angle=PI/5" \
  scripts/beach-video.sh recording.mov 0.2 24 0.72

/beach/* is cached for a year (public/_headers). To swap the footage, encode with a
new NAME, then update CLIP in src/scripts/beach-shore.ts and the two poster URLs in
src/styles/global.css.
