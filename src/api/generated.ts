/**
 * Generated from the treetop-rest v0.0.12 OpenAPI contract.
 * Do not edit by hand; run npm run api:generate.
 */
export interface paths {
    "/api/v1/authorize": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["authorize"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["health"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/policies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_policies"];
        put?: never;
        post: operations["upload_policies"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/policies/{user}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["list_policies"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/schema": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_schema"];
        put?: never;
        post: operations["upload_schema"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get_status"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/version": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["version"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/livez": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["livez"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["metrics"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/openapi.json": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["openapi_json"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/readyz": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["readyz"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @description An action, possibly with a namespace (e.g. Infra::Action::"delete_vm"). */
        Action: components["schemas"]["QualifiedId"];
        /** @description Attribute values that can be attached to Cedar entities. */
        AttrValue: {
            /** @enum {string} */
            type: "String";
            value: string;
        } | {
            /** @enum {string} */
            type: "Bool";
            value: boolean;
        } | {
            /** @enum {string} */
            type: "Long";
            /** Format: int64 */
            value: number;
        } | {
            /** @enum {string} */
            type: "Ip";
            value: string;
        } | {
            /** @enum {string} */
            type: "Set";
            value: components["schemas"]["AttrValue"][];
        };
        /** @description Single authorization request with optional client-provided ID */
        AuthRequest: components["schemas"]["Request"] & {
            /** @description Optional request-scoped context values. */
            context?: {
                [key: string]: components["schemas"]["AttrValue"];
            } | null;
            /** @description Optional client-provided identifier for this request */
            id?: string | null;
        };
        AuthorizeRequest: {
            /** @description List of authorization requests to evaluate, subject to the server's configured batch limit. */
            requests: components["schemas"]["AuthRequest"][];
        };
        /**
         * @description Container for authorization response results with metadata
         *
         *     Generic over the decision type to support both brief and detailed responses.
         *     All fields are private; use accessor methods to retrieve data.
         */
        AuthorizeResponse: {
            /** @description Number of failed evaluations */
            failed: number;
            /** @description Results for each request with optional client IDs */
            results: components["schemas"]["IndexedResult_AuthorizeDecisionDetailed"][];
            /** @description Number of successful evaluations */
            successful: number;
            /** @description Policy version used for all evaluations */
            version: components["schemas"]["PolicyVersion"];
        };
        /**
         * @description Response from the authorize endpoint - either brief or detailed based on query parameter
         *
         *     Uses tagged serde enum to deserialize into the correct variant.
         */
        AuthorizeResponseVariant: components["schemas"]["AuthorizeResponse"] | components["schemas"]["AuthorizeResponse"];
        /** @description Result of a single batch evaluation - either success or failure */
        BatchResult_AuthorizeDecisionBrief: {
            /** @description Brief authorization decision response with minimal information */
            result: {
                decision: components["schemas"]["DecisionBrief"];
                policy_id: string;
                version: components["schemas"]["PolicyVersion"];
            };
            /** @enum {string} */
            status: "success";
        } | {
            error: string;
            /** @enum {string} */
            status: "failed";
        };
        /** @description Result of a single batch evaluation - either success or failure */
        BatchResult_AuthorizeDecisionDetailed: {
            /** @description Detailed authorization decision including the matching policy */
            result: {
                decision: components["schemas"]["DecisionBrief"];
                policy: components["schemas"]["PermitPolicy"][];
                version: components["schemas"]["PolicyVersion"];
            };
            /** @enum {string} */
            status: "success";
        } | {
            error: string;
            /** @enum {string} */
            status: "failed";
        };
        Core: {
            cedar: string;
            version: string;
        };
        /**
         * @description Brief authorization decision without policy details
         * @enum {string}
         */
        DecisionBrief: "Allow" | "Deny";
        /** @description Network endpoint URL for policy or label service communication */
        Endpoint: {
            /** @example https://example.com/api */
            url: string;
        };
        ErrorDetails: {
            column?: number | null;
            line?: number | null;
        };
        ErrorResponse: {
            code: string;
            details?: null | components["schemas"]["ErrorDetails"];
            error: string;
        };
        /** @description A group identifier (e.g. Group::"devs"). */
        Group: components["schemas"]["QualifiedId"];
        /** @description A collection of Group entries. */
        Groups: components["schemas"]["Group"][];
        HealthOK: Record<string, never>;
        /** @description A single result from a batch operation with its original index and optional client ID */
        IndexedResult_AuthorizeDecisionBrief: components["schemas"]["BatchResult_AuthorizeDecisionBrief"] & {
            /** @description Client-provided identifier for this request (if provided) */
            id?: string | null;
            /** @description Index of the request in the original batch */
            index: number;
        };
        /** @description A single result from a batch operation with its original index and optional client ID */
        IndexedResult_AuthorizeDecisionDetailed: components["schemas"]["BatchResult_AuthorizeDecisionDetailed"] & {
            /** @description Client-provided identifier for this request (if provided) */
            id?: string | null;
            /** @description Index of the request in the original batch */
            index: number;
        };
        Metadata_OfLabels: {
            content: string;
            entries: number;
            /** Format: int32 */
            refresh_frequency?: number | null;
            sha256: string;
            size: number;
            source?: null | components["schemas"]["Endpoint"];
            /** Format: date-time */
            timestamp: string;
        };
        Metadata_OfPolicies: {
            content: string;
            entries: number;
            /** Format: int32 */
            refresh_frequency?: number | null;
            sha256: string;
            size: number;
            source?: null | components["schemas"]["Endpoint"];
            /** Format: date-time */
            timestamp: string;
        };
        Metadata_OfSchema: {
            content: string;
            entries: number;
            /** Format: int32 */
            refresh_frequency?: number | null;
            sha256: string;
            size: number;
            source?: null | components["schemas"]["Endpoint"];
            /** Format: date-time */
            timestamp: string;
        };
        ParallelConfig: {
            allow_parallel: boolean;
            cpu_count: number;
            par_threshold: number;
            rayon_threads: number;
            workers: number;
        };
        /** @description A permit policy that permitted a specific action on a resource. */
        PermitPolicy: {
            annotation_id?: string | null;
            cedar_id: string;
            json: unknown;
            literal: string;
        };
        /** @description Policy data for download */
        PoliciesDownload: {
            policies: components["schemas"]["Metadata_OfPolicies"];
        };
        /** @description Metadata about the policies and labels in the policy store */
        PoliciesMetadata: {
            allow_upload: boolean;
            labels: components["schemas"]["Metadata_OfLabels"];
            policies: components["schemas"]["Metadata_OfPolicies"];
            schema: components["schemas"]["Metadata_OfSchema"];
            schema_validation_mode: string;
        };
        /** @description Match metadata for one listed policy. */
        PolicyMatch: {
            cedar_id: string;
            reasons: components["schemas"]["PolicyMatchReason"][];
        };
        /**
         * @description Why a policy was selected by list policies APIs.
         * @enum {string}
         */
        PolicyMatchReason: "PrincipalEq" | "PrincipalIn" | "PrincipalAny" | "PrincipalIs" | "PrincipalIsIn" | "ActionEq" | "ActionIn" | "ActionAny" | "ResourceEq" | "ResourceIn" | "ResourceAny" | "ResourceIs" | "ResourceIsIn";
        /** @description Version metadata for the policy set used during an evaluation. */
        PolicyVersion: {
            /** @description Hash of the policy source (e.g. SHA-256 of the policy text). */
            hash: string;
            /** @description When this policy set was loaded into the engine. */
            loaded_at: string;
        };
        /** @description A principal for a policy query. */
        Principal: {
            User: components["schemas"]["User"];
        } | {
            Group: components["schemas"]["Group"];
        };
        /** @description A fully‐qualified identifier, with zero runtime cost over `(Vec<String>, String)`. */
        QualifiedId: {
            id: string;
            namespace: string[];
        };
        /** @description The API-level request, with strongly-typed principal, action, groups, resource, and context. */
        Request: {
            action: components["schemas"]["Action"];
            principal: components["schemas"]["Principal"];
            resource: components["schemas"]["Resource"];
        };
        /** @enum {string} */
        RequestContextFallbackReason: "no_schema" | "schema_incompatible";
        RequestContextStatus: {
            fallback_reason?: null | components["schemas"]["RequestContextFallbackReason"];
            schema_backed: boolean;
            supported: boolean;
        };
        RequestLimits: {
            max_batch_size?: number | null;
            max_context_bytes: number;
            max_context_depth: number;
            max_context_keys: number;
        };
        /** @description A resource entity in the Cedar policy model. */
        Resource: {
            /** @description Arbitrary attributes to attach to the resource entity */
            attrs?: {
                [key: string]: components["schemas"]["AttrValue"];
            };
            /** @description Entity id (quotes are added when rendering the Cedar literal) */
            id: string;
            /** @description Entity type, possibly namespaced: e.g. "Host", "Gateway", or "Database::Table" */
            kind: string;
        };
        /** @description Schema data for download */
        SchemaDownload: {
            schema: components["schemas"]["Metadata_OfSchema"];
        };
        /** @description A Cedar schema supplied as either a JSON wrapper or a raw JSON document */
        SchemaUpload: {
            schema: string;
        } | Record<string, never>;
        SchemaVersionInfo: {
            hash: string;
            loaded_at: string;
        };
        StatusResponse: {
            parallel_configuration: components["schemas"]["ParallelConfig"];
            policy_configuration: components["schemas"]["PoliciesMetadata"];
            request_context?: components["schemas"]["RequestContextStatus"];
            request_limits?: components["schemas"]["RequestLimits"];
        };
        Upload: {
            policies: string;
        };
        /** @description A user principal, possibly with a namespace (e.g. Application::User::"alice"). */
        User: components["schemas"]["QualifiedId"] & {
            groups: components["schemas"]["Groups"];
        };
        /** @description Policies associated with a specific user */
        UserPolicies: {
            matches: components["schemas"]["PolicyMatch"][];
            policies: unknown[];
            user: string;
        };
        VersionInfo: {
            core: components["schemas"]["Core"];
            policies: components["schemas"]["PolicyVersion"];
            schema?: null | components["schemas"]["SchemaVersionInfo"];
            version: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    authorize: {
        parameters: {
            query?: {
                /** @description Response detail level: 'brief' (default) or 'full' */
                detail?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description Authorization checks, limited by the configured maximum batch size */
        requestBody: {
            content: {
                "application/json": components["schemas"]["AuthorizeRequest"];
            };
        };
        responses: {
            /** @description Authorize performed successfully */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthorizeResponseVariant"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    health: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Process is live (legacy endpoint) */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthOK"];
                };
            };
        };
    };
    get_policies: {
        parameters: {
            query?: {
                /** @description Response format: 'json' (default) or 'raw'/'text' for plain text */
                format?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Policies retrieved successfully */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PoliciesDownload"];
                    "text/plain": string;
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    upload_policies: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description Cedar policies as a JSON wrapper or plain Cedar text */
        requestBody: {
            content: {
                "application/json": components["schemas"]["Upload"];
                "text/plain": string;
            };
        };
        responses: {
            /** @description Policies uploaded successfully */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PoliciesMetadata"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Uploads are disabled or the upload token is invalid */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    list_policies: {
        parameters: {
            query?: {
                /** @description List of group names */
                groups?: string[];
                /** @description List of namespaces */
                namespaces?: string[];
                /** @description Response format: 'json' (default) or 'raw'/'text' for plain text */
                format?: string;
            };
            header?: never;
            path: {
                /** @description User principal identifier */
                user: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Policies for user retrieved successfully */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserPolicies"];
                    "text/plain": string;
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    get_schema: {
        parameters: {
            query?: {
                /** @description Response format: 'json' (default) or 'raw'/'text' for plain text */
                format?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Schema retrieved successfully */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SchemaDownload"];
                    "text/plain": string;
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    upload_schema: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description Cedar schema as a JSON wrapper, raw JSON document, or plain text */
        requestBody: {
            content: {
                "application/json": components["schemas"]["SchemaUpload"];
                "text/plain": string;
            };
        };
        responses: {
            /** @description Schema uploaded successfully */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PoliciesMetadata"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Uploads are disabled or the upload token is invalid */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    get_status: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Service status retrieved successfully */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StatusResponse"];
                };
            };
            /** @description Bad request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Internal server error */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    version: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Version information */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VersionInfo"];
                };
            };
        };
    };
    livez: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Process is live */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": string;
                };
            };
        };
    };
    metrics: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OpenMetrics text, including authorization batch-size metrics, or Prometheus protobuf with native histograms when requested by Accept */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/openmetrics-text": string;
                    "application/vnd.google.protobuf": string;
                };
            };
        };
    };
    openapi_json: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OpenAPI specification for the Treetop REST API */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    readyz: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Service is ready to accept traffic */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": string;
                };
            };
            /** @description Service is not ready to accept traffic */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/plain": string;
                };
            };
        };
    };
}
