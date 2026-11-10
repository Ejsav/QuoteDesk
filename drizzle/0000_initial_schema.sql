CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`type` text NOT NULL,
	`lead_id` text,
	`customer_id` text,
	`operator_id` text,
	`actor_id` text,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`operator_id`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "activities_single_subject_ck" CHECK((("activities"."lead_id" is not null) + ("activities"."customer_id" is not null) + ("activities"."operator_id" is not null)) <= 1)
);
--> statement-breakpoint
CREATE INDEX `activities_workspace_created_idx` ON `activities` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `activities_lead_created_idx` ON `activities` (`lead_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `activities_customer_created_idx` ON `activities` (`customer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `activities_operator_created_idx` ON `activities` (`operator_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`full_name` text NOT NULL,
	`company_name` text,
	`email` text,
	`phone` text,
	`preferred_contact` text,
	`notes` text,
	`client_request_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "customers_reachable_ck" CHECK("customers"."email" is not null or "customers"."phone" is not null),
	CONSTRAINT "customers_preferred_contact_ck" CHECK(("customers"."preferred_contact" is null or "customers"."preferred_contact" in ('phone', 'text', 'email')))
);
--> statement-breakpoint
CREATE INDEX `customers_workspace_name_idx` ON `customers` (`workspace_id`,`full_name`);--> statement-breakpoint
CREATE INDEX `customers_workspace_email_idx` ON `customers` (`workspace_id`,`email`);--> statement-breakpoint
CREATE INDEX `customers_workspace_phone_idx` ON `customers` (`workspace_id`,`phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `customers_workspace_request_uq` ON `customers` (`workspace_id`,`client_request_id`);--> statement-breakpoint
CREATE TABLE `lead_stops` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`position` integer NOT NULL,
	`location` text NOT NULL,
	`note` text,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lead_stops_position_uq` ON `lead_stops` (`lead_id`,`position`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`number` integer NOT NULL,
	`customer_id` text NOT NULL,
	`status` text NOT NULL,
	`lost_reason` text,
	`priority` text DEFAULT 'normal' NOT NULL,
	`source` text NOT NULL,
	`occasion` text,
	`event_name` text,
	`service_type` text,
	`trip_date` text,
	`pickup_time` text,
	`time_zone` text NOT NULL,
	`pickup_at` integer,
	`duration_minutes` integer,
	`pickup_location` text,
	`destination` text,
	`passengers_min` integer,
	`passengers_max` integer,
	`vehicle_category` text,
	`budget_cents` integer,
	`follow_up_date` text,
	`follow_up_note` text,
	`notes` text,
	`status_changed_at` integer NOT NULL,
	`qualified_at` integer,
	`first_response_at` integer,
	`last_activity_at` integer NOT NULL,
	`created_by_id` text,
	`client_request_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "leads_status_ck" CHECK("leads"."status" in ('new', 'contacted', 'qualified', 'on_hold', 'lost')),
	CONSTRAINT "leads_lost_reason_ck" CHECK(("leads"."status" = 'lost' and "leads"."lost_reason" is not null and "leads"."lost_reason" in ('no_response', 'chose_competitor', 'budget', 'trip_cancelled', 'not_a_fit', 'duplicate', 'spam', 'other')) or ("leads"."status" <> 'lost' and "leads"."lost_reason" is null)),
	CONSTRAINT "leads_priority_ck" CHECK("leads"."priority" in ('low', 'normal', 'high', 'urgent')),
	CONSTRAINT "leads_source_ck" CHECK("leads"."source" in ('website', 'phone', 'email', 'referral', 'partner', 'repeat', 'instagram', 'google', 'other')),
	CONSTRAINT "leads_occasion_ck" CHECK(("leads"."occasion" is null or "leads"."occasion" in ('wedding', 'corporate', 'airport', 'bachelor', 'birthday', 'nightlife', 'prom', 'concert_sports', 'wine_tour', 'funeral', 'group_event', 'other'))),
	CONSTRAINT "leads_service_type_ck" CHECK(("leads"."service_type" is null or "leads"."service_type" in ('one_way', 'round_trip', 'hourly'))),
	CONSTRAINT "leads_vehicle_ck" CHECK(("leads"."vehicle_category" is null or "leads"."vehicle_category" in ('sedan', 'suv', 'sprinter', 'stretch_limo', 'suv_limo', 'party_bus', 'mini_coach', 'motor_coach', 'trolley', 'no_preference'))),
	CONSTRAINT "leads_passengers_ck" CHECK(("leads"."passengers_min" is null and "leads"."passengers_max" is null) or ("leads"."passengers_min" is not null and "leads"."passengers_max" is not null and "leads"."passengers_min" >= 1 and "leads"."passengers_max" >= "leads"."passengers_min")),
	CONSTRAINT "leads_budget_ck" CHECK("leads"."budget_cents" is null or "leads"."budget_cents" >= 0),
	CONSTRAINT "leads_duration_ck" CHECK("leads"."duration_minutes" is null or "leads"."duration_minutes" > 0),
	CONSTRAINT "leads_trip_date_ck" CHECK(("leads"."trip_date" is null or "leads"."trip_date" glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')),
	CONSTRAINT "leads_follow_up_date_ck" CHECK(("leads"."follow_up_date" is null or "leads"."follow_up_date" glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')),
	CONSTRAINT "leads_pickup_time_ck" CHECK("leads"."pickup_time" is null or ("leads"."trip_date" is not null and "leads"."pickup_time" glob '[0-2][0-9]:[0-5][0-9]')),
	CONSTRAINT "leads_follow_up_note_ck" CHECK("leads"."follow_up_note" is null or "leads"."follow_up_date" is not null),
	CONSTRAINT "leads_qualified_facts_ck" CHECK("leads"."status" <> 'qualified' or ("leads"."trip_date" is not null and "leads"."pickup_location" is not null and "leads"."passengers_min" is not null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leads_workspace_number_uq` ON `leads` (`workspace_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `leads_workspace_request_uq` ON `leads` (`workspace_id`,`client_request_id`);--> statement-breakpoint
CREATE INDEX `leads_workspace_status_idx` ON `leads` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `leads_workspace_trip_idx` ON `leads` (`workspace_id`,`trip_date`);--> statement-breakpoint
CREATE INDEX `leads_workspace_follow_up_idx` ON `leads` (`workspace_id`,`follow_up_date`);--> statement-breakpoint
CREATE INDEX `leads_workspace_created_idx` ON `leads` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `leads_customer_idx` ON `leads` (`customer_id`);--> statement-breakpoint
CREATE TABLE `operator_compliance` (
	`id` text PRIMARY KEY NOT NULL,
	`operator_id` text NOT NULL,
	`kind` text NOT NULL,
	`label` text,
	`status` text NOT NULL,
	`reference` text,
	`expires_on` text,
	`verified_on` text,
	`verified_by_id` text,
	`evidence_note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`operator_id`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`verified_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "operator_compliance_kind_ck" CHECK("operator_compliance"."kind" in ('insurance', 'usdot', 'state_authority', 'local_license', 'vehicle_inspection', 'chauffeur_screening', 'other')),
	CONSTRAINT "operator_compliance_status_ck" CHECK("operator_compliance"."status" in ('reported', 'received', 'verified', 'issue')),
	CONSTRAINT "operator_compliance_label_ck" CHECK("operator_compliance"."kind" <> 'other' or "operator_compliance"."label" is not null),
	CONSTRAINT "operator_compliance_dates_ck" CHECK(("operator_compliance"."expires_on" is null or "operator_compliance"."expires_on" glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]') and ("operator_compliance"."verified_on" is null or "operator_compliance"."verified_on" glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')),
	CONSTRAINT "operator_compliance_evidence_ck" CHECK("operator_compliance"."status" <> 'verified' or ("operator_compliance"."verified_on" is not null and "operator_compliance"."evidence_note" is not null))
);
--> statement-breakpoint
CREATE INDEX `operator_compliance_operator_idx` ON `operator_compliance` (`operator_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `operator_compliance_kind_uq` ON `operator_compliance` (`operator_id`,`kind`) WHERE "operator_compliance"."kind" <> 'other';--> statement-breakpoint
CREATE TABLE `operator_vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`operator_id` text NOT NULL,
	`category` text NOT NULL,
	`label` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`capacity` integer,
	`amenities` text DEFAULT '[]' NOT NULL,
	`notes` text,
	`verified_on` text,
	`verification_note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`operator_id`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "operator_vehicles_category_ck" CHECK("operator_vehicles"."category" in ('sedan', 'suv', 'sprinter', 'stretch_limo', 'suv_limo', 'party_bus', 'mini_coach', 'motor_coach', 'trolley')),
	CONSTRAINT "operator_vehicles_quantity_ck" CHECK("operator_vehicles"."quantity" >= 1),
	CONSTRAINT "operator_vehicles_capacity_ck" CHECK("operator_vehicles"."capacity" is null or "operator_vehicles"."capacity" > 0),
	CONSTRAINT "operator_vehicles_verified_on_ck" CHECK(("operator_vehicles"."verified_on" is null or "operator_vehicles"."verified_on" glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')),
	CONSTRAINT "operator_vehicles_verification_ck" CHECK(("operator_vehicles"."verified_on" is null and "operator_vehicles"."verification_note" is null) or ("operator_vehicles"."verified_on" is not null and "operator_vehicles"."verification_note" is not null))
);
--> statement-breakpoint
CREATE INDEX `operator_vehicles_operator_idx` ON `operator_vehicles` (`operator_id`);--> statement-breakpoint
CREATE TABLE `operators` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`company_name` text NOT NULL,
	`contact_name` text,
	`phone` text,
	`email` text,
	`website` text,
	`base_location` text,
	`service_areas` text DEFAULT '[]' NOT NULL,
	`status` text NOT NULL,
	`notes` text,
	`client_request_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "operators_status_ck" CHECK("operators"."status" in ('prospect', 'active', 'preferred', 'paused', 'do_not_use'))
);
--> statement-breakpoint
CREATE INDEX `operators_workspace_name_idx` ON `operators` (`workspace_id`,`company_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `operators_workspace_request_uq` ON `operators` (`workspace_id`,`client_request_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "users_role_ck" CHECK("users"."role" in ('owner', 'admin', 'agent'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_workspace_email_uq` ON `users` (`workspace_id`,`email`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`time_zone` text NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`next_lead_number` integer DEFAULT 1001 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_slug_unique` ON `workspaces` (`slug`);