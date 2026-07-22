import importlib.util
from pathlib import Path

_main_path = Path(__file__).resolve().parent / "main.py"
_spec = importlib.util.spec_from_file_location("jobjeeves_main", _main_path)
_module = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_module)
app = _module.app
