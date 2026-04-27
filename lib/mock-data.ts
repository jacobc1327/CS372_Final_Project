// =============================================================================
// Types
// =============================================================================

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  intensity: number; // % of 1RM (0 if accessory / unloaded)
  group: MuscleGroup;
  /** Optional: last comfortable working weight (kg) for this slot — improves load tracking in features/adaptation. */
  workingWeightKg?: number | null;
}

export type MuscleGroup =
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'conditioning';

export interface WorkoutDay {
  id: string;
  name: string;
  dayOfWeek: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  focus: string;
  exercises: Exercise[];
}

export interface ProgramWeek {
  weekNumber: number;
  days: WorkoutDay[];
  deload?: boolean;
  intensityShift: number; // applied multiplier vs template
  volumeShift: number;
}

export type ProgramCategory =
  | 'powerlifting'
  | 'strength'
  | 'hypertrophy'
  | 'beginner'
  | 'olympic'
  | 'hybrid'
  | 'conditioning';

export type ProgramLevel = 'beginner' | 'intermediate' | 'advanced';

export interface Program {
  id: string;
  name: string;
  author: string;
  description: string;
  category: ProgramCategory;
  level: ProgramLevel;
  tags: string[];
  duration: number; // weeks
  daysPerWeek: number;
  weeks: ProgramWeek[];
  baseVolume: number;
  baseIntensity: number;
  baseFrequency: number;
}

export interface SimulationMetrics {
  fatigueScore: number;
  progressScore: number;
  plateauRisk: number;
  adherenceDifficulty: number;
}

export interface ProgramDiff {
  volumeChange: number;
  intensityChange: number;
  frequencyChange: number;
  riskChange: number;
}

export interface Recommendation {
  id: string;
  type: 'warning' | 'success' | 'info' | 'optimization';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  metric?: string;
}

export interface SandboxState {
  sleep: number;
  soreness: number;
  recovery: number;
  recentProgress: 'stalled' | 'slow' | 'normal' | 'fast';
  goal: 'strength' | 'hypertrophy' | 'balanced';
}

// =============================================================================
// Compact program builder
// =============================================================================

type ExerciseSpec = [
  name: string,
  sets: number,
  reps: string,
  intensity: number,
  group: MuscleGroup,
];

type DaySpec = {
  name: string;
  day: WorkoutDay['dayOfWeek'];
  focus: string;
  ex: ExerciseSpec[];
};

type ProgressionType = 'linear' | 'wave' | 'block' | 'taper' | 'flat';

interface ProgramSpec {
  id: string;
  name: string;
  author: string;
  description: string;
  category: ProgramCategory;
  level: ProgramLevel;
  tags: string[];
  duration: number;
  baseVolume: number;
  baseIntensity: number;
  progression: ProgressionType;
  template: DaySpec[];
}

function makeExercise(idPrefix: string, idx: number, spec: ExerciseSpec): Exercise {
  return {
    id: `${idPrefix}_e${idx}`,
    name: spec[0],
    sets: spec[1],
    reps: spec[2],
    intensity: spec[3],
    group: spec[4],
  };
}

function progressionShifts(p: ProgressionType, week: number, total: number) {
  // returns { intensityShift, volumeShift, deload }
  const w = week - 1;
  const last = total - 1;
  switch (p) {
    case 'linear':
      return {
        intensityShift: 1 + w * 0.025,
        volumeShift: 1 + w * 0.04,
        deload: false,
      };
    case 'wave': {
      const cycle = w % 3;
      return {
        intensityShift: cycle === 0 ? 1.0 : cycle === 1 ? 1.05 : 1.1,
        volumeShift: cycle === 0 ? 1.1 : cycle === 1 ? 1.0 : 0.9,
        deload: false,
      };
    }
    case 'block': {
      const phase = w / Math.max(1, last);
      if (phase < 0.4) return { intensityShift: 0.95, volumeShift: 1.15, deload: false };
      if (phase < 0.8) return { intensityShift: 1.05, volumeShift: 1.0, deload: false };
      return { intensityShift: 1.12, volumeShift: 0.85, deload: false };
    }
    case 'taper':
      return {
        intensityShift: 1 + w * 0.04,
        volumeShift: 1 - w * 0.05,
        deload: w === last && total > 3,
      };
    case 'flat':
    default:
      return {
        intensityShift: 1 + w * 0.01,
        volumeShift: 1,
        deload: false,
      };
  }
}

function buildProgram(spec: ProgramSpec): Program {
  const weeks: ProgramWeek[] = [];
  for (let w = 1; w <= spec.duration; w++) {
    const shifts = progressionShifts(spec.progression, w, spec.duration);
    const days: WorkoutDay[] = spec.template.map((d, di) => ({
      id: `${spec.id}_w${w}_d${di}`,
      name: d.name,
      dayOfWeek: d.day,
      focus: d.focus,
      exercises: d.ex.map((ex, ei) => {
        const base = makeExercise(`${spec.id}_w${w}_d${di}`, ei, ex);
        const inten = ex[3] === 0 ? 0 : Math.min(98, ex[3] * shifts.intensityShift);
        const sets = Math.max(1, Math.round(ex[1] * shifts.volumeShift));
        if (shifts.deload) {
          return {
            ...base,
            intensity: ex[3] === 0 ? 0 : Math.round(ex[3] * 0.7),
            sets: Math.max(1, Math.round(ex[1] * 0.6)),
          };
        }
        return { ...base, intensity: Math.round(inten), sets };
      }),
    }));
    weeks.push({
      weekNumber: w,
      days,
      deload: shifts.deload,
      intensityShift: shifts.intensityShift,
      volumeShift: shifts.volumeShift,
    });
  }
  return {
    id: spec.id,
    name: spec.name,
    author: spec.author,
    description: spec.description,
    category: spec.category,
    level: spec.level,
    tags: spec.tags,
    duration: spec.duration,
    daysPerWeek: spec.template.length,
    baseVolume: spec.baseVolume,
    baseIntensity: spec.baseIntensity,
    baseFrequency: spec.template.length,
    weeks,
  };
}

// =============================================================================
// Programs (35+) — compact specs
// =============================================================================

