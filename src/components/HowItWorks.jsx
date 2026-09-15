import { Hand, RefreshCw, ThumbsUp, Ruler, Dice5, Car, Filter, Users } from 'lucide-react';
import Sheet from './primitives/Sheet.jsx';
import { Num } from './primitives/Bidi.jsx';
import { LANE_DEFS } from '../engine/rank/buckets.js';
import { TILES } from '../config.js';

/** What the app does, in one screen.
 *
 *  One line per control, naming the thing you can see and what happens when you
 *  touch it. The gestures need this most -- a card you can flick away is
 *  invisible until someone says so, and the veto is the single control that
 *  most changes what you get shown. Anything that is merely true rather than
 *  useful stays out: nobody reads a manual to pick dinner.
 */

const LANE_TINT = {
    safeBet: 'var(--gold)',
    somethingNew: 'var(--accent)',
    longShot: '#6d6096',
};

const Item = ({ icon: Icon, title, children }) => (
    <li className="flex gap-3 py-2.5 border-b" style={{ borderColor: 'var(--line)' }}>
        <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--ink-3)' }} />
        <p className="text-[0.8125rem] min-w-0" style={{ color: 'var(--ink-2)' }}>
            <span className="font-medium" style={{ color: 'var(--ink)' }}>{title}</span>
            {' — '}
            {children}
        </p>
    </li>
);

const SectionTitle = ({ children }) => (
    <p className="meta pt-4 pb-1" style={{ color: 'var(--ink-3)' }}>
        {children}
    </p>
);

export const HowItWorks = ({ open, onClose, reduced, firstRun = false }) => (
    <Sheet open={open} onClose={onClose} title="How it works" reduced={reduced}>
        <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
            Three places to eat, picked from everything around you &mdash; and it remembers what it
            has shown you, so you keep getting new ones.
        </p>

        <SectionTitle>Every spin gives you</SectionTitle>
        <ul className="list-none">
            {LANE_DEFS.map((lane) => (
                <li
                    key={lane.id}
                    className="flex gap-2.5 py-2 items-center"
                >
                    <span
                        className="meta px-2 py-1 rounded-full text-white shrink-0"
                        style={{ background: LANE_TINT[lane.id] ?? 'var(--gold)' }}
                    >
                        {lane.label}
                    </span>
                    <p className="text-[0.8125rem] min-w-0" style={{ color: 'var(--ink-2)' }}>
                        {lane.blurb}
                    </p>
                </li>
            ))}
        </ul>

        <SectionTitle>On a card</SectionTitle>
        <ul className="list-none">
            <Item icon={Hand} title="Flick it away">
                Not tonight? Swipe the card sideways. It is hidden for a few months and another
                slides in. The <strong>&times;</strong> does the same.
            </Item>
            <Item icon={RefreshCw} title="Swap">
                A different place in that card only. The other two stay put.
            </Item>
            <Item icon={ThumbsUp} title="Thumbs">
                Nudge the kinds of food you get offered.
            </Item>
        </ul>

        <SectionTitle>The dials</SectionTitle>
        <ul className="list-none">
            <Item icon={Ruler} title="Within">
                How far you will go. Past <Num>{TILES.fullCoverageKm} km</Num> we check a spread of
                areas rather than every street.
            </Item>
            <Item icon={Dice5} title="Mood">
                Safe to Chaos &mdash; how far off the beaten track it reaches.
            </Item>
            <Item icon={Car} title="Stay close / Worth the drive">
                Near you, or out at the far edge on purpose.
            </Item>
            <Item icon={Filter} title="Filters">
                One kind of food only. The number on a chip is how many places it leaves you
                choosing between.
            </Item>
            <Item icon={Users} title="Share">
                Sends the same three places to a friend. Or pass the phone around and vote.
            </Item>
        </ul>

        <p className="text-xs mt-4" style={{ color: 'var(--ink-3)' }}>
            Places come from OpenStreetMap &mdash; free, no account, and it works offline once an
            area has loaded. Star ratings and photos need your own Google key, in Settings.
        </p>

        <button
            type="button"
            onClick={onClose}
            className="btn w-full h-12 mt-5"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
        >
            {firstRun ? 'Got it' : 'Close'}
        </button>

        {firstRun && (
            <p className="text-xs mt-3 text-center" style={{ color: 'var(--ink-3)' }}>
                Tap <strong>?</strong> in the corner whenever you want this again.
            </p>
        )}
    </Sheet>
);

export default HowItWorks;
