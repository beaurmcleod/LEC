import { LegalPage } from "@/components/LegalPage";

const Cookies = () => (
  <LegalPage title="Cookie Policy" updated="May 30, 2026">
    <h2>1. What cookies are</h2>
    <p>Small files that help the site function and remember your preferences.</p>

    <h2>2. Types we use</h2>
    <ul>
      <li><strong>Essential</strong> — cart, checkout, login.</li>
      <li><strong>Analytics</strong> — site usage.</li>
      <li><strong>Marketing</strong> — ads and affiliate performance.</li>
    </ul>

    <h2>3. Managing cookies</h2>
    <p>You can control or delete cookies via your browser settings. Disabling essential cookies may break checkout.</p>

    <h2>4. Contact</h2>
    <p><a href="mailto:beau@lowendcandy.com">beau@lowendcandy.com</a></p>
  </LegalPage>
);

export default Cookies;
