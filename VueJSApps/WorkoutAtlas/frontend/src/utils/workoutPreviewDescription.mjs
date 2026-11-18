export const truncateTextAtWordBoundary = (value, maxChars = 140) => {
  const text = String(value || '').trim();
  const numericLimit = Number(maxChars || 0);

  if (!text || !Number.isFinite(numericLimit) || numericLimit <= 0 || text.length <= numericLimit) {
    return {
      text,
      isTruncated: false,
      originalText: text,
    };
  }

  const candidate = text.slice(0, numericLimit + 1);
  const minWordBoundaryIndex = Math.max(20, Math.floor(numericLimit * 0.6));
  const nearestBoundary = candidate.lastIndexOf(' ');
  const cutoffIndex = nearestBoundary >= minWordBoundaryIndex ? nearestBoundary : numericLimit;
  const clipped = text.slice(0, cutoffIndex).trim();
  const safeClipped = clipped || text.slice(0, numericLimit).trim();

  return {
    text: `${safeClipped}…`,
    isTruncated: true,
    originalText: text,
  };
};

export const getPreviewDescriptionDisplay = ({
  description,
  isMobile = false,
  isExpanded = false,
  maxChars = 140,
} = {}) => {
  const text = String(description || '').trim();
  if (!text) {
    return {
      shouldRender: false,
      text: '',
      showToggle: false,
      isExpanded: false,
      toggleLabel: '',
      isTruncated: false,
      originalText: '',
    };
  }

  if (!isMobile) {
    return {
      shouldRender: true,
      text,
      showToggle: false,
      isExpanded: true,
      toggleLabel: '',
      isTruncated: false,
      originalText: text,
    };
  }

  const collapsed = truncateTextAtWordBoundary(text, maxChars);
  if (!collapsed.isTruncated) {
    return {
      shouldRender: true,
      text,
      showToggle: false,
      isExpanded: true,
      toggleLabel: '',
      isTruncated: false,
      originalText: text,
    };
  }

  return {
    shouldRender: true,
    text: isExpanded ? text : collapsed.text,
    showToggle: true,
    isExpanded: Boolean(isExpanded),
    toggleLabel: isExpanded ? 'Show Less' : 'Show Details',
    isTruncated: true,
    originalText: text,
  };
};
