


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."enforce_profile_has_welder_no"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = new.profile_id
      and p.welder_no is not null
  ) then
    raise exception 'Profilen % har ingen Sveiser-ID', new.profile_id
      using errcode = '23514';
  end if;

  return new;
end;$$;


ALTER FUNCTION "public"."enforce_profile_has_welder_no"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$begin
  insert into public.profiles (id, display_name, login_enabled, created_at, role)
  values (new.id, 'Bruker', true, now(), 'user')
  on conflict (id) do nothing;

  return new;
end;$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("uid" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$select exists (
select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )$$;


ALTER FUNCTION "public"."is_admin"("uid" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."file_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."file_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bucket" "text" NOT NULL,
    "path" "text" NOT NULL,
    "type" "text" NOT NULL,
    "label" "text",
    "mime_type" "text",
    "size_bytes" bigint,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sha256" "text"
);


ALTER TABLE "public"."files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."material_certificates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "certificate_type" "text" NOT NULL,
    "supplier" "text",
    "heat_numbers" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "file_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cert_type" "text" DEFAULT '3.1'::"text" NOT NULL,
    "material_id" "uuid",
    "filler_type" "text",
    CONSTRAINT "material_certificates_cert_type_check" CHECK (("cert_type" = ANY (ARRAY['2.1'::"text", '2.2'::"text", '3.1'::"text", '3.2'::"text"]))),
    CONSTRAINT "material_certificates_certificate_type_check" CHECK (("certificate_type" = ANY (ARRAY['material'::"text", 'filler'::"text"])))
);


ALTER TABLE "public"."material_certificates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ndt_certificates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "personnel_name" "text" NOT NULL,
    "certificate_no" "text" NOT NULL,
    "ndt_method" "text" NOT NULL,
    "expires_at" "date",
    "pdf_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company" "text" NOT NULL,
    "organization_id" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "file_id" "uuid"
);


ALTER TABLE "public"."ndt_certificates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ndt_report_welders" (
    "report_id" "uuid" NOT NULL,
    "welder_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "weld_count" integer,
    "defect_count" integer
);


ALTER TABLE "public"."ndt_report_welders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ndt_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_id" "uuid",
    "method_id" "uuid",
    "weld_count" integer,
    "defect_count" integer,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title" "text",
    "customer" "text",
    "report_date" "date"
);


ALTER TABLE "public"."ndt_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parameter_customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."parameter_customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parameter_job_titles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."parameter_job_titles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parameter_materials" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "material_code" "text" NOT NULL,
    "material_group" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."parameter_materials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parameter_ndt_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "standard_id" "uuid"
);


ALTER TABLE "public"."parameter_ndt_methods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parameter_standard_fm_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "standard_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."parameter_standard_fm_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parameter_standards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "label" "text" NOT NULL,
    "has_fm_group" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "description" "text",
    "revision" integer,
    "type" "text"
);


ALTER TABLE "public"."parameter_standards" OWNER TO "postgres";


COMMENT ON TABLE "public"."parameter_standards" IS 'Oversikt over standarder';



CREATE TABLE IF NOT EXISTS "public"."parameter_suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."parameter_suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parameter_traceability_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."parameter_traceability_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parameter_traceability_types" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "use_dn" boolean DEFAULT false NOT NULL,
    "use_dn2" boolean DEFAULT false NOT NULL,
    "use_sch" boolean DEFAULT false NOT NULL,
    "use_pressure" boolean DEFAULT false NOT NULL,
    "use_thickness" boolean DEFAULT false NOT NULL,
    "use_filler_type" boolean DEFAULT false NOT NULL,
    "default_sch" "text",
    "default_pressure" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."parameter_traceability_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parameter_welding_processes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "label" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."parameter_welding_processes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "display_name" "text",
    "login_enabled" boolean DEFAULT true,
    "welder_no" "text",
    "role" "text" DEFAULT 'user'::"text",
    "job_title" "text",
    "email" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'User profile data - roles managed in organization_members per organization';



