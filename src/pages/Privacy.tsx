import { LegalPage } from "@/components/LegalPage";

const Privacy = () => (
  <LegalPage title="Privacy Policy" updated="May 30, 2026">
    <h2>1. Information we collect</h2>
    <ul>
      <li>Name, email, and billing details you provide.</li>
      <li>Payment confirmation from Stripe (never full card numbers).</li>
      <li>Automatic usage data via cookies and analytics.</li>
    </ul>

    <h2>2. How we use it</h2>
    <ul>
      <li>Process orders and deliver Products.</li>
      <li>Provide customer support.</li>
      <li>Send order emails and opt-in marketing emails.</li>
      <li>Improve the site and prevent fraud.</li>
    </ul>

    <h2>3. Email marketing</h2>
    <p>Marketing email is opt-in. You can unsubscribe at any time.</p>

    <h2>4. Sharing</h2>
    <p>We do not sell your data. It is shared only with service providers (Stripe, email, hosting) and where required by law.</p>

    <h2>5. Cookies</h2>
    <p>See our <a href="/cookies">Cookie Policy</a>.</p>

    <h2>6. Retention</h2>
    <p>We keep data only as long as needed to provide the service and meet legal obligations.</p>

    <h2>7. Your rights</h2>
    <p>You can access, correct, delete your data, and opt out of marketing. Email <a href="mailto:beau@lowendcandy.com">beau@lowendcandy.com</a>.</p>

    <h2>8. California (CCPA)</h2>
    <p>California residents may request to know, delete, and opt out of any sale of personal info. We do not sell personal info. Email <a href="mailto:beau@lowendcandy.com">beau@lowendcandy.com</a>.</p>

    <h2>9. Security</h2>
    <p>We use reasonable safeguards, but no transmission is 100% secure.</p>

    <h2>10. Children</h2>
    <p>This site is not intended for anyone under 16.</p>

    <h2>11. Changes</h2>
    <p>If we update this policy, we will post the new date.</p>

    <h2>12. Contact</h2>
    <p><a href="mailto:beau@lowendcandy.com">beau@lowendcandy.com</a></p>
  </LegalPage>
);

export default Privacy;
