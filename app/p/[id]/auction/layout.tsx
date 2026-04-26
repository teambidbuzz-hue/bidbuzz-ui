import { Metadata } from "next";
import { getTournamentMetadata } from "@/lib/metadata-utils";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  return getTournamentMetadata(resolvedParams.id, 'auction');
}

export default function AuctionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