COMMENT ON COLUMN "public"."profiles"."role" IS 'Brukerens rolle';



CREATE TABLE IF NOT EXISTS "public"."project_drawings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "file_id" "uuid" NOT NULL,
    "drawing_no" "text" NOT NULL,
    "revision" "text" DEFAULT 'A'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_drawings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_traceability" (
    "id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "type_code" "text" NOT NULL,
    "dn" "text",
    "dn2" "text",
    "sch" "text",
    "pressure_class" "text",
    "thickness" "text",
    "filler_type" "text",
    "material_certificate_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "code_index" integer,
    "material_id" "uuid",
    "heat_number" "text"
);


ALTER TABLE "public"."project_traceability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_weld_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "drawing_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_weld_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_welds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "log_id" "uuid" NOT NULL,
    "weld_no" integer NOT NULL,
    "joint_type" "text",
    "component_a_id" "uuid",
    "component_b_id" "uuid",
    "welder_id" "uuid",
    "wps_id" "uuid",
    "weld_date" "date",
    "filler_traceability_id" "uuid",
    "visual_inspector" "text",
    "crack_inspector" "text",
    "crack_report_id" "uuid",
    "crack_report_no" "text",
    "volumetric_inspector" "text",
    "volumetric_report_id" "uuid",
    "volumetric_report_no" "text",
    "status" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "welder_cert_id" "uuid"
);


ALTER TABLE "public"."project_welds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_no" integer NOT NULL,
    "work_order" "text" NOT NULL,
    "customer" "text" NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "projects_project_no_range" CHECK ((("project_no" >= 1) AND ("project_no" <= 10000)))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."welder_certificates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "certificate_no" "text" NOT NULL,
    "standard" "text" NOT NULL,
    "coverage_joint_type" "text",
    "coverage_thickness" "text",
    "expires_at" "date",
    "pdf_path" "text",
    "pdf_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fm_group" "text",
    "organization_id" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "base_material_id" "uuid",
    "file_id" "uuid"
);


ALTER TABLE "public"."welder_certificates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wpqr" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "doc_no" "text" NOT NULL,
    "materiale" "text",
    "fuge" "text" NOT NULL,
    "tykkelse" "text" NOT NULL,
    "process" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "material_id" "uuid",
    "file_id" "uuid",
    "standard_id" "uuid"
);


ALTER TABLE "public"."wpqr" OWNER TO "postgres";


COMMENT ON COLUMN "public"."wpqr"."organization_id" IS 'Defaults to Ti-Tech, ready for multi-tenant';



CREATE TABLE IF NOT EXISTS "public"."wps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "doc_no" "text" NOT NULL,
    "materiale" "text",
    "fuge" "text" NOT NULL,
    "tykkelse" "text" NOT NULL,
    "process" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "wpqr_id" "uuid",
    "organization_id" "uuid" DEFAULT '00000000-0000-0000-0000-000000000001'::"uuid",
    "material_id" "uuid",
    "file_id" "uuid",
    "standard_id" "uuid"
);


ALTER TABLE "public"."wps" OWNER TO "postgres";


ALTER TABLE ONLY "public"."file_links"
    ADD CONSTRAINT "file_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_links"
    ADD CONSTRAINT "file_links_unique" UNIQUE ("file_id", "entity_type", "entity_id");



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_bucket_path_key" UNIQUE ("bucket", "path");



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parameter_job_titles"
    ADD CONSTRAINT "job_titles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parameter_job_titles"
    ADD CONSTRAINT "job_titles_title_key" UNIQUE ("title");



ALTER TABLE ONLY "public"."material_certificates"
    ADD CONSTRAINT "material_certificates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parameter_materials"
    ADD CONSTRAINT "materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ndt_certificates"
    ADD CONSTRAINT "ndt_certificates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ndt_report_welders"
    ADD CONSTRAINT "ndt_report_welders_pkey" PRIMARY KEY ("report_id", "welder_id");