const SPECS: ProgramSpec[] = [
  // ---- POWERLIFTING ----
  {
    id: '531-bbb',
    name: '5/3/1 Boring But Big',
    author: 'Jim Wendler',
    description: '4-day cycle blending heavy main lifts with high-volume accessory work.',
    category: 'powerlifting',
    level: 'intermediate',
    tags: ['compound', 'periodized', 'classic'],
    duration: 4,
    baseVolume: 70,
    baseIntensity: 78,
    progression: 'wave',
    template: [
      { name: 'Squat', day: 'Mon', focus: 'Lower Strength', ex: [
        ['Back Squat', 3, '5/3/1+', 80, 'quads'],
        ['Back Squat (BBB)', 5, '10', 50, 'quads'],
        ['Leg Curl', 4, '10', 0, 'hamstrings'],
        ['Hanging Leg Raise', 3, '12', 0, 'core'],
      ]},
      { name: 'Bench', day: 'Tue', focus: 'Upper Push', ex: [
        ['Bench Press', 3, '5/3/1+', 80, 'chest'],
        ['Bench Press (BBB)', 5, '10', 50, 'chest'],
        ['DB Row', 5, '10', 0, 'back'],
        ['Tricep Pushdown', 3, '12', 0, 'arms'],
      ]},
      { name: 'Deadlift', day: 'Thu', focus: 'Posterior Chain', ex: [
        ['Deadlift', 3, '5/3/1+', 80, 'back'],
        ['Deadlift (BBB)', 5, '10', 50, 'back'],
        ['Hyperextension', 4, '12', 0, 'hamstrings'],
        ['Plank', 3, '45s', 0, 'core'],
      ]},
      { name: 'Press', day: 'Fri', focus: 'Upper Press', ex: [
        ['Overhead Press', 3, '5/3/1+', 80, 'shoulders'],
        ['Overhead Press (BBB)', 5, '10', 50, 'shoulders'],
        ['Chin-Up', 5, '10', 0, 'back'],
        ['Lateral Raise', 4, '12', 0, 'shoulders'],
      ]},
    ],
  },
  {
    id: '531-monolith',
    name: 'Building the Monolith',
    author: 'Jim Wendler',
    description: 'Extreme volume mass-building 4-day program for size and brutal work capacity.',
    category: 'powerlifting',
    level: 'advanced',
    tags: ['mass', 'high-volume', 'brutal'],
    duration: 4,
    baseVolume: 95,
    baseIntensity: 80,
    progression: 'block',
    template: [
      { name: 'Press / Squat', day: 'Mon', focus: 'Heavy', ex: [
        ['Overhead Press', 5, '5/3/1+', 80, 'shoulders'],
        ['Press (BBB)', 5, '10', 60, 'shoulders'],
        ['Chin-Up', 5, '10', 0, 'back'],
        ['Squat', 3, '5/3/1+', 75, 'quads'],
        ['Front Squat', 5, '5', 65, 'quads'],
      ]},
      { name: 'Deadlift', day: 'Wed', focus: 'Pull', ex: [
        ['Deadlift', 5, '3', 80, 'back'],
        ['Pendlay Row', 5, '10', 60, 'back'],
        ['Chin-Up', 100, 'total', 0, 'back'],
        ['Hanging Leg Raise', 5, '15', 0, 'core'],
      ]},
      { name: 'Bench / Squat', day: 'Fri', focus: 'Push', ex: [
        ['Bench Press', 5, '5/3/1+', 80, 'chest'],
        ['Bench (BBB)', 10, '6', 60, 'chest'],
        ['Squat', 1, '20', 65, 'quads'],
        ['DB Row', 5, '10', 0, 'back'],
      ]},
      { name: 'Conditioning', day: 'Sat', focus: 'Capacity', ex: [
        ['Prowler Push', 10, '40m', 0, 'conditioning'],
        ['Farmer Walk', 5, '30m', 0, 'core'],
        ['Sled Drag', 5, '40m', 0, 'conditioning'],
      ]},
    ],
  },
  {
    id: 'sheiko-29',
    name: 'Sheiko #29',
    author: 'Boris Sheiko',
    description: 'Russian high-frequency, sub-maximal volume program for raw powerlifters.',
    category: 'powerlifting',
    level: 'advanced',
    tags: ['russian', 'sub-max', 'volume'],
    duration: 4,
    baseVolume: 90,
    baseIntensity: 72,
    progression: 'wave',
    template: [
      { name: 'Squat / Bench', day: 'Mon', focus: 'Technique', ex: [
        ['Squat', 6, '5', 70, 'quads'],
        ['Bench Press', 5, '5', 70, 'chest'],
        ['Bench (Pause)', 4, '4', 65, 'chest'],
        ['Hyperextension', 3, '10', 0, 'hamstrings'],
      ]},
      { name: 'Bench / Pull', day: 'Wed', focus: 'Pull Volume', ex: [
        ['Bench Press', 6, '4', 75, 'chest'],
        ['Deadlift', 5, '3', 75, 'back'],
        ['Pendlay Row', 4, '6', 0, 'back'],
        ['Press', 4, '6', 60, 'shoulders'],
      ]},
      { name: 'Squat / Bench', day: 'Fri', focus: 'Heavy', ex: [
        ['Squat', 5, '4', 80, 'quads'],
        ['Bench Press', 5, '5', 75, 'chest'],
        ['Close-Grip Bench', 4, '6', 65, 'arms'],
        ['Good Morning', 3, '6', 60, 'hamstrings'],
      ]},
      { name: 'Bench / Squat', day: 'Sat', focus: 'Mixed', ex: [
        ['Bench Press', 5, '3', 80, 'chest'],
        ['Squat (Pause)', 4, '4', 70, 'quads'],
        ['Incline Bench', 4, '6', 0, 'chest'],
        ['Lat Pulldown', 4, '8', 0, 'back'],
      ]},
    ],
  },
  {
    id: 'smolov-base',
    name: 'Smolov Base Cycle',
    author: 'Sergey Smolov',
    description: 'Brutal 4-week squat specialization. Add 30–50 lb to a 1RM if you survive.',
    category: 'powerlifting',
    level: 'advanced',
    tags: ['squat', 'specialization', 'brutal'],
    duration: 4,
    baseVolume: 110,
    baseIntensity: 85,
    progression: 'taper',
    template: [
      { name: 'Volume Day', day: 'Mon', focus: 'Squat', ex: [
        ['Squat', 4, '9', 70, 'quads'],
        ['Leg Curl', 3, '10', 0, 'hamstrings'],
      ]},
      { name: 'Heavy Day', day: 'Wed', focus: 'Squat', ex: [
        ['Squat', 5, '7', 75, 'quads'],
        ['Plank', 3, '60s', 0, 'core'],
      ]},
      { name: 'Power Day', day: 'Fri', focus: 'Squat', ex: [
        ['Squat', 7, '5', 80, 'quads'],
        ['Hyperextension', 3, '12', 0, 'hamstrings'],
      ]},
      { name: 'Peak Day', day: 'Sat', focus: 'Squat', ex: [
        ['Squat', 10, '3', 85, 'quads'],
        ['Walking Lunge', 3, '20', 0, 'glutes'],
      ]},
    ],
  },
  {
    id: 'smolov-jr-bench',
    name: 'Smolov Jr. Bench',
    author: 'Smolov adaptation',
    description: '3-week bench specialization with progressive volume drops and intensity rises.',
    category: 'powerlifting',
    level: 'advanced',
    tags: ['bench', 'specialization', 'short-cycle'],
    duration: 3,
    baseVolume: 100,
    baseIntensity: 80,
    progression: 'taper',
    template: [
      { name: 'Bench A', day: 'Mon', focus: 'Bench', ex: [
        ['Bench Press', 6, '6', 70, 'chest'],
        ['DB Row', 4, '8', 0, 'back'],
      ]},
      { name: 'Bench B', day: 'Wed', focus: 'Bench', ex: [
        ['Bench Press', 7, '5', 75, 'chest'],
        ['Pull-Up', 4, '8', 0, 'back'],
      ]},
      { name: 'Bench C', day: 'Fri', focus: 'Bench', ex: [
        ['Bench Press', 8, '4', 80, 'chest'],
        ['Face Pull', 4, '15', 0, 'shoulders'],
      ]},
      { name: 'Bench D', day: 'Sat', focus: 'Bench', ex: [
        ['Bench Press', 10, '3', 85, 'chest'],
        ['Tricep Pushdown', 4, '12', 0, 'arms'],
      ]},
    ],
  },
  {
    id: 'madcow',
    name: 'Madcow 5x5',
    author: 'Madcow',
    description: 'Intermediate 5x5 with weekly progression on heavy day, light/medium intermediates.',
    category: 'strength',
    level: 'intermediate',
    tags: ['5x5', 'linear', 'classic'],
    duration: 6,
    baseVolume: 75,
    baseIntensity: 78,
    progression: 'linear',
    template: [
      { name: 'Heavy', day: 'Mon', focus: 'Full Body', ex: [
        ['Squat', 5, '5', 80, 'quads'],
        ['Bench Press', 5, '5', 80, 'chest'],
        ['Pendlay Row', 5, '5', 80, 'back'],
      ]},
      { name: 'Light', day: 'Wed', focus: 'Full Body', ex: [
        ['Squat', 4, '5', 60, 'quads'],
        ['Overhead Press', 4, '5', 70, 'shoulders'],
        ['Deadlift', 4, '5', 70, 'back'],
      ]},
      { name: 'Medium', day: 'Fri', focus: 'PR Day', ex: [
        ['Squat', 5, '3', 85, 'quads'],
        ['Bench Press', 5, '3', 85, 'chest'],
        ['Pendlay Row', 5, '3', 85, 'back'],
        ['Back Extension', 3, '10', 0, 'hamstrings'],
      ]},
    ],
  },
  {
    id: 'texas',
    name: 'Texas Method',
    author: 'Mark Rippetoe',
    description: 'Volume Monday, light Wednesday, intensity Friday. Reliable intermediate strength gains.',
    category: 'strength',
    level: 'intermediate',
    tags: ['weekly-progression', 'classic', 'powerlifting-style'],
    duration: 6,
    baseVolume: 80,
    baseIntensity: 80,
    progression: 'linear',
    template: [
      { name: 'Volume', day: 'Mon', focus: 'Heavy Volume', ex: [
        ['Squat', 5, '5', 80, 'quads'],
        ['Bench Press', 5, '5', 80, 'chest'],
        ['Deadlift', 1, '5', 85, 'back'],
      ]},
      { name: 'Light', day: 'Wed', focus: 'Recovery', ex: [
        ['Squat', 2, '5', 65, 'quads'],
        ['Overhead Press', 3, '5', 75, 'shoulders'],
        ['Chin-Up', 3, '8', 0, 'back'],
      ]},
      { name: 'Intensity', day: 'Fri', focus: 'PR Attempts', ex: [
        ['Squat', 1, '5', 90, 'quads'],
        ['Bench Press', 1, '5', 90, 'chest'],
        ['Power Clean', 5, '3', 75, 'back'],
      ]},
    ],
  },
  {
    id: 'westside',
    name: 'Westside Conjugate',
    author: 'Louie Simmons',
    description: 'Max-effort and dynamic-effort days alternated for raw and equipped powerlifters.',
    category: 'powerlifting',
    level: 'advanced',
    tags: ['conjugate', 'max-effort', 'dynamic'],
    duration: 4,
    baseVolume: 88,
    baseIntensity: 85,
    progression: 'wave',
    template: [
      { name: 'ME Lower', day: 'Mon', focus: 'Max Effort', ex: [
        ['Box Squat', 3, '1-3', 90, 'quads'],
        ['Good Morning', 4, '5', 70, 'hamstrings'],
        ['Reverse Hyper', 4, '12', 0, 'glutes'],
        ['Ab Wheel', 4, '10', 0, 'core'],
      ]},
      { name: 'ME Upper', day: 'Wed', focus: 'Max Effort', ex: [
        ['Floor Press', 3, '1-3', 90, 'chest'],
        ['Close-Grip Bench', 4, '6', 75, 'arms'],
        ['Bent Row', 4, '8', 0, 'back'],
        ['Tricep Extension', 4, '10', 0, 'arms'],
      ]},
      { name: 'DE Lower', day: 'Fri', focus: 'Dynamic Effort', ex: [
        ['Box Squat (DE)', 8, '2', 60, 'quads'],
        ['Speed Pull', 6, '1', 60, 'back'],
        ['Glute Ham Raise', 4, '8', 0, 'hamstrings'],
      ]},
      { name: 'DE Upper', day: 'Sat', focus: 'Dynamic Effort', ex: [
        ['Bench (DE)', 9, '3', 55, 'chest'],
        ['DB Press', 4, '12', 0, 'shoulders'],
        ['Lat Pulldown', 4, '10', 0, 'back'],
      ]},
    ],
  },
  {
    id: 'cube',
    name: 'Cube Method',
    author: 'Brandon Lilly',
    description: 'Rotating heavy / explosive / rep day across the big three. Built for raw lifters.',
    category: 'powerlifting',
    level: 'advanced',
    tags: ['rotation', 'raw', 'lilly'],
    duration: 6,
    baseVolume: 80,
    baseIntensity: 82,
    progression: 'wave',
    template: [
      { name: 'Heavy Squat', day: 'Mon', focus: 'Squat', ex: [
        ['Squat', 5, '3', 85, 'quads'],
        ['Front Squat', 4, '6', 70, 'quads'],
        ['Glute Bridge', 4, '10', 0, 'glutes'],
      ]},
      { name: 'Rep Bench', day: 'Wed', focus: 'Bench', ex: [
        ['Bench Press', 6, '8', 65, 'chest'],
        ['DB Press', 4, '12', 0, 'chest'],
        ['Row', 4, '10', 0, 'back'],
      ]},
      { name: 'Explosive Pull', day: 'Fri', focus: 'Deadlift', ex: [
        ['Speed Deadlift', 8, '3', 60, 'back'],
        ['Pendlay Row', 5, '5', 75, 'back'],
        ['Hanging Leg Raise', 4, '12', 0, 'core'],
      ]},
      { name: 'Accessory', day: 'Sat', focus: 'Hypertrophy', ex: [
        ['Incline DB Press', 4, '10', 0, 'chest'],
        ['Lat Pulldown', 4, '12', 0, 'back'],
        ['Curl', 4, '12', 0, 'arms'],
        ['Tricep Pushdown', 4, '12', 0, 'arms'],
      ]},
    ],
  },
  {
    id: 'juggernaut',
    name: 'Juggernaut Method',
    author: 'Chad Wesley Smith',
    description: '16-week wave-loaded periodization for athletes and powerlifters chasing PRs.',
    category: 'powerlifting',
    level: 'advanced',
    tags: ['periodized', 'wave', 'advanced'],
    duration: 8,
    baseVolume: 85,
    baseIntensity: 80,
    progression: 'block',
    template: [
      { name: 'Squat', day: 'Mon', focus: 'Lower', ex: [
        ['Squat', 5, '5', 80, 'quads'],
        ['Pause Squat', 4, '5', 70, 'quads'],
        ['Ab Wheel', 4, '10', 0, 'core'],
      ]},
      { name: 'Bench', day: 'Tue', focus: 'Upper', ex: [
        ['Bench Press', 5, '5', 80, 'chest'],
        ['Incline Bench', 4, '8', 0, 'chest'],
        ['Pull-Up', 5, '8', 0, 'back'],
      ]},
      { name: 'Deadlift', day: 'Thu', focus: 'Pull', ex: [
        ['Deadlift', 4, '5', 80, 'back'],
        ['Deficit Deadlift', 3, '5', 70, 'back'],
        ['Reverse Hyper', 4, '12', 0, 'glutes'],
      ]},
      { name: 'Press', day: 'Fri', focus: 'Push', ex: [
        ['Overhead Press', 5, '5', 80, 'shoulders'],
        ['Close-Grip Bench', 4, '6', 75, 'arms'],
        ['Lateral Raise', 4, '15', 0, 'shoulders'],
      ]},
    ],
  },
  {
    id: 'nsuns',
    name: 'nSuns 5/3/1 LP',
    author: 'nSuns',
    description: '6-day variant of 5/3/1 with daily heavy main lift + secondary T2 lift. Aggressive LP.',
    category: 'powerlifting',
    level: 'intermediate',
    tags: ['high-frequency', 'lp', 'aggressive'],
    duration: 6,
    baseVolume: 95,
    baseIntensity: 78,
    progression: 'linear',
    template: [
      { name: 'Bench / OHP', day: 'Mon', focus: 'Push', ex: [
        ['Bench Press', 9, '5', 75, 'chest'],
        ['Overhead Press', 8, '6', 50, 'shoulders'],
        ['Chin-Up', 4, '8', 0, 'back'],
      ]},
      { name: 'Squat / Sumo DL', day: 'Tue', focus: 'Lower', ex: [
        ['Squat', 9, '5', 75, 'quads'],
        ['Sumo Deadlift', 8, '5', 50, 'back'],
        ['Hanging Leg Raise', 4, '12', 0, 'core'],
      ]},
      { name: 'OHP / Incline', day: 'Wed', focus: 'Push', ex: [
        ['Overhead Press', 9, '5', 75, 'shoulders'],
        ['Incline Bench', 8, '6', 50, 'chest'],
        ['Lat Pulldown', 4, '10', 0, 'back'],
      ]},
      { name: 'Deadlift / Front Sq', day: 'Thu', focus: 'Pull', ex: [
        ['Deadlift', 9, '5', 75, 'back'],
        ['Front Squat', 8, '5', 50, 'quads'],
        ['Plank', 4, '60s', 0, 'core'],
      ]},
      { name: 'Bench / CGBP', day: 'Fri', focus: 'Push', ex: [
        ['Bench Press', 8, '6', 70, 'chest'],
        ['Close-Grip Bench', 8, '5', 60, 'arms'],
        ['DB Row', 4, '10', 0, 'back'],
      ]},
      { name: 'Squat Variant', day: 'Sat', focus: 'Lower', ex: [
        ['Pause Squat', 8, '5', 70, 'quads'],
        ['RDL', 4, '8', 0, 'hamstrings'],
        ['Ab Rollout', 4, '10', 0, 'core'],
      ]},
    ],
  },
  {
    id: '531-krypteia',
    name: '5/3/1 Krypteia',
    author: 'Jim Wendler',
    description: 'Bodyweight-heavy variant of 5/3/1 emphasizing chins, dips and conditioning.',
    category: 'hybrid',
    level: 'intermediate',
    tags: ['bodyweight', 'conditioning', 'wendler'],
    duration: 4,
    baseVolume: 70,
    baseIntensity: 72,
    progression: 'wave',
    template: [
      { name: 'Squat', day: 'Mon', focus: 'Lower', ex: [
        ['Squat', 3, '5/3/1+', 78, 'quads'],
        ['Front Squat', 3, '8', 60, 'quads'],
        ['Pull-Up', 5, 'AMRAP', 0, 'back'],
        ['Ab Wheel', 5, '10', 0, 'core'],
      ]},
      { name: 'Bench', day: 'Tue', focus: 'Upper', ex: [
        ['Bench Press', 3, '5/3/1+', 78, 'chest'],
        ['DB Bench', 3, '10', 0, 'chest'],
        ['Pendlay Row', 5, '6', 0, 'back'],
        ['Dip', 5, 'AMRAP', 0, 'arms'],
      ]},
      { name: 'Deadlift', day: 'Thu', focus: 'Pull', ex: [
        ['Deadlift', 3, '5/3/1+', 78, 'back'],
        ['Trap Bar', 3, '8', 65, 'back'],
        ['Hyperextension', 5, '10', 0, 'hamstrings'],
      ]},
      { name: 'Press', day: 'Fri', focus: 'Push', ex: [
        ['Overhead Press', 3, '5/3/1+', 78, 'shoulders'],
        ['Push Press', 3, '6', 65, 'shoulders'],
        ['Chin-Up', 5, '6', 0, 'back'],
        ['Curl', 4, '10', 0, 'arms'],
      ]},
    ],
  },

  // ---- HYPERTROPHY ----
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    author: 'Classic Bodybuilding',
    description: '6-day high-frequency split. Each muscle hit twice weekly with hypertrophy focus.',
    category: 'hypertrophy',
    level: 'intermediate',
    tags: ['split', 'high-volume', 'classic'],
    duration: 8,
    baseVolume: 90,
    baseIntensity: 70,
    progression: 'flat',
    template: [
      { name: 'Push A', day: 'Mon', focus: 'Chest / Shoulders / Triceps', ex: [
        ['Bench Press', 4, '6-8', 75, 'chest'],
        ['Overhead Press', 3, '8-10', 65, 'shoulders'],
        ['Incline DB Press', 3, '10-12', 0, 'chest'],
        ['Lateral Raise', 4, '12-15', 0, 'shoulders'],
        ['Tricep Pushdown', 4, '10-12', 0, 'arms'],
      ]},
      { name: 'Pull A', day: 'Tue', focus: 'Back / Biceps', ex: [
        ['Deadlift', 3, '5', 80, 'back'],
        ['Pull-Up', 4, '8-10', 0, 'back'],
        ['Barbell Row', 4, '8-10', 0, 'back'],
        ['Face Pull', 4, '15', 0, 'shoulders'],
        ['Barbell Curl', 4, '10', 0, 'arms'],
      ]},
      { name: 'Legs A', day: 'Wed', focus: 'Quads / Glutes', ex: [
        ['Squat', 4, '6-8', 75, 'quads'],
        ['RDL', 3, '8-10', 70, 'hamstrings'],
        ['Leg Press', 4, '12', 0, 'quads'],
        ['Leg Curl', 4, '10-12', 0, 'hamstrings'],
        ['Calf Raise', 5, '12-15', 0, 'core'],
      ]},
      { name: 'Push B', day: 'Thu', focus: 'Volume Push', ex: [
        ['Incline Bench', 4, '8-10', 70, 'chest'],
        ['DB Shoulder Press', 4, '10', 0, 'shoulders'],
        ['Cable Fly', 3, '12-15', 0, 'chest'],
        ['Lateral Raise', 4, '15', 0, 'shoulders'],
        ['Overhead Tricep Ext', 4, '12', 0, 'arms'],
      ]},
      { name: 'Pull B', day: 'Fri', focus: 'Volume Pull', ex: [
        ['Pendlay Row', 4, '6-8', 75, 'back'],
        ['Lat Pulldown', 4, '10', 0, 'back'],
        ['Cable Row', 3, '12', 0, 'back'],
        ['Rear Delt Fly', 4, '15', 0, 'shoulders'],
        ['Hammer Curl', 4, '10-12', 0, 'arms'],
      ]},
      { name: 'Legs B', day: 'Sat', focus: 'Posterior + Volume', ex: [
        ['Front Squat', 4, '6-8', 70, 'quads'],
        ['Hip Thrust', 4, '8-10', 0, 'glutes'],
        ['Walking Lunge', 3, '12', 0, 'glutes'],
        ['Leg Extension', 4, '12-15', 0, 'quads'],
        ['Standing Calf', 5, '12', 0, 'core'],
      ]},
    ],
  },
  {
    id: 'upper-lower',
    name: 'Upper / Lower 4-Day',
    author: 'Classic',
    description: 'Balanced 4-day split alternating heavy and volume sessions for upper and lower body.',
    category: 'hypertrophy',
    level: 'intermediate',
    tags: ['split', 'balanced', 'time-efficient'],
    duration: 6,
    baseVolume: 80,
    baseIntensity: 75,
    progression: 'linear',
    template: [
      { name: 'Upper Heavy', day: 'Mon', focus: 'Strength', ex: [
        ['Bench Press', 4, '5', 80, 'chest'],
        ['Bent Row', 4, '5', 80, 'back'],
        ['Overhead Press', 3, '8', 70, 'shoulders'],
        ['Pull-Up', 3, '8', 0, 'back'],
        ['Tricep Pushdown', 3, '12', 0, 'arms'],
      ]},
      { name: 'Lower Heavy', day: 'Tue', focus: 'Strength', ex: [
        ['Squat', 4, '5', 80, 'quads'],
        ['RDL', 3, '6', 75, 'hamstrings'],
        ['Leg Press', 3, '10', 0, 'quads'],
        ['Leg Curl', 3, '12', 0, 'hamstrings'],
        ['Plank', 3, '60s', 0, 'core'],
      ]},
      { name: 'Upper Volume', day: 'Thu', focus: 'Hypertrophy', ex: [
        ['Incline DB Press', 4, '10', 0, 'chest'],
        ['Cable Row', 4, '10', 0, 'back'],
        ['DB Shoulder Press', 4, '10', 0, 'shoulders'],
        ['Lat Pulldown', 3, '12', 0, 'back'],
        ['Curl', 3, '12', 0, 'arms'],
        ['Tricep Ext', 3, '12', 0, 'arms'],
      ]},
      { name: 'Lower Volume', day: 'Fri', focus: 'Hypertrophy', ex: [
        ['Front Squat', 4, '8', 70, 'quads'],
        ['Hip Thrust', 4, '10', 0, 'glutes'],
        ['Walking Lunge', 3, '12', 0, 'glutes'],
        ['Leg Extension', 3, '12', 0, 'quads'],
        ['Calf Raise', 4, '15', 0, 'core'],
      ]},
    ],
  },
  {
    id: 'phul',
    name: 'PHUL',
    author: 'Brandon Campbell',
    description: 'Power Hypertrophy Upper Lower — combines strength on Mon/Tue with hypertrophy Thu/Fri.',
    category: 'hypertrophy',
    level: 'intermediate',
    tags: ['power', 'hypertrophy', 'split'],
    duration: 6,
    baseVolume: 85,
    baseIntensity: 75,
    progression: 'linear',
    template: [
      { name: 'Upper Power', day: 'Mon', focus: 'Strength', ex: [
        ['Bench Press', 4, '3-5', 85, 'chest'],
        ['Bent Row', 4, '3-5', 85, 'back'],
        ['Overhead Press', 3, '6-10', 75, 'shoulders'],
        ['Pull-Up', 3, '6-10', 0, 'back'],
        ['Tricep Ext', 3, '6-10', 0, 'arms'],
      ]},
      { name: 'Lower Power', day: 'Tue', focus: 'Strength', ex: [
        ['Squat', 4, '3-5', 85, 'quads'],
        ['Deadlift', 3, '3-5', 85, 'back'],
        ['Leg Press', 3, '10-12', 0, 'quads'],
        ['Leg Curl', 3, '6-10', 0, 'hamstrings'],
      ]},
      { name: 'Upper Hyper', day: 'Thu', focus: 'Hypertrophy', ex: [
        ['Incline Bench', 4, '8-12', 70, 'chest'],
        ['DB Row', 4, '8-12', 0, 'back'],
        ['Lateral Raise', 4, '8-12', 0, 'shoulders'],
        ['Cable Fly', 3, '10-12', 0, 'chest'],
        ['Curl', 4, '8-12', 0, 'arms'],
      ]},
      { name: 'Lower Hyper', day: 'Fri', focus: 'Hypertrophy', ex: [
        ['Front Squat', 4, '8-12', 70, 'quads'],
        ['RDL', 4, '8-12', 0, 'hamstrings'],
        ['Walking Lunge', 3, '10', 0, 'glutes'],
        ['Leg Extension', 4, '12-15', 0, 'quads'],
        ['Calf Raise', 5, '12', 0, 'core'],
      ]},
    ],
  },
  {
    id: 'phat',
    name: 'PHAT',
    author: 'Layne Norton',
    description: 'Power Hypertrophy Adaptive Training — 5-day program blending heavy lifts and bodybuilding.',
    category: 'hypertrophy',
    level: 'advanced',
    tags: ['power', 'volume', 'norton'],
    duration: 6,
    baseVolume: 95,
    baseIntensity: 78,
    progression: 'wave',
    template: [
      { name: 'Upper Power', day: 'Mon', focus: 'Strength', ex: [
        ['Bench Press', 4, '3-5', 87, 'chest'],
        ['Pendlay Row', 4, '3-5', 87, 'back'],
        ['Weighted Pull-Up', 3, '6-10', 0, 'back'],
        ['Overhead Press', 3, '6-10', 70, 'shoulders'],
        ['Skull Crusher', 3, '6-10', 0, 'arms'],
      ]},
      { name: 'Lower Power', day: 'Tue', focus: 'Strength', ex: [
        ['Squat', 4, '3-5', 87, 'quads'],
        ['Deadlift', 3, '5-8', 80, 'back'],
        ['Leg Press', 2, '6-10', 0, 'quads'],
        ['Leg Curl', 3, '6-10', 0, 'hamstrings'],
      ]},
      { name: 'Back / Shoulders', day: 'Thu', focus: 'Hypertrophy', ex: [
        ['Bent Row', 6, '8-12', 65, 'back'],
        ['Lat Pulldown', 4, '10-15', 0, 'back'],
        ['Lateral Raise', 4, '10-15', 0, 'shoulders'],
        ['Rear Delt Fly', 4, '12-15', 0, 'shoulders'],
        ['Shrug', 3, '12-15', 0, 'back'],
      ]},
      { name: 'Chest / Arms', day: 'Fri', focus: 'Hypertrophy', ex: [
        ['Incline Bench', 4, '8-12', 65, 'chest'],
        ['DB Press', 3, '10-12', 0, 'chest'],
        ['Cable Fly', 3, '10-15', 0, 'chest'],
        ['Curl', 4, '10-15', 0, 'arms'],
        ['Tricep Pushdown', 4, '10-15', 0, 'arms'],
      ]},
      { name: 'Legs', day: 'Sat', focus: 'Hypertrophy', ex: [
        ['Squat', 4, '8-12', 65, 'quads'],
        ['Hack Squat', 3, '10-12', 0, 'quads'],
        ['Hip Thrust', 3, '12', 0, 'glutes'],
        ['Leg Extension', 4, '12-15', 0, 'quads'],
        ['Standing Calf', 5, '15', 0, 'core'],
      ]},
    ],
  },
  {
    id: 'arnold-split',
    name: 'Arnold Split',
    author: 'Arnold Schwarzenegger',
    description: 'Classic 6-day double split — chest/back, shoulders/arms, legs — with high volume.',
    category: 'hypertrophy',
    level: 'advanced',
    tags: ['classic', 'high-volume', 'double-split'],
    duration: 8,
    baseVolume: 100,
    baseIntensity: 70,
    progression: 'flat',
    template: [
      { name: 'Chest / Back A', day: 'Mon', focus: 'Volume', ex: [
        ['Bench Press', 5, '8-12', 70, 'chest'],
        ['Incline Bench', 4, '10', 65, 'chest'],
        ['Pull-Up', 4, '10', 0, 'back'],
        ['Bent Row', 4, '10', 0, 'back'],
        ['Pullover', 3, '12', 0, 'chest'],
      ]},
      { name: 'Shoulders / Arms A', day: 'Tue', focus: 'Volume', ex: [
        ['Behind-Neck Press', 5, '8', 65, 'shoulders'],
        ['Lateral Raise', 4, '10', 0, 'shoulders'],
        ['Barbell Curl', 5, '10', 0, 'arms'],
        ['Skull Crusher', 5, '10', 0, 'arms'],
        ['Wrist Curl', 4, '15', 0, 'arms'],
      ]},
      { name: 'Legs A', day: 'Wed', focus: 'Volume', ex: [
        ['Squat', 5, '8-12', 70, 'quads'],
        ['Leg Press', 4, '12', 0, 'quads'],
        ['Leg Curl', 4, '12', 0, 'hamstrings'],
        ['Calf Raise', 6, '15', 0, 'core'],
      ]},
      { name: 'Chest / Back B', day: 'Thu', focus: 'Volume', ex: [
        ['DB Bench', 5, '10', 0, 'chest'],
        ['Cable Fly', 4, '12', 0, 'chest'],
        ['Lat Pulldown', 4, '12', 0, 'back'],
        ['Cable Row', 4, '12', 0, 'back'],
      ]},
      { name: 'Shoulders / Arms B', day: 'Fri', focus: 'Volume', ex: [
        ['DB Shoulder Press', 4, '10', 0, 'shoulders'],
        ['Front Raise', 4, '10', 0, 'shoulders'],
        ['Preacher Curl', 4, '10', 0, 'arms'],
        ['Tricep Pushdown', 4, '12', 0, 'arms'],
      ]},
      { name: 'Legs B', day: 'Sat', focus: 'Volume', ex: [
        ['Front Squat', 4, '10', 65, 'quads'],
        ['Lunge', 4, '12', 0, 'glutes'],
        ['RDL', 4, '10', 0, 'hamstrings'],
        ['Seated Calf', 5, '15', 0, 'core'],
      ]},
    ],
  },
  {
    id: 'gvt',
    name: 'German Volume Training',
    author: 'Charles Poliquin',
    description: '10x10 brutal hypertrophy method. One main exercise per group, all sets at 60% 1RM.',
    category: 'hypertrophy',
    level: 'intermediate',
    tags: ['10x10', 'brutal', 'hypertrophy'],
    duration: 6,
    baseVolume: 110,
    baseIntensity: 60,
    progression: 'flat',
    template: [
      { name: 'Chest / Back', day: 'Mon', focus: '10x10', ex: [
        ['Bench Press', 10, '10', 60, 'chest'],
        ['Pendlay Row', 10, '10', 60, 'back'],
        ['Incline Fly', 3, '12', 0, 'chest'],
        ['Lat Pulldown', 3, '12', 0, 'back'],
      ]},
      { name: 'Legs / Abs', day: 'Wed', focus: '10x10', ex: [
        ['Squat', 10, '10', 60, 'quads'],
        ['RDL', 10, '10', 60, 'hamstrings'],
        ['Crunch', 3, '15', 0, 'core'],
        ['Calf Raise', 3, '15', 0, 'core'],
      ]},
      { name: 'Arms / Shoulders', day: 'Fri', focus: '10x10', ex: [
        ['DB Press', 10, '10', 60, 'shoulders'],
        ['Curl', 10, '10', 60, 'arms'],
        ['Tricep Pushdown', 10, '10', 60, 'arms'],
        ['Lateral Raise', 3, '12', 0, 'shoulders'],
      ]},
    ],
  },
  {
    id: 'fst7',
    name: 'FST-7',
    author: 'Hany Rambod',
    description: 'Fascia Stretch Training — finish each muscle with 7 sets of high reps short rest.',
    category: 'hypertrophy',
    level: 'advanced',
    tags: ['pump', 'fascia', 'finisher'],
    duration: 6,
    baseVolume: 95,
    baseIntensity: 65,
    progression: 'flat',
    template: [
      { name: 'Back', day: 'Mon', focus: 'FST-7', ex: [
        ['Pull-Up', 4, '8-10', 0, 'back'],
        ['Pendlay Row', 4, '8', 65, 'back'],
        ['T-Bar Row', 4, '10', 0, 'back'],
        ['Lat Pulldown', 7, '10-12', 0, 'back'],
      ]},
      { name: 'Chest', day: 'Tue', focus: 'FST-7', ex: [
        ['Incline Bench', 4, '8', 70, 'chest'],
        ['Flat DB Press', 4, '10', 0, 'chest'],
        ['Cable Fly', 7, '10-12', 0, 'chest'],
      ]},
      { name: 'Legs', day: 'Thu', focus: 'FST-7', ex: [
        ['Squat', 4, '8-10', 70, 'quads'],
        ['Leg Press', 4, '10', 0, 'quads'],
        ['Leg Curl', 4, '10', 0, 'hamstrings'],
        ['Leg Extension', 7, '10-12', 0, 'quads'],
      ]},
      { name: 'Shoulders / Arms', day: 'Sat', focus: 'FST-7', ex: [
        ['Overhead Press', 4, '8', 70, 'shoulders'],
        ['Lateral Raise', 4, '10', 0, 'shoulders'],
        ['Barbell Curl', 4, '10', 0, 'arms'],
        ['Tricep Pushdown', 7, '10-12', 0, 'arms'],
      ]},
    ],
  },
  {
    id: 'y3t',
    name: 'Y3T (Yoda Three Trainer)',
    author: 'Neil Hill',
    description: '3-week rotating cycle of low-rep heavy, mid-rep volume, and high-rep extreme intensity.',
    category: 'hypertrophy',
    level: 'advanced',
    tags: ['rotating', 'pump', 'shape'],
    duration: 9,
    baseVolume: 90,
    baseIntensity: 72,
    progression: 'wave',
    template: [
      { name: 'Chest / Tris', day: 'Mon', focus: 'Hypertrophy', ex: [
        ['Incline Bench', 4, '6-8', 75, 'chest'],
        ['DB Press', 4, '10', 0, 'chest'],
        ['Cable Fly', 3, '15', 0, 'chest'],
        ['Tricep Pushdown', 4, '12', 0, 'arms'],
      ]},
      { name: 'Legs', day: 'Tue', focus: 'Hypertrophy', ex: [
        ['Squat', 4, '6-8', 75, 'quads'],
        ['Hack Squat', 4, '10', 0, 'quads'],
        ['Leg Press', 3, '15', 0, 'quads'],
        ['Leg Curl', 4, '12', 0, 'hamstrings'],
      ]},
      { name: 'Back', day: 'Thu', focus: 'Hypertrophy', ex: [
        ['Deadlift', 4, '6', 80, 'back'],
        ['Pull-Up', 4, '8', 0, 'back'],
        ['Cable Row', 4, '12', 0, 'back'],
      ]},
      { name: 'Shoulders / Bis', day: 'Fri', focus: 'Hypertrophy', ex: [
        ['Overhead Press', 4, '6-8', 75, 'shoulders'],
        ['Lateral Raise', 4, '12', 0, 'shoulders'],
        ['Barbell Curl', 4, '10', 0, 'arms'],
        ['Hammer Curl', 3, '12', 0, 'arms'],
      ]},
    ],
  },
  {
    id: 'dorian-hit',
    name: 'Dorian Yates HIT',
    author: 'Dorian Yates',
    description: 'High-Intensity Training — one all-out working set per exercise. Brutal, brief, infrequent.',
    category: 'hypertrophy',
    level: 'advanced',
    tags: ['hit', 'brutal', 'low-volume'],
    duration: 6,
    baseVolume: 50,
    baseIntensity: 90,
    progression: 'flat',
    template: [
      { name: 'Shoulders / Tris', day: 'Mon', focus: 'HIT', ex: [
        ['Smith Press', 1, '6-8', 90, 'shoulders'],
        ['Lateral Raise', 1, '8-10', 0, 'shoulders'],
        ['Tricep Pushdown', 1, '8', 0, 'arms'],
        ['Skull Crusher', 1, '6-8', 0, 'arms'],
      ]},
      { name: 'Back', day: 'Wed', focus: 'HIT', ex: [
        ['Pull-Up', 1, '8', 0, 'back'],
        ['Bent Row', 1, '6-8', 90, 'back'],
        ['Deadlift', 1, '6-8', 90, 'back'],
        ['Shrug', 1, '8-10', 0, 'back'],
      ]},
      { name: 'Chest / Bis', day: 'Fri', focus: 'HIT', ex: [
        ['Incline Bench', 1, '6-8', 90, 'chest'],
        ['DB Press', 1, '8', 0, 'chest'],
        ['Curl', 1, '6-8', 0, 'arms'],
        ['Hammer Curl', 1, '8', 0, 'arms'],
      ]},
      { name: 'Legs', day: 'Sat', focus: 'HIT', ex: [
        ['Leg Extension', 1, '10-12', 0, 'quads'],
        ['Squat', 1, '8', 90, 'quads'],
        ['Leg Press', 1, '12', 0, 'quads'],
        ['Leg Curl', 1, '10', 0, 'hamstrings'],
      ]},
    ],
  },

  // ---- BEGINNER ----
  {
    id: 'starting-strength',
    name: 'Starting Strength',
    author: 'Mark Rippetoe',
    description: 'Linear-progression program for novices. 3 days a week, two simple alternating workouts.',
    category: 'beginner',
    level: 'beginner',
    tags: ['novice', 'linear', 'simple'],
    duration: 8,
    baseVolume: 50,
    baseIntensity: 75,
    progression: 'linear',
    template: [
      { name: 'Workout A', day: 'Mon', focus: 'Squat / Bench / DL', ex: [
        ['Squat', 3, '5', 75, 'quads'],
        ['Bench Press', 3, '5', 75, 'chest'],
        ['Deadlift', 1, '5', 80, 'back'],
      ]},
      { name: 'Workout B', day: 'Wed', focus: 'Squat / OHP / Pull', ex: [
        ['Squat', 3, '5', 75, 'quads'],
        ['Overhead Press', 3, '5', 75, 'shoulders'],
        ['Power Clean', 5, '3', 70, 'back'],
      ]},
      { name: 'Workout A', day: 'Fri', focus: 'Squat / Bench / DL', ex: [
        ['Squat', 3, '5', 75, 'quads'],
        ['Bench Press', 3, '5', 75, 'chest'],
        ['Deadlift', 1, '5', 80, 'back'],
      ]},
    ],
  },
  {
    id: 'stronglifts',
    name: 'StrongLifts 5x5',
    author: 'Mehdi Hadim',
    description: 'Five compound lifts, 5 sets of 5, three times a week with linear progression.',
    category: 'beginner',
    level: 'beginner',
    tags: ['novice', '5x5', 'linear'],
    duration: 12,
    baseVolume: 65,
    baseIntensity: 75,
    progression: 'linear',
    template: [
      { name: 'Workout A', day: 'Mon', focus: 'Squat / Bench / Row', ex: [
        ['Squat', 5, '5', 75, 'quads'],
        ['Bench Press', 5, '5', 75, 'chest'],
        ['Pendlay Row', 5, '5', 75, 'back'],
      ]},
      { name: 'Workout B', day: 'Wed', focus: 'Squat / OHP / DL', ex: [
        ['Squat', 5, '5', 75, 'quads'],
        ['Overhead Press', 5, '5', 75, 'shoulders'],
        ['Deadlift', 1, '5', 80, 'back'],
      ]},
      { name: 'Workout A', day: 'Fri', focus: 'Squat / Bench / Row', ex: [
        ['Squat', 5, '5', 75, 'quads'],
        ['Bench Press', 5, '5', 75, 'chest'],
        ['Pendlay Row', 5, '5', 75, 'back'],
      ]},
    ],
  },
  {
    id: 'gzclp',
    name: 'GZCLP',
    author: 'Cody Lefever',
    description: 'Linear progression flavored by Cody Lefever\'s GZCL method. Tier 1/2/3 structure.',
    category: 'beginner',
    level: 'beginner',
    tags: ['gzcl', 'tiered', 'linear'],
    duration: 10,
    baseVolume: 70,
    baseIntensity: 75,
    progression: 'linear',
    template: [
      { name: 'A1 Squat / Bench', day: 'Mon', focus: 'T1 + T2', ex: [
        ['Squat', 5, '3', 85, 'quads'],
        ['Bench Press', 3, '10', 65, 'chest'],
        ['Lat Pulldown', 3, '15', 0, 'back'],
      ]},
      { name: 'B1 OHP / DL', day: 'Tue', focus: 'T1 + T2', ex: [
        ['Overhead Press', 5, '3', 85, 'shoulders'],
        ['Deadlift', 3, '10', 65, 'back'],
        ['Cable Row', 3, '15', 0, 'back'],
      ]},
      { name: 'A2 Bench / Squat', day: 'Thu', focus: 'T1 + T2', ex: [
        ['Bench Press', 5, '3', 85, 'chest'],
        ['Squat', 3, '10', 65, 'quads'],
        ['Lat Pulldown', 3, '15', 0, 'back'],
      ]},
      { name: 'B2 DL / OHP', day: 'Fri', focus: 'T1 + T2', ex: [
        ['Deadlift', 5, '3', 85, 'back'],
        ['Overhead Press', 3, '10', 65, 'shoulders'],
        ['Cable Row', 3, '15', 0, 'back'],
      ]},
    ],
  },
  {
    id: 'greyskull',
    name: 'Greyskull LP',
    author: 'John Sheaffer',
    description: 'Beginner LP with AMRAP last set + frequent OHP. Adds curls and rows for arm size.',
    category: 'beginner',
    level: 'beginner',
    tags: ['novice', 'amrap', 'linear'],
    duration: 10,
    baseVolume: 55,
    baseIntensity: 75,
    progression: 'linear',
    template: [
      { name: 'Workout A', day: 'Mon', focus: 'Push + Squat', ex: [
        ['Bench Press', 2, '5+', 80, 'chest'],
        ['Squat', 2, '5+', 80, 'quads'],
        ['Curl', 3, '8', 0, 'arms'],
      ]},
      { name: 'Workout B', day: 'Wed', focus: 'OHP + DL', ex: [
        ['Overhead Press', 2, '5+', 80, 'shoulders'],
        ['Deadlift', 1, '5+', 85, 'back'],
        ['Pull-Up', 3, '8', 0, 'back'],
      ]},
      { name: 'Workout A', day: 'Fri', focus: 'Push + Squat', ex: [
        ['Bench Press', 2, '5+', 80, 'chest'],
        ['Squat', 2, '5+', 80, 'quads'],
        ['Curl', 3, '8', 0, 'arms'],
      ]},
    ],
  },
  {
    id: 'ivysaur',
    name: 'Ivysaur 4-4-8',
    author: 'Ivysaur',
    description: 'Beginner 3-day program with multiple rep ranges per lift to teach pacing and pushes.',
    category: 'beginner',
    level: 'beginner',
    tags: ['novice', 'rep-range', 'linear'],
    duration: 10,
    baseVolume: 70,
    baseIntensity: 73,
    progression: 'linear',
    template: [
      { name: 'Day A', day: 'Mon', focus: 'Squat / Bench / DL', ex: [
        ['Squat', 3, '5', 75, 'quads'],
        ['Bench Press', 3, '5', 75, 'chest'],
        ['Deadlift', 1, '5', 80, 'back'],
        ['Bent Row', 3, '8', 0, 'back'],
      ]},
      { name: 'Day B', day: 'Wed', focus: 'OHP / Squat / Pull', ex: [
        ['Overhead Press', 3, '5', 75, 'shoulders'],
        ['Squat', 3, '8', 65, 'quads'],
        ['Pull-Up', 4, '6', 0, 'back'],
      ]},
      { name: 'Day C', day: 'Fri', focus: 'Mixed', ex: [
        ['Bench Press', 3, '8', 65, 'chest'],
        ['Squat', 1, '5', 80, 'quads'],
        ['Bent Row', 3, '8', 0, 'back'],
        ['Curl', 3, '10', 0, 'arms'],
      ]},
    ],
  },

  // ---- HYBRID / ATHLETIC ----
  {
    id: 'tactical-barbell',
    name: 'Tactical Barbell',
    author: 'K. Black',
    description: 'Strength + conditioning hybrid for tactical athletes. Cluster sets and Z-conditioning.',
    category: 'hybrid',
    level: 'intermediate',
    tags: ['tactical', 'hybrid', 'conditioning'],
    duration: 6,
    baseVolume: 75,
    baseIntensity: 80,
    progression: 'wave',
    template: [
      { name: 'Strength A', day: 'Mon', focus: 'Cluster Strength', ex: [
        ['Bench Press', 3, '5', 80, 'chest'],
        ['Squat', 3, '5', 80, 'quads'],
        ['Pull-Up', 5, '5', 0, 'back'],
      ]},
      { name: 'Conditioning', day: 'Tue', focus: 'Aerobic', ex: [
        ['Easy Run', 1, '40min', 0, 'conditioning'],
      ]},
      { name: 'Strength B', day: 'Thu', focus: 'Cluster Strength', ex: [
        ['Deadlift', 3, '5', 80, 'back'],
        ['Overhead Press', 3, '5', 80, 'shoulders'],
        ['Dip', 5, '5', 0, 'arms'],
      ]},
      { name: 'Conditioning', day: 'Fri', focus: 'HIIT', ex: [
        ['Hill Sprints', 8, '30s', 0, 'conditioning'],
      ]},
      { name: 'Long', day: 'Sat', focus: 'LISS', ex: [
        ['Long Run', 1, '60min', 0, 'conditioning'],
      ]},
    ],
  },
  {
    id: 'hybrid-athlete',
    name: 'Hybrid Athlete',
    author: 'Nick Bare',
    description: 'Concurrent training program — lift heavy 4 days, run 4 days. Build endurance and strength.',
    category: 'hybrid',
    level: 'advanced',
    tags: ['hybrid', 'running', 'concurrent'],
    duration: 8,
    baseVolume: 80,
    baseIntensity: 75,
    progression: 'block',
    template: [
      { name: 'Lower + Run', day: 'Mon', focus: 'Squat + Easy 5K', ex: [
        ['Squat', 5, '5', 80, 'quads'],
        ['RDL', 3, '8', 70, 'hamstrings'],
        ['Easy 5K', 1, '5K', 0, 'conditioning'],
      ]},
      { name: 'Tempo Run', day: 'Tue', focus: 'Aerobic Threshold', ex: [
        ['Tempo Run', 1, '8K', 0, 'conditioning'],
      ]},
      { name: 'Upper + Run', day: 'Wed', focus: 'Bench + Easy 5K', ex: [
        ['Bench Press', 5, '5', 80, 'chest'],
        ['Pull-Up', 5, '8', 0, 'back'],
        ['Easy 5K', 1, '5K', 0, 'conditioning'],
      ]},
      { name: 'Intervals', day: 'Thu', focus: 'VO2', ex: [
        ['400m Repeats', 8, '400m', 0, 'conditioning'],
      ]},
      { name: 'Lower Volume', day: 'Fri', focus: 'Posterior', ex: [
        ['Deadlift', 4, '5', 80, 'back'],
        ['Front Squat', 3, '8', 65, 'quads'],
        ['Walking Lunge', 3, '12', 0, 'glutes'],
      ]},
      { name: 'Long Run', day: 'Sat', focus: 'Long Slow Distance', ex: [
        ['Long Run', 1, '15K', 0, 'conditioning'],
      ]},
      { name: 'Upper Volume', day: 'Sun', focus: 'Push / Pull', ex: [
        ['Overhead Press', 4, '8', 70, 'shoulders'],
        ['Bent Row', 4, '8', 70, 'back'],
        ['DB Curl', 3, '12', 0, 'arms'],
      ]},
    ],
  },
  {
    id: 'crossfit-mainsite',
    name: 'CrossFit Mainsite',
    author: 'CrossFit HQ',
    description: 'Daily varied WODs blending Olympic lifts, gymnastics and metcons. Constantly varied.',
    category: 'conditioning',
    level: 'intermediate',
    tags: ['metcon', 'varied', 'crossfit'],
    duration: 6,
    baseVolume: 85,
    baseIntensity: 75,
    progression: 'flat',
    template: [
      { name: 'WOD 1', day: 'Mon', focus: 'Strength + Metcon', ex: [
        ['Power Clean', 5, '3', 80, 'back'],
        ['Pull-Up', 5, '10', 0, 'back'],
        ['Box Jump', 5, '10', 0, 'conditioning'],
      ]},
      { name: 'WOD 2', day: 'Tue', focus: 'Long Metcon', ex: [
        ['Thruster', 5, '15', 0, 'shoulders'],
        ['Burpee', 5, '15', 0, 'conditioning'],
        ['Row', 5, '500m', 0, 'conditioning'],
      ]},
      { name: 'WOD 3', day: 'Wed', focus: 'Skill', ex: [
        ['Snatch', 6, '2', 75, 'back'],
        ['Handstand Pushup', 5, '6', 0, 'shoulders'],
      ]},
      { name: 'WOD 4', day: 'Fri', focus: 'AMRAP', ex: [
        ['Deadlift', 5, '10', 70, 'back'],
        ['Wall Ball', 5, '20', 0, 'conditioning'],
        ['Double-Under', 5, '50', 0, 'conditioning'],
      ]},
      { name: 'WOD 5', day: 'Sat', focus: 'Hero WOD', ex: [
        ['Run', 1, '1mi', 0, 'conditioning'],
        ['Pull-Up', 1, '100', 0, 'back'],
        ['Push-Up', 1, '200', 0, 'chest'],
        ['Air Squat', 1, '300', 0, 'quads'],
      ]},
    ],
  },
  {
    id: 'wendler-triumvirate',
    name: '5/3/1 Triumvirate',
    author: 'Jim Wendler',
    description: 'Minimalist 5/3/1 with two assistance lifts per main day. Perfect for time-crunched lifters.',
    category: 'strength',
    level: 'intermediate',
    tags: ['minimal', 'wendler', 'efficient'],
    duration: 4,
    baseVolume: 60,
    baseIntensity: 78,
    progression: 'wave',
    template: [
      { name: 'Press', day: 'Mon', focus: 'OHP', ex: [
        ['Overhead Press', 3, '5/3/1+', 80, 'shoulders'],
        ['Dip', 5, '15', 0, 'arms'],
        ['Chin-Up', 5, '10', 0, 'back'],
      ]},
      { name: 'Deadlift', day: 'Tue', focus: 'Pull', ex: [
        ['Deadlift', 3, '5/3/1+', 80, 'back'],
        ['Good Morning', 5, '10', 60, 'hamstrings'],
        ['Hanging Leg Raise', 5, '15', 0, 'core'],
      ]},
      { name: 'Bench', day: 'Thu', focus: 'Bench', ex: [
        ['Bench Press', 3, '5/3/1+', 80, 'chest'],
        ['DB Bench', 5, '15', 0, 'chest'],
        ['DB Row', 5, '10', 0, 'back'],
      ]},
      { name: 'Squat', day: 'Fri', focus: 'Squat', ex: [
        ['Squat', 3, '5/3/1+', 80, 'quads'],
        ['Leg Press', 5, '15', 0, 'quads'],
        ['Leg Curl', 5, '10', 0, 'hamstrings'],
      ]},
    ],
  },

  // ---- OLYMPIC ----
  {
    id: 'catalyst',
    name: 'Catalyst Athletics',
    author: 'Greg Everett',
    description: 'Olympic weightlifting cycle prioritizing snatch / clean & jerk + supporting strength.',
    category: 'olympic',
    level: 'advanced',
    tags: ['olympic', 'snatch', 'clean'],
    duration: 6,
    baseVolume: 80,
    baseIntensity: 78,
    progression: 'taper',
    template: [
      { name: 'Snatch', day: 'Mon', focus: 'Olympic', ex: [
        ['Snatch', 6, '2', 78, 'back'],
        ['Snatch Pull', 4, '3', 85, 'back'],
        ['Squat', 4, '3', 80, 'quads'],
      ]},
      { name: 'Clean & Jerk', day: 'Tue', focus: 'Olympic', ex: [
        ['Clean & Jerk', 6, '1+1', 78, 'back'],
        ['Front Squat', 5, '3', 80, 'quads'],
        ['Push Press', 4, '3', 75, 'shoulders'],
      ]},
      { name: 'Snatch Tech', day: 'Thu', focus: 'Technique', ex: [
        ['Snatch Pull from Block', 5, '2', 80, 'back'],
        ['Hang Snatch', 5, '2', 70, 'back'],
        ['Squat', 4, '5', 75, 'quads'],
      ]},
      { name: 'Clean Tech', day: 'Fri', focus: 'Technique', ex: [
        ['Hang Clean', 5, '2', 75, 'back'],
        ['Push Jerk', 5, '2', 75, 'shoulders'],
        ['Front Squat', 4, '4', 75, 'quads'],
      ]},
      { name: 'Heavy Day', day: 'Sat', focus: 'Test', ex: [
        ['Snatch', 5, '1', 88, 'back'],
        ['Clean & Jerk', 5, '1', 88, 'back'],
        ['Squat', 3, '3', 85, 'quads'],
      ]},
    ],
  },
  {
    id: 'bulgarian',
    name: 'Bulgarian Method',
    author: 'Ivan Abadjiev',
    description: 'Maximum-attempt Olympic lifts daily. Brutal, frequent, unforgiving.',
    category: 'olympic',
    level: 'advanced',
    tags: ['max-effort', 'olympic', 'brutal'],
    duration: 4,
    baseVolume: 60,
    baseIntensity: 92,
    progression: 'flat',
    template: [
      { name: 'Max', day: 'Mon', focus: 'Daily Max', ex: [
        ['Snatch', 1, '1', 95, 'back'],
        ['Clean & Jerk', 1, '1', 95, 'back'],
        ['Front Squat', 1, '1', 95, 'quads'],
      ]},
      { name: 'Max', day: 'Tue', focus: 'Daily Max', ex: [
        ['Snatch', 1, '1', 95, 'back'],
        ['Clean & Jerk', 1, '1', 95, 'back'],
        ['Front Squat', 1, '1', 95, 'quads'],
      ]},
      { name: 'Max', day: 'Wed', focus: 'Daily Max', ex: [
        ['Snatch', 1, '1', 95, 'back'],
        ['Clean & Jerk', 1, '1', 95, 'back'],
        ['Front Squat', 1, '1', 95, 'quads'],
      ]},
      { name: 'Max', day: 'Thu', focus: 'Daily Max', ex: [
        ['Snatch', 1, '1', 95, 'back'],
        ['Clean & Jerk', 1, '1', 95, 'back'],
        ['Front Squat', 1, '1', 95, 'quads'],
      ]},
      { name: 'Max', day: 'Fri', focus: 'Daily Max', ex: [
        ['Snatch', 1, '1', 95, 'back'],
        ['Clean & Jerk', 1, '1', 95, 'back'],
        ['Front Squat', 1, '1', 95, 'quads'],
      ]},
      { name: 'Max', day: 'Sat', focus: 'Daily Max', ex: [
        ['Snatch', 1, '1', 95, 'back'],
        ['Clean & Jerk', 1, '1', 95, 'back'],
        ['Front Squat', 1, '1', 95, 'quads'],
      ]},
    ],
  },
  {
    id: 'russian-squat',
    name: 'Russian Squat Routine',
    author: 'Soviet Sport Sci',
    description: '6-week squat specialization with planned intensity ladder. Adds 25–40 lb to a 1RM.',
    category: 'powerlifting',
    level: 'advanced',
    tags: ['squat', 'specialization', 'russian'],
    duration: 6,
    baseVolume: 85,
    baseIntensity: 82,
    progression: 'taper',
    template: [
      { name: 'Squat A', day: 'Mon', focus: 'Squat', ex: [
        ['Squat', 6, '2', 80, 'quads'],
        ['Front Squat', 3, '5', 65, 'quads'],
      ]},
      { name: 'Squat B', day: 'Wed', focus: 'Squat', ex: [
        ['Squat', 6, '3', 80, 'quads'],
        ['Hip Thrust', 3, '8', 0, 'glutes'],
      ]},
      { name: 'Squat C', day: 'Fri', focus: 'Squat', ex: [
        ['Squat', 6, '2', 80, 'quads'],
        ['Walking Lunge', 3, '10', 0, 'glutes'],
      ]},
    ],
  },
  {
    id: 'korte-3x3',
    name: 'Korte 3x3',
    author: 'Stephan Korte',
    description: '12-week bench/squat focused cycle alternating volume and intensity blocks.',
    category: 'powerlifting',
    level: 'advanced',
    tags: ['classic', 'bench', 'specialization'],
    duration: 8,
    baseVolume: 90,
    baseIntensity: 78,
    progression: 'block',
    template: [
      { name: 'Volume', day: 'Mon', focus: 'Bench / Squat', ex: [
        ['Bench Press', 8, '8', 60, 'chest'],
        ['Squat', 8, '8', 60, 'quads'],
      ]},
      { name: 'Volume', day: 'Wed', focus: 'Bench / Squat', ex: [
        ['Bench Press', 8, '8', 60, 'chest'],
        ['Squat', 8, '8', 60, 'quads'],
      ]},
      { name: 'Volume', day: 'Fri', focus: 'Bench / Squat', ex: [
        ['Bench Press', 8, '8', 60, 'chest'],
        ['Squat', 8, '8', 60, 'quads'],
      ]},
    ],
  },
  {
    id: 'coan-deadlift',
    name: 'Coan / Phillipi Deadlift',
    author: 'Ed Coan',
    description: '10-week deadlift specialization to add 50+ lb to a competition pull.',
    category: 'powerlifting',
    level: 'advanced',
    tags: ['deadlift', 'specialization', 'coan'],
    duration: 8,
    baseVolume: 80,
    baseIntensity: 82,
    progression: 'taper',
    template: [
      { name: 'Deadlift', day: 'Mon', focus: 'Pull', ex: [
        ['Deadlift', 5, '5', 75, 'back'],
        ['Stiff-Leg DL', 4, '6', 65, 'hamstrings'],
        ['Bent Row', 4, '8', 0, 'back'],
      ]},
      { name: 'Squat', day: 'Wed', focus: 'Lower', ex: [
        ['Squat', 4, '5', 80, 'quads'],
        ['Front Squat', 3, '8', 0, 'quads'],
        ['Hyperextension', 3, '10', 0, 'hamstrings'],
      ]},
      { name: 'Bench', day: 'Fri', focus: 'Push', ex: [
        ['Bench Press', 4, '5', 80, 'chest'],
        ['Close-Grip Bench', 3, '8', 0, 'arms'],
      ]},
    ],
  },
  {
    id: 'sheiko-37',
    name: 'Sheiko #37',
    author: 'Boris Sheiko',
    description: 'Classic Russian intermediate-advanced volume cycle with 4 sessions/week.',
    category: 'powerlifting',
    level: 'advanced',
    tags: ['russian', 'volume', 'powerlifting'],
    duration: 4,
    baseVolume: 95,
    baseIntensity: 75,
    progression: 'wave',
    template: [
      { name: 'Squat / Bench', day: 'Mon', focus: 'Mixed', ex: [
        ['Squat', 5, '5', 75, 'quads'],
        ['Bench Press', 6, '4', 75, 'chest'],
        ['Deadlift', 4, '4', 70, 'back'],
      ]},
      { name: 'Bench Volume', day: 'Tue', focus: 'Push', ex: [
        ['Bench Press', 6, '5', 70, 'chest'],
        ['Incline Bench', 4, '6', 0, 'chest'],
        ['Row', 4, '8', 0, 'back'],
      ]},
      { name: 'Squat / Pull', day: 'Thu', focus: 'Lower', ex: [
        ['Squat', 5, '4', 80, 'quads'],
        ['Deadlift', 4, '3', 75, 'back'],
        ['Good Morning', 3, '6', 0, 'hamstrings'],
      ]},
      { name: 'Bench Heavy', day: 'Sat', focus: 'Push', ex: [
        ['Bench Press', 5, '3', 80, 'chest'],
        ['Pause Bench', 4, '4', 70, 'chest'],
        ['Press', 4, '5', 65, 'shoulders'],
      ]},
    ],
  },
];

