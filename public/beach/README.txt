Beach theme background: real shoreline footage, crossfaded between random
segments so the loop point never repeats (src/scripts/beach-shore.ts).

Files (all generated from one source clip by scripts/beach-video.sh):
  shore.webm / shore.mp4                          1920x1080, desktop and landscape
  shore-portrait.webm / shore-portrait.mp4        720x1280, phones
  shore-poster.webp / shore-poster-portrait.webp  first frame, shown before the
                                                  video starts and for reduced motion

Source: "Beach seen from the air with waves reaching the shore" (Mixkit #51461),
https://mixkit.co/free-stock-video/beach-seen-from-the-air-with-waves-reaching-the-shore-51461/
Mixkit Stock Video Free License (https://mixkit.co/license/#videoFree): free for
commercial and personal use, no attribution required.

How the source was prepared before encoding:
  1. Stabilised to a locked frame (the drone drifts, which would ghost on crossfades):
       ffmpeg -i 51461.mp4 -vf vidstabdetect=tripod=1:shakiness=4:accuracy=15:stepsize=6:result=t.trf -f null -
       ffmpeg -i 51461.mp4 -vf "vidstabtransform=input=t.trf:tripod=1:smoothing=0:zoom=7:crop=black" -an -crf 12 stab.mp4
  2. Rotated 180 degrees (sea at the top, waves washing down toward the title) and
     cropped to the water and sand, dropping the trees:
       ffmpeg -i stab.mp4 -vf "transpose=2,transpose=2,crop=1440:810:240:0,scale=1920:1080:flags=lanczos" -an -crf 12 master.mp4
  3. scripts/beach-video.sh master.mp4 0 16.05 0.5
