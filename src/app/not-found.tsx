import Link from "next/link";
import { Container } from "@/components/container";
import { Mark } from "@/components/mark";

export default function NotFound() {
  return (
    <Container className="pt-24 pb-4">
      <Mark className="text-line h-20 w-20 -scale-x-100" />
      <h1 className="font-display mt-6 text-4xl tracking-tight sm:text-5xl">
        Walked off somewhere
      </h1>
      <p className="text-graphite mt-4 max-w-md text-pretty">
        This page isn&rsquo;t here. Sold-out work usually still is, so it may be worth looking
        through the whole catalogue.
      </p>
      <Link
        href="/work"
        className="hover:text-biro font-display mt-8 inline-block text-lg tracking-tight underline decoration-1 underline-offset-[6px] transition-colors"
      >
        See all work
      </Link>
    </Container>
  );
}
