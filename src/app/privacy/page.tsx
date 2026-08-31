import type { Metadata } from "next";
import { Container } from "@/components/container";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What this site collects, which is almost nothing.",
};

export default function PrivacyPage() {
  return (
    <Container className="pt-16 pb-4">
      <div className="max-w-prose">
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Privacy</h1>

        <div className="mt-6 space-y-5 leading-relaxed text-pretty">
          <p>
            Nothing is sold on this site. Buying a print happens on Etsy, and Etsy&rsquo;s privacy
            policy covers everything that happens there, including your payment and delivery
            details. This site never sees them.
          </p>
          <p>
            Visits are counted using aggregate analytics that set no cookies and do not identify
            you. That is why there is no cookie banner.
          </p>
          <p>If you email me, I keep the email so I can reply. Ask and I will delete it.</p>
        </div>
      </div>
    </Container>
  );
}
