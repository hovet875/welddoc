import { useAuth } from "../../auth/AuthProvider";
import { AppFooter } from "../../layout/AppFooter";
import { AppHeader } from "../../layout/AppHeader";
import { HomeHero } from "./components/HomeHero";
import { HomeTiles } from "./components/HomeTiles";
import { UbibotCard } from "./components/UbibotCard";

export function HomePage() {
  const { access, session } = useAuth();
  const displayName = access?.displayName ?? "Bruker";
  const email = session?.user?.email ?? "";

  return (
    <div className="shell page-home">
      <AppHeader displayName={displayName} email={email} />

      <main className="main">
        <HomeTiles />

        <section className="hero">
          <HomeHero />
          <UbibotCard />
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
