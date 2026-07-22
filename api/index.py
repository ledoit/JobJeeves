import importlib.util
import sys
from pathlib import Path

API_DIR = Path(__file__).resolve().parent
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

_main_path = API_DIR / "main.py"
_spec = importlib.util.spec_from_file_location("jobjeeves_main", _main_path)
_module = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_module)
app = _module.app
