/**
 * iPhone or iPad Safari, not installed on the home screen. Safari may then clear the app's storage
 * after about 7 days without a visit, so the parent area asks to add the app to the home screen.
 */
export function iosNotInstalled(): boolean {
  try {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const installed = (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches;
    return ios && !installed;
  } catch {
    return false;
  }
}
