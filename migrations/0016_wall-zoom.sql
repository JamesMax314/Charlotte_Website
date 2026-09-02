/*
  Whether an unclickable wall image opens full screen when a visitor taps it.

  Defaults true, so every piece already on a wall becomes zoomable the moment
  this ships — which is the behaviour the artist asked for. A decorative mark
  that should stay inert is switched off individually.
*/
ALTER TABLE `portfolio_items` ADD `zoomable` integer DEFAULT true NOT NULL;
