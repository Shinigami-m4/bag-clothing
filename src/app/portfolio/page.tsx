import PortfolioGallery from "@/app/components/PortfolioGallery";
import { readPortfolio } from "@/lib/portfolio.server";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const items = await readPortfolio();

  return (
    <section
      className="portfolioPage"
      style={{ fontFamily: "Impact, Haettenschweiler, \"Arial Narrow Bold\", sans-serif" }}
    >
      <h1 style={{ margin: 0, fontSize: "clamp(36px, 5vw, 64px)", letterSpacing: "0.08em" }}>
        PORTFOLIO
      </h1>

      <p style={{ marginTop: 10, marginBottom: 24, color: "var(--muted)" }}>
        Events, modeling, and campaign moments.
      </p>

      {items.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No portfolio entries yet. Add some from Admin.</p>
      ) : (
        <PortfolioGallery items={items} />
      )}
    </section>
  );
}