// =============================================================================
// Build & export
// =============================================================================

export const programs: Program[] = SPECS.map(buildProgram);

export const PROGRAM_CATEGORIES: { id: ProgramCategory; label: string }[] = [
  { id: 'powerlifting', label: 'Powerlifting' },
  { id: 'strength', label: 'Strength' },
  { id: 'hypertrophy', label: 'Hypertrophy' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'olympic', label: 'Olympic' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'conditioning', label: 'Conditioning' },
];

export const PROGRAM_LEVELS: { id: ProgramLevel; label: string }[] = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

// =============================================================================
// Calculations
// =============================================================================

export function calculateMetrics(
  program: Program,
  volumeMod: number,
  intensityMod: number,
  frequencyMod: number,
  sandbox: SandboxState
): SimulationMetrics {
  const baseFatigue =
    (program.baseVolume * (volumeMod / 100) * 0.5 +
      program.baseIntensity * (intensityMod / 100) * 0.4 +
      frequencyMod * 8) /
    1.4;

  const sleepEffect = (8 - sandbox.sleep) * 5;
  const sorenessEffect = sandbox.soreness * 4;
  const recoveryEffect = (100 - sandbox.recovery) * 0.4;

  const fatigueScore = Math.min(
    100,
    Math.max(0, baseFatigue + sleepEffect + sorenessEffect + recoveryEffect - 20)
  );

  let progressBase =
    program.baseVolume * 0.3 + program.baseIntensity * 0.4 + frequencyMod * 5;
  progressBase = progressBase * (volumeMod / 100) * (intensityMod / 100);

  const progressFactor =
    sandbox.recentProgress === 'fast'
      ? 1.3
      : sandbox.recentProgress === 'normal'
        ? 1.0
        : sandbox.recentProgress === 'slow'
          ? 0.7
          : 0.4;

  const goalAlignment =
    sandbox.goal === 'strength' && intensityMod > 100
      ? 1.15
      : sandbox.goal === 'hypertrophy' && volumeMod > 100
        ? 1.15
        : sandbox.goal === 'balanced'
          ? 1.05
          : 0.9;

  const recoveryBonus = sandbox.recovery > 70 ? 1.1 : sandbox.recovery < 40 ? 0.7 : 1.0;
  const progressScore = Math.min(
    100,
    Math.max(0, progressBase * progressFactor * goalAlignment * recoveryBonus * 0.6)
  );

  let plateauRisk = 30;
  if (sandbox.recentProgress === 'stalled') plateauRisk += 30;
  if (sandbox.recentProgress === 'slow') plateauRisk += 15;
  if (volumeMod < 90) plateauRisk += 10;
  if (intensityMod < 90) plateauRisk += 10;
  if (fatigueScore > 70) plateauRisk += 15;
  if (sandbox.recovery < 40) plateauRisk += 10;
  plateauRisk = Math.min(100, Math.max(0, plateauRisk));

  let adherence = (volumeMod / 100) * 30 + frequencyMod * 6;
  adherence += sandbox.soreness * 3;
  if (sandbox.sleep < 7) adherence += 10;
  if (program.daysPerWeek >= 6) adherence += 12;
  adherence = Math.min(100, Math.max(0, adherence));

  return {
    fatigueScore: Math.round(fatigueScore),
    progressScore: Math.round(progressScore),
    plateauRisk: Math.round(plateauRisk),
    adherenceDifficulty: Math.round(adherence),
  };
}