ALTER TABLE ONLY "public"."ndt_reports"
    ADD CONSTRAINT "ndt_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parameter_customers"
    ADD CONSTRAINT "parameter_customers_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."parameter_customers"
    ADD CONSTRAINT "parameter_customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parameter_ndt_methods"
    ADD CONSTRAINT "parameter_ndt_methods_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."parameter_ndt_methods"
    ADD CONSTRAINT "parameter_ndt_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parameter_standard_fm_groups"
    ADD CONSTRAINT "parameter_standard_fm_groups_unique" UNIQUE ("standard_id", "label");



ALTER TABLE ONLY "public"."parameter_standards"
    ADD CONSTRAINT "parameter_standards_label_revision_key" UNIQUE ("label", "revision");



ALTER TABLE ONLY "public"."parameter_suppliers"
    ADD CONSTRAINT "parameter_suppliers_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."parameter_suppliers"
    ADD CONSTRAINT "parameter_suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parameter_traceability_options"
    ADD CONSTRAINT "parameter_traceability_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parameter_traceability_types"
    ADD CONSTRAINT "parameter_traceability_types_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."parameter_welding_processes"
    ADD CONSTRAINT "parameter_welding_processes_label_key" UNIQUE ("label");



ALTER TABLE ONLY "public"."parameter_welding_processes"
    ADD CONSTRAINT "parameter_welding_processes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_drawings"
    ADD CONSTRAINT "project_drawings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_traceability"
    ADD CONSTRAINT "project_traceability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_weld_logs"
    ADD CONSTRAINT "project_weld_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_welds"
    ADD CONSTRAINT "project_welds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_project_no_key" UNIQUE ("project_no");



ALTER TABLE ONLY "public"."parameter_standard_fm_groups"
    ADD CONSTRAINT "standard_fm_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parameter_standards"
    ADD CONSTRAINT "standards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."welder_certificates"
    ADD CONSTRAINT "welder_certificates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wpqr"
    ADD CONSTRAINT "wpqr_doc_no_unique" UNIQUE ("doc_no");



ALTER TABLE ONLY "public"."wpqr"
    ADD CONSTRAINT "wpqr_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wps"
    ADD CONSTRAINT "wps_doc_no_unique" UNIQUE ("doc_no");



ALTER TABLE ONLY "public"."wps"
    ADD CONSTRAINT "wps_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_file_links_entity" ON "public"."file_links" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_file_links_file" ON "public"."file_links" USING "btree" ("file_id");



CREATE INDEX "idx_files_created_at" ON "public"."files" USING "btree" ("created_at");



CREATE UNIQUE INDEX "idx_files_sha256_unique" ON "public"."files" USING "btree" ("sha256") WHERE ("sha256" IS NOT NULL);



CREATE INDEX "idx_files_type" ON "public"."files" USING "btree" ("type");



CREATE INDEX "idx_material_certificates_cert_type" ON "public"."material_certificates" USING "btree" ("cert_type");



CREATE INDEX "idx_material_certificates_created_at" ON "public"."material_certificates" USING "btree" ("created_at");



CREATE INDEX "idx_material_certificates_file_id" ON "public"."material_certificates" USING "btree" ("file_id");



CREATE INDEX "idx_material_certificates_filler_type" ON "public"."material_certificates" USING "btree" ("filler_type");



CREATE INDEX "idx_material_certificates_material_id" ON "public"."material_certificates" USING "btree" ("material_id");



CREATE INDEX "idx_material_certificates_supplier" ON "public"."material_certificates" USING "btree" ("supplier");



CREATE INDEX "idx_material_certificates_type" ON "public"."material_certificates" USING "btree" ("certificate_type");



CREATE INDEX "idx_ndt_certificates_org" ON "public"."ndt_certificates" USING "btree" ("organization_id");



CREATE INDEX "idx_ndt_report_welders_welder" ON "public"."ndt_report_welders" USING "btree" ("welder_id");



CREATE INDEX "idx_ndt_reports_created_at" ON "public"."ndt_reports" USING "btree" ("created_at");



CREATE INDEX "idx_ndt_reports_method" ON "public"."ndt_reports" USING "btree" ("method_id");



