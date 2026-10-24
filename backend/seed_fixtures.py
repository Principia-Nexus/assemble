"""Load demo/test fixtures from backend/fixtures/*.json into a MongoDB database.

Usage: python seed_fixtures.py [--db NAME] [--replace]
Defaults to DB_NAME from backend/.env. Use --db to fill a separate test database.
"""
import argparse
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

from fixtures import fixture_files

load_dotenv(Path(__file__).parent / ".env")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=os.environ["DB_NAME"])
    ap.add_argument("--replace", action="store_true", help="drop existing fixtures in that DB first")
    args = ap.parse_args()
    coll = MongoClient(os.environ["MONGO_URL"])[args.db]["fixtures"]
    if args.replace:
        coll.delete_many({})
    for fx in fixture_files():
        coll.update_one({"fixture_id": fx["fixture_id"]},
                        {"$set": {**fx, "loaded_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
        print(f"{args.db}.fixtures <- {fx['fixture_id']} ({len(fx['sites'])} sites, {len(fx['partners'])} partners)")
    coll.create_index("fixture_id", unique=True)


if __name__ == "__main__":
    main()
