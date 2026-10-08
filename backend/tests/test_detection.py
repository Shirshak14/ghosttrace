import random
import string

from app.detection.engine import mask_secret, scan_diff_patch, scan_text, should_skip_path


def rnd(alpha, n, seed=1):
    r = random.Random(seed)
    return "".join(r.choice(alpha) for _ in range(n))


AWS = "AKIA" + rnd(string.ascii_uppercase + string.digits, 16)
GHP = "ghp_" + rnd(string.ascii_letters + string.digits, 36, 2)


def rules(text, path="app.py"):
    return {m.rule.id for m in scan_text(text, path)}


def test_provider_rules():
    assert "aws_access_key_id" in rules(f"key={AWS}")
    assert "github_pat" in rules(f"token: {GHP}")
    assert "google_api_key" in rules("k = 'AIza" + rnd(string.ascii_letters + string.digits + "-_", 35, 3) + "'")
    assert "stripe_live_secret" in rules("sk_live_" + rnd(string.ascii_letters + string.digits, 30, 4))
    assert "database_url" in rules("DATABASE_URL=postgres://app:Zq8vLm2pXr7t@db.prod:5432/core")
    assert "private_key" in rules("-----BEGIN OPENSSH PRIVATE KEY-----\n" + rnd(string.ascii_letters, 70, 5) + "\n-----END OPENSSH PRIVATE KEY-----")
    assert "password_assignment" in rules('password = "Tr0ub4dor&3x"')
    assert "email_address" in rules("contact priya@fintrack.in")


def test_specific_rule_beats_generic():
    found = scan_text(f'api_key = "{AWS}"')
    assert [m.rule.id for m in found] == ["aws_access_key_id"]


def test_placeholders_and_noise():
    found = scan_text('AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE')
    assert found and found[0].placeholder
    assert not rules("email user@example.com or noreply@github.com")
    assert not rules('api_key = "aaaaaaaaaaaaaaaaaaaa"')  # below entropy floor


def test_masking_never_leaks_secret():
    m = scan_text(f"token: {GHP}")[0]
    assert GHP not in m.snippet and GHP not in mask_secret(GHP)
    assert mask_secret(GHP).startswith("ghp_")


def test_line_numbers_and_diff():
    assert scan_text(f"a\nb\nkey={AWS}\n")[0].line == 3
    patch = f"@@ -10,2 +10,3 @@\n context\n-old\n+AWS={AWS}\n"
    m = scan_diff_patch(patch, "x.sh")
    assert m and m[0].line == 11


def test_skip_paths():
    assert should_skip_path("node_modules/a/index.js")
    assert should_skip_path("package-lock.json")
    assert should_skip_path("img/logo.png")
    assert not should_skip_path("src/.env")
