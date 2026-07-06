const sanitizeText = (text, maxLength = 255) => {
    if (!text) return null;
    return text.trim().substring(0, maxLength).replace(/<[^>]*>?/gm, "");
  };
  const parseNumber = (value, allowDecimal = false) => {
    const parsed = allowDecimal ? parseFloat(value) : parseInt(value);
    return isNaN(parsed) || parsed < 0 ? null : parsed;
  };
  module.exports = { sanitizeText, parseNumber };
  