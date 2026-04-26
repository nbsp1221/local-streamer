const TAG_ALLOWED_CHARACTERS_PATTERN = /[^a-z0-9_-]/g;
const TAG_WHITESPACE_PATTERN = /\s+/g;
const TAG_REPEATED_UNDERSCORE_PATTERN = /_+/g;
const TAG_LETTER_OR_NUMBER_PATTERN = /[a-z0-9]/;

function isTagLetterOrNumber(character: string | undefined): boolean {
  return Boolean(character && TAG_LETTER_OR_NUMBER_PATTERN.test(character));
}

function removeUnsupportedUnderscoreSeparators(value: string): string {
  let normalizedValue = '';

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (
      character === '_' &&
      (!isTagLetterOrNumber(value[index - 1]) || !isTagLetterOrNumber(value[index + 1]))
    ) {
      continue;
    }

    normalizedValue += character;
  }

  return normalizedValue;
}

export function normalizeVideoTag(rawTag: string): string | null {
  const normalizedTag = rawTag
    .trim()
    .toLowerCase()
    .replace(TAG_WHITESPACE_PATTERN, '_')
    .replace(TAG_ALLOWED_CHARACTERS_PATTERN, '')
    .replace(TAG_REPEATED_UNDERSCORE_PATTERN, '_');
  const canonicalTag = removeUnsupportedUnderscoreSeparators(normalizedTag);

  return TAG_LETTER_OR_NUMBER_PATTERN.test(canonicalTag) ? canonicalTag : null;
}

export function normalizeVideoTags(rawTags: string[]): string[] {
  const seenTags = new Set<string>();
  const normalizedTags: string[] = [];

  for (const rawTag of rawTags) {
    const tag = normalizeVideoTag(rawTag);

    if (!tag || seenTags.has(tag)) {
      continue;
    }

    seenTags.add(tag);
    normalizedTags.push(tag);
  }

  return normalizedTags;
}

export function formatVideoTagLabel(tag: string): string {
  return tag.replaceAll('_', ' ');
}
