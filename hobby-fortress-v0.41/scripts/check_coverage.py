import os, json, re, sys

ROOT = os.path.dirname(os.path.dirname(__file__))

def die(msg):
    print(msg)
    sys.exit(1)

# 1) Step01-17 existence
missing = []
for i in range(1, 18):
    p = os.path.join(ROOT, "concept", f"STEP{str(i).zfill(2)}.md")
    if not os.path.exists(p):
        missing.append(p)

if missing:
    die("Missing step files:\n" + "\n".join(missing))

# 2) ensure each step file contains its step label
bad = []
for i in range(1, 18):
    fn = os.path.join(ROOT, "concept", f"STEP{str(i).zfill(2)}.md")
    with open(fn, "r", encoding="utf-8") as f:
        txt = f.read()
    if f"Step{str(i).zfill(2)}" not in txt and f"STEP{str(i).zfill(2)}" not in txt:
        # allow Japanese heading like StepXX in title
        if not re.search(rf"Step{str(i).zfill(2)}", txt, re.IGNORECASE):
            bad.append(fn)

if bad:
    die("Step files missing step marker:\n" + "\n".join(bad))

# 3) key catalogs exist
required = [
    "data/catalog/nodes.v0.41.json",
    "data/catalog/cards.v0.41.json",
    "data/catalog/branches.v0.41.json",
    "data/catalog/synergy.v0.41.json",
    "data/catalog/badges.v0.41.json",
    "schemas/ledger_event.schema.json",
    "schemas/bridge_council_request.schema.json",
    "schemas/bridge_council_response.schema.json"
]
missing2 = [r for r in required if not os.path.exists(os.path.join(ROOT, r))]
if missing2:
    die("Missing required artifacts:\n" + "\n".join(missing2))

print("OK: Step01-17 present, markers OK, required artifacts present.")
