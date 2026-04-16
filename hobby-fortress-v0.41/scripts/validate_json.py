# validate_json.py
# ローカルでjsonschemaを使う場合の簡易検証スクリプト例。
# 依存: pip install jsonschema
import json, sys, pathlib
from jsonschema import Draft202012Validator

def load(p): return json.loads(pathlib.Path(p).read_text(encoding="utf-8"))

schema_path = sys.argv[1]
json_path = sys.argv[2]
schema = load(schema_path)
data = load(json_path)

v = Draft202012Validator(schema)
errors = sorted(v.iter_errors(data), key=lambda e: e.path)
if errors:
    for e in errors:
        print("ERROR:", e.message, "at", list(e.path))
    sys.exit(1)
print("OK")