CREATE INDEX "idx_parameter_customers_active" ON "public"."parameter_customers" USING "btree" ("is_active");



CREATE INDEX "idx_parameter_customers_sort" ON "public"."parameter_customers" USING "btree" ("sort_order");



CREATE INDEX "idx_parameter_job_titles_active" ON "public"."parameter_job_titles" USING "btree" ("is_active");



CREATE INDEX "idx_parameter_materials_active" ON "public"."parameter_materials" USING "btree" ("is_active");



CREATE INDEX "idx_parameter_materials_sort" ON "public"."parameter_materials" USING "btree" ("sort_order");



CREATE INDEX "idx_parameter_ndt_methods_active" ON "public"."parameter_ndt_methods" USING "btree" ("is_active");



CREATE INDEX "idx_parameter_ndt_methods_sort" ON "public"."parameter_ndt_methods" USING "btree" ("sort_order");



CREATE INDEX "idx_parameter_ndt_methods_standard" ON "public"."parameter_ndt_methods" USING "btree" ("standard_id");



CREATE INDEX "idx_parameter_standard_fm_groups_sort" ON "public"."parameter_standard_fm_groups" USING "btree" ("sort_order");



CREATE INDEX "idx_parameter_standard_fm_groups_standard" ON "public"."parameter_standard_fm_groups" USING "btree" ("standard_id");



CREATE INDEX "idx_parameter_standards_sort" ON "public"."parameter_standards" USING "btree" ("sort_order");



CREATE INDEX "idx_parameter_suppliers_active" ON "public"."parameter_suppliers" USING "btree" ("is_active");



CREATE INDEX "idx_parameter_suppliers_sort" ON "public"."parameter_suppliers" USING "btree" ("sort_order");



CREATE INDEX "idx_parameter_traceability_options_group" ON "public"."parameter_traceability_options" USING "btree" ("group_key");



CREATE INDEX "idx_parameter_welding_processes_active" ON "public"."parameter_welding_processes" USING "btree" ("is_active");



CREATE INDEX "idx_parameter_welding_processes_sort" ON "public"."parameter_welding_processes" USING "btree" ("sort_order");



CREATE INDEX "idx_project_drawings_created_at" ON "public"."project_drawings" USING "btree" ("created_at");



CREATE INDEX "idx_project_drawings_project" ON "public"."project_drawings" USING "btree" ("project_id");



CREATE INDEX "idx_project_traceability_heat_number" ON "public"."project_traceability" USING "btree" ("heat_number");



CREATE INDEX "idx_project_traceability_material_id" ON "public"."project_traceability" USING "btree" ("material_id");



CREATE INDEX "idx_project_traceability_project" ON "public"."project_traceability" USING "btree" ("project_id");



CREATE INDEX "idx_project_traceability_type_seq" ON "public"."project_traceability" USING "btree" ("project_id", "type_code", "code_index");



CREATE INDEX "idx_project_weld_logs_drawing" ON "public"."project_weld_logs" USING "btree" ("drawing_id");



CREATE INDEX "idx_project_weld_logs_project" ON "public"."project_weld_logs" USING "btree" ("project_id");



CREATE INDEX "idx_project_welds_log" ON "public"."project_welds" USING "btree" ("log_id");



CREATE INDEX "idx_project_welds_status" ON "public"."project_welds" USING "btree" ("status");



CREATE INDEX "idx_project_welds_welder_cert_id" ON "public"."project_welds" USING "btree" ("welder_cert_id");



CREATE INDEX "idx_projects_active" ON "public"."projects" USING "btree" ("is_active");



CREATE INDEX "idx_projects_created_at" ON "public"."projects" USING "btree" ("created_at");



CREATE INDEX "idx_projects_project_no" ON "public"."projects" USING "btree" ("project_no");



CREATE INDEX "idx_welder_certificates_org" ON "public"."welder_certificates" USING "btree" ("organization_id");



CREATE INDEX "idx_wpqr_org" ON "public"."wpqr" USING "btree" ("organization_id");



