import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CreateProject({ act, busy }) {
  const [name, setName] = useState("");
  const [errors, setErrors] = useState([]);
  const submit = async (e) => {
    e.preventDefault();
    const r = await act("post", "/project", { name });
    if (!r.ok) setErrors(r.errors);
  };
  return (
    <div data-testid="create-project-empty" className="mx-auto mt-10 max-w-xl rounded-md border border-slate-200 bg-white p-8">
      <p className="eyebrow">No job yet</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Start the one job you want to check</h1>
      <p className="mt-2 text-sm text-slate-600">
        Assemble works on one job at a time. Name it now; you'll add sites, dates, budget and partners next. Anything you don't know yet stays marked as unknown.
      </p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 12-branch lighting retrofit"
          className="h-11" data-testid="create-project-name-input" />
        <Button type="submit" className="h-11" disabled={busy || !name.trim()} data-testid="create-project-submit-button">
          Create job
        </Button>
      </form>
      {errors.length > 0 && <p data-testid="create-project-error" className="mt-3 text-sm text-red-700">{errors.join(" ")}</p>}
    </div>
  );
}
