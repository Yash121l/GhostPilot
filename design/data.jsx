// Demo seed data + variant generator for the prototype.

const NAV_ITEMS = [
  { id: 'composer', label: 'Composer', icon: 'IconCompose' },
  { id: 'calendar', label: 'Calendar', icon: 'IconCalendar' },
  { id: 'connect',  label: 'Connect',  icon: 'IconLink' },
  { id: 'goals',    label: 'Goals',    icon: 'IconTarget' },
  { id: 'trends',   label: 'Trends',   icon: 'IconTrend' },
  { id: 'personas', label: 'Personas', icon: 'IconPersona' },
  { id: 'analytics',label: 'Analytics',icon: 'IconChart' },
  { id: 'settings', label: 'Settings', icon: 'IconSettings' },
];

const PLATFORMS = [
  { id: 'linkedin',  label: 'LinkedIn',    icon: 'IconLinkedIn' },
  { id: 'twitter',   label: 'X (Twitter)', icon: 'IconAt' },
  { id: 'instagram', label: 'Instagram',   icon: 'IconInstagram' },
];

const SEED_POSTS = [
  { id: 'p1', day: 14, hour: 9,  platform: 'linkedin',  title: 'Solo founders & focus rituals', status: 'scheduled' },
  { id: 'p2', day: 14, hour: 14, platform: 'twitter',   title: 'A 4-tweet thread on shipping rhythm', status: 'scheduled' },
  { id: 'p3', day: 15, hour: 10, platform: 'instagram', title: 'Workspace photo + caption', status: 'scheduled' },
  { id: 'p4', day: 18, hour: 8,  platform: 'linkedin',  title: 'Q2 lessons from indie hacking', status: 'draft' },
  { id: 'p5', day: 20, hour: 11, platform: 'twitter',   title: 'Why I killed three side projects', status: 'scheduled' },
  { id: 'p6', day: 22, hour: 15, platform: 'linkedin',  title: 'Hiring my first contractor', status: 'scheduled' },
];

const SEED_PERSONAS = [
  {
    id: 'yash', name: 'Yash — Indie Founder',
    bio: 'Solo dev shipping AI tools. Writes from the trenches about what actually works.',
    pillars: 'AI tooling, indie hacking, dev workflow, post-mortems',
    style: 'Casual, first-person, short sentences. No corporate jargon. Specific numbers > vague claims.',
    posts: 47, voice: 78,
  },
  {
    id: 'studio', name: 'GhostPilot — Brand',
    bio: 'Product voice for the GhostPilot brand account. More measured, narrative-driven.',
    pillars: 'AI writing, content workflow, founder stories, product updates',
    style: 'Warm, narrative, occasionally playful. Lead with story, end with insight.',
    posts: 22, voice: 64,
  },
];

const SEED_GOALS = [
  {
    id: 'g1', name: 'Reach 5K LinkedIn followers by Sep', north: '5,000 LinkedIn followers',
    progress: 0.42, current: 2089, target: 5000, weekly: 4,
    keyResults: [
      { label: 'Publish 4 LinkedIn posts / week', done: true,  current: 4, target: 4 },
      { label: 'Maintain 6%+ avg engagement rate', done: false, current: 5.1, target: 6 },
      { label: 'Reply to 20 comments / week',       done: true,  current: 22, target: 20 },
    ],
  },
  {
    id: 'g2', name: 'Build a Twitter audience around AI tooling', north: '10K X followers',
    progress: 0.18, current: 1810, target: 10000, weekly: 7,
    keyResults: [
      { label: 'Post 1 thread / week',     done: false, current: 0, target: 1 },
      { label: 'Daily single-tweet hooks', done: true,  current: 7, target: 7 },
      { label: 'Quote-reply 5 big posts / wk', done: false, current: 3, target: 5 },
    ],
  },
];