CREATE INDEX "idx_wps_org" ON "public"."wps" USING "btree" ("organization_id");



CREATE INDEX "ndt_certificates_expires_at_idx" ON "public"."ndt_certificates" USING "btree" ("expires_at");



CREATE INDEX "ndt_certificates_method_idx" ON "public"."ndt_certificates" USING "btree" ("ndt_method");



CREATE UNIQUE INDEX "profiles_welder_no_unique" ON "public"."profiles" USING "btree" ("welder_no") WHERE ("welder_no" IS NOT NULL);



CREATE UNIQUE INDEX "uq_project_weld_logs_drawing" ON "public"."project_weld_logs" USING "btree" ("project_id", "drawing_id");



CREATE UNIQUE INDEX "uq_project_welds_log_no" ON "public"."project_welds" USING "btree" ("log_id", "weld_no");



CREATE INDEX "welder_certificates_expires_at_idx" ON "public"."welder_certificates" USING "btree" ("expires_at");



CREATE INDEX "welder_certificates_profile_id_idx" ON "public"."welder_certificates" USING "btree" ("profile_id");



CREATE INDEX "wpqr_doc_no_idx" ON "public"."wpqr" USING "btree" ("doc_no");



CREATE INDEX "wpqr_process_idx" ON "public"."wpqr" USING "btree" ("process");



CREATE INDEX "wps_doc_no_idx" ON "public"."wps" USING "btree" ("doc_no");



CREATE INDEX "wps_process_idx" ON "public"."wps" USING "btree" ("process");



CREATE INDEX "wps_wpqr_id_idx" ON "public"."wps" USING "btree" ("wpqr_id");



CREATE OR REPLACE TRIGGER "trg_enforce_profile_has_welder_no" BEFORE INSERT OR UPDATE OF "profile_id" ON "public"."welder_certificates" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_profile_has_welder_no"();



ALTER TABLE ONLY "public"."file_links"
    ADD CONSTRAINT "file_links_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."material_certificates"
    ADD CONSTRAINT "material_certificates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."material_certificates"
    ADD CONSTRAINT "material_certificates_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."material_certificates"
    ADD CONSTRAINT "material_certificates_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."parameter_materials"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ndt_certificates"
    ADD CONSTRAINT "ndt_certificates_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id");



ALTER TABLE ONLY "public"."ndt_report_welders"
    ADD CONSTRAINT "ndt_report_welders_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."ndt_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ndt_report_welders"
    ADD CONSTRAINT "ndt_report_welders_welder_id_fkey" FOREIGN KEY ("welder_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."ndt_reports"
    ADD CONSTRAINT "ndt_reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ndt_reports"
    ADD CONSTRAINT "ndt_reports_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id");



ALTER TABLE ONLY "public"."ndt_reports"
    ADD CONSTRAINT "ndt_reports_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "public"."parameter_ndt_methods"("id");



ALTER TABLE ONLY "public"."parameter_ndt_methods"
    ADD CONSTRAINT "parameter_ndt_methods_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "public"."parameter_standards"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_drawings"
    ADD CONSTRAINT "project_drawings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."project_drawings"
    ADD CONSTRAINT "project_drawings_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id");



