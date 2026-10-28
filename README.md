# Student Sem Progress Dashboard

## Prerequisites

- **Node.js 18.17+** (developed on Node 20) and npm
- **Python 3.9+** - required only for marksheet PDF parsing (and for re-extracting curriculum data)

## Setup

```bash
git clone https://github.com/pvsaravanan/sec_curriculum.git
cd sec_curriculum

# 1. JavaScript dependencies
npm install

# 2. Python virtual environment (the API route calls venv/bin/python)
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
deactivate
```

> The virtual environment **must** be named `venv` and live in the project root. The `/api/parse-marksheet` route runs `venv/bin/python parse_marksheet.py` (macOS/Linux layout). Without it, dashboard features work but marksheet upload fails.

## Running the Dashboard

```bash
# Development (hot reload) - http://localhost:3000
npm run dev

# Production
npm run build
npm run start
```

`npm run start` serves the last build from `.next/`, so run `npm run build` again after changing any code.