export function calculateDiff(
  original: SimulationMetrics,
  modified: SimulationMetrics
): ProgramDiff {
  return {
    volumeChange: modified.fatigueScore - original.fatigueScore,
    intensityChange: modified.progressScore - original.progressScore,
    frequencyChange: modified.adherenceDifficulty - original.adherenceDifficulty,
    riskChange: modified.plateauRisk - original.plateauRisk,
  };
}

export function generateRecommendations(
  metrics: SimulationMetrics,
  sandbox: SandboxState
): Recommendation[] {
  const out: Recommendation[] = [];

  if (metrics.fatigueScore > 75) {
    out.push({
      id: 'fatigue-high',
      type: 'warning',
      title: 'Fatigue trending high',
      description: 'Drop volume 10–15% or insert a deload to protect recovery.',
      impact: 'high',
      metric: 'fatigue',
    });
  }
  if (metrics.plateauRisk > 60) {
    out.push({
      id: 'plateau-risk',
      type: 'optimization',
      title: 'Plateau risk elevated',
      description: 'Wave intensity up 5–10% or rotate variations to disrupt staleness.',
      impact: 'high',
      metric: 'plateau',
    });
  }
  if (metrics.progressScore > 75 && metrics.fatigueScore < 60) {
    out.push({
      id: 'sweet-spot',
      type: 'success',
      title: 'In the productive zone',
      description: 'Strong stimulus, fatigue under control. Hold this load for the block.',
      impact: 'high',
      metric: 'progress',
    });
  }
  if (sandbox.sleep < 6.5) {
    out.push({
      id: 'sleep-low',
      type: 'warning',
      title: 'Sleep is the bottleneck',
      description: `${sandbox.sleep}h is below the threshold for productive recovery.`,
      impact: 'high',
      metric: 'recovery',
    });
  }
  if (sandbox.recovery > 75 && metrics.progressScore < 60) {
    out.push({
      id: 'capacity-available',
      type: 'info',
      title: 'Capacity untapped',
      description: 'Recovery is high — you can push more volume or intensity.',
      impact: 'medium',
      metric: 'progress',
    });
  }
  if (metrics.adherenceDifficulty > 70) {
    out.push({
      id: 'adherence',
      type: 'warning',
      title: 'Sustainability risk',
      description: 'Demands are high. Simplify accessory work or trim a session.',
      impact: 'high',
      metric: 'adherence',
    });
  }
  return out;
}

