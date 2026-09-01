import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

/** Chrome for the public site. The admin deliberately does not get this. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      {/*
        Runs while the document is still parsing, so the wall is hidden before
        its first paint rather than after — otherwise pieces flash in, vanish,
        then fade.

        It also performs the opening reveal itself, rather than leaving it to
        `FadeIn`. Nothing can be revealed before the class is removed, so while
        the reveal lived only in React the wall stayed blank for as long as the
        bundle took to arrive and hydrate — seconds, on a phone. The visible
        screenful must not wait on JavaScript it does not need, so the reveal
        for it happens here and the component takes over for scrolling.

        The band and stagger figures mirror `src/lib/reveal.ts`. Duplicated
        deliberately: this has to run before any module can be imported.

        The timeout is the safety net. Finding no revealed piece after five
        seconds means neither path ran, so it reveals everything — it does not
        remove `js-fade`, which dropped the whole wall in unfaded and at once
        and made the safety net itself look like the bug.
      */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){var d=document,h=d.documentElement;h.classList.add('js-fade');" +
            "function s(el,ms){setTimeout(function(){el.classList.add('is-visible')},ms)}" +
            "function pass(){var t=d.querySelectorAll('.fade-target:not(.is-visible)')," +
            "vh=innerHeight||1;for(var i=0;i<t.length;i++){var r=t[i].getBoundingClientRect();" +
            "if(r.top<vh*0.92&&r.top+(r.height>1?r.height:1)>0){" +
            "var q=r.top/vh;q=q<0?0:q>1?1:q;s(t[i],80+q*450)}}}" +
            // Images arriving change what is on screen, so the pass repeats briefly.
            "function go(){pass();setTimeout(pass,300);setTimeout(pass,900)}" +
            "if(d.readyState!=='loading')go();else d.addEventListener('DOMContentLoaded',go);" +
            "setTimeout(function(){if(d.querySelector('.fade-target.is-visible'))return;" +
            "var t=d.querySelectorAll('.fade-target');" +
            "for(var i=0;i<t.length;i++)t[i].classList.add('is-visible')},5000)})()",
        }}
      />
      <a
        href="#main"
        className="bg-ink text-paper sr-only px-4 py-2 focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>
      <SiteHeader />
      <div id="main" className="flex-1">
        {children}
      </div>
      <SiteFooter />
    </div>
  );
}
