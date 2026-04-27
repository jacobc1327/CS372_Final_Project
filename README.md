## What it does
Adaptive Training Program Studio is a browser-based strength program editor with an AI Coach. You can browse preset programs or build your own, run a guided coaching intake, generate an adjusted week plan grounded in a local knowledge base, save plans, log completed sessions, and iterate based on your history.

## Quick start
- Install dependencies:

```bash
npm install
```

- Run the app:

```bash
npm run dev
```

Open the printed localhost URL, then start from **Library → any program → Start coaching**.

## Core flows
- **Coach**: guided questions → staged “analysis” → adjusted week → save as a **Plan** → optional swaps/regenerate.
- **Log**: log sessions against your active plan at `/programs/[id]/log`.
- **Diagnose**: diagnostics dashboard at `/programs/[id]/simulate` (signals + charts + logging).
- **Plans/History**: global `/history` shows Sessions + Plans.

## Evaluation
This repo includes an offline evaluation pipeline for a ridge-style metric head:
- Export synthetic training data:

```bash
npm run eval:export
```

- Fit ridge weights + produce a quantitative report (train/val/test + lambda sweep):

```bash
npm run eval:report
```

- Run both:

```bash
npm run eval:train
```

The fitted weights are written to `lib/ai/weights.json` and can be used by `lib/ai/predict.ts` for feature→metric inference.
The evaluation report is written to `evaluation/data/report.json`.

### Retrieval ablation
The knowledge retriever supports TF‑IDF, BM25, and a hybrid scorer. You can run an offline retrieval eval:

```bash
npm run eval:retrieval
```


## Video links
- Demo video (3–5 minutes): `https://drive.google.com/file/d/14QZ4Nehwvsfe70458uUy1fx8ebIuGbm3/view?usp=sharing`
- Technical walkthrough (5–10 minutes): `https://drive.google.com/drive/u/0/folders/1lhWCh_w8jcFE0bz65dQDvTgTb2D8f3uP`

## Individual contributions
This project was completed individually by Jacob Cho.

## Repo notes
- Everything is stored locally in your browser (localStorage) for the course demo.
- The Coach uses a deterministic planning core + retrieval over `data/knowledge/` (no external API calls by default).

