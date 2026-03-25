
import yaml
import sys

try:
    with open('.github/workflows/release.yml', 'r') as f:
        yaml.safe_load(f)
    print("YAML is valid.")
except Exception as e:
    print(f"YAML ERROR: {e}")
    sys.exit(1)
