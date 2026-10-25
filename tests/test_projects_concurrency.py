# Iteration 12: concurrent create with same request_key and concurrent first demo sign-ins must not duplicate.
import uuid
from concurrent.futures import ThreadPoolExecutor

from test_projects_multi import API, DB, demo_login, get, ORIGIN
import os
import requests


def test_parallel_same_key_one_project():
    s, _ = demo_login()
    k = uuid.uuid4().hex
    with ThreadPoolExecutor(6) as ex:
        ids = list(ex.map(lambda _: s.post(f"{API}/projects", json={"name": "TEST race", "request_key": k}).json().get("project_id"), range(6)))
    assert len(set(ids)) == 1 and None not in ids, ids
    assert DB.projects.count_documents({"create_key": k}) == 1


def test_parallel_first_signins_three_examples():
    v = str(uuid.uuid4())

    def login(_):
        s = requests.Session()
        s.headers.update(ORIGIN)
        r = s.post(f"{API}/auth/login", json={"email": "organizer@demo.assemble.test", "password": os.environ["DEMO_PASSWORD"], "visitor_id": v})
        return r.status_code, s
    with ThreadPoolExecutor(5) as ex:
        res = list(ex.map(login, range(5)))
    ok = [s for c, s in res if c == 200]
    assert ok, [c for c, _ in res]
    names = [p["name"] for p in get(ok[0], "/projects").json()["projects"]]
    assert len(names) == 3, names
