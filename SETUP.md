# Install ingpad (AI agent prompt)

> Paste this whole file to your AI coding agent (Claude Code, Cursor, Copilot Chat, …).
> It will set up `ingpad` on your machine and verify it works.

---

**Task: set up `ingpad` for me and confirm it works.**

`ingpad` is a local learning canvas for technical exercises — pure Python
(stdlib-only, nothing to pip-install). Please:

1. **Detect my OS and Python.** Confirm Python ≥ 3.10 is available
   (`python --version` or `python3 --version`). If missing, tell me how to
   install it for my OS and stop.

2. **Clone the repo:**
   ```bash
   git clone https://github.com/MoritzV42/ingpad
   cd ingpad
   ```
   No dependencies to install — the server uses only the Python standard library.

3. **Optional but recommended — check for Claude Code** (powers the in-app AI
   tutor over a Claude subscription, no API key needed):
   ```bash
   claude --version
   ```
   - If it's installed: nothing else to do, the tutor will work out of the box.
   - If not: tell me I can either install it
     (`npm install -g @anthropic-ai/claude-code`, then run `claude` once to
     log in) **or** skip it — the in-app chat also accepts any OpenAI-compatible
     API key (Anthropic, OpenRouter, OpenAI, Mistral, Gemini, DeepSeek, Groq, xAI)
     via its settings panel. Don't block the setup on this.

4. **Start the demo project:**
   ```bash
   python server.py demo
   ```
   The server prints its URL (default `http://localhost:8042/index.html`;
   set the env var `INGPAD_PORT` if 8042 is taken).

5. **Open the URL in my browser** and verify the canvas loads: framework-data
   rail on the left, exercise steps in the middle, a 💬 chat button bottom right.

6. **Function check.** Confirm the server answers:
   ```bash
   curl http://localhost:8042/api/ai/status
   ```
   Expect JSON like `{"claude": true/false, "version": "...", ...}`.
   `"claude": true` means the AI tutor is ready over the Claude subscription;
   `false` means step 3 applies (install Claude Code or configure an API key
   in the chat's ⚙ settings).

7. **Show me the basics** once it works:
   - Pick a step, handwrite the calculation in the drawing field (stylus draws,
     one finger pans, two fingers zoom), hit **send to AI**.
   - Ask the in-app AI tutor (💬) about the exercise — it sees the canvas state.
   - Own exercises: copy a folder under `projekte/` and run
     `python server.py <your-exercise>`.

If anything fails, show the exact error and the smallest fix for my platform.
Ask before installing anything beyond cloning the repo.
