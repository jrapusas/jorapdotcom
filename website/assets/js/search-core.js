/**
 * Pure search match/rank helpers shared by the client UI and Node tests.
 */

export const DEFAULT_SEARCH_OPTS = {
  description: true,
  tags: true,
  categories: true,
};

export function slugify(string) {
  return encodeURIComponent(string.trim().replace(/[\s_]+/g, "-").toLowerCase());
}

export function escapeHtml(input) {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function capitalizeFirstLetter(string) {
  return string
    .replace(/^[\s_]+|[\s_]+$/g, "")
    .replace(/[_\s]+/g, " ")
    .replace(/^[a-z]/, (m) => m.toUpperCase());
}

function noteBodyText(item) {
  return [
    item.content,
    item.keyConcept,
    item.shareableThought,
    item.relationships,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function matchesSearch(item, query, opts = DEFAULT_SEARCH_OPTS) {
  const q = query.toLowerCase();
  return (
    item.title.toLowerCase().includes(q) ||
    (opts.description ? item.description?.toLowerCase().includes(q) : false) ||
    item.searchKeyword.toLowerCase().includes(q) ||
    (opts.tags ? item.tags?.toLowerCase().includes(q) : false) ||
    (opts.categories ? item.categories?.toLowerCase().includes(q) : false) ||
    noteBodyText(item).includes(q)
  );
}

export function searchMatchPriority(item, query) {
  const q = query.toLowerCase();
  const title = item.title.toLowerCase();
  if (title === q) return 0;
  if (title.includes(q)) return 1;
  if (noteBodyText(item).includes(q)) return 2;
  return 3;
}

export function filterAndSortSearchResults(items, query, opts = DEFAULT_SEARCH_OPTS) {
  return items
    .filter((item) => matchesSearch(item, query, opts))
    .sort(
      (a, b) => searchMatchPriority(a, query) - searchMatchPriority(b, query),
    );
}

export function groupByConfiguredSections(index, sections) {
  return sections.map((section) => {
    const data = index.filter(
      (item) => slugify(item.section) === slugify(section),
    );
    return {
      section: capitalizeFirstLetter(section.replace(/[-_]/g, " ")),
      data,
    };
  });
}

export function searchIndex(index, sections, query, opts = DEFAULT_SEARCH_OPTS) {
  const grouped = groupByConfiguredSections(index, sections);
  if (!query) return [];

  return grouped
    .map((group) => ({
      ...group,
      data: filterAndSortSearchResults(group.data, query, opts),
    }))
    .filter((group) => group.data.length > 0);
}
