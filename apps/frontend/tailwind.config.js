/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      animation: {
        marquee: "marquee 8s linear infinite",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-100%)" },
        },
      },
      colors: {
        /**
         * Neutral scale. The chrome carries no hue at all: surfaces, borders,
         * selection and text are all steps of this one ramp. Values live in
         * src/styles/tokens.css so both themes share these class names.
         */
        ui: {
          canvas: "rgb(var(--ui-canvas) / <alpha-value>)",
          surface: "rgb(var(--ui-surface) / <alpha-value>)",
          raised: "rgb(var(--ui-raised) / <alpha-value>)",
          selected: "rgb(var(--ui-selected) / <alpha-value>)",
          border: "rgb(var(--ui-border) / <alpha-value>)",
          "border-strong": "rgb(var(--ui-border-strong) / <alpha-value>)",
          text: "rgb(var(--ui-text) / <alpha-value>)",
          "text-soft": "rgb(var(--ui-text-soft) / <alpha-value>)",
          "text-mute": "rgb(var(--ui-text-mute) / <alpha-value>)",
        },
        /**
         * State colours. Reserved for the status glyph that reports what a
         * thing is doing, and for the badge that repeats it. Never a surface,
         * never body text, never an action.
         */
        state: {
          idle: "rgb(var(--state-idle) / <alpha-value>)",
          running: "rgb(var(--state-running) / <alpha-value>)",
          pending: "rgb(var(--state-pending) / <alpha-value>)",
          done: "rgb(var(--state-done) / <alpha-value>)",
          failed: "rgb(var(--state-failed) / <alpha-value>)",
        },
        /**
         * Difficulty scale. An ordinal domain scale for song difficulty, kept
         * outside the semantic palette on purpose: these hues rank a value,
         * they do not report a state.
         */
        difficulty: {
          1: "#22C55E",
          2: "#EAB308",
          3: "#F97316",
          4: "#DC2626",
          5: "#7E22CE",
        },
        /**
         * Score bands. An ordinal domain scale for the score badge, kept out of
         * the semantic palette for the same reason as the difficulty scale: it
         * ranks a result, it does not report a state. Rendered as tinted badges
         * (`bg-score-N/10 text-score-N border-score-N/25`), so every step is dark
         * enough to stay legible as small text.
         */
        score: {
          base: "#374151",
          1: "#92400E",
          2: "#065F46",
          3: "#134C77",
          4: "#6B21A8",
          failed: "#991B1B",
        },
        /**
         * Judgment colours, taken from the In The Groove palette. These are the
         * colours a player already reads off the cabinet, so they are data
         * rather than design: never align them to the semantic palette, and
         * never adjust one for contrast. Legibility is the background's job,
         * which is why the live view is rendered on `live-screen`.
         */
        judgment: {
          fantasticPlus: "#21CCE8",
          excellent: "#E29C18",
          great: "#66C955",
          decent: "#B45CFF",
          wayOff: "#C9855E",
          miss: "#FF3030",
        },
        /**
         * Live view surfaces. The judgment palette is calibrated for the near
         * black of the game screen and only holds up against a background of
         * that weight, so the live cards mirror it. Both surfaces clear 4.5:1
         * against every judgment colour; a lighter one does not.
         */
        live: {
          screen: "#0F1E2A",
          failed: "#2E0F14",
        },
      },
      zIndex: {
        dropdown: "20",
        sidebar: "50",
        modal: "9999",
        toast: "99999",
      },
    },
  },
  plugins: [],
};