ALTER TABLE ONLY "public"."project_drawings"
    ADD CONSTRAINT "project_drawings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_traceability"
    ADD CONSTRAINT "project_traceability_material_certificate_id_fkey" FOREIGN KEY ("material_certificate_id") REFERENCES "public"."material_certificates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_traceability"
    ADD CONSTRAINT "project_traceability_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."parameter_materials"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_traceability"
    ADD CONSTRAINT "project_traceability_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_traceability"
    ADD CONSTRAINT "project_traceability_type_code_fkey" FOREIGN KEY ("type_code") REFERENCES "public"."parameter_traceability_types"("code") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."project_weld_logs"
    ADD CONSTRAINT "project_weld_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."project_weld_logs"
    ADD CONSTRAINT "project_weld_logs_drawing_id_fkey" FOREIGN KEY ("drawing_id") REFERENCES "public"."project_drawings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_weld_logs"
    ADD CONSTRAINT "project_weld_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_welds"
    ADD CONSTRAINT "project_welds_component_a_id_fkey" FOREIGN KEY ("component_a_id") REFERENCES "public"."project_traceability"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_welds"
    ADD CONSTRAINT "project_welds_component_b_id_fkey" FOREIGN KEY ("component_b_id") REFERENCES "public"."project_traceability"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_welds"
    ADD CONSTRAINT "project_welds_crack_report_id_fkey" FOREIGN KEY ("crack_report_id") REFERENCES "public"."ndt_reports"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_welds"
    ADD CONSTRAINT "project_welds_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."project_welds"
    ADD CONSTRAINT "project_welds_filler_traceability_id_fkey" FOREIGN KEY ("filler_traceability_id") REFERENCES "public"."project_traceability"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_welds"
    ADD CONSTRAINT "project_welds_log_id_fkey" FOREIGN KEY ("log_id") REFERENCES "public"."project_weld_logs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_welds"
    ADD CONSTRAINT "project_welds_volumetric_report_id_fkey" FOREIGN KEY ("volumetric_report_id") REFERENCES "public"."ndt_reports"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_welds"
    ADD CONSTRAINT "project_welds_welder_cert_id_fkey" FOREIGN KEY ("welder_cert_id") REFERENCES "public"."welder_certificates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_welds"
    ADD CONSTRAINT "project_welds_welder_id_fkey" FOREIGN KEY ("welder_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_welds"
    ADD CONSTRAINT "project_welds_wps_id_fkey" FOREIGN KEY ("wps_id") REFERENCES "public"."wps"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."parameter_standard_fm_groups"
    ADD CONSTRAINT "standard_fm_groups_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "public"."parameter_standards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."welder_certificates"
    ADD CONSTRAINT "welder_certificates_base_material_id_fkey" FOREIGN KEY ("base_material_id") REFERENCES "public"."parameter_materials"("id");



ALTER TABLE ONLY "public"."welder_certificates"
    ADD CONSTRAINT "welder_certificates_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id");



ALTER TABLE ONLY "public"."welder_certificates"
    ADD CONSTRAINT "welder_certificates_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wpqr"
    ADD CONSTRAINT "wpqr_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id");



ALTER TABLE ONLY "public"."wpqr"
    ADD CONSTRAINT "wpqr_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."parameter_materials"("id");



ALTER TABLE ONLY "public"."wpqr"
    ADD CONSTRAINT "wpqr_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "public"."parameter_standards"("id");



ALTER TABLE ONLY "public"."wps"
    ADD CONSTRAINT "wps_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id");



ALTER TABLE ONLY "public"."wps"
    ADD CONSTRAINT "wps_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."parameter_materials"("id");



ALTER TABLE ONLY "public"."wps"
    ADD CONSTRAINT "wps_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "public"."parameter_standards"("id");



ALTER TABLE ONLY "public"."wps"
    ADD CONSTRAINT "wps_wpqr_fk" FOREIGN KEY ("wpqr_id") REFERENCES "public"."wpqr"("id") ON UPDATE CASCADE ON DELETE SET NULL;



