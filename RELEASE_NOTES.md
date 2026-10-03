# ShopRight Release Notes — October 3, 2026

## What's New

**Full Android and iPhone Support with Mobile Optimization**

ShopRight now runs flawlessly on Android phones (Chrome) and iPhones (Safari) with comprehensive automatic testing to ensure every update works across all devices.

---

## Key Improvements

### 🧪 Continuous Mobile Testing
- Every update is tested automatically on **Android Chrome (Pixel 7)**, **iPhone Safari (iPhone 15)**, and **small iPhones (320px)**
- 24 browser tests run on every deployment to GitHub
- Tests verify the app works correctly with real phone screens, touch interactions, and mobile browsers
- Live production testing on Android and iPhone ensures the app works in the real world

### 🐛 Bug Fix: Tooltips Now Stay On-Screen
- Fixed an issue where the "Also shopped last week" tooltip (↻ icon) would run off the right edge on small iPhones
- Tooltips now intelligently reposition themselves to stay fully visible on all screen sizes, from 320px to desktop
- Confirmed working on all phone sizes: Pixel 7 (412px), iPhone 15 (390px), and iPhone SE (320px)

### 📱 What This Means
- **Reliable on any phone**: Whether you're using a 2-year-old iPhone SE or the latest Android flagship, ShopRight works consistently
- **Faster bug detection**: Problems are caught automatically across all devices before they reach you
- **Confidence in updates**: Each new feature or fix has been tested on real phone browsers before deployment

---

## Testing Details

All browser tests are powered by **Playwright**, which emulates real phone devices with:
- Authentic phone screen sizes and pixel densities
- Real Chrome (Chromium) and Safari (WebKit) browsers — the exact engines your phone uses
- Touch input, phone user agents, and mobile viewport behavior

This ensures what we test is what you use.

---

## For Technical Users

- Backend: Python FastAPI with pytest coverage
- Frontend: React 19 with component unit tests
- E2E: Playwright browser automation (mocked API for safety)
- Production monitoring: Live tests on shopright-jet.vercel.app after each deployment
- CI/CD: GitHub Actions runs tests on every push to main

See `README.md` → **Run the tests** for details.

---

## Known Limitations

- Tests run in a sandboxed environment with a mocked API to ensure safety — the app never touches real data during testing
- Production tests use a throwaway test account to verify the real API works

---

## Questions?

If you notice anything unusual on your phone, please let Eli know. Your real-world feedback helps us catch edge cases tests might miss.

**Happy shopping! 📱**
