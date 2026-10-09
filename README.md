# GhostTrace

**AI-powered digital identity leak and credential exposure detection.**

GhostTrace scans GitHub users, organizations and repositories (including commit history), pasted text and uploaded
projects for exposed passwords, API keys, tokens, private keys and database credentials. A trained machine-learning
model scores how likely each hit is to be a real secret and how much damage it could do, so real leaks rise to the top
and test keys and placeholders sink. Email addresses can be checked against public breach databases, targets can be
monitored continuously, and new high-risk leaks trigger email alerts.

Team: Tanmay Dabholkar, Shirshak Dange, Aayush Doke, Atharva Goim.

## Features

| Area | What it does |
| --- | --- |
| Detection | 49 rules: AWS, GCP, Azure, GitHub, GitLab, Stripe, OpenAI, Anthropic, Slack, Twilio, SendGrid, JWT, SSH/PEM keys, database URLs, hard-coded passwords, generic keys, emails and more, plus Shannon-entropy filtering |
| Sources | GitHub API (users, orgs, repos, last N commits per repo), pasted text, file and `.zip` uploads |
| AI risk scoring | Gradient-boosted classifier (scikit-learn) on 24 features: entropy, length, character mix, placeholder patterns, test/docs paths, sensitive files, history-only, rule type. Outputs confidence, a 0–100 risk score, severity and human-readable reasons |
| Breach intel | Email lookups via [XposedOrNot](https://xposedornot.com) (free) or Have I Been Pwned (with an API key); password checks via Pwned Passwords k-anonymity, so the password never leaves the server |
| Monitoring | Scheduled re-scans of GitHub targets and emails, alerting only on credentials or breaches not seen before |
| Alerts | HTML email alerts over any SMTP provider, with a per-user severity threshold |
| Dashboard | KPIs, exposure trend, severity and category breakdowns, risk distribution, most exposed repos, exposure timeline |
| Triage | Search by org/user/repo/file, filter by severity and type, mark rotated or false positive (applies to every copy of the secret) |
| Reports | PDF summary and per-scan reports, CSV export |
| Noise control | Skips code expressions (`os.getenv(...)`, variable names, f-strings), vendored libraries (anything beside a `*.dist-info` folder), licence/author files, and any line marked `ghosttrace:ignore` or `gitleaks:allow`; test and docs paths score lower |
| Privacy | Raw secrets are never stored; only a masked preview and a SHA-256 fingerprint |

## Stack

React 19 + Vite + Tailwind CSS + Chart.js · FastAPI · SQLAlchemy · PostgreSQL (SQLite for local dev) · scikit-learn ·
APScheduler · ReportLab · Docker · GitHub Actions.

```
frontend/          React app (landing page + dashboard)
backend/app/
  detection/       rules.py (49 detectors), engine.py (matching, entropy, masking, diff scanning)
  sources/         github.py (async GitHub API client)
  ml/              features.py, train.py, scorer.py (AI risk model)
  intel/           breach.py (XposedOrNot / HIBP / Pwned Passwords)
  services/        scanner, alerts, monitoring scheduler, PDF reports
  routers/         REST API
backend/tests/     pytest suite
```

## Run locally

Requirements: Python 3.12+, Node 20+.

```bash
# 1. Backend
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
cp ../.env.example .env                                 # then fill in GITHUB_TOKEN (and SMTP if you want emails)
uvicorn app.main:app --reload                            # http://localhost:8000/docs

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                                             # http://localhost:5173
```

The first start trains the risk model (a few seconds) and creates a SQLite database. Open http://localhost:5173,
create an account and run a scan.

### Configuration

All settings are environment variables (see `.env.example`):

- `GITHUB_TOKEN`: strongly recommended. Without it GitHub allows 60 API requests an hour, enough for one small repo.
  A classic token with no scopes works for public repos.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`: email alerts. With Gmail, use an
  [app password](https://myaccount.google.com/apppasswords) and `smtp.gmail.com:587`.
- `HIBP_API_KEY`: optional; switches email lookups from XposedOrNot to Have I Been Pwned.
- `SECRET_KEY`: required in production, used to sign login tokens.

## Run with Docker

```bash
cp .env.example .env          # set SECRET_KEY, POSTGRES_PASSWORD, GITHUB_TOKEN, SMTP_*
docker compose up -d --build  # http://localhost:8000
```

One container serves both the API and the built React app; PostgreSQL runs alongside it.

## Deploy to AWS EC2

1. Launch an Ubuntu EC2 instance (t3.small or larger) and open ports 80/443 in its security group.
2. Install Docker: `curl -fsSL https://get.docker.com | sh`.
3. `git clone https://github.com/Shirshak14/ghosttrace && cd ghosttrace`, create `.env`, set
   `FRONTEND_URL=https://your-domain` and `CORS_ORIGINS=https://your-domain`.
4. `docker compose up -d --build`.
5. Put Caddy or nginx in front for HTTPS, e.g. `caddy reverse-proxy --from your-domain --to localhost:8000`.

## Tests

```bash
cd backend && python -m pytest -q
cd frontend && npm run lint && npm run build
```

CI runs both on every push and pull request, then builds the Docker image.

## How the AI risk model works

`backend/app/ml/train.py` builds a labelled dataset by rendering realistic code and config lines containing either
real-format secrets (random values in each provider's exact format, in `.env`, settings and source files) or the decoys
that cause false positives in keyword scanners (documentation keys such as `AKIAIOSFODNN7EXAMPLE`, `${ENV}` references,
`your-api-key-here`, low-entropy dummies, test fixtures). Every line runs through the real detection engine, so the
model learns from the same features it sees in production. About 4% label noise is added so boundaries stay soft.
Held-out accuracy is about 95% (ROC AUC ≈ 0.95). Retrain with `python -m app.ml.train`.

Risk score = `100 × confidence^0.8 × impact(credential type) × exposure(public repo, sensitive file, history-only)`,
mapped to critical (≥75), high (≥55), medium (≥30) and low.

## Responsible use

Only scan targets you own or are authorised to assess. GhostTrace reads public data through official APIs and never
stores raw secrets, but anything it finds should be reported to the owner and rotated, not used.
