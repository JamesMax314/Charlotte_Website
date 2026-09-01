import {
  FIRST_PAINT_DELAY_MS,
  POLL_INTERVAL_MS,
  REVEAL_BAND,
  SETTLE_MS,
  STAGGER_WINDOW_MS,
} from "./reveal";

/**
 * The whole reveal, as a script that runs while the document is still parsing.
 *
 * It lives here rather than in a component because nothing can fade in while
 * `js-fade` hides it. Every version of this feature that put the reveal in
 * React made the wall wait for the bundle: first the opening screenful, which
 * left a phone blank for seconds, and then — once that moved here — everything
 * below the fold, which simply never arrived when hydration did not complete.
 * A fade is presentation. It must not depend on hydration at all.
 *
 * That also removed the last reason for `FadeIn` to be a client component, so
 * the wall no longer ships one.
 *
 * The constants come from `./reveal`, interpolated at render time, so the
 * timings this implements stay the ones the tests describe. The formula is
 * duplicated rather than imported for the obvious reason: this has to run
 * before any module exists to import.
 */
export const fadeScript = `(function(){
var d=document,h=d.documentElement,frame=0,opened=0,timer=0;
try{
h.classList.add('js-fade');
function reveal(el,ms){setTimeout(function(){el.classList.add('is-visible');
/* Retire the transition once it has run: a lingering transform keeps a tall
   stack of large images on compositing layers a phone cannot afford. */
setTimeout(function(){el.classList.add('is-settled')},${SETTLE_MS})},ms)}
function pass(){frame=0;
var t=d.querySelectorAll('.fade-target:not(.is-visible)'),vh=innerHeight||1;
/* Nothing left to reveal: stop measuring. getBoundingClientRect forces a
   synchronous layout, and doing that twice a second forever is a cost a phone
   pays in battery for no remaining benefit. */
if(opened&&!t.length){removeEventListener('scroll',schedule);
removeEventListener('resize',schedule);removeEventListener('load',schedule,true);
clearInterval(timer);return}
for(var i=0;i<t.length;i++){var r=t[i].getBoundingClientRect();
/* Height floored at a pixel: a piece measured before its image loads is
   zero-high, and bottom>top then rejects anything at the top of the page. */
if(r.top<vh*${REVEAL_BAND}&&r.top+(r.height>1?r.height:1)>0){
var q=r.top/vh;q=q<0?0:q>1?1:q;
reveal(t[i],opened?0:${FIRST_PAINT_DELAY_MS}+q*${STAGGER_WINDOW_MS})}}
opened=1}
function schedule(){if(!frame)frame=requestAnimationFrame(pass)}
function go(){pass();
addEventListener('scroll',schedule,{passive:true});
addEventListener('resize',schedule,{passive:true});
/* Images arriving reflow what is beneath them without firing a scroll event.
   Capture, because load on an image does not bubble. */
addEventListener('load',schedule,true);
timer=setInterval(schedule,${POLL_INTERVAL_MS})}
if(d.readyState!=='loading')go();else d.addEventListener('DOMContentLoaded',go);
/* The safety net tests whether a pass ever ran, not whether anything is
   visible. Asking the latter disabled it the moment the opening pass started
   succeeding, which stranded everything below the fold. */
setTimeout(function(){if(!opened)h.classList.remove('js-fade')},5000)
}catch(e){h.classList.remove('js-fade')}})();`;
