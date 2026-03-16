import Link from "next/link";
import Shell from "@/app/components/Shell";
import { artistConfig, type ArtistId } from "@/lib/artists";

export const dynamic = "force-dynamic";

console.log("SERVER ENV CHECK:", {
  NEXT_PUBLIC_DEV_ADMIN_EMAIL: process.env.NEXT_PUBLIC_DEV_ADMIN_EMAIL,
});

export default function HomePage() {
  return (
    <section className="homeHero">
      <div className="homeHeroInner">
        <h1 className="homeTitle brandFont">BLACK ART GOONS</h1>
        <p className="homeSub">
          Limited drops. Independent artists. Built for the culture.
        </p>

        <div className="homeActions">
          <Link className="homeBtn" href="/catalog">
            Shop Catalog
          </Link>
          <Link className="homeBtn ghost" href="/portfolio">
            Browse Portfolio
          </Link>
          <Link className="homeBtn ghost" href="/contact">
            Contact
          </Link>
        </div>
      </div>
    </section>
  );
}
