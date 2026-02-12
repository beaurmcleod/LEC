// TikTok Pixel helper utilities
// Pixel is loaded globally in index.html with ID D66JVNRC77U2V3Q5HKC0

declare global {
  interface Window {
    ttq?: any;
  }
}

const getTTQ = () => window.ttq;

interface TikTokContent {
  content_id: string;
  content_type: "product" | "product_group";
  content_name: string;
}

interface TikTokEventParams {
  contents: TikTokContent[];
  value: number;
  currency: string;
}

export const ttqTrack = {
  viewContent: (product: { id: string; title: string; price: string }) => {
    const ttq = getTTQ();
    if (!ttq) return;
    ttq.track("ViewContent", buildParams(product));
  },

  addToCart: (product: { id: string; title: string; price: string }) => {
    const ttq = getTTQ();
    if (!ttq) return;
    ttq.track("AddToCart", buildParams(product));
  },

  initiateCheckout: (product: { id: string; title: string; price: string }) => {
    const ttq = getTTQ();
    if (!ttq) return;
    ttq.track("InitiateCheckout", buildParams(product));
  },

  addPaymentInfo: (product: { id: string; title: string; price: string }) => {
    const ttq = getTTQ();
    if (!ttq) return;
    ttq.track("AddPaymentInfo", buildParams(product));
  },

  purchase: (product: { id: string; title: string; price: string }) => {
    const ttq = getTTQ();
    if (!ttq) return;
    ttq.track("Purchase", buildParams(product));
  },

  completeRegistration: () => {
    const ttq = getTTQ();
    if (!ttq) return;
    ttq.track("CompleteRegistration", {});
  },
};

function parsePrice(price: string): number {
  const num = parseFloat(String(price).replace(/[^0-9.]/g, ""));
  return isNaN(num) ? 0 : num;
}

function buildParams(product: { id: string; title: string; price: string }): TikTokEventParams {
  return {
    contents: [
      {
        content_id: product.id,
        content_type: "product",
        content_name: product.title,
      },
    ],
    value: parsePrice(product.price),
    currency: "USD",
  };
}
