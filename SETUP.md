## Setup

### Requirements
- Node.js (recommended: current LTS)
- Python 3 (only needed for the optional ridge-fit evaluation script)

### Python deps (evaluation only)

```bash
python3 -m pip install -r requirements.txt
```

### Install

```bash
npm install
```

### Run (development)

```bash
npm run dev
```

### Run (production)

```bash
npm run build
npm run start
```

### Evaluation (optional)
Exports synthetic training data and fits/evaluates a ridge-style head (train/val/test split + lambda sweep):

```bash
npm run eval:train
```

Outputs:
- `evaluation/data/training.csv`
- `evaluation/data/report.json`
- `lib/ai/weights.json`

### Retrieval evaluation (optional)
Evaluates knowledge retrieval methods (TF‑IDF vs BM25 vs hybrid) with Recall@K + MRR:

```bash
npm run eval:retrieval
```

