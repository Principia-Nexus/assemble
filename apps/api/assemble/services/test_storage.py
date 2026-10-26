import pytest

from assemble.services import storage


def test_path_outside_storage_dir_is_refused(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "STORAGE_DIR", tmp_path.resolve())
    storage.put_object("p/a.pdf", b"x", "application/pdf")
    assert storage.get_object("p/a.pdf")[0] == b"x"
    for path in ("../escape.pdf", "p/../../escape.pdf", str(tmp_path.parent / "abs.pdf")):
        with pytest.raises(ValueError):
            storage.put_object(path, b"x", "application/pdf")
