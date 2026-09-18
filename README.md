# UPI PayLink

Scan any UPI QR code, set a fixed amount or a maximum, and share a link. Whoever opens it picks a UPI app (Google Pay, PhonePe, Paytm, BHIM, or any other) and pays. No login needed.

**Live:** https://upi-paylink.vercel.app

## How it works

1. **Create** (`/`): scan a UPI QR with the camera, upload a QR image, or type a UPI ID. Both `upi://pay?...` and BharatQR/EMV QR codes are supported.
2. **Set the amount**:
   - **Fixed amount**: the payer pays exactly this amount and can't change it.
   - **Up to a limit**: the payer types any amount from ₹1 up to the maximum.
3. **Share**: the link (`/pay/<id>`) is saved to Firestore. You can copy it, share it, or show it as a QR code.
4. **Pay** (`/pay/<id>`): the page builds the UPI deep link with the amount:
   - Android: `intent://` URLs send the payment to the chosen app (and open the Play Store if it isn't installed).
   - iOS: uses each app's own scheme (`gpay://`, `phonepe://`, `paytmmp://`) and falls back to `upi://`.
   - Desktop: shows a UPI QR to scan with a phone.

## For elderly users and people with broken phones

This app splits a UPI payment into two parts that can happen on **different phones, done by different people**:

- **Making the link** needs the QR code (or just the UPI ID) and someone who can set the amount.
- **Paying** needs only a link tap and a UPI PIN. There's no camera, no scanning, and no amount to type.

That helps in these situations:

### Elderly people who find UPI apps confusing
A family member creates the link with a **fixed amount** and sends it on WhatsApp. The elderly person:
1. Taps the link.
2. Taps their UPI app (big buttons with the app names).
3. Enters their UPI PIN.

They don't scan anything or type an amount, and they can't overpay by mistake. The amount is locked, and the pay page shows who is being paid in large text. This works well for regular payments like the milkman, the maid, rent, or a pharmacy bill.

### Paying for someone who is somewhere else
Say a parent is at a shop and can't pay (no UPI, low balance, or they're unsure how). Anyone there, like the parent or the shopkeeper, photographs the shop's QR code. The photo goes to a family member, who **uploads it** here, sets a limit ("up to ₹2,000"), and pays from anywhere. Or the family member shares the link with someone else trusted to pay. The limit caps how much can be paid.

### Broken camera
- **Making a link:** use **Upload QR image** (a screenshot, or a photo someone sent) or **Enter UPI ID**. No camera needed.
- **Paying:** a link is tapped, not scanned, so the payer never needs a working camera.

### Broken screen or phone (the payer has another device)
Open the link on **any browser**, such as a laptop, a tablet, or a borrowed phone. On a computer the pay page shows a UPI QR code with the amount already filled in. On a phone, tap **"Paying from another phone? Show QR"**. Then scan that QR with any working phone that has a UPI app. The amount and payee stay locked.

### Low-end phones and slow internet
The pay page is a single light web page. It needs no app install and no login, and it works in any mobile browser.

> The payer always approves the payment in their own UPI app with their own PIN. This app never sees PINs, bank details, or money. It only builds the payment request.

## Setup

1. Create a Firebase project and add a **Web app**. Then enable **Cloud Firestore**.
2. Copy the env file and fill in the web app config:
   ```bash
   cp .env.example .env.local
   ```
3. Deploy the security rules:
   ```bash
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules --project <your-project-id>
   ```
   Warning: this **replaces** all Firestore rules in that project. If the project already serves another app, merge your rules into its existing ones first.
4. Run the app:
   ```bash
   npm install
   npm run dev
   ```

The camera only works on `https://` or `localhost`. To test on a phone, deploy the app (for example to Vercel) or use an HTTPS tunnel.

## Deploy to Vercel

Import the repo on Vercel, add the six `NEXT_PUBLIC_FIREBASE_*` variables from `.env.example`, and deploy. No other configuration is needed.

## Data and security

- Collection `paylinks`: `{ pa, pn, extra, mode, amountPaise, note, createdAt }`. Amounts are stored as whole paise.
- `firestore.rules` allows anyone to create a valid link and to read a link by its ID. Listing, editing, and deleting are all blocked, so a link's amount can't be changed after it is created.
- There is no auth, so anyone can create links. To limit abuse, consider adding [Firebase App Check](https://firebase.google.com/docs/app-check).

## Limitations

- The amount limit is enforced on the pay page and in the UPI link it generates. A payer can still ignore the link, scan the payee's original QR, and pay any amount. This app can't stop that.
- Without a payment gateway, the app can't confirm that a payment happened.
- Some UPI apps block app-to-app payments to personal (non-merchant) UPI IDs, or cap them at a low amount. Merchant QR codes work most reliably.

## License

[MIT](LICENSE)