CREATE POLICY "admin_file_links_ALL" ON "public"."file_links" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_files_ALL" ON "public"."files" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_full_access_ndt" ON "public"."ndt_certificates" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_full_access_profiles" ON "public"."profiles" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_full_access_welder_certificates" ON "public"."welder_certificates" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_full_access_wpqr" ON "public"."wpqr" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "admin_full_access_wps" ON "public"."wps" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_material_certificates_ALL" ON "public"."material_certificates" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_ndt_report_welders_ALL" ON "public"."ndt_report_welders" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_ndt_reports_ALL" ON "public"."ndt_reports" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_parameter_customers_ALL" ON "public"."parameter_customers" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_parameter_ndt_methods_ALL" ON "public"."parameter_ndt_methods" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_parameter_suppliers_ALL" ON "public"."parameter_suppliers" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_parameter_traceability_options_ALL" ON "public"."parameter_traceability_options" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_parameter_traceability_types_ALL" ON "public"."parameter_traceability_types" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_parameter_welding_processes_ALL" ON "public"."parameter_welding_processes" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_project_drawings_ALL" ON "public"."project_drawings" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_project_traceability_ALL" ON "public"."project_traceability" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_project_weld_logs_ALL" ON "public"."project_weld_logs" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admin_project_welds_ALL" ON "public"."project_welds" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."file_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."files" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_titles_admin_ALL" ON "public"."parameter_job_titles" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "job_titles_user_select" ON "public"."parameter_job_titles" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."material_certificates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "materials_admin_ALL" ON "public"."parameter_materials" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "materials_user_select" ON "public"."parameter_materials" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."ndt_certificates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ndt_report_welders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ndt_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parameter_customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parameter_job_titles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parameter_materials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parameter_ndt_methods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parameter_standard_fm_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parameter_standards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parameter_suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parameter_traceability_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parameter_traceability_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parameter_welding_processes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_drawings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_traceability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_weld_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_welds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "projects_admin_ALL" ON "public"."projects" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "projects_user_select" ON "public"."projects" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "standard_fm_groups_admin_ALL" ON "public"."parameter_standard_fm_groups" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "standard_fm_groups_user_select" ON "public"."parameter_standard_fm_groups" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "standards_admin_ALL" ON "public"."parameter_standards" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "standards_user_select" ON "public"."parameter_standards" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "user_file_links_select" ON "public"."file_links" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "user_files_select" ON "public"."files" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "user_material_certificates_select" ON "public"."material_certificates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "user_ndt_report_welders_select" ON "public"."ndt_report_welders" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "user_ndt_reports_select" ON "public"."ndt_reports" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "user_parameter_ndt_methods_select" ON "public"."parameter_ndt_methods" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "user_parameter_suppliers_select" ON "public"."parameter_suppliers" FOR SELECT USING (true);



CREATE POLICY "user_parameter_traceability_options_select" ON "public"."parameter_traceability_options" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "user_parameter_traceability_types_select" ON "public"."parameter_traceability_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "user_parameter_welding_processes_select" ON "public"."parameter_welding_processes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "user_paramter_customers_select" ON "public"."parameter_customers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "user_project_drawings_select" ON "public"."project_drawings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "user_project_traceability_insert" ON "public"."project_traceability" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "user_project_traceability_select" ON "public"."project_traceability" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "user_project_weld_logs_insert" ON "public"."project_weld_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "user_project_weld_logs_select" ON "public"."project_weld_logs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "user_project_welds_insert" ON "public"."project_welds" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "user_project_welds_select" ON "public"."project_welds" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "user_select_ndt" ON "public"."ndt_certificates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "user_select_profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "user_select_welder_certificates" ON "public"."welder_certificates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "user_select_wpqr" ON "public"."wpqr" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "user_select_wps" ON "public"."wps" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."welder_certificates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wpqr" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wps" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_profile_has_welder_no"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_profile_has_welder_no"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_profile_has_welder_no"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("uid" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."file_links" TO "anon";
GRANT ALL ON TABLE "public"."file_links" TO "authenticated";
GRANT ALL ON TABLE "public"."file_links" TO "service_role";



GRANT ALL ON TABLE "public"."files" TO "anon";
GRANT ALL ON TABLE "public"."files" TO "authenticated";
GRANT ALL ON TABLE "public"."files" TO "service_role";



GRANT ALL ON TABLE "public"."material_certificates" TO "anon";
GRANT ALL ON TABLE "public"."material_certificates" TO "authenticated";
GRANT ALL ON TABLE "public"."material_certificates" TO "service_role";



GRANT ALL ON TABLE "public"."ndt_certificates" TO "anon";
GRANT ALL ON TABLE "public"."ndt_certificates" TO "authenticated";
GRANT ALL ON TABLE "public"."ndt_certificates" TO "service_role";



