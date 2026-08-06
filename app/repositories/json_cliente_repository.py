import json
from pathlib import Path
from typing import Any


class JsonClienteRepository:
    def __init__(self, data_path: Path | None = None) -> None:
        self.data_path = data_path or Path(__file__).resolve().parents[1] / "data" / "clientes.json"

    def get_by_id(self, cliente_id: int) -> dict[str, Any] | None:
        with self.data_path.open(encoding="utf-8") as file:
            clientes = json.load(file)
        return next((cliente for cliente in clientes if cliente["id"] == cliente_id), None)
