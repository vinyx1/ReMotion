"""The secret check catches keys and key files, and leaves ordinary code alone.

The fake keys are built from pieces so this file doesn't trip the check itself.
"""
from software.tools.check_secrets import bad_file, bad_line

R = "Ab3dE6gH9jK2mN5pQ8sT1vW4yZ7bC0eF"          # random-looking filler, 32 characters


def test_catches_keys():
    assert bad_line("key = '" + "sk-ant-api03-" + R + "'")
    assert bad_line("ghp_" + R + "abcd")
    assert bad_line("AKIA" + "ABCDEFGHIJKLMNOP")
    assert bad_line("-----BEGIN " + "PRIVATE KEY-----")
    assert bad_line("ANTHROPIC_API_KEY=" + R)
    assert bad_line('const apiKey = "' + R + '"')
    assert bad_line('password = "' + "hunter2hunter2" + '"')


def test_leaves_ordinary_code_alone():
    assert not bad_line("ANTHROPIC_API_KEY=")                          # .env.example
    assert not bad_line("const TOKEN = window.__IMPECCABLE_TOKEN__;")  # a variable, not a value
    assert not bad_line("token = bearer(req)")
    assert not bad_line("Keys look like sk-ant-... and live in .env")
    assert not bad_line("key = '" + "sk-ant-api03-" + R + "'  # secret-scan: allow")


def test_key_files():
    assert bad_file("software/web/.env")
    assert bad_file(".env.local")
    assert not bad_file("software/web/.env.example")
    assert bad_file("release.jks")
    assert bad_file("software/android/local.properties")
    assert bad_file("data/state/accounts.json")
    assert not bad_file("software/web/src/env.ts")
