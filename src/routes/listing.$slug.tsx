import { Link, createFileRoute, notFound } from "@tanstack/react-router";

import { getListing, LISTINGS } from "@/lib/listings";

export const Route = createFileRoute("/listing/$slug")({
  loader: ({ params }) => {
    const listing = getListing(params.slug);
    if (!listing) throw notFound();
    return { listing };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Listing not found — Lost Coast Surf" }, { name: "robots", content: "noindex" }],
      };
    }
    const { listing } = loaderData;
    const title = `${listing.title} — Lost Coast Surf`;
    const description = listing.teaser;
    const image = listing.photos[0]?.src;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(image && image.startsWith("https://")
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
    };
  },
  notFoundComponent: ListingNotFound,
  component: ListingPage,
});

function ListingNotFound() {
  return (
    <div className="min-h-screen bg-background px-4 py-16 text-center font-mono text-foreground">
      <h1 className="font-display text-4xl uppercase">Listing not found</h1>
      <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
        It may have sold or been pulled from the board.
      </p>
      <Link
        to="/"
        className="mt-6 inline-block border border-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-foreground hover:text-background"
      >
        Back to the surf report
      </Link>
    </div>
  );
}

function ListingPage() {
  const { listing } = Route.useLoaderData();
  const [hero, ...rest] = listing.photos;

  return (
    <div className="min-h-screen bg-background font-mono text-foreground">
      <header className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-foreground/10 bg-background/90 px-4 py-3 backdrop-blur-sm">
        <Link
          to="/"
          className="text-[10px] font-bold uppercase tracking-widest transition-colors hover:text-primary"
        >
          &larr; Surf Report
        </Link>
        <span className="text-[9px] uppercase tracking-widest text-primary">{listing.kind}</span>
      </header>

      <main className="mx-auto max-w-md space-y-8 px-4 py-6">
        <section className="animate-rise">
          <h1 className="font-display text-3xl uppercase leading-tight tracking-tight">
            {listing.title}
          </h1>
          {listing.price ? (
            <p className="mt-2 border-b-4 border-foreground pb-2 font-display text-4xl italic leading-none text-primary">
              {listing.price}
            </p>
          ) : null}
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{listing.teaser}</p>
        </section>

        {hero ? (
          <section className="animate-rise space-y-2 [animation-delay:100ms]">
            <img
              src={hero.src}
              alt={hero.alt}
              className="w-full border border-foreground/10 object-cover"
              loading="eager"
            />
            {rest.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {rest.map((p) => (
                  <a key={p.src} href={p.src} target="_blank" rel="noreferrer">
                    <img
                      src={p.src}
                      alt={p.alt}
                      loading="lazy"
                      className="h-32 w-full border border-foreground/10 object-cover transition-opacity hover:opacity-80"
                    />
                  </a>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {listing.specs?.length ? (
          <section className="animate-rise [animation-delay:200ms]">
            <SectionTitle>Details</SectionTitle>
            <div className="grid grid-cols-1 gap-x-8 text-[11px]">
              {listing.specs.map((s) => (
                <div
                  key={s.label}
                  className="flex justify-between gap-4 border-b border-foreground/5 py-1"
                >
                  <span className="uppercase text-muted-foreground">{s.label}</span>
                  <span className="text-right font-bold">{s.value}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="animate-rise space-y-3 [animation-delay:300ms]">
          <SectionTitle>Description</SectionTitle>
          {listing.body.map((p) => (
            <p key={p.slice(0, 24)} className="text-[12px] leading-relaxed">
              {p}
            </p>
          ))}
        </section>

        {listing.location ? (
          <section className="animate-rise [animation-delay:400ms]">
            <SectionTitle>Location</SectionTitle>
            <p className="text-[12px]">{listing.location.address}</p>
            <a
              href={listing.location.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex items-center justify-between border border-foreground/20 p-3 text-[10px] font-bold uppercase transition-colors hover:bg-foreground hover:text-background"
            >
              <span>Open in Maps</span>
              <span>&rarr;</span>
            </a>
          </section>
        ) : null}

        <section className="animate-rise rounded-xs bg-foreground p-6 text-background [animation-delay:500ms]">
          <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-primary">
            Contact
          </h3>
          {listing.contact.name ? (
            <p className="text-[12px] font-bold">{listing.contact.name}</p>
          ) : null}
          <div className="mt-3 grid gap-2">
            {listing.contact.email ? (
              <a
                href={`mailto:${listing.contact.email}?subject=${encodeURIComponent(listing.title)}`}
                className="flex items-center justify-between border border-background/30 p-3 text-[10px] font-bold uppercase transition-colors hover:bg-background hover:text-foreground"
              >
                <span>Email about this listing</span>
                <span>&rarr;</span>
              </a>
            ) : null}
            {listing.contact.phone ? (
              <a
                href={`tel:${listing.contact.phone.replace(/[^\d+]/g, "")}`}
                className="flex items-center justify-between border border-background/30 p-3 text-[10px] font-bold uppercase transition-colors hover:bg-background hover:text-foreground"
              >
                <span>{listing.contact.phone}</span>
                <span>&rarr;</span>
              </a>
            ) : null}
          </div>
        </section>

        <section className="animate-rise [animation-delay:600ms]">
          <SectionTitle>More on the board</SectionTitle>
          <div className="grid gap-2">
            {LISTINGS.filter((l) => l.slug !== listing.slug).map((l) => (
              <Link
                key={l.slug}
                to="/listing/$slug"
                params={{ slug: l.slug }}
                className="flex items-center justify-between gap-3 border border-foreground/10 p-3 transition-colors hover:border-primary/60"
              >
                <span className="text-[11px] font-bold uppercase">{l.title}</span>
                <span className="text-[10px] text-primary">&rarr;</span>
              </Link>
            ))}
          </div>
        </section>

        <footer className="pb-12 text-center text-[9px] uppercase tracking-widest text-muted-foreground">
          Lost Coast Surf Monitor · lostcoastsurf.com
        </footer>
      </main>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
      <span>{children}</span>
      <span className="h-px flex-1 bg-foreground/10" />
    </h2>
  );
}
