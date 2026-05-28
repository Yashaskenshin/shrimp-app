import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadAssumptions } from "@/lib/assumptions";
import { parseCustomCosts } from "@/lib/customCosts";
import { getQuoteAutocomplete } from "@/app/actions/quotes";
import { QuoteEditor } from "./QuoteEditor";

export const dynamic = "force-dynamic";

export default async function QuotePage(
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { lineNo: "asc" } },
      events: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!quote) notFound();

  const [products, assumptions, processingRates, plants, autocomplete] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
    }),
    loadAssumptions(),
    prisma.processingChargeRate.findMany(),
    prisma.plant.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    getQuoteAutocomplete(),
  ]);

  const processingRatesProps = processingRates.map((r) => ({
    plant: r.plant,
    product: r.product,
    freezeType: r.freezeType,
    packSize: r.packSize,
    rsPerKg: r.rsPerKg,
  }));

  return (
    <QuoteEditor
      quote={{
        id: quote.id,
        poNo: quote.poNo,
        contractDate: quote.contractDate ? quote.contractDate.toISOString() : null,
        revisedDate: quote.revisedDate ? quote.revisedDate.toISOString() : null,
        customer: quote.customer,
        country: quote.country,
        incoterm: quote.incoterm,
        payment: quote.payment,
        plant: quote.plant,
        freezeType: quote.freezeType,
        commissionOverridePerKg: quote.commissionOverridePerKg,
        processingChargeWithGst: quote.processingChargeWithGst,
        portLoading: quote.portLoading,
        portLoadingDate: quote.portLoadingDate ? quote.portLoadingDate.toISOString() : null,
        portDestination: quote.portDestination,
        portDestDate: quote.portDestDate ? quote.portDestDate.toISOString() : null,
        fxRate: quote.fxRate,
        status: quote.status,
        notes: quote.notes,
        preparedBy: quote.preparedBy,
        verifiedBy: quote.verifiedBy,
        approvedBy: quote.approvedBy,
      }}
      lines={quote.lines.map((l) => ({
        id: l.id,
        lineNo: l.lineNo,
        productCode: l.productCode,
        productName: l.productName,
        sizeBand: l.sizeBand,
        pack: l.pack,
        weightKg: l.weightKg,
        usdPerKg: l.usdPerKg,
        stockFgKg: l.stockFgKg,
        stockCostRs: l.stockCostRs,
        rmPriceRs: l.rmPriceRs,
        yieldPctOverride: l.yieldPctOverride,
        avgSizeOverride: l.avgSizeOverride,
        packagingRs: l.packagingRs,
        additiveRs: l.additiveRs,
        processingChargeRs: l.processingChargeRs,
        commissionRs: l.commissionRs,
        exportShipmentRs: l.exportShipmentRs,
        ddpRs: l.ddpRs,
      }))}
      products={products.map((p) => ({
        code: p.code,
        name: p.name,
        rmAvgSize: p.rmAvgSize ?? null,
        stdYieldPct: p.stdYieldPct ?? null,
        sizeBand: p.sizeBand ?? null,
        packDefault: p.packDefault ?? null,
      }))}
      assumptions={assumptions}
      events={quote.events.map((e) => ({
        id: e.id,
        action: e.action,
        actor: e.actor,
        comment: e.comment,
        createdAt: e.createdAt.toISOString(),
      }))}
      customVariableCosts={parseCustomCosts(quote.customVariableCosts)}
      customFixedCosts={parseCustomCosts(quote.customFixedCosts)}
      processingRates={processingRatesProps}
      plantOptions={plants.map((p) => p.name)}
      autocomplete={autocomplete}
    />
  );
}
