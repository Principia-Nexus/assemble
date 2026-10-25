import json, os, urllib.request, urllib.error
import stripe

base = os.environ["INTEGRATION_PROXY_URL"]
job_id = "984f3c10-9519-4aba-98b1-236773dc9de9"
key = "sk-emergent-4Ea7d07C76f81319aE"
req = urllib.request.Request(base + "/stripe/sandboxes", data=json.dumps({"job_id": job_id}).encode(),
                             headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"}, method="POST")
try:
    with urllib.request.urlopen(req) as r:
        sb = json.load(r)
except urllib.error.HTTPError as e:
    print("FAILED", e.code, e.read().decode()); raise SystemExit(1)
stripe.api_key = sb["sandbox_secret_key"]
acct = stripe.Account.retrieve()
print("country", acct["country"], "account", sb["sandbox_account_id"])
print("onboarding", sb.get("onboarding_url"))
with open("/app/memory/.stripe_env", "w") as f:
    f.write(f'STRIPE_SECRET_KEY={sb["sandbox_secret_key"]}\nSTRIPE_PUBLISHABLE_KEY={sb["sandbox_publishable_key"]}\n'
            f'STRIPE_ACCOUNT_ID={sb["sandbox_account_id"]}\nSTRIPE_WEBHOOK_SECRET={sb["preview_webhook_secret"]}\nSTRIPE_MODE=test\n')

prod = next((p for p in stripe.Product.list(active=True).auto_paging_iter()
             if p.to_dict().get("metadata", {}).get("emergent_product_id") == "assemble_pilot"), None)
if not prod:
    prod = stripe.Product.create(name="Assemble pilot (90 days)", tax_code="txcd_10103001",
                                 metadata={"managed_by": "emergent", "emergent_product_id": "assemble_pilot"})
ex = stripe.Price.list(lookup_keys=["assemble_pilot_90d"], active=True, limit=1).data
if ex and (ex[0].unit_amount != 9900 or ex[0].currency != "usd"):
    stripe.Price.modify(ex[0].id, active=False); ex = []
if not ex:
    stripe.Price.create(product=prod.id, unit_amount=9900, currency="usd", lookup_key="assemble_pilot_90d", transfer_lookup_key=True)
print("catalog ok")
