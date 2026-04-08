World's Hardest Game - Minimal Clone (Flask + Canvas)

This repository contains a minimal full-stack clone of The World's Hardest Game.

Structure
- `app.py` — Flask backend (auth, score submission, leaderboard)
- `templates/` — Jinja2 templates (login/register/index/leaderboard)
- `static/` — CSS and JS (game implementation)
- `instance/game.sqlite` — SQLite database (created automatically in the app instance folder)

Quick start (Windows PowerShell)

1. Create a virtual environment and install:

```powershell
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2. (Optional) Set a secret key for sessions:

```powershell
$env:FLASK_SECRET_KEY = "your-random-secret"
```

3. Run the app:

```powershell
# Prefer the package entrypoint (uses instance folder)
python .\run.py
```

4. Open http://127.0.0.1:5000 in your browser, register, login, and play.

Notes
- Scores are saved in `instance/game.sqlite` (SQLite) inside the project's instance folder.
- Leaderboard is available in the game page sidebar and at `/leaderboard`.

If you want, I can add a simple initialization route, Dockerfile, or a small test suite next.