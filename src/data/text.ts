// "F´" (NASA JPL's flight software framework) must not wrap between the F and
// the mark: U+00B4 allows a line break before it. A word joiner (U+2060) holds
// them. For text shown on a page; feeds, JSON-LD and meta tags keep the plain
// form. MDX bodies write it as F&#x2060;´.
export const keepFPrime = (s: string) => s.replaceAll('F´', 'F⁠´');