const SEED_TRENDS = [
  { id: 't1', title: 'Cursor 1.0 shipped — devs are split on the agent UX', source: 'hackernews', tag: 'RISING',   relevance: 86, velocity: 72, novelty: 64, signals: 14, url: '#' },
  { id: 't2', title: 'Solo founders are killing newsletters in favor of LinkedIn', source: 'reddit', tag: 'RISING',  relevance: 78, velocity: 64, novelty: 81, signals: 9, url: '#' },
  { id: 't3', title: '"Vibe coding" is the new no-code — pros and cons',         source: 'reddit', tag: 'HOT',      relevance: 71, velocity: 88, novelty: 52, signals: 22, url: '#' },
  { id: 't4', title: 'Local Llama 3.3 benchmarks vs Claude Haiku — closer than you think', source: 'hackernews', tag: 'RISING', relevance: 82, velocity: 56, novelty: 76, signals: 11, url: '#' },
  { id: 't5', title: 'Why senior engineers struggle to communicate technical decisions', source: 'hackernews', tag: 'STEADY', relevance: 64, velocity: 31, novelty: 48, signals: 7, url: '#' },
  { id: 't6', title: 'Indie devs are charging less than they think — pricing survey',     source: 'reddit', tag: 'RISING', relevance: 74, velocity: 60, novelty: 68, signals: 12, url: '#' },
];

const SEED_ANALYTICS = {
  posts: 47, scheduled: 12, impressions: 28640, engagement: 6.2, followers: 2089, spend: 4.82,
  trend: [12, 18, 14, 22, 28, 24, 36, 32, 40, 48, 44, 56, 52, 64],
  byPlatform: [
    { id: 'linkedin', label: 'LinkedIn', posts: 28, eng: 7.1, color: 'var(--linkedin)' },
    { id: 'twitter',  label: 'X',        posts: 14, eng: 4.8, color: '#111' },
    { id: 'instagram',label: 'Instagram',posts: 5,  eng: 5.2, color: 'var(--instagram)' },
  ],
  topPosts: [
    { title: 'The framework I use to kill features fast', platform: 'linkedin', reach: 8412, eng: 9.4 },
    { title: '4 tools I replaced with a 200-line script',  platform: 'twitter',  reach: 4280, eng: 7.1 },
    { title: 'Why I stopped journaling and started shipping', platform: 'linkedin', reach: 3960, eng: 6.8 },
  ],
};

// ─── Variant generation (mock) ───────────────────────────────────
function generateVariants(draft) {
  const trimmed = draft.trim();
  const seed = trimmed || 'I spent six months building the wrong thing. Here\'s what I learned about validating ideas before writing code.';
  const firstSentence = seed.split(/[.!?]/)[0].trim() || seed.slice(0, 80);
  const restOfText = seed.length > firstSentence.length ? seed.slice(firstSentence.length + 1).trim() : '';

  return {
    linkedin: {
      title: firstSentence + '.',
      body: [
        firstSentence + '.',
        '',
        restOfText || 'Three things became clear:',
        '',
        '→ Talking to 5 real users beats 50 hypothetical ones.',
        '→ A landing page tells you more than a prototype.',
        '→ If you can\'t explain it in one sentence, nobody buys it.',
        '',
        'The next product I built took 3 weeks. It now has paying customers.',
        '',
        'What\'s the longest you\'ve worked on something before showing it to a real user?',
      ].join('\n'),
      chars: 460, optimal: '1300–2000',
    },
    twitter: {
      thread: [
        firstSentence + '. 🧵',
        (restOfText || 'three things i learned the hard way:') + '',
        '1/ talking to 5 real users > 50 hypothetical ones',
        '2/ a landing page tells you more than a prototype',
        '3/ if you can\'t explain it in one sentence, no one buys',
        'the next product took 3 weeks. it has paying customers now.',
      ],
      chars: 268, optimal: '< 280 per tweet',
    },
    instagram: {
      caption: (firstSentence + '.\n\n' + (restOfText || 'swipe → for the three lessons that changed how i ship.\n\n#indiehacker #buildinpublic #startup #founder')).slice(0, 600),
      chars: 280, optimal: '125–150 for first line',
    },
  };
}

Object.assign(window, {
  NAV_ITEMS, PLATFORMS, SEED_POSTS, SEED_PERSONAS, SEED_GOALS,
  SEED_TRENDS, SEED_ANALYTICS, generateVariants,
});