export interface NarrativeLine {
  text: string;
  tone: 'positive' | 'neutral' | 'caution';
}

export function generateNarrative(
  metrics: SimulationMetrics,
  sandbox: SandboxState
): NarrativeLine[] {
  const out: NarrativeLine[] = [];
  if (metrics.fatigueScore > metrics.progressScore + 15) {
    out.push({ text: 'Fatigue is outpacing recovery.', tone: 'caution' });
  } else if (metrics.progressScore > metrics.fatigueScore + 10) {
    out.push({ text: 'Recovery is keeping pace with adaptation.', tone: 'positive' });
  } else {
    out.push({ text: 'Work and recovery are in equilibrium.', tone: 'neutral' });
  }
  if (metrics.plateauRisk > 55) {
    out.push({ text: 'Plateau risk rising — variation would help.', tone: 'caution' });
  } else if (metrics.progressScore > 60 && metrics.fatigueScore < 50) {
    out.push({ text: 'Progress steady, plateau risk low.', tone: 'positive' });
  }
  if (sandbox.sleep < 7) {
    out.push({ text: `Sleep at ${sandbox.sleep}h limits overnight recovery.`, tone: 'caution' });
  } else if (sandbox.sleep >= 8 && sandbox.recovery > 70) {
    out.push({ text: 'Recovery state supports a productive block.', tone: 'positive' });
  }
  if (sandbox.soreness > 6) {
    out.push({ text: "Soreness suggests yesterday's load reached threshold.", tone: 'caution' });
  }
  return out.slice(0, 4);
}

