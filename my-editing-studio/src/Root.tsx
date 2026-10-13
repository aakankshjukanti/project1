import React from 'react';
import {Composition} from 'remotion';
import {FILM_TEST_FRAMES, FilmTest} from './compositions/FilmTest';
import {PRESET_TEST_FRAMES, PresetTest} from './compositions/PresetTest';
import {LookSamples} from './compositions/LookSamples';
import {LAYOUT, WIDE} from './design/tokens';
import {PartnersIntro, PARTNERS_INTRO_FRAMES} from './videos/partners-intro/PartnersIntro';
import {Sample, SAMPLE_FRAMES} from './videos/sample/Sample';

/**
 * Every video you make gets registered here. `npm run studio` shows this list.
 *
 * PresetTest and FilmTest are reference compositions, not videos — they show every
 * transition and every film look side by side so you can judge them against each other
 * and pick one by name. Leave them; they cost nothing and they are how you decide.
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Sample"
      component={Sample}
      durationInFrames={SAMPLE_FRAMES}
      fps={LAYOUT.fps}
      width={LAYOUT.width}
      height={LAYOUT.height}
    />
    <Composition
      id="PartnersIntro"
      component={PartnersIntro}
      durationInFrames={PARTNERS_INTRO_FRAMES}
      fps={LAYOUT.fps}
      width={LAYOUT.width}
      height={LAYOUT.height}
    />
    <Composition
      id="PresetTest"
      component={PresetTest}
      durationInFrames={PRESET_TEST_FRAMES}
      fps={LAYOUT.fps}
      width={LAYOUT.width}
      height={LAYOUT.height}
    />
    <Composition
      id="FilmTest"
      component={FilmTest}
      durationInFrames={FILM_TEST_FRAMES}
      fps={LAYOUT.fps}
      width={LAYOUT.width}
      height={LAYOUT.height}
    />
    <Composition id="Look0Tall" component={LookSamples} defaultProps={{frame: 0 as const}} durationInFrames={30} fps={LAYOUT.fps} width={LAYOUT.width} height={LAYOUT.height} />
    <Composition id="Look0Wide" component={LookSamples} defaultProps={{frame: 0 as const, wide: true}} durationInFrames={30} fps={WIDE.fps} width={WIDE.width} height={WIDE.height} />
    <Composition id="Look1Tall" component={LookSamples} defaultProps={{frame: 1 as const}} durationInFrames={30} fps={LAYOUT.fps} width={LAYOUT.width} height={LAYOUT.height} />
    <Composition id="Look1Wide" component={LookSamples} defaultProps={{frame: 1 as const, wide: true}} durationInFrames={30} fps={WIDE.fps} width={WIDE.width} height={WIDE.height} />
    <Composition id="Look2Tall" component={LookSamples} defaultProps={{frame: 2 as const}} durationInFrames={30} fps={LAYOUT.fps} width={LAYOUT.width} height={LAYOUT.height} />
    <Composition id="Look2Wide" component={LookSamples} defaultProps={{frame: 2 as const, wide: true}} durationInFrames={30} fps={WIDE.fps} width={WIDE.width} height={WIDE.height} />
  </>
);
