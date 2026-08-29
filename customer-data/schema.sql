-- Tiger customer data platform — canonical schema
-- IMPORTANT: This file defines structure only. Never commit production PII or raw exports to Git.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text,
  last_name text,
  email text,
  phone text,
  locale text,
  country_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX customers_email_lower_idx
  ON customers (lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX customers_phone_idx
  ON customers (phone)
  WHERE phone IS NOT NULL;

CREATE TABLE customer_external_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  source text NOT NULL,
  external_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE INDEX customer_external_ids_customer_idx ON customer_external_ids(customer_id);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL,
  brand text,
  product_family text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_external_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  source text NOT NULL,
  external_id text NOT NULL,
  external_title text,
  sku text,
  UNIQUE (source, external_id)
);

CREATE INDEX product_external_ids_product_idx ON product_external_ids(product_id);
CREATE INDEX product_external_ids_sku_idx ON product_external_ids(sku) WHERE sku IS NOT NULL;

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  source text NOT NULL,
  external_order_id text NOT NULL,
  order_name text,
  currency text,
  subtotal numeric(14,2),
  discounts numeric(14,2),
  shipping numeric(14,2),
  tax numeric(14,2),
  total numeric(14,2),
  financial_status text,
  fulfillment_status text,
  ordered_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_order_id)
);

CREATE INDEX orders_customer_idx ON orders(customer_id);
CREATE INDEX orders_ordered_at_idx ON orders(ordered_at);

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  source text NOT NULL,
  external_line_item_id text,
  external_product_id text,
  external_variant_id text,
  title_at_purchase text,
  variant_title_at_purchase text,
  sku text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(14,2),
  total_price numeric(14,2),
  UNIQUE (source, external_line_item_id)
);

CREATE INDEX order_items_order_idx ON order_items(order_id);
CREATE INDEX order_items_product_idx ON order_items(product_id);
CREATE INDEX order_items_sku_idx ON order_items(sku) WHERE sku IS NOT NULL;

CREATE TABLE customer_product_cohorts (
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  first_order_at timestamptz,
  last_order_at timestamptz,
  order_count integer NOT NULL DEFAULT 0,
  unit_count integer NOT NULL DEFAULT 0,
  lifetime_revenue numeric(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (customer_id, product_id)
);

CREATE TABLE survey_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  source text NOT NULL,
  external_submission_id text NOT NULL,
  form_external_id text,
  form_name text,
  submitted_at timestamptz,
  imported_at timestamptz NOT NULL DEFAULT now(),
  raw_payload jsonb,
  UNIQUE (source, external_submission_id)
);

CREATE INDEX survey_submissions_customer_idx ON survey_submissions(customer_id);

CREATE TABLE survey_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES survey_submissions(id) ON DELETE CASCADE,
  question_key text NOT NULL,
  question_label text,
  answer_text text,
  answer_json jsonb
);

CREATE INDEX survey_answers_submission_idx ON survey_answers(submission_id);
CREATE INDEX survey_answers_question_key_idx ON survey_answers(question_key);

CREATE TABLE customer_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  namespace text NOT NULL,
  key text NOT NULL,
  value_json jsonb NOT NULL,
  source text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, namespace, key)
);

CREATE TABLE customer_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  channel text NOT NULL,
  status text NOT NULL,
  source text NOT NULL,
  captured_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, channel)
);

CREATE TABLE sync_events (
  id bigserial PRIMARY KEY,
  source text NOT NULL,
  entity_type text NOT NULL,
  external_id text,
  operation text NOT NULL,
  status text NOT NULL,
  error_message text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sync_events_source_entity_idx ON sync_events(source, entity_type, occurred_at DESC);

-- Derived cohort refresh example:
-- Product cohort membership is computed from order_items + orders, not guessed from surveys.
-- Survey answers can enrich a customer's profile but should remain attributable to their source.