// =============================================================================
// Stress / heatmap utilities
// =============================================================================

export function dayStress(
  day: WorkoutDay,
  volumeMod: number,
  intensityMod: number
): number {
  let stress = 0;
  for (const e of day.exercises) {
    const sets = Math.max(1, e.sets * (volumeMod / 100));
    const repsNum = parseFirstNumber(e.reps) ?? 5;
    const intensity = e.intensity > 0 ? e.intensity * (intensityMod / 100) : 30;
    stress += sets * repsNum * (intensity / 100);
  }
  return stress;
}

function parseFirstNumber(s: string): number | null {
  const m = s.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

export interface DayCell {
  day: WorkoutDay['dayOfWeek'];
  workout: WorkoutDay | null;
  stress: number;
  intensityScale: number; // 0..1 for heatmap
}

export function buildWeekGrid(
  week: ProgramWeek | undefined,
  volumeMod: number,
  intensityMod: number,
  maxStress: number
): DayCell[] {
  const days: WorkoutDay['dayOfWeek'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((d) => {
    const w = week?.days.find((x) => x.dayOfWeek === d) ?? null;
    const s = w ? dayStress(w, volumeMod, intensityMod) : 0;
    return {
      day: d,
      workout: w,
      stress: s,
      intensityScale: maxStress > 0 ? Math.min(1, s / maxStress) : 0,
    };
  });
}

export function programMaxStress(
  program: Program,
  volumeMod: number,
  intensityMod: number
): number {
  let max = 0;
  for (const w of program.weeks) {
    for (const d of w.days) {
      const s = dayStress(d, volumeMod, intensityMod);
      if (s > max) max = s;
    }
  }
  return max;
}

export function muscleGroupVolume(
  program: Program,
  weekIndex: number,
  volumeMod: number,
  intensityMod: number
): Record<MuscleGroup, number> {
  const groups: MuscleGroup[] = [
    'quads', 'hamstrings', 'glutes', 'chest', 'back', 'shoulders', 'arms', 'core', 'conditioning',
  ];
  const out = Object.fromEntries(groups.map((g) => [g, 0])) as Record<MuscleGroup, number>;
  const week = program.weeks[weekIndex];
  if (!week) return out;
  for (const d of week.days) {
    for (const e of d.exercises) {
      const sets = Math.max(1, e.sets * (volumeMod / 100));
      const intensity = e.intensity > 0 ? e.intensity * (intensityMod / 100) : 30;
      out[e.group] += sets * (intensity / 100);
    }
  }
  return out;
}

export function weeklyStressSeries(
  program: Program,
  volumeMod: number,
  intensityMod: number
): { week: number; stress: number; deload: boolean }[] {
  return program.weeks.map((w) => ({
    week: w.weekNumber,
    stress: w.days.reduce((sum, d) => sum + dayStress(d, volumeMod, intensityMod), 0),
    deload: !!w.deload,
  }));
}

// =============================================================================
// Adaptation
// =============================================================================

export interface AdaptedSettings {
  volume: number;
  intensity: number;
  frequency: number;
  rationale: string;
}

export function simulateAdaptation(
  metrics: SimulationMetrics,
  sandbox: SandboxState,
  current: { volume: number; intensity: number; frequency: number }
): AdaptedSettings {
  let volume = current.volume;
  let intensity = current.intensity;
  let frequency = current.frequency;
  const reasons: string[] = [];

  if (metrics.fatigueScore > 70) {
    volume = Math.max(60, volume - 15);
    reasons.push('reduced volume');
  }
  if (metrics.plateauRisk > 60) {
    intensity = Math.min(115, intensity + 8);
    reasons.push('raised intensity');
  }
  if (metrics.progressScore < 50 && metrics.fatigueScore < 45 && sandbox.recovery > 60) {
    volume = Math.min(140, volume + 10);
    reasons.push('added stimulus');
  }
  if (metrics.adherenceDifficulty > 75 && frequency > 3) {
    frequency -= 1;
    reasons.push('lowered frequency');
  }
  if (sandbox.goal === 'strength' && intensity < 95) {
    intensity = Math.min(115, intensity + 5);
    if (!reasons.includes('raised intensity')) reasons.push('aligned to strength goal');
  }
  if (sandbox.goal === 'hypertrophy' && volume < 100) {
    volume = Math.min(130, volume + 8);
    if (!reasons.includes('added stimulus')) reasons.push('aligned to hypertrophy goal');
  }
  if (volume === current.volume && intensity === current.intensity && frequency === current.frequency) {
    intensity = Math.min(115, intensity + 3);
    reasons.push('refined intensity');
  }
  return {
    volume: Math.round(volume),
    intensity: Math.round(intensity),
    frequency,
    rationale: reasons.length > 0 ? reasons.join(' · ') : 'no changes needed',
  };
}

export function describeAdjustment(
  control: 'volume' | 'intensity' | 'frequency' | 'sleep' | 'soreness' | 'recovery',
  delta: number
): string {
  const up = delta > 0;
  switch (control) {
    case 'volume':
      return up ? 'Volume up — fatigue accumulates' : 'Volume down — recovery improves';
    case 'intensity':
      return up ? 'Intensity up — strength stimulus' : 'Intensity down — easier on joints';
    case 'frequency':
      return up ? 'Added training day' : 'Fewer sessions — more rest';
    case 'sleep':
      return up ? 'Better sleep — recovery climbs' : 'Less sleep — fatigue compounds';
    case 'soreness':
      return up ? 'Higher soreness — adherence risk' : 'Less soreness — system fresher';
    case 'recovery':
      return up ? 'Recovery rising' : 'Recovery dipping';
  }
}

// =============================================================================
// Defaults
// =============================================================================

export const defaultSandbox: SandboxState = {
  sleep: 7.5,
  soreness: 3,
  recovery: 70,
  recentProgress: 'normal',
  goal: 'balanced',
};

// =============================================================================
// Exercise library (for the custom program builder picker)
// =============================================================================

export interface LibraryExercise {
  name: string;
  group: MuscleGroup;
  defaultSets: number;
  defaultReps: string;
  defaultIntensity: number;
  family: 'squat' | 'hinge' | 'push' | 'pull' | 'olympic' | 'arms' | 'core' | 'conditioning';
}

export const EXERCISE_LIBRARY: LibraryExercise[] = [
  // Squat
  { name: 'Back Squat', group: 'quads', defaultSets: 4, defaultReps: '5', defaultIntensity: 80, family: 'squat' },
  { name: 'Front Squat', group: 'quads', defaultSets: 4, defaultReps: '5', defaultIntensity: 75, family: 'squat' },
  { name: 'High-Bar Squat', group: 'quads', defaultSets: 4, defaultReps: '5', defaultIntensity: 78, family: 'squat' },
  { name: 'Low-Bar Squat', group: 'quads', defaultSets: 4, defaultReps: '5', defaultIntensity: 82, family: 'squat' },
  { name: 'Pause Squat', group: 'quads', defaultSets: 3, defaultReps: '5', defaultIntensity: 75, family: 'squat' },
  { name: 'Box Squat', group: 'quads', defaultSets: 4, defaultReps: '5', defaultIntensity: 75, family: 'squat' },
  { name: 'Bulgarian Split Squat', group: 'quads', defaultSets: 3, defaultReps: '8-10', defaultIntensity: 0, family: 'squat' },
  { name: 'Goblet Squat', group: 'quads', defaultSets: 3, defaultReps: '10', defaultIntensity: 0, family: 'squat' },
  { name: 'Walking Lunge', group: 'quads', defaultSets: 3, defaultReps: '12', defaultIntensity: 0, family: 'squat' },
  { name: 'Leg Press', group: 'quads', defaultSets: 3, defaultReps: '10-12', defaultIntensity: 0, family: 'squat' },
  // Hinge
  { name: 'Conventional Deadlift', group: 'hamstrings', defaultSets: 3, defaultReps: '5', defaultIntensity: 82, family: 'hinge' },
  { name: 'Sumo Deadlift', group: 'hamstrings', defaultSets: 3, defaultReps: '5', defaultIntensity: 80, family: 'hinge' },
  { name: 'Romanian Deadlift', group: 'hamstrings', defaultSets: 3, defaultReps: '8', defaultIntensity: 70, family: 'hinge' },
  { name: 'Stiff-Leg Deadlift', group: 'hamstrings', defaultSets: 3, defaultReps: '8', defaultIntensity: 65, family: 'hinge' },
  { name: 'Trap-Bar Deadlift', group: 'hamstrings', defaultSets: 3, defaultReps: '5', defaultIntensity: 78, family: 'hinge' },
  { name: 'Good Morning', group: 'hamstrings', defaultSets: 3, defaultReps: '8', defaultIntensity: 60, family: 'hinge' },
  { name: 'Hip Thrust', group: 'glutes', defaultSets: 3, defaultReps: '8-10', defaultIntensity: 70, family: 'hinge' },
  { name: 'Glute Ham Raise', group: 'glutes', defaultSets: 3, defaultReps: '8-10', defaultIntensity: 0, family: 'hinge' },
  // Push
  { name: 'Bench Press', group: 'chest', defaultSets: 4, defaultReps: '5', defaultIntensity: 80, family: 'push' },
  { name: 'Incline Bench Press', group: 'chest', defaultSets: 4, defaultReps: '6-8', defaultIntensity: 75, family: 'push' },
  { name: 'Close-Grip Bench Press', group: 'chest', defaultSets: 3, defaultReps: '6-8', defaultIntensity: 75, family: 'push' },
  { name: 'Pause Bench Press', group: 'chest', defaultSets: 3, defaultReps: '5', defaultIntensity: 75, family: 'push' },
  { name: 'Floor Press', group: 'chest', defaultSets: 3, defaultReps: '5-8', defaultIntensity: 75, family: 'push' },
  { name: 'Dumbbell Bench Press', group: 'chest', defaultSets: 3, defaultReps: '8-10', defaultIntensity: 0, family: 'push' },
  { name: 'Dumbbell Incline Press', group: 'chest', defaultSets: 3, defaultReps: '8-10', defaultIntensity: 0, family: 'push' },
  { name: 'Cable Fly', group: 'chest', defaultSets: 3, defaultReps: '12-15', defaultIntensity: 0, family: 'push' },
  { name: 'Push-Up', group: 'chest', defaultSets: 3, defaultReps: 'AMRAP', defaultIntensity: 0, family: 'push' },
  { name: 'Overhead Press', group: 'shoulders', defaultSets: 4, defaultReps: '5', defaultIntensity: 75, family: 'push' },
  { name: 'Push Press', group: 'shoulders', defaultSets: 4, defaultReps: '3-5', defaultIntensity: 80, family: 'push' },
  { name: 'Dumbbell Shoulder Press', group: 'shoulders', defaultSets: 3, defaultReps: '8-10', defaultIntensity: 0, family: 'push' },
  { name: 'Lateral Raise', group: 'shoulders', defaultSets: 3, defaultReps: '12-15', defaultIntensity: 0, family: 'push' },
  { name: 'Dip', group: 'chest', defaultSets: 3, defaultReps: '8-10', defaultIntensity: 0, family: 'push' },
  // Pull
  { name: 'Pull-Up', group: 'back', defaultSets: 3, defaultReps: '6-10', defaultIntensity: 0, family: 'pull' },
  { name: 'Chin-Up', group: 'back', defaultSets: 3, defaultReps: '6-10', defaultIntensity: 0, family: 'pull' },
  { name: 'Barbell Row', group: 'back', defaultSets: 4, defaultReps: '5-8', defaultIntensity: 70, family: 'pull' },
  { name: 'Pendlay Row', group: 'back', defaultSets: 4, defaultReps: '5', defaultIntensity: 70, family: 'pull' },
  { name: 'Dumbbell Row', group: 'back', defaultSets: 3, defaultReps: '8-10', defaultIntensity: 0, family: 'pull' },
  { name: 'T-Bar Row', group: 'back', defaultSets: 3, defaultReps: '8-10', defaultIntensity: 0, family: 'pull' },
  { name: 'Cable Row', group: 'back', defaultSets: 3, defaultReps: '10-12', defaultIntensity: 0, family: 'pull' },
  { name: 'Lat Pulldown', group: 'back', defaultSets: 3, defaultReps: '10-12', defaultIntensity: 0, family: 'pull' },
  { name: 'Face Pull', group: 'shoulders', defaultSets: 3, defaultReps: '15', defaultIntensity: 0, family: 'pull' },
  { name: 'Rear Delt Fly', group: 'shoulders', defaultSets: 3, defaultReps: '12-15', defaultIntensity: 0, family: 'pull' },
  // Olympic
  { name: 'Power Clean', group: 'back', defaultSets: 5, defaultReps: '3', defaultIntensity: 75, family: 'olympic' },
  { name: 'Clean', group: 'back', defaultSets: 5, defaultReps: '2', defaultIntensity: 80, family: 'olympic' },
  { name: 'Power Snatch', group: 'back', defaultSets: 5, defaultReps: '2', defaultIntensity: 75, family: 'olympic' },
  { name: 'Snatch', group: 'back', defaultSets: 5, defaultReps: '2', defaultIntensity: 80, family: 'olympic' },
  { name: 'Clean & Jerk', group: 'back', defaultSets: 5, defaultReps: '1+1', defaultIntensity: 80, family: 'olympic' },
  { name: 'Push Jerk', group: 'shoulders', defaultSets: 4, defaultReps: '3', defaultIntensity: 80, family: 'olympic' },
  { name: 'Hang Clean', group: 'back', defaultSets: 4, defaultReps: '3', defaultIntensity: 70, family: 'olympic' },
  { name: 'Hang Snatch', group: 'back', defaultSets: 4, defaultReps: '3', defaultIntensity: 70, family: 'olympic' },
  // Arms
  { name: 'Barbell Curl', group: 'arms', defaultSets: 3, defaultReps: '8-10', defaultIntensity: 0, family: 'arms' },
  { name: 'Dumbbell Curl', group: 'arms', defaultSets: 3, defaultReps: '10-12', defaultIntensity: 0, family: 'arms' },
  { name: 'Hammer Curl', group: 'arms', defaultSets: 3, defaultReps: '10-12', defaultIntensity: 0, family: 'arms' },
  { name: 'Preacher Curl', group: 'arms', defaultSets: 3, defaultReps: '8-10', defaultIntensity: 0, family: 'arms' },
  { name: 'Tricep Pushdown', group: 'arms', defaultSets: 3, defaultReps: '10-12', defaultIntensity: 0, family: 'arms' },
  { name: 'Skull Crusher', group: 'arms', defaultSets: 3, defaultReps: '8-10', defaultIntensity: 0, family: 'arms' },
  { name: 'Overhead Tricep Extension', group: 'arms', defaultSets: 3, defaultReps: '10-12', defaultIntensity: 0, family: 'arms' },
  // Core
  { name: 'Plank', group: 'core', defaultSets: 3, defaultReps: '60s', defaultIntensity: 0, family: 'core' },
  { name: 'Hanging Leg Raise', group: 'core', defaultSets: 3, defaultReps: '8-12', defaultIntensity: 0, family: 'core' },
  { name: 'Ab Wheel', group: 'core', defaultSets: 3, defaultReps: '8-10', defaultIntensity: 0, family: 'core' },
  { name: 'Cable Crunch', group: 'core', defaultSets: 3, defaultReps: '12-15', defaultIntensity: 0, family: 'core' },
  { name: 'Pallof Press', group: 'core', defaultSets: 3, defaultReps: '10/side', defaultIntensity: 0, family: 'core' },
  // Conditioning
  { name: 'Sled Push', group: 'conditioning', defaultSets: 4, defaultReps: '40m', defaultIntensity: 0, family: 'conditioning' },
  { name: 'Farmer Carry', group: 'conditioning', defaultSets: 3, defaultReps: '40m', defaultIntensity: 0, family: 'conditioning' },
  { name: 'Air Bike', group: 'conditioning', defaultSets: 1, defaultReps: '10 min', defaultIntensity: 0, family: 'conditioning' },
  { name: 'Box Jump', group: 'conditioning', defaultSets: 4, defaultReps: '5', defaultIntensity: 0, family: 'conditioning' },
  { name: 'Rower', group: 'conditioning', defaultSets: 1, defaultReps: '2000m', defaultIntensity: 0, family: 'conditioning' },
];

export const EXERCISE_FAMILIES: { id: LibraryExercise['family']; label: string }[] = [
  { id: 'squat', label: 'Squat' },
  { id: 'hinge', label: 'Hinge' },
  { id: 'push', label: 'Push' },
  { id: 'pull', label: 'Pull' },
  { id: 'olympic', label: 'Olympic' },
  { id: 'arms', label: 'Arms' },
  { id: 'core', label: 'Core' },
  { id: 'conditioning', label: 'Conditioning' },
];

export const MUSCLE_GROUPS: { id: MuscleGroup; label: string }[] = [
  { id: 'quads', label: 'Quads' },
  { id: 'hamstrings', label: 'Hamstrings' },
  { id: 'glutes', label: 'Glutes' },
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'arms', label: 'Arms' },
  { id: 'core', label: 'Core' },
  { id: 'conditioning', label: 'Conditioning' },
];

// Builds an empty program shell for a custom program from basic metadata
export interface ProgramBasics {
  name: string;
  author: string;
  description: string;
  category: ProgramCategory;
  level: ProgramLevel;
  daysPerWeek: number;
  duration: number;
}

export function createEmptyProgram(id: string, basics: ProgramBasics): Program {
  const weeks: ProgramWeek[] = Array.from({ length: basics.duration }, (_, i) => ({
    weekNumber: i + 1,
    days: [],
    deload: false,
    intensityShift: 0,
    volumeShift: 0,
  }));
  return {
    id,
    name: basics.name,
    author: basics.author,
    description: basics.description || 'A custom program built in Workout Program Editor.',
    category: basics.category,
    level: basics.level,
    tags: ['custom'],
    duration: basics.duration,
    daysPerWeek: basics.daysPerWeek,
    weeks,
    baseVolume: 100,
    baseIntensity: 75,
    baseFrequency: basics.daysPerWeek,
  };
}
