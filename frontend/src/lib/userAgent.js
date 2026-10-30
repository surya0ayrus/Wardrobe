/**
 * Rough, readable summary of a browser user-agent string: browser, OS and device.
 * Good enough for an audit screen; not meant for exact detection.
 */
export function parseUserAgent(ua) {
  if (!ua) return null

  const browser = [
    [/Edg\/([\d]+)/, 'Edge'],
    [/OPR\/([\d]+)/, 'Opera'],
    [/Chrome\/([\d]+)/, 'Chrome'],
    [/Firefox\/([\d]+)/, 'Firefox'],
    [/Version\/([\d]+).*Safari/, 'Safari'],
  ].find(([pattern]) => pattern.test(ua))

  const os = [
    [/Android ([\d.]+)/, 'Android'],
    [/(iPhone|iPad).*OS ([\d_]+)/, 'iOS'],
    [/Windows NT/, 'Windows'],
    [/Mac OS X/, 'macOS'],
    [/Linux/, 'Linux'],
  ].find(([pattern]) => pattern.test(ua))

  return {
    browser: browser ? `${browser[1]} ${ua.match(browser[0])[1]}` : ua.split(/[ /]/)[0] || 'Unknown',
    os: os ? os[1] : 'Unknown',
    device: /Mobile|Android|iPhone|iPad/.test(ua) ? 'Phone / tablet' : 'Desktop',
  }
}
