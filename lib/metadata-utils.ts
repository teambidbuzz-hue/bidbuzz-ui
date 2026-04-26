import { Metadata } from "next";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace("localhost", "127.0.0.1");

export async function getTournamentMetadata(id: string, pageType: 'details' | 'registration' | 'auction'): Promise<Metadata> {
  try {
    const res = await fetch(`${API_BASE_URL}/public/tournaments/${id}`, { cache: "no-store" });
    if (!res.ok) {
      return { title: "Tournament | BidBuzz" };
    }
    const data = await res.json();
    const tournament = data.tournament;

    let pageTitle = "";
    let pageDescription = "";

    switch (pageType) {
      case 'registration':
        pageTitle = `Player Registration | ${tournament.name}`;
        pageDescription = `Register as a player for ${tournament.name} (${tournament.season}). Complete your profile to enter the live auction pool!`;
        break;
      case 'auction':
        pageTitle = `Live Auction | ${tournament.name}`;
        pageDescription = `Watch the live auction for ${tournament.name}. Stay updated with real-time player bids and team selections!`;
        break;
      case 'details':
      default:
        pageTitle = `${tournament.name} | Tournament Details`;
        pageDescription = `Details and player list for ${tournament.name} (${tournament.season}). Explore teams and registered players.`;
        break;
    }

    const title = `${pageTitle} | BidBuzz`;
    const ogImage = tournament.logo_url || "https://bidbuzz.app/default-og.png";

    return {
      title,
      description: pageDescription,
      openGraph: {
        title,
        description: pageDescription,
        type: "website",
        images: [
          {
            url: ogImage,
            width: 1200,
            height: 630,
            alt: `${tournament.name} Logo`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description: pageDescription,
        images: [ogImage],
      },
    };
  } catch (err) {
    return { title: "Tournament | BidBuzz" };
  }
}
