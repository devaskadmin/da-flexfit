/**
 * browserDetect.js
 *
 * Temporary debug utility — detects browser name, version, and platform from
 * navigator.userAgent.  Used to help diagnose Safari/iOS login issues.
 *
 * TEMP: Remove or gate behind an env flag before final production release.
 */

export function detectBrowser() {
  const ua = navigator.userAgent || '';

  let browser = 'Unknown';
  let version = 'Unknown';

  if (/chrome|crios|crmo/i.test(ua) && !/edg/i.test(ua)) {
    browser = 'Chrome';
    version = ua.match(/(chrome|crios)\/(\d+)/i)?.[2] ?? 'Unknown';
  } else if (/safari/i.test(ua) && !/chrome|crios|crmo/i.test(ua)) {
    browser = 'Safari';
    version = ua.match(/version\/(\d+)/i)?.[1] ?? 'Unknown';
  } else if (/firefox|fxios/i.test(ua)) {
    browser = 'Firefox';
    version = ua.match(/(firefox|fxios)\/(\d+)/i)?.[2] ?? 'Unknown';
  } else if (/edg/i.test(ua)) {
    browser = 'Edge';
    version = ua.match(/edg\/(\d+)/i)?.[1] ?? 'Unknown';
  }

  let platform = 'Unknown';

  if (/iphone|ipad|ipod/i.test(ua)) {
    platform = 'iOS';
  } else if (/android/i.test(ua)) {
    platform = 'Android';
  } else if (/macintosh|mac os x/i.test(ua)) {
    platform = 'Mac';
  } else if (/windows/i.test(ua)) {
    platform = 'Windows';
  }

  return {
    name: browser,
    version,
    platform,
    userAgent: ua,
  };
}
