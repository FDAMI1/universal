#pragma once
#include <stdint.h>
#include <stddef.h>
#include "clips.h"

// Payment sources, matching `PaymentSource` in src/shared/types/payment.ts.
enum class PaymentSource { Merchant, GooglePayPersonal, BankSms };

PaymentSource parsePaymentSource(const char* source);

// Fills `out` with the clip sequence for a payment announcement, e.g.
// "भुगतान प्राप्त हुआ, पाँच सौ रुपये". `amountPaise` is an integer in paise, as
// sent by the app. Returns the number of clips written (never more than `cap`).
size_t buildPaymentAnnouncement(PaymentSource source, uint32_t amountPaise, ClipId* out, size_t cap);

// "आई पी पता एक नौ दो डॉट ... पिन चार आठ ..." — read digit by digit, since the
// board has no display and these are what the user types into the app.
size_t buildIpAndPinAnnouncement(const char* ip, const char* pin, ClipId* out, size_t cap);
