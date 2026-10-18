// Hugo layouts and CDN script tags inject these before bundled JS runs.
// Ambient declarations for aislop oxlint (collectAmbientGlobals reads .d.ts).
declare const indexURL: string;
declare const includeSectionsInSearch: string[];
declare const search_initial_message: string;
declare const search_no_results: string;
declare const GLightbox: (options?: object) => void;
declare const Swiper: new (element: Element, options?: object) => unknown;
declare const CMS: { registerEditorComponent: (definition: unknown) => void };
declare const cytoscape: (options?: object) => unknown;
declare const cytoscapeFcose: unknown;
declare const marked: { parse: (src: string, options?: object) => string };
