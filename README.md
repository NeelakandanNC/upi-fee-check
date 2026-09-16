# UPI Fee Check

A static site that answers two questions about the UPI merchant fee (MDR) that starts on **15 Oct 2026**:

1. **How much I have to pay in charges.** Upload bank statement PDFs or UPI app screenshots. Every payment is read and classified in the browser, then the NPCI rules are applied. People who pay always pay ₹0; the page also shows what merchants would pay.
2. **Should I worry?** A scroll-animated infographic built from official sources.

## Run locally

```bash
python3 -m http.server 5173
```

Open http://localhost:5173. ES modules need a server, so opening `index.html` directly won't work.

## Deploy on Vercel

It's a plain static site with no build step.

1. On Vercel, choose **Add New → Project** and import `NeelakandanNC/upi-fee-check`.
2. Framework preset: **Other**. Leave the build command and output directory empty.
3. Deploy.

`vercel.json` adds security headers and cache rules. Live at https://upi-fee-check.vercel.app. If the domain changes, update `og:url` and `og:image` in `index.html`.

## How extraction works (₹0 model cost)

| Step | Tool | Where |
|---|---|---|
| Text PDFs (incl. password-protected) | pdf.js | browser |
| Screenshots and scanned PDF pages | Tesseract.js | browser |
| Person vs merchant, fee category | Regex rules on UPI narration and VPA (`js/classify.js`) | browser |
| Mistakes | Editable amount, type and category in the results table | user |

Nothing is uploaded. Tesseract often misreads the ₹ sign, so amounts that might be wrong get a "check amount" flag.

**Next step if you want better screenshot accuracy:** add one serverless function that sends only the low-confidence images to a small vision model. Cache results by image hash, rate-limit by IP and set a monthly spending cap.

## Files

- `js/rules.js`: fee engine (NPCI FAQ, 15 Sep 2026)
- `js/extract.js`: PDF/OCR reading and statement/screenshot parsers
- `js/classify.js`: merchant/person and category rules
- `js/calculator.js`: upload flow and results table
- `js/worry.js`: infographic data and GSAP ScrollTrigger animations
- `vercel.json`: headers and caching for Vercel

## Sources

- NPCI, *FAQs: Merchant Discount Rate on Select UPI (P2M) Transactions*, 15 Sep 2026
- PIB / Ministry of Finance, *No Charges for UPI Users*, 8 Aug 2026 (PRID 2296594)
- RBI, *Discussion Paper on Charges in Payment Systems*, 17 Aug 2022 (Box 9)
- Dept. of Financial Services, incentive scheme disbursements FY22–FY25

---

Made by [neelakandannc.com](https://x.com/NeelakandanNC)
