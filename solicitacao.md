Estou com problema na verificação da assinatura do meu aplicativo. Ao fazer o upgrade, no supabase parece dar certo, mas meu aplicativo está aparecendo contra gratuita ainda.

O meu webhook no stripe tem o destination ID (we_1ShdC3JkxX3Me4wlyYUmsIAX) e o endpoint URL (https://dgweztejbixowxmfizgx.supabase.co/functions/v1/stripe-webhook) com signing secret (whsec_ja7nAWl1Tpyep93U2IskGLvmxbTLsHUI) porém olhando no overview de 45 eventos, 45 deram falha. No supabase eu adicionei STRIPE_WEBHOOK_SECRET=whsec_ja7nAWl1Tpyep93U2IskGLvmxbTLsHUI.


===
ESTE FOI O REQUEST:
===

{
  "id": "evt_1Sk3oiJkxX3Me4wlTNMibuMD",
  "object": "event",
  "api_version": "2025-11-17.clover",
  "created": 1767104552,
  "data": {
    "object": {
      "id": "sub_1Sk3odJkxX3Me4wlINoDdnVV",
      "object": "subscription",
      "application": null,
      "application_fee_percent": null,
      "automatic_tax": {
        "disabled_reason": null,
        "enabled": false,
        "liability": null
      },
      "billing_cycle_anchor": 1767104547,
      "billing_cycle_anchor_config": null,
      "billing_mode": {
        "flexible": null,
        "type": "classic"
      },
      "billing_thresholds": null,
      "cancel_at": null,
      "cancel_at_period_end": false,
      "canceled_at": null,
      "cancellation_details": {
        "comment": null,
        "feedback": null,
        "reason": null
      },
      "collection_method": "charge_automatically",
      "created": 1767104547,
      "currency": "brl",
      "customer": "cus_Tex9IQFQjenXJI",
      "customer_account": null,
      "days_until_due": null,
      "default_payment_method": "pm_1Sk3ocJkxX3Me4wlAIMYXrxv",
      "default_source": null,
      "default_tax_rates": [],
      "description": null,
      "discounts": [],
      "ended_at": null,
      "invoice_settings": {
        "account_tax_ids": null,
        "issuer": {
          "type": "self"
        }
      },
      "items": {
        "object": "list",
        "data": [
          {
            "id": "si_ThSkODueLtPEAf",
            "object": "subscription_item",
            "billing_thresholds": null,
            "created": 1767104548,
            "current_period_end": 1769782947,
            "current_period_start": 1767104547,
            "discounts": [],
            "metadata": {},
            "plan": {
              "id": "price_1Sd9F5JkxX3Me4wl1xNRb5Kh",
              "object": "plan",
              "active": true,
              "amount": 3800,
              "amount_decimal": "3800",
              "billing_scheme": "per_unit",
              "created": 1765457111,
              "currency": "brl",
              "interval": "month",
              "interval_count": 1,
              "livemode": false,
              "metadata": {},
              "meter": null,
              "nickname": null,
              "product": "prod_TaJsysi99Q1g2J",
              "tiers_mode": null,
              "transform_usage": null,
              "trial_period_days": null,
              "usage_type": "licensed"
            },
            "price": {
              "id": "price_1Sd9F5JkxX3Me4wl1xNRb5Kh",
              "object": "price",
              "active": true,
              "billing_scheme": "per_unit",
              "created": 1765457111,
              "currency": "brl",
              "custom_unit_amount": null,
              "livemode": false,
              "lookup_key": null,
              "metadata": {},
              "nickname": null,
              "product": "prod_TaJsysi99Q1g2J",
              "recurring": {
                "interval": "month",
                "interval_count": 1,
                "meter": null,
                "trial_period_days": null,
                "usage_type": "licensed"
              },
              "tax_behavior": "unspecified",
              "tiers_mode": null,
              "transform_quantity": null,
              "type": "recurring",
              "unit_amount": 3800,
              "unit_amount_decimal": "3800"
            },
            "quantity": 1,
            "subscription": "sub_1Sk3odJkxX3Me4wlINoDdnVV",
            "tax_rates": []
          }
        ],
        "has_more": false,
        "total_count": 1,
        "url": "/v1/subscription_items?subscription=sub_1Sk3odJkxX3Me4wlINoDdnVV"
      },
      "latest_invoice": "in_1Sk3odJkxX3Me4wl5uIk7fyJ",
      "livemode": false,
      "metadata": {},
      "next_pending_invoice_item_invoice": null,
      "on_behalf_of": null,
      "pause_collection": null,
      "payment_settings": {
        "payment_method_options": {
          "acss_debit": null,
          "bancontact": null,
          "card": {
            "network": null,
            "request_three_d_secure": "automatic"
          },
          "customer_balance": null,
          "konbini": null,
          "payto": null,
          "sepa_debit": null,
          "us_bank_account": null
        },
        "payment_method_types": null,
        "save_default_payment_method": "off"
      },
      "pending_invoice_item_interval": null,
      "pending_setup_intent": null,
      "pending_update": null,
      "plan": {
        "id": "price_1Sd9F5JkxX3Me4wl1xNRb5Kh",
        "object": "plan",
        "active": true,
        "amount": 3800,
        "amount_decimal": "3800",
        "billing_scheme": "per_unit",
        "created": 1765457111,
        "currency": "brl",
        "interval": "month",
        "interval_count": 1,
        "livemode": false,
        "metadata": {},
        "meter": null,
        "nickname": null,
        "product": "prod_TaJsysi99Q1g2J",
        "tiers_mode": null,
        "transform_usage": null,
        "trial_period_days": null,
        "usage_type": "licensed"
      },
      "quantity": 1,
      "schedule": null,
      "start_date": 1767104547,
      "status": "active",
      "test_clock": null,
      "transfer_data": null,
      "trial_end": null,
      "trial_settings": {
        "end_behavior": {
          "missing_payment_method": "create_invoice"
        }
      },
      "trial_start": null
    },
    "previous_attributes": {
      "default_payment_method": null,
      "status": "incomplete"
    }
  },
  "livemode": false,
  "pending_webhooks": 1,
  "request": {
    "id": null,
    "idempotency_key": "62539e19-0ae9-49ca-afde-f16cdf2a6fe1"
  },
  "type": "customer.subscription.updated"
}

===
ESTE FOI O RESPONSE:
===
HTTP status code
400



