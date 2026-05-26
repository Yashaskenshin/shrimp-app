import { createQuote } from "@/app/actions/quotes";

export default function NewQuotePage() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">New Quote</h1>
      <form action={createQuote} className="card space-y-4">
        <div>
          <label className="label">PO No (optional)</label>
          <input name="poNo" className="input" placeholder="e.g. PO-2026-0142" />
        </div>
        <div>
          <label className="label">Customer (optional)</label>
          <input name="customer" className="input" placeholder="e.g. Big Brand Foods Pvt Ltd" />
        </div>
        <div>
          <label className="label">USD / INR Rate</label>
          <input
            name="fxRate"
            type="number"
            step="0.0001"
            defaultValue={83}
            className="input input-num"
          />
          <p className="mt-1 text-xs text-slate-500">
            You can change this any time inside the quote.
          </p>
        </div>
        <button type="submit" className="btn-primary w-full">Create Quote</button>
      </form>
    </div>
  );
}
