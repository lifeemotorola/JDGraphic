/**
 * Bundled photo art — "some of the best imagery on the internet", vendored
 * into `public/art/` so templates, the artboard picker and every export work
 * offline, load instantly and never taint the canvas (same-origin pixels).
 *
 * Each entry records where the photo came from. They are used here as
 * placeholder art for design exploration; swap in fully-licensed imagery
 * before sending a carton to press.
 */
export interface ArtAsset {
  /** file under public/art/, referenced as `art/<id>` */
  id: string;
  file: string;
  name: string;
  tags: string[];
  source: string;
  credit: string;
}

const A = (id: string, file: string, name: string, tags: string[], source: string, credit: string): ArtAsset =>
  ({ id, file, name, tags, source, credit });

export const ART: ArtAsset[] = [
  A('coffee-beans', 'coffee-beans.jpg', 'Roast beans, top-down', ['coffee', 'dark', 'texture'], 'https://dreamstime.com/photos-images/black-coffee-beans-macro-photo.html', 'Dreamstime'),
  A('coffee-macro', 'coffee-macro.jpg', 'Roast beans macro', ['coffee', 'macro'], 'https://dreamstime.com/photos-images/black-coffee-beans-macro-photo.html', 'Dreamstime'),
  A('coffee-bag', 'coffee-bag.jpg', 'Kraft bag on beans', ['coffee', 'packaging', 'kraft'], 'https://www.vecteezy.com/free-photos/coffee-bags', 'Vecteezy'),
  A('coffee-scene', 'coffee-scene.jpg', 'Autumn coffee still life', ['coffee', 'autumn', 'warm'], 'https://peakpx.com/en/search?q=coffee+with+coffee+graphy', 'Peakpx'),
  A('chocolate-swirl', 'chocolate-swirl.jpg', 'Melted chocolate swirl', ['chocolate', 'texture', 'dark'], 'https://www.istockphoto.com/photos/chocolate-macro', 'iStock'),
  A('chocolate-bar', 'chocolate-bar.jpg', 'Dark chocolate bar', ['chocolate', 'bar'], 'https://dreamstime.com/photos-images/smooth-glossy-dark-chocolate-bar-rich-cocoa-texture.html', 'Dreamstime'),
  A('chocolate-cream', 'chocolate-cream.jpg', 'Chocolate gelato swirl', ['chocolate', 'cream', 'gelato'], 'https://www.istockphoto.com/photos/chocolate-macro', 'iStock'),
  A('citrus-grid', 'citrus-grid.jpg', 'Citrus halves grid', ['citrus', 'orange', 'vibrant'], 'https://www.pexels.com/photo/vibrant-and-juicy-orange-slices-flat-lay-30781346/', 'Pexels'),
  A('citrus-slice', 'citrus-slice.jpg', 'Orange slice column', ['citrus', 'juice'], 'https://www.pexels.com/photo/vibrant-and-juicy-orange-slices-flat-lay-30781346/', 'Pexels'),
  A('leaves-dark', 'leaves-dark.jpg', 'Botanical leaves, dark', ['botanical', 'green', 'tea'], 'https://www.vecteezy.com/free-photos/botanical-texture', 'Vecteezy'),
  A('leaves-matte', 'leaves-matte.jpg', 'Matte foliage texture', ['botanical', 'sage', 'texture'], 'https://www.vecteezy.com/free-photos/green-leaves-texture', 'Vecteezy'),
  A('ocean-aerial', 'ocean-aerial.jpg', 'Turquoise wave aerial', ['ocean', 'surf', 'aerial'], 'https://www.vecteezy.com/free-photos/sea-waves-texture', 'Vecteezy'),
  A('ocean-foam', 'ocean-foam.jpg', 'Sea foam aerial', ['ocean', 'foam', 'texture'], 'https://www.vecteezy.com/free-photos/ocean-water-texture', 'Vecteezy'),
  A('ocean-swell', 'ocean-swell.jpg', 'Swell water texture', ['ocean', 'water', 'sage'], 'https://www.pexels.com/search/ocean%20texture/', 'Pexels'),
  A('mountain-mist', 'mountain-mist.jpg', 'Cloud-line ridge', ['mountain', 'mist', 'outdoor'], 'https://dreamstime.com/photos-images/moody-misty.html', 'Dreamstime'),
  A('forest-fog', 'forest-fog.jpg', 'Fog over pines', ['forest', 'fog', 'outdoor'], 'https://dreamstime.com/photos-images/moody-misty.html', 'Dreamstime'),
  A('cliff-fog', 'cliff-fog.jpg', 'Cliff above the fog', ['cliff', 'travel', 'moody'], 'https://dreamstime.com/photos-images/moody-misty.html', 'Dreamstime'),
  A('marble-white', 'marble-white.jpg', 'White marble, gold veins', ['marble', 'luxury', 'gold'], 'https://www.vecteezy.com/free-photos/black-white-gold-marble', 'Vecteezy'),
  A('marble-black', 'marble-black.jpg', 'Black marble, gold veins', ['marble', 'luxury', 'noir'], 'https://www.vecteezy.com/free-photos/black-white-gold-marble', 'Vecteezy'),
  A('marble-grey', 'marble-grey.jpg', 'Grey marble kintsugi', ['marble', 'stone', 'gold'], 'https://www.vecteezy.com/free-photos/black-white-gold-marble', 'Vecteezy'),
  A('flowers-dark', 'flowers-dark.png', 'Dutch still-life blooms', ['floral', 'moody', 'studio'], 'https://cozyroominspo.com/diy-dried-floral-arrangements-that-look-like-studio-art', 'Cozy Room Inspo'),
  A('flowers-pastel', 'flowers-pastel.jpg', 'Pastel dried bouquet', ['floral', 'pastel', 'dried'], 'https://www.etsy.com/market/pastels_dried_flower', 'Etsy'),
  A('dog-sit', 'dog-sit.jpg', 'Golden retriever, seated', ['dog', 'pet', 'studio'], 'https://shutterstock.com/search/dog-goldie', 'Shutterstock'),
  A('dog-face', 'dog-face.jpg', 'Golden retriever portrait', ['dog', 'pet', 'portrait'], 'https://shutterstock.com/search/dog-goldie', 'Shutterstock'),
  A('candle-flame', 'candle-flame.jpg', 'Candle flame macro', ['candle', 'flame', 'warm'], 'https://vecteezy.com/free-photos/candle-glow', 'Vecteezy'),
  A('candle-evening', 'candle-evening.jpg', 'Candlelit evening table', ['candle', 'hygge', 'evening'], 'https://etsy.com/market/warm_glow_candle', 'Etsy'),
  A('serum', 'serum.jpg', 'Dropper serum bottles', ['beauty', 'serum', 'studio'], 'https://create.vista.com/photos/skincare-serum', 'VistaCreate'),
  A('beer-bokeh', 'beer-bokeh.jpg', 'Bottles in bar bokeh', ['beer', 'bar', 'bokeh'], 'https://gettyimages.com/photos/dark-beer-bottle', 'Getty Images'),
  A('beer-bar', 'beer-bar.jpg', 'Pour at the wooden bar', ['beer', 'craft', 'bar'], 'https://www.vecteezy.com/photo/69626781-freshly-poured-craft-beer-and-bottle-on-a-wooden-bar-with-moody-brewery-lighting', 'Vecteezy'),
  A('grapes', 'grapes.jpg', 'Vine grapes macro', ['wine', 'grapes', 'vineyard'], 'https://dreamstime.com/photos-images/texture-wine.html', 'Dreamstime'),
  A('wine-vintage', 'wine-vintage.jpg', 'Corks and vine, vintage paper', ['wine', 'vintage'], 'https://dreamstime.com/photos-images/texture-wine.html', 'Dreamstime'),
  A('spices-flat', 'spices-flat.jpg', 'Spice bowls flat-lay', ['spice', 'color', 'kitchen'], 'https://www.magnific.com/free-photos-vectors/spices', 'Magnific'),
  A('spices-leaf', 'spices-leaf.jpg', 'Spices on banana leaf', ['spice', 'market', 'vivid'], 'https://dreamstime.com/photos-images/paprika-pepper.html', 'Dreamstime'),
  A('headphones', 'headphones.jpg', 'Studio headphones, grey', ['audio', 'tech', 'minimal'], 'https://www.vecteezy.com/free-photos/headphone', 'Vecteezy'),
  A('headphones-light', 'headphones-light.jpg', 'Headphones in window light', ['audio', 'tech', 'light'], 'https://www.vecteezy.com/free-photos/headphone', 'Vecteezy'),
  A('toys-blue', 'toys-blue.jpg', 'Wooden puzzles on blue', ['kids', 'toys', 'play'], 'https://gettyimages.com/photos/toys-flat-lay', 'Getty Images'),
  A('toys-yellow', 'toys-yellow.jpg', 'Play set on yellow', ['kids', 'toys', 'bright'], 'https://gettyimages.com/photos/toys-flat-lay', 'Getty Images'),
  A('baby-pink', 'baby-pink.jpg', 'Newborn set on pink', ['baby', 'nursery', 'soft'], 'https://gettyimages.com/photos/toys-flat-lay', 'Getty Images'),
];

export const artById = (id: string): ArtAsset | undefined => ART.find((a) => a.id === id);

/** Path as served by Vite from `public/` (relative so any deploy base works). */
export const artSrc = (id: string): string => {
  const a = artById(id);
  return a ? `art/${a.file}` : '';
};

export const ART_CATEGORIES = ['Coffee', 'Chocolate', 'Citrus', 'Botanical', 'Ocean', 'Outdoors', 'Marble', 'Floral', 'Pet', 'Candle', 'Beauty', 'Beer', 'Wine', 'Spice', 'Tech', 'Kids'] as const;
