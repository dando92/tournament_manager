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
         * Brand scale. A single hue (206deg) so every step reads as the same
         * colour at a different weight. See .ai/Design.md for the role each
         * step plays; do not introduce a second blue.
         */
        brand: {
          50: "#F1F8FE",
          100: "#D9EDFC",
          200: "#B6DBF7",
          300: "#84BEEB",
          400: "#50A3E2",
          500: "#1F8CE0",
          600: "#1571B7",
          700: "#135D96",
          800: "#134C77",
          900: "#153D5B",
          950: "#0F1E2A",
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
         * Judgment colours. Fixed by the StepMania/ITG convention, so they are
         * data rather than design. Never align these to the semantic palette.
         */
        judgment: {
          fantasticPlus: "#BFDBFE",
          excellent: "#FDE047",
          great: "#86EFAC",
          decent: "#F9A8D4",
          wayOff: "#FDBA74",
          miss: "#FCA5A5",
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
