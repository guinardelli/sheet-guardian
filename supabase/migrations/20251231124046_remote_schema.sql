drop extension if exists "pg_net";

drop function if exists "public"."create_missing_subscription"(p_user_id uuid);

alter table "public"."profiles" drop column "full_name";

alter table "public"."subscriptions" add column "stripe_customer_id" text;

alter table "public"."subscriptions" add column "stripe_product_id" text;

alter table "public"."subscriptions" add column "stripe_subscription_id" text;

CREATE UNIQUE INDEX auth_attempts_ip_address_idx ON public.auth_attempts USING btree (ip_address, created_at);

CREATE INDEX idx_subscriptions_stripe_customer ON public.subscriptions USING btree (stripe_customer_id);

CREATE UNIQUE INDEX subscriptions_stripe_customer_id_key ON public.subscriptions USING btree (stripe_customer_id);

CREATE UNIQUE INDEX subscriptions_stripe_subscription_id_key ON public.subscriptions USING btree (stripe_subscription_id);

alter table "public"."auth_attempts" add constraint "auth_attempts_ip_address_idx" UNIQUE using index "auth_attempts_ip_address_idx";

alter table "public"."subscriptions" add constraint "subscriptions_stripe_customer_id_key" UNIQUE using index "subscriptions_stripe_customer_id_key";

alter table "public"."subscriptions" add constraint "subscriptions_stripe_subscription_id_key" UNIQUE using index "subscriptions_stripe_subscription_id_key";


