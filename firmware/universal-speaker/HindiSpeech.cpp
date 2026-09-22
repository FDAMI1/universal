#include "HindiSpeech.h"
#include <string.h>

namespace {

struct ClipWriter {
  ClipId* out;
  size_t cap;
  size_t len = 0;
  void add(ClipId clip) {
    if (len < cap) out[len++] = clip;
  }
};

// 1–99 are irregular in Hindi, so each has its own clip (CLIP_N1 + n - 1).
void addUnder100(ClipWriter& w, uint32_t n) {
  if (n > 0) w.add(static_cast<ClipId>(CLIP_N1 + n - 1));
}

// Indian grouping: करोड़ (1e7), लाख (1e5), हज़ार (1e3), सौ (1e2), then 1–99.
// Crores above 99 recurse ("एक सौ करोड़").
void addNumber(ClipWriter& w, uint32_t n) {
  if (n >= 10000000) {
    addNumber(w, n / 10000000);
    w.add(CLIP_CRORE);
    n %= 10000000;
  }
  if (n >= 100000) {
    addUnder100(w, n / 100000);
    w.add(CLIP_LAKH);
    n %= 100000;
  }
  if (n >= 1000) {
    addUnder100(w, n / 1000);
    w.add(CLIP_HAZAAR);
    n %= 1000;
  }
  if (n >= 100) {
    addUnder100(w, n / 100);
    w.add(CLIP_SAU);
    n %= 100;
  }
  addUnder100(w, n);
}

void addDigits(ClipWriter& w, const char* text) {
  for (const char* c = text; *c; ++c) {
    if (*c == '0') w.add(CLIP_SHUNYA);
    else if (*c >= '1' && *c <= '9') addUnder100(w, *c - '0');
    else if (*c == '.') w.add(CLIP_DOT);
  }
}

}  // namespace

size_t buildIpAndPinAnnouncement(const char* ip, const char* pin, ClipId* out, size_t cap) {
  ClipWriter w{out, cap};
  w.add(CLIP_IP_ADDRESS);
  addDigits(w, ip);
  w.add(CLIP_PIN);
  addDigits(w, pin);
  return w.len;
}

PaymentSource parsePaymentSource(const char* source) {
  if (source && strcmp(source, "google_pay_personal") == 0) return PaymentSource::GooglePayPersonal;
  if (source && strcmp(source, "bank_sms") == 0) return PaymentSource::BankSms;
  return PaymentSource::Merchant;
}

size_t buildPaymentAnnouncement(PaymentSource source, uint32_t amountPaise, ClipId* out, size_t cap) {
  ClipWriter w{out, cap};
  switch (source) {
    case PaymentSource::GooglePayPersonal: w.add(CLIP_PREFIX_GPAY); break;
    case PaymentSource::BankSms: w.add(CLIP_PREFIX_BANK); break;
    default: w.add(CLIP_PREFIX_MERCHANT); break;
  }

  const uint32_t rupees = amountPaise / 100;
  const uint32_t paise = amountPaise % 100;
  if (rupees > 0) {
    addNumber(w, rupees);
    w.add(rupees == 1 ? CLIP_RUPAYA : CLIP_RUPAYE);
  }
  if (paise > 0) {
    if (rupees > 0) w.add(CLIP_AUR);
    addUnder100(w, paise);
    w.add(CLIP_PAISE);
  }
  return w.len;
}