GRANT ALL ON TABLE "public"."ndt_report_welders" TO "anon";
GRANT ALL ON TABLE "public"."ndt_report_welders" TO "authenticated";
GRANT ALL ON TABLE "public"."ndt_report_welders" TO "service_role";



GRANT ALL ON TABLE "public"."ndt_reports" TO "anon";
GRANT ALL ON TABLE "public"."ndt_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."ndt_reports" TO "service_role";



GRANT ALL ON TABLE "public"."parameter_customers" TO "anon";
GRANT ALL ON TABLE "public"."parameter_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."parameter_customers" TO "service_role";



GRANT ALL ON TABLE "public"."parameter_job_titles" TO "anon";
GRANT ALL ON TABLE "public"."parameter_job_titles" TO "authenticated";
GRANT ALL ON TABLE "public"."parameter_job_titles" TO "service_role";



GRANT ALL ON TABLE "public"."parameter_materials" TO "anon";
GRANT ALL ON TABLE "public"."parameter_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."parameter_materials" TO "service_role";



GRANT ALL ON TABLE "public"."parameter_ndt_methods" TO "anon";
GRANT ALL ON TABLE "public"."parameter_ndt_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."parameter_ndt_methods" TO "service_role";



GRANT ALL ON TABLE "public"."parameter_standard_fm_groups" TO "anon";
GRANT ALL ON TABLE "public"."parameter_standard_fm_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."parameter_standard_fm_groups" TO "service_role";



GRANT ALL ON TABLE "public"."parameter_standards" TO "anon";
GRANT ALL ON TABLE "public"."parameter_standards" TO "authenticated";
GRANT ALL ON TABLE "public"."parameter_standards" TO "service_role";



GRANT ALL ON TABLE "public"."parameter_suppliers" TO "anon";
GRANT ALL ON TABLE "public"."parameter_suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."parameter_suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."parameter_traceability_options" TO "anon";
GRANT ALL ON TABLE "public"."parameter_traceability_options" TO "authenticated";
GRANT ALL ON TABLE "public"."parameter_traceability_options" TO "service_role";



GRANT ALL ON TABLE "public"."parameter_traceability_types" TO "anon";
GRANT ALL ON TABLE "public"."parameter_traceability_types" TO "authenticated";
GRANT ALL ON TABLE "public"."parameter_traceability_types" TO "service_role";



GRANT ALL ON TABLE "public"."parameter_welding_processes" TO "anon";
GRANT ALL ON TABLE "public"."parameter_welding_processes" TO "authenticated";
GRANT ALL ON TABLE "public"."parameter_welding_processes" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."project_drawings" TO "anon";
GRANT ALL ON TABLE "public"."project_drawings" TO "authenticated";
GRANT ALL ON TABLE "public"."project_drawings" TO "service_role";



GRANT ALL ON TABLE "public"."project_traceability" TO "anon";
GRANT ALL ON TABLE "public"."project_traceability" TO "authenticated";
GRANT ALL ON TABLE "public"."project_traceability" TO "service_role";



GRANT ALL ON TABLE "public"."project_weld_logs" TO "anon";
GRANT ALL ON TABLE "public"."project_weld_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."project_weld_logs" TO "service_role";



GRANT ALL ON TABLE "public"."project_welds" TO "anon";
GRANT ALL ON TABLE "public"."project_welds" TO "authenticated";
GRANT ALL ON TABLE "public"."project_welds" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."welder_certificates" TO "anon";
GRANT ALL ON TABLE "public"."welder_certificates" TO "authenticated";
GRANT ALL ON TABLE "public"."welder_certificates" TO "service_role";



GRANT ALL ON TABLE "public"."wpqr" TO "anon";
GRANT ALL ON TABLE "public"."wpqr" TO "authenticated";
GRANT ALL ON TABLE "public"."wpqr" TO "service_role";



GRANT ALL ON TABLE "public"."wps" TO "anon";
GRANT ALL ON TABLE "public"."wps" TO "authenticated";
GRANT ALL ON TABLE "public"."wps" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






