import React from 'react';
import {COLOR, FONT, MOCKUP, RADIUS, SHADOW} from '../design/tokens';

const Light: React.FC<{color: string}> = ({color}) => (
  <span style={{width: 16, height: 16, borderRadius: RADIUS.pill, backgroundColor: color}} />
);

const NavButton: React.FC<{flip?: boolean}> = ({flip}) => (
  <span
    style={{
      width: 36,
      height: 36,
      borderRadius: RADIUS.pill,
      backgroundColor: MOCKUP.navButton,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transform: flip ? 'scaleX(-1)' : undefined,
    }}
  >
    <svg width={18} height={18} viewBox="0 0 18 18">
      <path d="M14 9 H4 M8.5 4.5 L4 9 L8.5 13.5" fill="none" stroke={MOCKUP.navIcon} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

/**
 * Light Mac-style browser window (matches the user's reference): traffic lights, back/forward,
 * URL field with search icon, overflow menu. Fills its parent; content goes in `children`.
 */
export const MacWindow: React.FC<{url: string; children?: React.ReactNode}> = ({url, children}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      borderRadius: MOCKUP.radius,
      overflow: 'hidden',
      backgroundColor: MOCKUP.content,
      boxShadow: SHADOW.pop,
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    <div
      style={{
        height: MOCKUP.barHeight,
        flexShrink: 0,
        backgroundColor: MOCKUP.bar,
        borderBottom: `1px solid ${MOCKUP.barDivider}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 26px',
        gap: 10,
      }}
    >
      <Light color={MOCKUP.close} />
      <Light color={MOCKUP.minimize} />
      <Light color={MOCKUP.maximize} />
      <span style={{width: 18}} />
      <NavButton />
      <NavButton flip />
      <div
        style={{
          flex: 1,
          height: 38,
          marginLeft: 12,
          marginRight: 12,
          borderRadius: RADIUS.pill,
          backgroundColor: MOCKUP.urlField,
          display: 'flex',
          alignItems: 'center',
          padding: '0 18px',
          fontFamily: FONT.sans,
          fontSize: 18,
          color: MOCKUP.urlText,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        <span style={{flex: 1}}>{url}</span>
        <svg width={18} height={18} viewBox="0 0 18 18">
          <circle cx={7.5} cy={7.5} r={5} fill="none" stroke={MOCKUP.navIcon} strokeWidth={2} />
          <path d="M11.5 11.5 L16 16" stroke={MOCKUP.navIcon} strokeWidth={2} strokeLinecap="round" />
        </svg>
      </div>
      <span style={{display: 'flex', flexDirection: 'column', gap: 4, padding: '0 4px'}}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{width: 4, height: 4, borderRadius: RADIUS.pill, backgroundColor: COLOR.surface}} />
        ))}
      </span>
    </div>
    <div style={{position: 'relative', flex: 1, overflow: 'hidden'}}>{children}</div>
  </div>
);
