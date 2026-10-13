import React from 'react';
import {Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {PALETTE, RADIUS, SHADOW} from '../design/tokens';
import {EASE} from '../design/motion';
import {progress} from '../lib/animate';

/**
 * The corner bug, which exists to cover the teleprompter app's "RECORDED ON BIGVU" watermark
 * burnt into the bottom-right of every frame of the talking head.
 *
 * Measured off the source at 1920x1080: the watermark sits at roughly x 1780-1900, y 962-1060.
 * WATERMARK below is that box plus a margin, and the badge is sized from it rather than from
 * taste, so the cover is guaranteed rather than eyeballed. If the footage is ever re-shot at a
 * different size, re-measure and change this one constant.
 *
 * IT LIVES IN SCREEN SPACE, NOT FOOTAGE SPACE. Any push-in or reframe must be applied to the
 * video underneath this, never to this badge — scale the badge with the footage and it slides
 * off the thing it is covering, which is the one failure that matters here. The alternative,
 * when a shot is punched in far enough, is to crop the watermark out of frame entirely and let
 * the badge ride along as ordinary branding.
 */
const WATERMARK = {left: 1770, top: 952, right: 1910, bottom: 1068} as const;

export const CornerMark: React.FC<{
  /** Frame it fades in on. It then stays for the rest of the shot. */
  at?: number;
  /** Canvas width/height the measurements were taken against. */
  canvas?: {width: number; height: number};
}> = ({at = 0, canvas = {width: 1920, height: 1080}}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  /**
   * Flush to the corner, rounded on the inner corner only.
   *
   * A pill was the obvious choice and it does not work: the watermark reaches to within 10px of
   * the frame edge, so the cap's curve cuts across its corners and leaves white slivers showing.
   * Covering those with a pill needs the badge to extend past x=1937 on a 1920 frame. Running
   * the badge into the corner instead covers to both edges by construction, and one generous
   * inner radius keeps it in the brand's geometry rather than looking like a crop.
   */
  const height = canvas.height - WATERMARK.top;
  const minWidth = canvas.width - WATERMARK.left;

  const show = progress(frame, at, Math.round(0.4 * fps), EASE.out);

  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        bottom: 0,
        height,
        minWidth,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        // Extra padding on the right and bottom keeps the type off the frame edge even though
        // the panel itself runs into it.
        padding: '0 40px 18px 34px',
        borderTopLeftRadius: RADIUS.lg,
        // The supplied mark is black letterforms with a accent bar: it is drawn for a light
        // background and disappears entirely on ink. So the badge is paper, not ink. It also
        // sits more quietly over the light wall behind him than a black tab would.
        backgroundColor: PALETTE.paper,
        boxShadow: SHADOW.card,
        opacity: show,
        transform: `translateY(${(1 - show) * 12}px)`,
      }}
    >
      <Img src={staticFile('setup/ceos.svg')} style={{width: 150, display: 'block'}} />
    </div>
  );
};
