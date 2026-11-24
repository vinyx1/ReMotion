"""
Stops API keys, passwords and key files from being committed.

    python -m software.tools.check_secrets --staged     what's about to be committed (the pre-commit hook)
    python -m software.tools.check_secrets              every file in the repo now
    python -m software.tools.check_secrets --history    every line ever added, in every commit (CI)

Exits 1 and says where if it finds something. Two kinds of finding:
  - a file that should never be in git: .env (not .env.example), private keys and keystores
    (.pem, .key, .p12, .jks, .keystore), Android's local.properties, the dashboard's data/state/
  - a line that looks like a key: Anthropic, OpenAI, GitHub, AWS, Google, Slack, Stripe,
    a private-key block, or `..._KEY = "<long value>"` / `password = "..."`

A line that is safe on purpose (an obviously fake example) can end with `secret-scan: allow`.

Set up once per clone so it runs before every commit (also in AGENTS.md):
    git config core.hooksPath .githooks
"""
import argparse
import re
import subprocess
import sys

ALLOW = "secret-scan: allow"

# Files that never belong in git, whatever they contain.
FORBIDDEN_FILES = [
    (re.compile(r"(^|/)\.env(\.(?!example$)[^/]*)?$"), ".env file (keep keys there, but don't commit it; .env.example is fine)"),
    (re.compile(r"\.(pem|key|p12|pfx|jks|keystore)$", re.I), "private key or keystore"),
    (re.compile(r"(^|/)local\.properties$"), "Android local.properties (machine-specific, may hold signing passwords)"),
    (re.compile(r"(^|/)data/state/"), "dashboard accounts and sign-ins (data/state/)"),
    (re.compile(r"(^|/)id_(rsa|ed25519|ecdsa)$"), "SSH private key"),
]

# Text that looks like a real key. Each pattern needs a long random-looking part, so docs that
# only mention a key's name (ANTHROPIC_API_KEY) or its prefix (sk-ant-...) don't trip it.
PATTERNS = [
    (re.compile(r"sk-ant-[A-Za-z0-9_-]{20,}"), "Anthropic API key"),
    (re.compile(r"\bsk-(proj-)?[A-Za-z0-9_-]{32,}"), "OpenAI-style API key"),
    (re.compile(r"\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}"), "GitHub token"),
    (re.compile(r"\bgithub_pat_[A-Za-z0-9_]{30,}"), "GitHub token"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "AWS access key"),
    (re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"), "Google API key"),
    (re.compile(r"\bxox[abposr]-[A-Za-z0-9-]{10,}"), "Slack token"),
    (re.compile(r"\b[sr]k_live_[A-Za-z0-9]{20,}"), "Stripe live key"),
    (re.compile(r"-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY"), "private key"),
    # api_key = "long value" / token: 'long value' in code (a quoted literal, not a variable)
    (re.compile(r"""(?i)\b[A-Z0-9_]*(API[_-]?KEY|SECRET|TOKEN)[A-Z0-9_]*["']?\s*[:=]\s*["'][A-Za-z0-9_\-+/=.]{24,}["']"""),
     "a key or token written into the code"),
    # NAME_API_KEY=value, as in a .env file
    (re.compile(r"""^\s*(export\s+)?[A-Z0-9_]*(API_KEY|SECRET|TOKEN)[A-Z0-9_]*=["']?[A-Za-z0-9_\-+/=.]{24,}["']?\s*$"""),
     "a key or token set like in a .env file"),
    (re.compile(r"""(?i)\b(password|passwd|pwd)\s*[:=]\s*["'][^"'\s]{8,}["']"""), "a password in the code"),
]


def git(*args: str) -> str:
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True, errors="replace").stdout


def bad_file(path: str) -> str | None:
    for rx, why in FORBIDDEN_FILES:
        if rx.search(path):
            return why
    return None


def bad_line(line: str) -> str | None:
    if ALLOW in line:
        return None
    for rx, why in PATTERNS:
        if rx.search(line):
            return why
    return None


def scan_text(path: str, text: str, found: list[str], where: str = "") -> None:
    if "\0" in text[:8000]:                      # a binary file (an image, a model): nothing to read
        return
    for n, line in enumerate(text.splitlines(), 1):
        why = bad_line(line)
        if why:
            found.append(f"{where}{path}:{n}: {why}")


def scan_staged(found: list[str]) -> None:
    for path in git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z").split("\0"):
        if not path:
            continue
        why = bad_file(path)
        if why:
            found.append(f"{path}: {why}")
            continue
        scan_text(path, git("show", f":{path}"), found)


def scan_tree(found: list[str]) -> None:
    for path in git("ls-files", "-z").split("\0"):
        if not path:
            continue
        why = bad_file(path)
        if why:
            found.append(f"{path}: {why}")
            continue
        try:
            with open(path, encoding="utf-8", errors="replace") as f:
                scan_text(path, f.read(), found)
        except (FileNotFoundError, IsADirectoryError):
            pass


def scan_history(found: list[str]) -> None:
    """Every line ever added, so a key committed and then deleted is still caught."""
    commit = path = ""
    for line in git("log", "--all", "-p", "--no-color", "--format=commit %h", "--unified=0").splitlines():
        if line.startswith("commit "):
            commit = line[7:]
        elif line.startswith("+++ "):
            path = line[6:] if line.startswith("+++ b/") else ""
            why = bad_file(path) if path else None
            if why:
                found.append(f"commit {commit}: {path}: {why}")
        elif line.startswith("+") and path:
            why = bad_line(line[1:])
            if why:
                found.append(f"commit {commit}: {path}: {why}")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    g = p.add_mutually_exclusive_group()
    g.add_argument("--staged", action="store_true", help="only what's staged for the next commit")
    g.add_argument("--history", action="store_true", help="every line added in every commit")
    a = p.parse_args()

    found: list[str] = []
    (scan_staged if a.staged else scan_history if a.history else scan_tree)(found)
    if not found:
        return 0
    found = list(dict.fromkeys(found))
    print("Secret check: this looks like a key, password or private file:\n", file=sys.stderr)
    for f in found[:50]:
        print("  " + f, file=sys.stderr)
    if len(found) > 50:
        print(f"  … and {len(found) - 50} more", file=sys.stderr)
    print(
        "\nKeep keys in a git-ignored .env file instead (software/web/.env for the dashboard)."
        "\nIf the key was real and has already been pushed, revoke it with its provider: deleting the"
        "\nline doesn't remove it from git history."
        f"\nAn obviously fake example can end its line with `{ALLOW}`.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
